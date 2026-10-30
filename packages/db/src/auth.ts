import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, asc, count, eq, gt, lt, ne, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { apiTokens, invites, loginAttempts, sessions, users } from './tables.ts'

export type Role = 'admin' | 'editor'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  /** Signs in with a code from an authenticator app too. */
  twoFactor: boolean
}

/** A signed-in device, as listed in Profilo → Sicurezza. */
export interface DeviceSession {
  /** The hash of the session token: safe to show, useless to sign in. */
  id: string
  userAgent: string | null
  ip: string | null
  createdAt: Date
  lastSeenAt: Date
}

type UserRow = typeof users.$inferSelect
const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role,
  twoFactor: !!row.totpSecret,
})

export interface Member extends User {
  createdAt: Date
  /** Most recent sign-in, if any. */
  lastSeenAt: Date | null
}

export interface Invite {
  id: string
  kind: 'invite' | 'reset'
  email: string
  name: string
  role: Role
  userId: string | null
  createdAt: Date
  expiresAt: Date
}

/** A personal access token as listed: the secret itself is shown only once, when created. */
export interface ApiToken {
  id: string
  name: string
  /** The last characters of the secret, to tell tokens apart. */
  hint: string
  createdAt: Date
  lastUsedAt: Date | null
}

/** Prefix of every personal access token, so they are easy to recognise (and to scan for if leaked). */
export const TOKEN_PREFIX = 'mzp_'

/** Raised when an email already belongs to someone. */
export class EmailTakenError extends Error {
  constructor(email: string) {
    super(`${email} already has an account`)
    this.name = 'EmailTakenError'
  }
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url')
/** Recovery codes are compared without dashes, spaces or case. */
const hashCode = (code: string) => hashToken(code.replace(/[\s-]/g, '').toLowerCase())

export function createAuthStore(db: Db) {
  return {
    async countUsers(): Promise<number> {
      const [row] = await db.select({ n: count() }).from(users)
      return row?.n ?? 0
    },

    async createUser(input: { email: string; name: string; role: Role; passwordHash: string }): Promise<User> {
      const user = {
        id: randomUUID(),
        email: input.email.trim().toLowerCase(),
        name: input.name.trim(),
        role: input.role,
      }
      await db.insert(users).values({ ...user, passwordHash: input.passwordHash, createdAt: new Date() })
      return { ...user, twoFactor: false }
    },

    async findForLogin(email: string): Promise<(User & { passwordHash: string }) | null> {
      const row = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) })
      return row ? { ...toUser(row), passwordHash: row.passwordHash } : null
    },

    /** Returns the raw token for the cookie; only its hash is stored. */
    async createSession(
      userId: string,
      ttlMs: number,
      device: { userAgent?: string | null; ip?: string | null } = {},
    ): Promise<{ token: string; expiresAt: Date }> {
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + ttlMs)
      const now = new Date()
      await db.insert(sessions).values({
        id: hashToken(token),
        userId,
        expiresAt,
        createdAt: now,
        lastSeenAt: now,
        userAgent: device.userAgent?.slice(0, 300) ?? null,
        ip: device.ip ?? null,
      })
      await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId))
      return { token, expiresAt }
    },

    /**
     * Who a session belongs to. It ends when it expires or when it has not been used for
     * `idleMs`; use is noted at most every few minutes.
     */
    async userForSession(token: string, idleMs = Number.POSITIVE_INFINITY): Promise<User | null> {
      const session = await db.query.sessions.findFirst({ where: eq(sessions.id, hashToken(token)) })
      if (!session) return null
      const now = Date.now()
      const seen = (session.lastSeenAt ?? session.createdAt).getTime()
      if (session.expiresAt.getTime() < now || now - seen > idleMs) {
        await db.delete(sessions).where(eq(sessions.id, session.id))
        return null
      }
      if (now - seen > 5 * 60_000)
        await db
          .update(sessions)
          .set({ lastSeenAt: new Date(now) })
          .where(eq(sessions.id, session.id))
      const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
      return user ? toUser(user) : null
    },

    /** The id under which a session is listed. */
    sessionId: (token: string) => hashToken(token),

    async listSessions(userId: string): Promise<DeviceSession[]> {
      const rows = await db.query.sessions.findMany({
        where: and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())),
      })
      return rows
        .map((r) => ({
          id: r.id,
          userAgent: r.userAgent ?? null,
          ip: r.ip ?? null,
          createdAt: r.createdAt,
          lastSeenAt: r.lastSeenAt ?? r.createdAt,
        }))
        .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime())
    },

    /** Signs one device out; only its owner can. */
    async endSession(userId: string, id: string): Promise<boolean> {
      const res = await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
      return res.rowsAffected > 0
    },

    /** Signs every device out, except the session given. */
    async endOtherSessions(userId: string, keepToken?: string): Promise<number> {
      const res = await db
        .delete(sessions)
        .where(and(eq(sessions.userId, userId), keepToken ? ne(sessions.id, hashToken(keepToken)) : undefined))
      return res.rowsAffected
    },

    // ---------- two-step verification ----------

    async twoFactorOf(userId: string) {
      const row = await db.query.users.findFirst({ where: eq(users.id, userId) })
      return row
        ? {
            secret: row.totpSecret ?? null,
            pending: row.totpPending ?? null,
            lastStep: row.totpLastStep ?? null,
            recoveryLeft: row.recoveryCodes?.length ?? 0,
          }
        : null
    },

    /** A new secret during setup, not in use until a first code confirms it. */
    async setPendingSecret(userId: string, secret: string | null): Promise<void> {
      await db.update(users).set({ totpPending: secret }).where(eq(users.id, userId))
    },

    /** The pending secret becomes the one in use, with fresh recovery codes (stored as hashes). */
    async enableTwoFactor(userId: string, step: number, recoveryCodes: string[]): Promise<void> {
      const row = await db.query.users.findFirst({ where: eq(users.id, userId) })
      if (!row?.totpPending) return
      await db
        .update(users)
        .set({
          totpSecret: row.totpPending,
          totpPending: null,
          totpLastStep: step,
          recoveryCodes: recoveryCodes.map(hashCode),
        })
        .where(eq(users.id, userId))
    },

    async disableTwoFactor(userId: string): Promise<void> {
      await db
        .update(users)
        .set({ totpSecret: null, totpPending: null, totpLastStep: null, recoveryCodes: null })
        .where(eq(users.id, userId))
    },

    /** Notes the time step of an accepted code, so the same code cannot be used again. */
    async useStep(userId: string, step: number): Promise<void> {
      await db.update(users).set({ totpLastStep: step }).where(eq(users.id, userId))
    },

    async setRecoveryCodes(userId: string, codes: string[]): Promise<void> {
      await db
        .update(users)
        .set({ recoveryCodes: codes.map(hashCode) })
        .where(eq(users.id, userId))
    },

    /** A recovery code works once: true when it was valid (and is now spent). */
    async useRecoveryCode(userId: string, code: string): Promise<boolean> {
      const row = await db.query.users.findFirst({ where: eq(users.id, userId) })
      const hash = hashCode(code)
      if (!row?.recoveryCodes?.includes(hash)) return false
      await db
        .update(users)
        .set({ recoveryCodes: row.recoveryCodes.filter((h) => h !== hash) })
        .where(eq(users.id, userId))
      return true
    },

    // ---------- failed sign-ins ----------

    /** Until when a key (an email, an address) is locked, if it is. */
    async lockedUntil(key: string): Promise<Date | null> {
      const row = await db.query.loginAttempts.findFirst({ where: eq(loginAttempts.key, key) })
      return row?.lockedUntil && row.lockedUntil.getTime() > Date.now() ? row.lockedUntil : null
    },

    /**
     * Counts a failure. From `threshold` failures on, the key is locked for a time that doubles
     * with each further failure (1, 2, 4… minutes, at most an hour). Failures are forgotten
     * after a day without any.
     */
    async recordFailure(key: string, threshold: number): Promise<{ failures: number; lockedUntil: Date | null }> {
      const now = Date.now()
      const row = await db.query.loginAttempts.findFirst({ where: eq(loginAttempts.key, key) })
      const fresh = !row || now - row.updatedAt.getTime() > 24 * 60 * 60_000
      const failures = fresh ? 1 : row.failures + 1
      const lockedUntil =
        failures >= threshold ? new Date(now + Math.min(60, 2 ** (failures - threshold)) * 60_000) : null
      await db
        .insert(loginAttempts)
        .values({ key, failures, lockedUntil, updatedAt: new Date(now) })
        .onConflictDoUpdate({ target: loginAttempts.key, set: { failures, lockedUntil, updatedAt: new Date(now) } })
      return { failures, lockedUntil }
    },

    async clearFailures(key: string): Promise<void> {
      await db.delete(loginAttempts).where(eq(loginAttempts.key, key))
    },

    /** A new personal access token for someone: returns the secret, which is never stored. */
    async createToken(userId: string, name: string): Promise<{ token: string; record: ApiToken }> {
      const token = `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
      const record = {
        id: randomUUID(),
        name: name.trim(),
        hint: token.slice(-4),
        createdAt: new Date(),
        lastUsedAt: null,
      }
      await db.insert(apiTokens).values({ ...record, userId, tokenHash: hashToken(token) })
      return { token, record }
    },

    async listTokens(userId: string): Promise<ApiToken[]> {
      const rows = await db.query.apiTokens.findMany({
        where: eq(apiTokens.userId, userId),
        orderBy: asc(apiTokens.createdAt),
      })
      return rows.map(({ id, name, hint, createdAt, lastUsedAt }) => ({ id, name, hint, createdAt, lastUsedAt }))
    },

    /** Only the owner can revoke a token. */
    async revokeToken(id: string, userId: string): Promise<boolean> {
      const res = await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)))
      return res.rowsAffected > 0
    },

    /** Who a token belongs to; notes when it was last used (at most once a minute). */
    async userForToken(token: string): Promise<User | null> {
      if (!token.startsWith(TOKEN_PREFIX)) return null
      const row = await db.query.apiTokens.findFirst({ where: eq(apiTokens.tokenHash, hashToken(token)) })
      if (!row) return null
      const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) })
      if (!user) return null
      const now = Date.now()
      if (!row.lastUsedAt || now - row.lastUsedAt.getTime() > 60_000)
        await db
          .update(apiTokens)
          .set({ lastUsedAt: new Date(now) })
          .where(eq(apiTokens.id, row.id))
      return toUser(user)
    },

    async deleteSession(token: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
    },

    async purgeExpiredSessions(): Promise<void> {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    },

    // ---------- people ----------

    async listUsers(): Promise<Member[]> {
      const rows = await db.select().from(users).orderBy(asc(users.createdAt), asc(sql`rowid`))
      return rows.map((r) => ({ ...toUser(r), createdAt: r.createdAt, lastSeenAt: r.lastSeenAt ?? null }))
    },

    async getUser(id: string): Promise<User | null> {
      const row = await db.query.users.findFirst({ where: eq(users.id, id) })
      return row ? toUser(row) : null
    },

    async getPasswordHash(id: string): Promise<string | null> {
      return (await db.query.users.findFirst({ where: eq(users.id, id) }))?.passwordHash ?? null
    },

    async countAdmins(): Promise<number> {
      const [row] = await db.select({ n: count() }).from(users).where(eq(users.role, 'admin'))
      return row?.n ?? 0
    },

    /** Changes name, role or email; an email someone else already uses raises EmailTakenError. */
    async updateUser(id: string, input: { name?: string; role?: Role; email?: string }): Promise<User | null> {
      const change: { name?: string; role?: Role; email?: string } = {}
      if (input.name !== undefined) change.name = input.name.trim()
      if (input.role !== undefined) change.role = input.role
      if (input.email !== undefined) {
        const email = input.email.trim().toLowerCase()
        const owner = await db.query.users.findFirst({ where: eq(users.email, email) })
        if (owner && owner.id !== id) throw new EmailTakenError(email)
        change.email = email
      }
      if (Object.keys(change).length) await db.update(users).set(change).where(eq(users.id, id))
      return this.getUser(id)
    },

    async deleteUser(id: string): Promise<boolean> {
      return (await db.delete(users).where(eq(users.id, id))).rowsAffected > 0
    },

    /** Sets a new password and signs the user out everywhere, except the session given. */
    async setPassword(id: string, passwordHash: string, keepSession?: string): Promise<void> {
      await db.update(users).set({ passwordHash }).where(eq(users.id, id))
      await db
        .delete(sessions)
        .where(and(eq(sessions.userId, id), keepSession ? ne(sessions.id, hashToken(keepSession)) : undefined))
    },

    async emailTaken(email: string): Promise<boolean> {
      return !!(await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) }))
    },

    // ---------- invitations and resets ----------

    /** Returns the raw token for the link; only its hash is stored. Replaces earlier links of the same kind. */
    async createInvite(input: {
      kind: Invite['kind']
      email: string
      name?: string
      role: Role
      userId?: string
      createdBy?: string
      ttlMs: number
    }): Promise<{ token: string; invite: Invite }> {
      const email = input.email.trim().toLowerCase()
      if (input.kind === 'invite' && (await this.emailTaken(email))) throw new EmailTakenError(email)
      await db.delete(invites).where(and(eq(invites.email, email), eq(invites.kind, input.kind)))
      const token = randomBytes(32).toString('base64url')
      const invite = {
        id: hashToken(token),
        kind: input.kind,
        email,
        name: input.name?.trim() ?? '',
        role: input.role,
        userId: input.userId ?? null,
        createdBy: input.createdBy ?? null,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + input.ttlMs),
      }
      await db.insert(invites).values(invite)
      const { createdBy: _, ...publicInvite } = invite
      return { token, invite: publicInvite }
    },

    async pendingInvites(): Promise<Invite[]> {
      const rows = await db
        .select()
        .from(invites)
        .where(and(eq(invites.kind, 'invite'), gt(invites.expiresAt, new Date())))
        .orderBy(asc(invites.createdAt))
      return rows.map(({ createdBy: _, ...r }) => r)
    },

    async findInvite(token: string): Promise<Invite | null> {
      const row = await db.query.invites.findFirst({ where: eq(invites.id, hashToken(token)) })
      if (!row || row.expiresAt.getTime() < Date.now()) return null
      const { createdBy: _, ...invite } = row
      return invite
    },

    async revokeInvite(id: string): Promise<boolean> {
      return (await db.delete(invites).where(eq(invites.id, id))).rowsAffected > 0
    },

    /** A link works once. */
    async consumeInvite(token: string): Promise<void> {
      await db.delete(invites).where(eq(invites.id, hashToken(token)))
    },
  }
}

export type AuthStore = ReturnType<typeof createAuthStore>
