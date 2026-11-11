import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, gte, type SQL } from 'drizzle-orm'
import type { Db } from './database.ts'
import { visitorComments } from './tables.ts'

export type VisitorCommentStatus = 'pending' | 'approved' | 'spam'

export interface VisitorComment {
  id: string
  collection: string
  documentId: string
  title: string
  locale: string
  path: string
  name: string
  /** Private: shown only to the panel. */
  email: string | null
  text: string
  status: VisitorCommentStatus
  /** Why it looks like spam; null otherwise. */
  spam: string | null
  createdAt: Date
}

/** What the site shows of a comment: no email, nothing else. */
export interface PublicComment {
  id: string
  name: string
  text: string
  createdAt: Date
}

const row = (r: typeof visitorComments.$inferSelect): VisitorComment => ({
  id: r.id,
  collection: r.collection,
  documentId: r.documentId,
  title: r.title,
  locale: r.locale,
  path: r.path,
  name: r.name,
  email: r.email ?? null,
  text: r.text,
  status: r.status,
  spam: r.spam ?? null,
  createdAt: r.createdAt,
})

/** Comments visitors leave under articles, waiting for approval, published, or set aside as spam. */
export function createVisitorCommentStore(db: Db) {
  const where = (status?: VisitorCommentStatus, documentId?: string): SQL | undefined =>
    and(
      status ? eq(visitorComments.status, status) : undefined,
      documentId ? eq(visitorComments.documentId, documentId) : undefined,
    )

  return {
    async add(input: Omit<VisitorComment, 'id' | 'createdAt'> & { fingerprint?: string }): Promise<VisitorComment> {
      const item = { ...input, id: randomUUID(), createdAt: new Date(), fingerprint: input.fingerprint ?? null }
      await db.insert(visitorComments).values(item)
      return row(item)
    },

    async get(id: string): Promise<VisitorComment | null> {
      const [r] = await db.select().from(visitorComments).where(eq(visitorComments.id, id))
      return r ? row(r) : null
    },

    /** For the panel, newest first, with how many wait in each place. */
    async list(
      filter: { status?: VisitorCommentStatus; documentId?: string; limit?: number; offset?: number } = {},
    ): Promise<{ items: VisitorComment[]; total: number; pending: number; spam: number }> {
      const items = await db
        .select()
        .from(visitorComments)
        .where(where(filter.status, filter.documentId))
        .orderBy(desc(visitorComments.createdAt))
        .limit(filter.limit ?? 50)
        .offset(filter.offset ?? 0)
      const total = async (status?: VisitorCommentStatus) =>
        (await db.select({ n: count() }).from(visitorComments).where(where(status, filter.documentId)))[0]?.n ?? 0
      return {
        items: items.map(row),
        total: await total(filter.status),
        pending: await total('pending'),
        spam: await total('spam'),
      }
    },

    /**
     * What a page shows: the approved comments of its document in its language, oldest first, as
     * a conversation reads. By document, not by address: a new slug keeps its comments.
     */
    async approved(documentId: string, locale: string, limit = 500): Promise<PublicComment[]> {
      const rows = await db
        .select({
          id: visitorComments.id,
          name: visitorComments.name,
          text: visitorComments.text,
          createdAt: visitorComments.createdAt,
        })
        .from(visitorComments)
        .where(
          and(
            eq(visitorComments.documentId, documentId),
            eq(visitorComments.locale, locale),
            eq(visitorComments.status, 'approved'),
          ),
        )
        .orderBy(asc(visitorComments.createdAt))
        .limit(limit)
      return rows
    },

    async setStatus(id: string, status: VisitorCommentStatus): Promise<VisitorComment | null> {
      await db
        .update(visitorComments)
        .set({ status, ...(status !== 'spam' ? { spam: null } : {}) })
        .where(eq(visitorComments.id, id))
      return this.get(id)
    },

    async remove(id: string): Promise<boolean> {
      return (await db.delete(visitorComments).where(eq(visitorComments.id, id))).rowsAffected > 0
    },

    /** The same comment, written again: spam. */
    async seen(fingerprint: string, since: Date): Promise<boolean> {
      const [r] = await db
        .select({ n: count() })
        .from(visitorComments)
        .where(and(eq(visitorComments.fingerprint, fingerprint), gte(visitorComments.createdAt, since)))
      return (r?.n ?? 0) > 0
    },
  }
}

export type VisitorCommentStore = ReturnType<typeof createVisitorCommentStore>
