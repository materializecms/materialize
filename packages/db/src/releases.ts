import { randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNotNull, lte } from 'drizzle-orm'
import type { Db } from './database.ts'
import { releaseItems, releases } from './tables.ts'

export type ReleaseAction = 'publish' | 'unpublish'
export type ReleaseStatus = 'open' | 'published' | 'failed' | 'cancelled'

export interface ReleaseItem {
  documentId: string
  action: ReleaseAction
  addedAt: Date
}

export interface Release {
  id: string
  name: string
  status: ReleaseStatus
  runAt: Date | null
  error: string | null
  createdBy: string | null
  createdByName: string
  scheduledBy: string | null
  scheduledByName: string
  createdAt: Date
  publishedAt: Date | null
  items: ReleaseItem[]
}

type Who = { id: string; name: string }

/**
 * Releases: several documents that go on (or off) the site together. A document is in at most one
 * open release at a time; a failed release can be fixed and published again.
 */
export function createReleaseStore(db: Db) {
  const withItems = async (rows: (typeof releases.$inferSelect)[]): Promise<Release[]> => {
    if (!rows.length) return []
    const items = await db
      .select()
      .from(releaseItems)
      .where(
        inArray(
          releaseItems.releaseId,
          rows.map((r) => r.id),
        ),
      )
      .orderBy(asc(releaseItems.addedAt))
    return rows.map((r) => ({
      ...r,
      runAt: r.runAt ?? null,
      error: r.error ?? null,
      createdBy: r.createdBy ?? null,
      scheduledBy: r.scheduledBy ?? null,
      publishedAt: r.publishedAt ?? null,
      items: items
        .filter((i) => i.releaseId === r.id)
        .map((i) => ({ documentId: i.documentId, action: i.action, addedAt: i.addedAt })),
    }))
  }
  /** Open and failed: the ones that can still change and go out. */
  const live = inArray(releases.status, ['open', 'failed'])

  const store = {
    async create(name: string, user: Who): Promise<Release> {
      const row = {
        id: randomUUID(),
        name,
        status: 'open' as const,
        runAt: null,
        error: null,
        createdBy: user.id,
        createdByName: user.name,
        scheduledBy: null,
        scheduledByName: '',
        createdAt: new Date(),
        publishedAt: null,
      }
      await db.insert(releases).values(row)
      return { ...row, items: [] }
    },

    async get(id: string): Promise<Release | null> {
      return (await withItems(await db.select().from(releases).where(eq(releases.id, id))))[0] ?? null
    },

    /** Open and failed releases, soonest first (those with a time before the others), and the last published. */
    async list(): Promise<{ active: Release[]; done: Release[] }> {
      const active = await withItems(
        await db.select().from(releases).where(live).orderBy(asc(releases.runAt), asc(releases.createdAt)),
      )
      const done = await withItems(
        await db
          .select()
          .from(releases)
          .where(eq(releases.status, 'published'))
          .orderBy(desc(releases.publishedAt))
          .limit(10),
      )
      // SQLite puts nulls first: releases without a time go after the scheduled ones.
      active.sort((a, b) => (a.runAt ? a.runAt.getTime() : Infinity) - (b.runAt ? b.runAt.getTime() : Infinity))
      return { active, done }
    },

    async rename(id: string, name: string): Promise<void> {
      await db.update(releases).set({ name }).where(eq(releases.id, id))
    },

    /** Sets when it goes out (null: by hand). A failed release becomes open again. */
    async schedule(id: string, runAt: Date | null, user: Who | null): Promise<void> {
      await db
        .update(releases)
        .set({
          runAt,
          status: 'open',
          error: null,
          scheduledBy: runAt ? (user?.id ?? null) : null,
          scheduledByName: runAt ? (user?.name ?? '') : '',
        })
        .where(eq(releases.id, id))
    },

    async finish(id: string, status: 'published' | 'failed' | 'cancelled', error: string | null = null) {
      await db
        .update(releases)
        .set({ status, error, publishedAt: status === 'published' ? new Date() : null })
        .where(eq(releases.id, id))
    },

    /** Adds a document, or changes what happens to it; it leaves any other open release. */
    async put(id: string, documentId: string, action: ReleaseAction): Promise<void> {
      const other = await store.forDocument(documentId)
      if (other && other.id !== id)
        await db
          .delete(releaseItems)
          .where(and(eq(releaseItems.releaseId, other.id), eq(releaseItems.documentId, documentId)))
      await db
        .insert(releaseItems)
        .values({ releaseId: id, documentId, action, addedAt: new Date() })
        .onConflictDoUpdate({ target: [releaseItems.releaseId, releaseItems.documentId], set: { action } })
    },

    async remove(id: string, documentId: string): Promise<void> {
      await db.delete(releaseItems).where(and(eq(releaseItems.releaseId, id), eq(releaseItems.documentId, documentId)))
    },

    /** The open (or failed) release a document is in, if any. */
    async forDocument(documentId: string): Promise<Release | null> {
      const rows = await db
        .select({ id: releases.id })
        .from(releaseItems)
        .innerJoin(releases, eq(releases.id, releaseItems.releaseId))
        .where(and(eq(releaseItems.documentId, documentId), live))
      return rows[0] ? store.get(rows[0].id) : null
    },

    /** Open releases whose time has come. */
    async due(now: Date): Promise<Release[]> {
      return withItems(
        await db
          .select()
          .from(releases)
          .where(and(eq(releases.status, 'open'), isNotNull(releases.runAt), lte(releases.runAt, now)))
          .orderBy(asc(releases.runAt)),
      )
    },

    /** A deleted document leaves the releases it was in. */
    async removeDocument(documentId: string): Promise<void> {
      await db.delete(releaseItems).where(eq(releaseItems.documentId, documentId))
    },
  }
  return store
}

export type ReleaseStore = ReturnType<typeof createReleaseStore>
