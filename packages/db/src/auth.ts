import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { and, asc, count, eq, gt, lt, ne, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { invites, sessions, users } from './tables.ts'

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
