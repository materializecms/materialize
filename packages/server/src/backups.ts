import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { Database } from '@materializecms/db'

/**
 * Copies of the content database, made by SQLite itself (VACUUM INTO: consistent even while
 * people are editing), in a backups/ folder next to it, and a copy of the uploaded files in
 * backups/media. Only for a local database: a hosted one (Turso, libSQL) is backed up by its
 * provider.
 *
 * Uploaded originals never change once saved (each has a name of its own), so the media copy
 * only adds what is new. A file deleted from the library stays in the copy at least 30 days, and
 * until no kept database copy is older than its deletion (those copies may still show it).
 */

/** How long a deleted file stays in the media copy, at least. */
const KEEP_DELETED_MS = 30 * 24 * 60 * 60_000

export interface Backup {
  name: string
  size: number
  createdAt: Date
}

export interface BackupSettings {
  /** A copy every day, made by the server. */
  enabled: boolean
  /** How many copies to keep; older ones are deleted. */
  keep: number
}

export const DEFAULT_BACKUPS: BackupSettings = { enabled: true, keep: 14 }

const NAME = /^content-\d{8}-\d{6}(-[a-z0-9]+)*\.db$/

const stamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function createBackups(database: Database, mediaDir: () => string) {
  const file = () => {
    const u = database.url
    return u.startsWith('file:') ? resolve(u.slice('file:'.length)) : null
  }
  const folder = () => {
    const f = file()
    return f ? join(dirname(f), 'backups') : null
  }

  const list = async (): Promise<Backup[]> => {
    const dir = folder()
    if (!dir) return []
    const names = (await readdir(dir).catch(() => [] as string[])).filter((n) => NAME.test(n))
    const out = await Promise.all(
      names.map(async (name) => {
        const s = await stat(join(dir, name))
        return { name, size: s.size, createdAt: s.mtime }
      }),
    )
    return out.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  return {
    /** False for a hosted database, or one in memory (tests). */
    available: () => !!file(),
    folder,
    list,

    /** A new copy; `tag` marks why ("auto", "restore"). */
    async create(tag?: string): Promise<Backup> {
      const dir = folder()
      if (!dir) throw new Error('Backups need a local database')
      await mkdir(dir, { recursive: true })
      const base = `content-${stamp()}${tag ? `-${tag}` : ''}`
      let name = `${base}.db`
      // Two copies in the same second keep both.
      for (let i = 2; await stat(join(dir, name)).catch(() => null); i++) name = `${base}-${i}.db`
      const path = join(dir, name)
      await database.client.execute({ sql: 'VACUUM INTO ?', args: [path] })
      const s = await stat(path)
      return { name, size: s.size, createdAt: s.mtime }
    },

    /** Keeps the newest `keep` copies. */
    async prune(keep: number): Promise<number> {
      const dir = folder()
      if (!dir) return 0
      const old = (await list()).slice(Math.max(1, keep))
      for (const b of old) await rm(join(dir, b.name), { force: true })
      return old.length
    },

    /** The file of a copy, or null when the name is not one of ours. */
    async path(name: string): Promise<string | null> {
      const dir = folder()
      if (!dir || !NAME.test(name)) return null
      const path = join(dir, name)
      return (await stat(path).catch(() => null))?.isFile() ? path : null
    },

    /** The media copy: new uploads in, files deleted long enough ago out. */
    async mirrorMedia(): Promise<{ copied: number; purged: number }> {
      const dir = folder()
      if (!dir) return { copied: 0, purged: 0 }
      const source = resolve(mediaDir())
      const target = join(dir, 'media')
      await mkdir(target, { recursive: true })
      const originals = await mediaFiles(source)
      const copies = new Set(await mediaFiles(target))
      let copied = 0
      for (const name of originals)
        if (!copies.has(name)) {
          await copyFile(join(source, name), join(target, name))
          copied++
        }
      // When each file went missing from the library, to know when it can go.
      const ledgerPath = join(target, '.removed.json')
      const ledger: Record<string, number> = JSON.parse(await readFile(ledgerPath, 'utf8').catch(() => '{}'))
      const present = new Set(originals)
      const now = Date.now()
      const oldest = (await list()).at(-1)?.createdAt.getTime() ?? now
      let purged = 0
      for (const name of copies) {
        if (present.has(name)) {
          delete ledger[name]
          continue
        }
        ledger[name] ??= now
        const gone = ledger[name] as number
        if (now - gone > KEEP_DELETED_MS && gone < oldest) {
          await rm(join(target, name), { force: true })
          delete ledger[name]
          purged++
        }
      }
      await writeFile(ledgerPath, JSON.stringify(ledger))
      return { copied, purged }
    },

    /** How many files the media copy holds, and how much space. */
    async mediaCopy(): Promise<{ files: number; size: number }> {
      const dir = folder()
      if (!dir) return { files: 0, size: 0 }
      const target = join(dir, 'media')
      let size = 0
      const names = await mediaFiles(target)
      for (const name of names) size += (await stat(join(target, name)).catch(() => null))?.size ?? 0
      return { files: names.length, size }
    },

    async remove(name: string): Promise<boolean> {
      const dir = folder()
      if (!dir || !NAME.test(name)) return false
      const path = join(dir, name)
      if (!(await stat(path).catch(() => null))) return false
      await rm(path)
      return true
    },
  }
}

export type Backups = ReturnType<typeof createBackups>

/** The files of a media folder: originals only (resized copies live in .cache and are remade). */
async function mediaFiles(dir: string): Promise<string[]> {
  const items = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return items.filter((i) => i.isFile() && !i.name.startsWith('.')).map((i) => i.name)
}

/**
 * After a database is put back: the files it uses that are missing from the library, taken from
 * the media copy next to the backups. Returns how many came back.
 */
export async function restoreMedia(database: string, mediaDir: string, keys: string[]): Promise<number> {
  const copy = join(dirname(database), 'backups', 'media')
  await mkdir(mediaDir, { recursive: true })
  let restored = 0
  for (const key of keys) {
    if (!key || key.includes('/') || key.includes('\\') || key.startsWith('.')) continue
    if (await stat(join(mediaDir, key)).catch(() => null)) continue
    if (!(await stat(join(copy, key)).catch(() => null))) continue
    await copyFile(join(copy, key), join(mediaDir, key))
    restored++
  }
  return restored
}
