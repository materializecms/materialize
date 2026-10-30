import { randomUUID } from 'node:crypto'
import { and, count, desc, eq, getTableColumns, gt, like, lt, or, sql } from 'drizzle-orm'
import type { Db } from './database.ts'
import { activity, apiTokens, loginAttempts } from './tables.ts'

export interface ActivityEntry {
  id: string
  at: Date
  userId: string | null
  userName: string
  /** A dotted code: "login.failed", "document.published", "user.removed"… */
  action: string
  target: string
  detail: Record<string, unknown> | null
  ip: string | null
  /** Position in the log, to continue a list from (entries of the same millisecond included). */
  seq: number
}

/** Entries older than this are deleted as new ones come in. */
const KEEP_MS = 365 * 24 * 60 * 60_000

/** The activity log: written by the server as things happen, read by administrators. */
export function createActivityStore(db: Db) {
  let writes = 0
  return {
    async record(entry: Omit<ActivityEntry, 'id' | 'at' | 'seq'>): Promise<void> {
      await db.insert(activity).values({ id: randomUUID(), at: new Date(), ...entry })
      // Now and then, the oldest entries go.
      if (++writes % 500 === 1) await db.delete(activity).where(lt(activity.at, new Date(Date.now() - KEEP_MS)))
    },

    /**
     * Newest first. `prefixes` keeps the actions of some groups ("login.", "user."…); `before`
     * continues a list from the `seq` of its last entry.
     */
    async list(options: { prefixes?: string[]; before?: number; limit?: number } = {}): Promise<ActivityEntry[]> {
      const rows = await db
        .select({ ...getTableColumns(activity), seq: sql<number>`rowid` })
        .from(activity)
        .where(
          and(
            options.before ? sql`rowid < ${options.before}` : undefined,
            options.prefixes?.length ? or(...options.prefixes.map((p) => like(activity.action, `${p}%`))) : undefined,
          ),
        )
        .orderBy(desc(sql`rowid`))
        .limit(Math.min(options.limit ?? 50, 200))
      return rows.map((r) => ({ ...r, detail: r.detail ?? null, ip: r.ip ?? null, userId: r.userId ?? null }))
    },

    /** How many times an action happened since a moment: failed sign-ins in the last day… */
    async countSince(action: string, since: Date): Promise<number> {
      const [row] = await db
        .select({ n: count() })
        .from(activity)
        .where(and(eq(activity.action, action), gt(activity.at, since)))
      return row?.n ?? 0
    },

    /** Emails and addresses paused right now after failed sign-ins. */
    async lockedKeys(): Promise<string[]> {
      const rows = await db
        .select({ key: loginAttempts.key })
        .from(loginAttempts)
        .where(gt(loginAttempts.lockedUntil, new Date()))
      return rows.map((r) => r.key)
    },

    /** Access tokens, with whose they are and when last used: for the security overview. */
    async tokens() {
      return db
        .select({ userId: apiTokens.userId, createdAt: apiTokens.createdAt, lastUsedAt: apiTokens.lastUsedAt })
        .from(apiTokens)
    },
  }
}

export type ActivityStore = ReturnType<typeof createActivityStore>
