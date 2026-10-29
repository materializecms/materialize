import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { type Client, createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import * as tables from './tables.ts'
import { MIGRATIONS } from './tables.ts'

export type Db = LibSQLDatabase<typeof tables>

export interface Database {
  db: Db
  client: Client
  close: () => void
}

/**
 * Opens a database: `file:path.db` for local SQLite (the default), `:memory:` for tests,
 * or a libSQL / Turso URL for hosted setups. Pending migrations run automatically.
 */
export async function openDatabase(options: { url: string; authToken?: string }): Promise<Database> {
  if (options.url.startsWith('file:')) {
    await mkdir(dirname(options.url.slice('file:'.length)), { recursive: true })
  }
  const client = createClient({ url: options.url, authToken: options.authToken })
  await client.execute('PRAGMA foreign_keys = ON')
  if (options.url.startsWith('file:')) await client.execute('PRAGMA journal_mode = WAL')
  await migrate(client)
  return { db: drizzle(client, { schema: tables }), client, close: () => client.close() }
}

async function migrate(client: Client): Promise<void> {
  await client.execute('CREATE TABLE IF NOT EXISTS _materialize_schema (version INTEGER NOT NULL)')
  const row = (await client.execute('SELECT version FROM _materialize_schema LIMIT 1')).rows[0]
  const current = row ? Number(row.version) : 0
  for (let v = current; v < MIGRATIONS.length; v++) {
    const steps = MIGRATIONS[v] ?? []
    await client.batch(
      [
        ...steps,
        current === 0 && v === 0
          ? { sql: 'INSERT INTO _materialize_schema (version) VALUES (?)', args: [v + 1] }
          : { sql: 'UPDATE _materialize_schema SET version = ?', args: [v + 1] },
      ],
      'write',
    )
  }
}
