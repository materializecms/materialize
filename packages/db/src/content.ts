import { randomUUID } from 'node:crypto'
import { and, asc, count, desc, eq, inArray, isNotNull, like, or, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { documents, revisions } from './tables.ts'

export type DocumentStatus = 'draft' | 'published' | 'changed'

export interface StoredDocument {
  id: string
  collection: string
  locale: string
  slug: string | null
  title: string
  status: DocumentStatus
  data: Record<string, unknown>
  publishedData: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
  publishedAt: Date | null
  /** The original this document translates; null for originals. */
  sourceId: string | null
}

/** One language version of a document. */
export interface Translation {
  id: string
  locale: string
  title: string
  status: DocumentStatus
  sourceId: string | null
}

export interface DocumentSummary {
  id: string
  title: string
  slug: string | null
  status: DocumentStatus
  updatedAt: Date
  publishedAt: Date | null
  /** The first image in the document, for thumbnails in lists. */
  image: string | null
  /** The other languages it exists in. */
  locales: string[]
}

export interface Revision {
  id: string
  kind: 'save' | 'publish' | 'restore'
  data: Record<string, unknown>
  createdAt: Date
  authorId: string | null
}

/** Raised when a slug is already used in the same collection and locale. */
export class SlugTakenError extends Error {
  constructor(slug: string) {
    super(`The address "${slug}" is already used by another document`)
    this.name = 'SlugTakenError'
  }
}

type Row = typeof documents.$inferSelect

const REVISION_MERGE_MS = 5 * 60 * 1000

function statusOf(row: Pick<Row, 'publishedAt' | 'hasChanges'>): DocumentStatus {
  if (!row.publishedAt) return 'draft'
  return row.hasChanges ? 'changed' : 'published'
}

/** The first image found in a document's data (fields first, then blocks, in order). */
export function firstImage(value: unknown, depth = 0): string | null {
  if (!value || typeof value !== 'object' || depth > 6) return null
  const record = value as Record<string, unknown>
  if (typeof record.src === 'string' && record.src && 'alt' in record) return record.src
  for (const child of Array.isArray(value) ? value : Object.values(record)) {
    const found = firstImage(child, depth + 1)
    if (found) return found
  }
  return null
}

function toDocument(row: Row): StoredDocument {
  return {
    id: row.id,
    collection: row.collection,
    locale: row.locale,
    slug: row.slug,
    title: row.title,
    status: statusOf(row),
    data: row.data,
    publishedData: row.publishedData ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt ?? null,
    sourceId: row.sourceId ?? null,
  }
}

function isUniqueViolation(error: unknown): boolean {
  const text = String((error as { cause?: unknown })?.cause ?? error)
  return text.includes('UNIQUE constraint failed: documents.collection, documents.locale, documents.slug')
}

export interface ListOptions {
  locale: string
  limit?: number
  offset?: number
  search?: string
  /** Only documents that have a published version. */
  publishedOnly?: boolean
}

export function createContentStore(db: Db) {
  async function addRevision(
    documentId: string,
    kind: Revision['kind'],
    data: Record<string, unknown>,
    authorId?: string,
  ) {
    await db.insert(revisions).values({ id: randomUUID(), documentId, kind, data, createdAt: new Date(), authorId })
  }

  /**
   * The admin autosaves while people type: consecutive saves by the same person within a few minutes
   * update one revision instead of filling the history with near-identical versions.
   */
  async function addSaveRevision(documentId: string, data: Record<string, unknown>, authorId?: string) {
    const [last] = await db
      .select()
      .from(revisions)
      .where(eq(revisions.documentId, documentId))
      .orderBy(desc(sql`rowid`))
      .limit(1)
    const now = new Date()
    if (
      last?.kind === 'save' &&
      last.authorId === (authorId ?? null) &&
      now.getTime() - last.createdAt.getTime() < REVISION_MERGE_MS
    ) {
      await db.update(revisions).set({ data, createdAt: now }).where(eq(revisions.id, last.id))
      return
    }
    await addRevision(documentId, 'save', data, authorId)
  }

  async function write<T>(slug: string | null, run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      if (slug && isUniqueViolation(error)) throw new SlugTakenError(slug)
      throw error
    }
  }

  /** The languages of each listed document's group (original plus translations), by group key. */
  async function groupsOf(rows: Row[]): Promise<Map<string, string[]>> {
    const keys = [...new Set(rows.map((r) => r.sourceId ?? r.id))]
    const out = new Map<string, string[]>()
    if (!keys.length) return out
    const members = await db
      .select({ id: documents.id, sourceId: documents.sourceId, locale: documents.locale })
      .from(documents)
      .where(or(inArray(documents.id, keys), inArray(documents.sourceId, keys)))
    for (const m of members) {
      const key = m.sourceId ?? m.id
      out.set(key, [...(out.get(key) ?? []), m.locale])
    }
    return out
  }

  return {
    async list(collection: string, options: ListOptions): Promise<{ items: DocumentSummary[]; total: number }> {
      const where = and(
        eq(documents.collection, collection),
        eq(documents.locale, options.locale),
        options.publishedOnly ? isNotNull(documents.publishedAt) : undefined,
        options.search ? like(documents.title, `%${options.search.replace(/[%_]/g, '')}%`) : undefined,
      )
      const rows = await db
        .select()
        .from(documents)
        .where(where)
        .orderBy(desc(documents.updatedAt))
        .limit(Math.min(options.limit ?? 50, 200))
        .offset(options.offset ?? 0)
      const [totalRow] = await db.select({ n: count() }).from(documents).where(where)
      const groups = await groupsOf(rows)
      return {
        total: totalRow?.n ?? 0,
        items: rows.map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          status: statusOf(r),
          updatedAt: r.updatedAt,
          publishedAt: r.publishedAt ?? null,
          image: firstImage(r.data),
          locales: (groups.get(r.sourceId ?? r.id) ?? []).filter((l) => l !== r.locale),
        })),
      }
    },

    /** Every language version of a document, itself included: the original and its translations. */
    async translations(id: string): Promise<Translation[]> {
      const doc = await db.query.documents.findFirst({ where: eq(documents.id, id) })
      if (!doc) return []
      const key = doc.sourceId ?? doc.id
      const rows = await db
        .select()
        .from(documents)
        .where(or(eq(documents.id, key), eq(documents.sourceId, key)))
        .orderBy(asc(documents.createdAt))
      return rows.map((r) => ({
        id: r.id,
        locale: r.locale,
        title: r.title,
        status: statusOf(r),
        sourceId: r.sourceId ?? null,
      }))
    },

    /** Counts per collection and the latest changes across all of them: the panel's home. */
    async overview(locale: string, recent = 8) {
      const counts = await db
        .select({
          collection: documents.collection,
          total: count(),
          drafts: sql<number>`sum(case when ${documents.publishedAt} is null then 1 else 0 end)`,
          changed: sql<number>`sum(case when ${documents.publishedAt} is not null and ${documents.hasChanges} then 1 else 0 end)`,
        })
        .from(documents)
        .where(eq(documents.locale, locale))
        .groupBy(documents.collection)
      const rows = await db
        .select()
        .from(documents)
        .where(eq(documents.locale, locale))
        .orderBy(desc(documents.updatedAt), desc(sql`rowid`))
        .limit(recent)
      return {
        counts: counts.map((c) => ({
          collection: c.collection,
          total: c.total,
          drafts: Number(c.drafts ?? 0),
          changed: Number(c.changed ?? 0),
        })),
        recent: rows.map((r) => ({
          id: r.id,
          collection: r.collection,
          title: r.title,
          slug: r.slug,
          status: statusOf(r),
          updatedAt: r.updatedAt,
          publishedAt: r.publishedAt ?? null,
          image: firstImage(r.data),
          updatedBy: r.updatedBy ?? null,
        })),
      }
    },

    async get(id: string): Promise<StoredDocument | null> {
      const row = await db.query.documents.findFirst({ where: eq(documents.id, id) })
      return row ? toDocument(row) : null
    },

    async getMany(ids: string[]): Promise<StoredDocument[]> {
      if (!ids.length) return []
      const rows = await db.select().from(documents).where(inArray(documents.id, ids))
      return rows.map(toDocument)
    },

    /** Every published document of a collection (all locales unless one is given), oldest first. */
    async published(collection: string, locale?: string): Promise<StoredDocument[]> {
      const rows = await db
        .select()
        .from(documents)
        .where(
          and(
            eq(documents.collection, collection),
            isNotNull(documents.publishedAt),
            locale ? eq(documents.locale, locale) : undefined,
          ),
        )
        .orderBy(asc(documents.createdAt), asc(sql`rowid`))
      return rows.map(toDocument)
    },

    async getBySlug(collection: string, slug: string, locale: string): Promise<StoredDocument | null> {
      const row = await db.query.documents.findFirst({
        where: and(eq(documents.collection, collection), eq(documents.slug, slug), eq(documents.locale, locale)),
      })
      return row ? toDocument(row) : null
    },

    async create(input: {
      collection: string
      locale: string
      title: string
      slug: string | null
      data: Record<string, unknown>
      userId?: string
      sourceId?: string | null
    }): Promise<StoredDocument> {
      const now = new Date()
      const id = randomUUID()
      await write(input.slug, () =>
        db.insert(documents).values({
          id,
          collection: input.collection,
          locale: input.locale,
          slug: input.slug,
          title: input.title,
          data: input.data,
          hasChanges: true,
          createdAt: now,
          updatedAt: now,
          createdBy: input.userId,
          updatedBy: input.userId,
          sourceId: input.sourceId ?? null,
        }),
      )
      await addRevision(id, 'save', input.data, input.userId)
      return (await this.get(id)) as StoredDocument
    },

    async update(
      id: string,
      input: { title: string; slug: string | null; data: Record<string, unknown>; userId?: string },
    ): Promise<StoredDocument | null> {
      const result = await write(input.slug, () =>
        db
          .update(documents)
          .set({
            title: input.title,
            slug: input.slug,
            data: input.data,
            hasChanges: true,
            updatedAt: new Date(),
            updatedBy: input.userId,
          })
          .where(eq(documents.id, id)),
      )
      if (result.rowsAffected === 0) return null
      await addSaveRevision(id, input.data, input.userId)
      return this.get(id)
    },

    /** Makes the current draft live; `data` is the validated form of the draft, when the caller has one. */
    async publish(id: string, userId?: string, data?: Record<string, unknown>): Promise<StoredDocument | null> {
      const current = await this.get(id)
      if (!current) return null
      const live = data ?? current.data
      const now = new Date()
      await db
        .update(documents)
        .set({ publishedData: live, publishedAt: now, hasChanges: false, updatedAt: now, updatedBy: userId })
        .where(eq(documents.id, id))
      await addRevision(id, 'publish', live, userId)
      return this.get(id)
    },

    /** Takes the document off the live site; the draft stays. */
    async unpublish(id: string, userId?: string): Promise<StoredDocument | null> {
      const result = await db
        .update(documents)
        .set({ publishedData: null, publishedAt: null, hasChanges: true, updatedAt: new Date(), updatedBy: userId })
        .where(eq(documents.id, id))
      return result.rowsAffected ? this.get(id) : null
    },

    async remove(id: string): Promise<boolean> {
      const result = await db.delete(documents).where(eq(documents.id, id))
      if (!result.rowsAffected) return false
      // Translations of a deleted original stay together: the oldest becomes their original.
      const orphans = await db
        .select({ id: documents.id })
        .from(documents)
        .where(eq(documents.sourceId, id))
        .orderBy(asc(documents.createdAt))
      const [first, ...rest] = orphans
      if (first) {
        await db.update(documents).set({ sourceId: null }).where(eq(documents.id, first.id))
        if (rest.length)
          await db
            .update(documents)
            .set({ sourceId: first.id })
            .where(
              inArray(
                documents.id,
                rest.map((r) => r.id),
              ),
            )
      }
      return true
    },

    async revisions(documentId: string): Promise<Revision[]> {
      const rows = await db
        .select()
        .from(revisions)
        .where(eq(revisions.documentId, documentId))
        // rowid follows insertion order, so revisions written in the same millisecond stay ordered.
        .orderBy(desc(sql`rowid`))
        .limit(100)
      return rows.map((r) => ({ id: r.id, kind: r.kind, data: r.data, createdAt: r.createdAt, authorId: r.authorId }))
    },

    /** Copies an old version back into the draft, recorded as a new revision. */
    async restore(documentId: string, revisionId: string, userId?: string): Promise<StoredDocument | null> {
      const revision = await db.query.revisions.findFirst({
        where: and(eq(revisions.id, revisionId), eq(revisions.documentId, documentId)),
      })
      if (!revision) return null
      await db
        .update(documents)
        .set({ data: revision.data, hasChanges: true, updatedAt: new Date(), updatedBy: userId })
        .where(eq(documents.id, documentId))
      await addRevision(documentId, 'restore', revision.data, userId)
      return this.get(documentId)
    },
  }
}

export type ContentStore = ReturnType<typeof createContentStore>
