import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import type { Db } from './database.ts'
import { comments } from './tables.ts'

export interface Comment {
  id: string
  documentId: string
  nodeId: string | null
  authorId: string | null
  authorName: string
  body: string
  resolved: boolean
  createdAt: Date
}

/** Comments on a page, in the order they were written. */
export function createCommentStore(db: Db) {
  return {
    async list(documentId: string): Promise<Comment[]> {
      return db.select().from(comments).where(eq(comments.documentId, documentId)).orderBy(asc(comments.createdAt))
    },

    async get(id: string): Promise<Comment | null> {
      return (await db.select().from(comments).where(eq(comments.id, id)))[0] ?? null
    },

    async add(input: {
      documentId: string
      nodeId: string | null
      authorId: string
      authorName: string
      body: string
    }): Promise<Comment> {
      const row: Comment = { id: randomUUID(), ...input, resolved: false, createdAt: new Date() }
      await db.insert(comments).values(row)
      return row
    },

    async resolve(id: string, resolved: boolean): Promise<void> {
      await db.update(comments).set({ resolved }).where(eq(comments.id, id))
    },

    async remove(id: string): Promise<void> {
      await db.delete(comments).where(eq(comments.id, id))
    },
  }
}

export type CommentStore = ReturnType<typeof createCommentStore>
