import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray, lte } from 'drizzle-orm'
import type { Db } from './database.ts'
import { schedules } from './tables.ts'

export type ScheduleAction = 'publish' | 'unpublish'

export interface Schedule {
  id: string
  documentId: string
  action: ScheduleAction
  runAt: Date
  status: 'pending' | 'done' | 'failed' | 'cancelled'
  error: string | null
  releaseId: string | null
  createdBy: string | null
  createdByName: string
  createdAt: Date
}

/** A document's pending actions, and the last one that failed (shown until someone acts on it). */
export interface DocumentSchedule {
  publish: Schedule | null
  unpublish: Schedule | null
  failed: Schedule | null
}

const row = (r: typeof schedules.$inferSelect): Schedule => ({
  ...r,
  error: r.error ?? null,
  releaseId: r.releaseId ?? null,
  createdBy: r.createdBy ?? null,
})

/** Publishing and taking off the site at a set time. */
export function createScheduleStore(db: Db) {
  const open = (documentId: string, action?: ScheduleAction) =>
    and(
      eq(schedules.documentId, documentId),
      inArray(schedules.status, ['pending', 'failed']),
      action ? eq(schedules.action, action) : undefined,
    )

  return {
    /** Sets when an action happens, replacing the one already set (and a failed one). */
    async set(input: {
      documentId: string
      action: ScheduleAction
      runAt: Date
      user: { id: string; name: string }
    }): Promise<Schedule> {
      await db.update(schedules).set({ status: 'cancelled' }).where(open(input.documentId, input.action))
      const item: Schedule = {
        id: randomUUID(),
        documentId: input.documentId,
        action: input.action,
        runAt: input.runAt,
        status: 'pending',
        error: null,
        releaseId: null,
        createdBy: input.user.id,
        createdByName: input.user.name,
        createdAt: new Date(),
      }
      await db.insert(schedules).values(item)
      return item
    },

    /** Cancels a document's pending action (and clears a failed one), or all of them. */
    async cancel(documentId: string, action?: ScheduleAction): Promise<void> {
      await db.update(schedules).set({ status: 'cancelled' }).where(open(documentId, action))
    },

    async forDocument(documentId: string): Promise<DocumentSchedule> {
      const rows = (await db.select().from(schedules).where(open(documentId)).orderBy(asc(schedules.runAt))).map(row)
      return {
        publish: rows.find((r) => r.status === 'pending' && r.action === 'publish') ?? null,
        unpublish: rows.find((r) => r.status === 'pending' && r.action === 'unpublish') ?? null,
        failed: rows.filter((r) => r.status === 'failed').at(-1) ?? null,
      }
    },

    /** Every pending action, for lists and the calendar of what is coming. */
    async pending(): Promise<Schedule[]> {
      return (
        await db.select().from(schedules).where(eq(schedules.status, 'pending')).orderBy(asc(schedules.runAt))
      ).map(row)
    },

    /** Pending actions whose time has come, oldest first. */
    async due(now: Date): Promise<Schedule[]> {
      return (
        await db
          .select()
          .from(schedules)
          .where(and(eq(schedules.status, 'pending'), lte(schedules.runAt, now)))
          .orderBy(asc(schedules.runAt))
      ).map(row)
    },

    async finish(id: string, status: 'done' | 'failed', error: string | null = null): Promise<void> {
      await db.update(schedules).set({ status, error }).where(eq(schedules.id, id))
    },

    /** A deleted document takes its schedule with it. */
    async removeForDocument(documentId: string): Promise<void> {
      await db.delete(schedules).where(eq(schedules.documentId, documentId))
    },
  }
}

export type ScheduleStore = ReturnType<typeof createScheduleStore>
