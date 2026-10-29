import { randomUUID } from 'node:crypto'
import { count, desc, eq, like, or, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { documents, media } from './tables.ts'

export type MediaAsset = typeof media.$inferSelect

export function createMediaStore(db: Db) {
  return {
    async create(input: Omit<MediaAsset, 'id' | 'createdAt' | 'alt'> & { alt?: string }): Promise<MediaAsset> {
      const row = { id: randomUUID(), createdAt: new Date(), alt: '', ...input }
      await db.insert(media).values(row)
      return row as MediaAsset
    },

    async list(options: { search?: string; limit?: number; offset?: number } = {}) {
      const term = options.search?.replace(/[%_]/g, '')
      const where = term ? or(like(media.filename, `%${term}%`), like(media.alt, `%${term}%`)) : undefined
      const items = await db
        .select()
        .from(media)
        .where(where)
        .orderBy(desc(media.createdAt), desc(sql`rowid`))
        .limit(Math.min(options.limit ?? 60, 200))
        .offset(options.offset ?? 0)
      const [total] = await db.select({ n: count() }).from(media).where(where)
      return { items, total: total?.n ?? 0 }
    },

    async get(id: string): Promise<MediaAsset | null> {
      return (await db.query.media.findFirst({ where: eq(media.id, id) })) ?? null
    },

    async getByKey(key: string): Promise<MediaAsset | null> {
      return (await db.query.media.findFirst({ where: eq(media.key, key) })) ?? null
    },

    async update(id: string, input: { alt: string }): Promise<MediaAsset | null> {
      await db.update(media).set({ alt: input.alt }).where(eq(media.id, id))
      return this.get(id)
    },

    async remove(id: string): Promise<boolean> {
      return (await db.delete(media).where(eq(media.id, id))).rowsAffected > 0
    },

    /** How many documents mention the file, in their draft or published version. */
    async usage(key: string): Promise<number> {
      const needle = `%/media/${key.replace(/[%_]/g, '')}%`
      const [row] = await db
        .select({ n: count() })
        .from(documents)
        .where(or(like(documents.data, needle), like(documents.publishedData, needle)))
      return row?.n ?? 0
    },
  }
}

export type MediaStore = ReturnType<typeof createMediaStore>
