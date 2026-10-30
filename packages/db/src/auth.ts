import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, asc, count, eq, gt, lt, ne, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { apiTokens, invites, sessions, users } from './tables.ts'

export type Role = 'admin' | 'editor'

export interface User {
  id: string
  email: string
  name: string
  role: Role
}

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
      return user
    },

    async findForLogin(email: string): Promise<(User & { passwordHash: string }) | null> {
      const row = await db.query.users.findFirst({ where: eq(users.email, email.trim().toLowerCase()) })
      return row
        ? { id: row.id, email: row.email, name: row.name, role: row.role, passwordHash: row.passwordHash }
        : null
    },

    /** Returns the raw token for the cookie; only its hash is stored. */
    async createSession(userId: string, ttlMs: number): Promise<{ token: string; expiresAt: Date }> {
      const token = randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + ttlMs)
      const now = new Date()
      await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, createdAt: now })
      await db.update(users).set({ lastSeenAt: now }).where(eq(users.id, userId))
      return { token, expiresAt }
    },

    async userForSession(token: string): Promise<User | null> {
      const session = await db.query.sessions.findFirst({ where: eq(sessions.id, hashToken(token)) })
      if (!session) return null
      if (session.expiresAt.getTime() < Date.now()) {
        await db.delete(sessions).where(eq(sessions.id, session.id))
        return null
      }
      const user = await db.query.users.findFirst({ where: eq(users.id, session.userId) })
      return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null
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
      return { id: user.id, email: user.email, name: user.name, role: user.role }
    },

    async deleteSession(token: string): Promise<void> {
      await db.delete(sessions).where(eq(sessions.id, hashToken(token)))
    },

    async purgeExpiredSessions(): Promise<void> {
      await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    },

    // ---------- people ----------

    async listUsers(): Promise<Member[]> {
      return db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          createdAt: users.createdAt,
          lastSeenAt: users.lastSeenAt,
        })
        .from(users)
        .orderBy(asc(users.createdAt), asc(sql`rowid`))
    },

    async getUser(id: string): Promise<User | null> {
      const row = await db.query.users.findFirst({ where: eq(users.id, id) })
      return row ? { id: row.id, email: row.email, name: row.name, role: row.role } : null
    },

    async getPasswordHash(id: string): Promise<string | null> {
      return (await db.query.users.findFirst({ where: eq(users.id, id) }))?.passwordHash ?? null
    },

    async countAdmins(): Promise<number> {
      const [row] = await db.select({ n: count() }).from(users).where(eq(users.role, 'admin'))
      return row?.n ?? 0
    },

    async updateUser(id: string, input: { name?: string; role?: Role }): Promise<User | null> {
      const change: { name?: string; role?: Role } = {}
      if (input.name !== undefined) change.name = input.name.trim()
      if (input.role !== undefined) change.role = input.role
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
