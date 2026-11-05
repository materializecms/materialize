import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, gte, isNotNull, isNull, like, lt, or, type SQL, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { type SubmissionFile, submissions } from './tables.ts'

export type { SubmissionFile }

export interface Submission {
  id: string
  form: string
  formName: string
  page: string
  data: Record<string, string>
  read: boolean
  mailed: boolean
  /** Why it looks like spam; null for a real message. */
  spam: string | null
  files: SubmissionFile[]
  webhook: 'ok' | 'failed' | null
  createdAt: Date
}

export interface SubmissionFilter {
  form?: string
  /** unread: real messages not opened yet; spam: only spam. Without it, real messages. */
  status?: 'unread' | 'spam'
  /** Words in what was written. */
  q?: string
}

const row = (r: typeof submissions.$inferSelect): Submission => ({
  id: r.id,
  form: r.form,
  formName: r.formName,
  page: r.page,
  data: r.data,
  read: r.read,
  mailed: r.mailed,
  spam: r.spam ?? null,
  files: r.files ?? [],
  webhook: r.webhook ?? null,
  createdAt: r.createdAt,
})

/** Messages from the site's forms: kept even when email is not set up, so nothing is lost. */
export function createSubmissionStore(db: Db) {
  const where = (f: SubmissionFilter = {}): SQL | undefined => {
    const parts: (SQL | undefined)[] = [
      f.status === 'spam' ? isNotNull(submissions.spam) : isNull(submissions.spam),
      f.status === 'unread' ? eq(submissions.read, false) : undefined,
      f.form ? eq(submissions.form, f.form) : undefined,
    ]
    const q = f.q?.trim()
    if (q) {
      const pattern = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
      parts.push(
        or(
          sql`${submissions.data} LIKE ${pattern} ESCAPE '\\'`,
          like(submissions.page, pattern),
          like(submissions.formName, pattern),
        ),
      )
    }
    return and(...parts)
  }

  return {
    async add(input: {
      form: string
      formName?: string
      page: string
      data: Record<string, string>
      spam?: string | null
      fingerprint?: string
      id?: string
    }): Promise<Submission> {
      const item = {
        id: input.id ?? randomUUID(),
        form: input.form,
        formName: input.formName ?? '',
        page: input.page,
        data: input.data,
        read: false,
        mailed: false,
        spam: input.spam ?? null,
        files: [] as SubmissionFile[],
        fingerprint: input.fingerprint ?? null,
        webhook: null,
        createdAt: new Date(),
      }
      await db.insert(submissions).values(item)
      return row(item)
    },

    async get(id: string): Promise<Submission | null> {
      const [r] = await db.select().from(submissions).where(eq(submissions.id, id))
      return r ? row(r) : null
    },

    async list(
      limit = 50,
      offset = 0,
      filter: SubmissionFilter = {},
    ): Promise<{ items: Submission[]; total: number; unread: number; spam: number }> {
      const items = await db
        .select()
        .from(submissions)
        .where(where(filter))
        .orderBy(desc(submissions.createdAt))
        .limit(limit)
        .offset(offset)
      const [all] = await db.select({ n: count() }).from(submissions).where(where(filter))
      const [unread] = await db
        .select({ n: count() })
        .from(submissions)
        .where(where({ form: filter.form, status: 'unread' }))
      const [spam] = await db
        .select({ n: count() })
        .from(submissions)
        .where(where({ form: filter.form, status: 'spam' }))
      return { items: items.map(row), total: all?.n ?? 0, unread: unread?.n ?? 0, spam: spam?.n ?? 0 }
    },

    /** Every form that has sent something, with its latest name and how many real messages. */
    async forms(): Promise<{ form: string; name: string; total: number }[]> {
      const rows = await db
        .select({
          form: submissions.form,
          name: sql<string>`max(${submissions.formName})`,
          total: sql<number>`sum(case when ${submissions.spam} is null then 1 else 0 end)`,
        })
        .from(submissions)
        .groupBy(submissions.form)
      return rows.map((r) => ({ form: r.form, name: r.name ?? '', total: Number(r.total ?? 0) }))
    },

    /** Whether the same message arrived since `since`: a repeat is spam. */
    async seen(fingerprint: string, since: Date): Promise<boolean> {
      const [r] = await db
        .select({ n: count() })
        .from(submissions)
        .where(and(eq(submissions.fingerprint, fingerprint), gte(submissions.createdAt, since)))
      return (r?.n ?? 0) > 0
    },

    async setFiles(id: string, files: SubmissionFile[]): Promise<void> {
      await db.update(submissions).set({ files }).where(eq(submissions.id, id))
    },

    async markMailed(id: string): Promise<void> {
      await db.update(submissions).set({ mailed: true }).where(eq(submissions.id, id))
    },

    async markRead(id: string, read = true): Promise<void> {
      await db.update(submissions).set({ read }).where(eq(submissions.id, id))
    },

    /** Moves a message to spam (with the reason) or back among the real ones (null). */
    async markSpam(id: string, reason: string | null): Promise<void> {
      await db.update(submissions).set({ spam: reason }).where(eq(submissions.id, id))
    },

    async setWebhook(id: string, status: 'ok' | 'failed'): Promise<void> {
      await db.update(submissions).set({ webhook: status }).where(eq(submissions.id, id))
    },

    async remove(id: string): Promise<void> {
      await db.delete(submissions).where(eq(submissions.id, id))
    },

    /** Messages older than `before`, to delete with their files. */
    async olderThan(before: Date): Promise<Submission[]> {
      const rows = await db.select().from(submissions).where(lt(submissions.createdAt, before))
      return rows.map(row)
    },
  }
}

export type SubmissionStore = ReturnType<typeof createSubmissionStore>
