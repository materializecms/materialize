import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { newer } from '@materializecms/core/updates'
import { openDatabase } from '@materializecms/db'
import { extractTarGz, inspectTarGz } from './archive.ts'
import { t } from './t.ts'

/**
 * A whole site put back from an archive made by «Scarica tutto» (database, media, fonts, files sent
 * with the forms). Used by `materialize restore`, and at start-up for an archive uploaded from the
 * panel: the database is replaced only while nothing has it open.
 */

/** Where an archived file goes, or null: only what belongs where it says, nothing outside. */
export function archivePlace(name: string, dirs: { db: string | null; media: string }): string | null {
  const fonts = join(dirname(dirs.media), 'fonts')
  const uploads = join(dirname(dirs.media), 'uploads')
  if (name === 'content.db') return dirs.db
  const media = /^media\/([^/\\]+)$/.exec(name)?.[1]
  if (media && !media.startsWith('.')) return join(dirs.media, media)
  const font = /^fonts\/(.+)$/.exec(name)?.[1]
  if (font && !font.split('/').some((part) => part === '..' || part.startsWith('.') || part.includes('\\')))
    return join(fonts, font)
  // Files sent with the forms: "<message id>/<n>-<name>".
  const upload = /^uploads\/([\w-]+\/[^/\\]+)$/.exec(name)?.[1]
  if (upload && !upload.split('/').some((part) => part === '..' || part.startsWith('.'))) return join(uploads, upload)
  return null
}

export class ArchiveError extends Error {}

/** What the panel shows before and after: whose site, from which version, how much. */
export interface ArchiveSummary {
  site: string
  version: string
  createdAt: string | null
  database: boolean
  media: number
}

/** Unpacked, an archive may be this many times its upload limit at most. */
const UNPACK_FACTOR = 4

/**
 * Checks an archive before anything is replaced: complete, made by Materialize, not from a newer
 * version (its database could not be read), with a real database when the site keeps one locally.
 */
export async function checkArchive(
  file: string,
  options: { localDb: boolean; version: string; max: number },
): Promise<ArchiveSummary> {
  let contents: Awaited<ReturnType<typeof inspectTarGz>>
  try {
    contents = await inspectTarGz(
      file,
      { 'materialize.json': 64 * 1024, 'content.db': 16 },
      options.max * UNPACK_FACTOR,
    )
  } catch (error) {
    throw new ArchiveError(
      /too large/.test((error as Error).message)
        ? t('L’archivio è troppo grande una volta aperto.')
        : t('Questo file non è un archivio completo: scaricalo di nuovo con «Scarica tutto».'),
    )
  }
  let manifest: { site?: unknown; version?: unknown; createdAt?: unknown } = {}
  try {
    manifest = JSON.parse(contents.peeked.get('materialize.json')?.toString('utf8') ?? '')
  } catch {
    throw new ArchiveError(t('Questo archivio non viene da Materialize: manca materialize.json.'))
  }
  const version = typeof manifest.version === 'string' ? manifest.version : ''
  if (!/^\d+\.\d+\.\d+/.test(version))
    throw new ArchiveError(t('Questo archivio non viene da Materialize: manca materialize.json.'))
  if (newer(version, options.version))
    throw new ArchiveError(
      t('L’archivio viene da Materialize {version}: aggiorna prima questo sito almeno a quella versione.', {
        version,
      }),
    )
  const db = contents.peeked.get('content.db')
  const hasDb = !!db && db.toString('latin1') === 'SQLite format 3\0'
  if (contents.entries.some((e) => e.name === 'content.db') && !hasDb)
    throw new ArchiveError(t('Il database dentro l’archivio è rovinato.'))
  if (options.localDb && !hasDb) throw new ArchiveError(t('L’archivio non contiene il database del sito.'))
  return {
    site: typeof manifest.site === 'string' ? manifest.site : '',
    version,
    createdAt: typeof manifest.createdAt === 'string' ? manifest.createdAt : null,
    // With a hosted database (Turso, libSQL) the archive's database is not put back: its provider keeps it.
    database: hasDb && options.localDb,
    media: contents.entries.filter((e) => e.name.startsWith('media/')).length,
  }
}

/** Saves an uploaded archive to disk as it arrives, never whole in memory; stops past `max` bytes. */
export async function receiveArchive(body: ReadableStream<Uint8Array> | null, path: string, max: number) {
  if (!body) throw new ArchiveError(t('Nessun file ricevuto'))
  await mkdir(dirname(path), { recursive: true })
  let size = 0
  const limit = new Transform({
    transform(chunk: Buffer, _enc, done) {
      size += chunk.length
      if (size > max) done(new ArchiveError('too large'))
      else done(null, chunk)
    },
  })
  try {
    await pipeline(Readable.fromWeb(body as never), limit, createWriteStream(path))
  } catch (error) {
    await rm(path, { force: true })
    if (error instanceof ArchiveError) throw error
    throw new ArchiveError(t('Il caricamento si è interrotto: riprova.'))
  }
  return size
}

/**
 * Puts an archive in place: the current database is saved among the backups first
 * (…-prima-del-ripristino), so even this can be undone. The database must not be open.
 */
export async function applyArchive(options: {
  file: string
  database: { url: string; authToken?: string }
  mediaDir: string
}): Promise<{ kept: string | null; written: string[] }> {
  const local = options.database.url.startsWith('file:')
  const db = local ? resolve(options.database.url.slice('file:'.length)) : null
  let kept: string | null = null
  if (db) {
    const backups = join(dirname(db), 'backups')
    await mkdir(backups, { recursive: true })
    const p = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    kept = join(
      backups,
      `content-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-prima-del-ripristino.db`,
    )
    // Made by SQLite, which also reads what is still in the write-ahead file.
    const current = await openDatabase(options.database)
    await current.client.execute({ sql: 'VACUUM INTO ?', args: [kept] })
    current.close()
    // The write-ahead files belong to the old database.
    await rm(`${db}-wal`, { force: true })
    await rm(`${db}-shm`, { force: true })
  }
  const written = await extractTarGz(resolve(options.file), (name) =>
    archivePlace(name, { db, media: resolve(options.mediaDir) }),
  )
  return { kept, written }
}

/** What `materialize start` gives the server so that an archive uploaded from the panel is applied. */
export interface Restorer {
  /** Why the panel cannot restore here (development, no supervisor), or undefined. */
  unavailable(): string | undefined
  /** Takes the checked archive and restarts: it is applied before the database opens again. */
  schedule(file: string): Promise<void>
  /** The outcome of the last restore, if any. */
  result(): Promise<RestoreResult | null>
}

/** Where an uploaded archive waits for the restart, beside the database. */
export const pendingRestore = (dataDir: string) => ({
  dir: join(dataDir, 'restore'),
  file: join(dataDir, 'restore', 'pending.tar.gz'),
  /** The one being applied: still here at the next start means that start stopped halfway. */
  applying: join(dataDir, 'restore', 'applying.tar.gz'),
  result: join(dataDir, 'restore', 'result.json'),
})

/** The outcome of the last restore, kept for the panel to show after the restart. */
export interface RestoreResult {
  ok: boolean
  at: string
  site?: string
  media?: number
  error?: string
}

export async function movePending(from: string, to: string) {
  await mkdir(dirname(to), { recursive: true })
  await rename(from, to)
}
