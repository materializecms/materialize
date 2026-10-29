import { eq } from 'drizzle-orm'
import type { Db } from './database.ts'
import { settings } from './tables.ts'

/** Site-wide values by key (the design theme, for one), saved as JSON. */
export function createSettingsStore(db: Db) {
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const row = await db.query.settings.findFirst({ where: eq(settings.key, key) })
      return (row?.value as T | undefined) ?? null
    },

    async set(key: string, value: unknown, userId?: string): Promise<void> {
      const row = { key, value, updatedAt: new Date(), updatedBy: userId ?? null }
      await db
        .insert(settings)
        .values(row)
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedAt: row.updatedAt, updatedBy: row.updatedBy },
        })
    },
  }
}

export type SettingsStore = ReturnType<typeof createSettingsStore>
