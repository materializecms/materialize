import { randomBytes, randomUUID } from 'node:crypto'
import { and, desc, eq, gt, isNull, lte, or, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { previewLinks } from './tables.ts'

export interface PreviewLink {
  id: string
  documentId: string
  /** The secret part of the address: whoever has it sees the draft. */
  token: string
  expiresAt: Date | null
  createdBy: string | null
  createdByName: string
  createdAt: Date
  viewedAt: Date | null
  views: number
}

const row = (r: typeof previewLinks.$inferSelect): PreviewLink => ({
  ...r,
  expiresAt: r.expiresAt ?? null,
  createdBy: r.createdBy ?? null,
  viewedAt: r.viewedAt ?? null,
})

const valid = (now: Date) => or(isNull(previewLinks.expiresAt), gt(previewLinks.expiresAt, now))

/** Links that show a draft with the site's own design, to people without an account. */
export function createPreviewLinkStore(db: Db) {
  return {
    async create(input: {
      documentId: string
      expiresAt: Date | null
      user: { id: string; name: string }
    }): Promise<PreviewLink> {
      const link: PreviewLink = {
        id: randomUUID(),
        documentId: input.documentId,
        token: randomBytes(24).toString('base64url'),
        expiresAt: input.expiresAt,
        createdBy: input.user.id,
        createdByName: input.user.name,
        createdAt: new Date(),
        viewedAt: null,
        views: 0,
      }
      await db.insert(previewLinks).values(link)
      return link
    },

    /** A document's links that still work, newest first. */
    async forDocument(documentId: string, now = new Date()): Promise<PreviewLink[]> {
      const rows = await db
        .select()
        .from(previewLinks)
        .where(and(eq(previewLinks.documentId, documentId), valid(now)))
        .orderBy(desc(previewLinks.createdAt))
      return rows.map(row)
    },

    async get(id: string): Promise<PreviewLink | null> {
      const [r] = await db.select().from(previewLinks).where(eq(previewLinks.id, id))
      return r ? row(r) : null
    },

    /** The link behind an address, if it still works; counts the visit. */
    async open(token: string, now = new Date()): Promise<PreviewLink | null> {
      const [r] = await db
        .select()
        .from(previewLinks)
        .where(and(eq(previewLinks.token, token), valid(now)))
      if (!r) return null
      await db
        .update(previewLinks)
        .set({ viewedAt: now, views: sql`${previewLinks.views} + 1` })
        .where(eq(previewLinks.id, r.id))
      return row(r)
    },

    async revoke(id: string): Promise<void> {
      await db.delete(previewLinks).where(eq(previewLinks.id, id))
    },

    async removeForDocument(documentId: string): Promise<void> {
      await db.delete(previewLinks).where(eq(previewLinks.documentId, documentId))
    },

    /** Forgets links that expired more than a month ago. */
    async prune(now = new Date()): Promise<void> {
      await db.delete(previewLinks).where(lte(previewLinks.expiresAt, new Date(now.getTime() - 30 * 86_400_000)))
    },
  }
}

export type PreviewLinkStore = ReturnType<typeof createPreviewLinkStore>
