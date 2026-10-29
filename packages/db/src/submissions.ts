import { randomUUID } from 'node:crypto'
import { count, desc, eq } from 'drizzle-orm'
import type { Db } from './database.ts'
import { submissions } from './tables.ts'

export interface Submission {
  id: string
  form: string
  page: string
  data: Record<string, string>
  read: boolean
  mailed: boolean
  createdAt: Date
}

/** Messages from the site's forms: kept even when email is not set up, so nothing is lost. */
export function createSubmissionStore(db: Db) {
  return {
    async add(input: { form: string; page: string; data: Record<string, string> }): Promise<Submission> {
      const row: Submission = { id: randomUUID(), ...input, read: false, mailed: false, createdAt: new Date() }
      await db.insert(submissions).values(row)
      return row
    },

    async list(limit = 50, offset = 0): Promise<{ items: Submission[]; total: number; unread: number }> {
      const items = await db.select().from(submissions).orderBy(desc(submissions.createdAt)).limit(limit).offset(offset)
      const [all] = await db.select({ n: count() }).from(submissions)
      const [unread] = await db.select({ n: count() }).from(submissions).where(eq(submissions.read, false))
      return { items, total: all?.n ?? 0, unread: unread?.n ?? 0 }
    },

    async markMailed(id: string): Promise<void> {
      await db.update(submissions).set({ mailed: true }).where(eq(submissions.id, id))
    },

    async markRead(id: string, read = true): Promise<void> {
      await db.update(submissions).set({ read }).where(eq(submissions.id, id))
    },

    async remove(id: string): Promise<void> {
      await db.delete(submissions).where(eq(submissions.id, id))
    },
  }
}

export type SubmissionStore = ReturnType<typeof createSubmissionStore>
