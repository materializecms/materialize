import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { count, eq, lt } from 'drizzle-orm'
import type { Db } from './database.ts'
import { sessions, users } from './tables.ts'

export type Role = 'admin' | 'editor'

export interface User {
  id: string
  email: string
  name: string
  role: Role
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
      await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt, createdAt: new Date() })
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
  }
}

export type AuthStore = ReturnType<typeof createAuthStore>
