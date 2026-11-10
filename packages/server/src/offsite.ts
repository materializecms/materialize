import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { mkdtemp, open, readdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import type { Backups } from './backups.ts'
import {
  createS3Storage,
  createWebDavStorage,
  type RemoteStorage,
  type S3Target,
  type WebDavTarget,
} from './remote-storage.ts'
import { t } from './t.ts'

/**
 * A copy of the backups outside the server, encrypted before it leaves: every night the newest
 * database copy, and the media and fonts not sent yet (uploaded files never change, so they go
 * once). On the storage the media are only added; database copies beyond `keep` are deleted.
 *
 * Encryption: AES-256-GCM with a random key made by Materialize, the "recovery key", shown once
 * to the administrator. Whoever reads the bucket or the WebDAV folder sees noise. Files are
 * encrypted in blocks of 1 MiB, each authenticated, the last one marked: a file cut short (an
 * upload that stopped) is refused instead of giving back half a database.
 */

export interface OffsiteSettings {
  kind: 'off' | 's3' | 'webdav'
  s3?: S3Target & { prefix?: string }
  webdav?: WebDavTarget
  /** How many database copies stay on the storage; older ones are deleted. */
  keep: number
  /** The recovery key: base64url of 32 random bytes, with the "mzk1-" mark. */
  key?: string
}

export interface OffsiteStatus {
  at: string
  ok: boolean
  message?: string
  database?: string
  media?: number
  fonts?: number
}

export const DEFAULT_OFFSITE: OffsiteSettings = { kind: 'off', keep: 30 }
const KEY_MARK = 'mzk1-'
const MAGIC = Buffer.from('MZB1')
const BLOCK = 1024 * 1024
/** Encrypted files end with this, so they are told apart from anything else in the folder. */
export const SUFFIX = '.mzb'

export function newRecoveryKey(): string {
  return KEY_MARK + randomBytes(32).toString('base64url')
}

export function parseRecoveryKey(text: string): Buffer {
  const clean = text.trim().replace(/\s+/g, '')
  const raw = clean.startsWith(KEY_MARK) ? clean.slice(KEY_MARK.length) : clean
  const key = Buffer.from(raw, 'base64url')
  if (key.length !== 32) throw new Error(t('La chiave di ripristino non è valida: deve iniziare con mzk1-'))
  return key
}

const nonceOf = (prefix: Buffer, index: number) => {
  const n = Buffer.alloc(12)
  prefix.copy(n, 0)
  n.writeUInt32BE(index, 8)
  return n
}

/** Encrypts `source` into `target` (block by block: large videos never sit in memory). */
export async function encryptFile(source: string, target: string, key: Buffer): Promise<void> {
  const input = await open(source, 'r')
  const output = await open(target, 'w')
  try {
    const { size } = await input.stat()
    const blocks = Math.max(1, Math.ceil(size / BLOCK))
    const prefix = randomBytes(8)
    await output.write(Buffer.concat([MAGIC, prefix]))
    const buffer = Buffer.alloc(BLOCK)
    for (let i = 0; i < blocks; i++) {
      const { bytesRead } = await input.read(buffer, 0, BLOCK, i * BLOCK)
      const cipher = createCipheriv('aes-256-gcm', key, nonceOf(prefix, i))
      cipher.setAAD(Buffer.from([i === blocks - 1 ? 1 : 0]))
      const sealed = Buffer.concat([cipher.update(buffer.subarray(0, bytesRead)), cipher.final(), cipher.getAuthTag()])
      const length = Buffer.alloc(4)
      length.writeUInt32BE(bytesRead)
      await output.write(Buffer.concat([length, sealed]))
    }
  } finally {
    await input.close()
    await output.close()
  }
}

/** The other way; throws on a wrong key, a changed file or one cut short. */
export async function decryptFile(source: string, target: string, key: Buffer): Promise<void> {
  const input = await open(source, 'r')
  const output = await open(target, 'w')
  let ok = false
  try {
    const head = Buffer.alloc(12)
    await input.read(head, 0, 12, 0)
    if (!head.subarray(0, 4).equals(MAGIC)) throw new Error(t('Non è un file di backup cifrato da Materialize'))
    const prefix = head.subarray(4, 12)
    let position = 12
    for (let i = 0; ; i++) {
      const length = Buffer.alloc(4)
      if ((await input.read(length, 0, 4, position)).bytesRead < 4) throw new Error(t('Il file è incompleto'))
      const size = length.readUInt32BE()
      if (size > BLOCK) throw new Error(t('Il file è danneggiato'))
      const sealed = Buffer.alloc(size + 16)
      if ((await input.read(sealed, 0, size + 16, position + 4)).bytesRead < size + 16)
        throw new Error(t('Il file è incompleto'))
      position += 4 + size + 16
      const end = position >= (await input.stat()).size
      const decipher = createDecipheriv('aes-256-gcm', key, nonceOf(prefix, i))
      decipher.setAAD(Buffer.from([end ? 1 : 0]))
      decipher.setAuthTag(sealed.subarray(size))
      try {
        await output.write(Buffer.concat([decipher.update(sealed.subarray(0, size)), decipher.final()]))
      } catch {
        throw new Error(
          end
            ? t('Chiave sbagliata, oppure il file è stato modificato')
            : t('Il file è incompleto o è stato modificato'),
        )
      }
      if (end) break
    }
    ok = true
  } finally {
    await input.close()
    await output.close()
    if (!ok) await rm(target, { force: true })
  }
}

export function storageOf(s: OffsiteSettings): RemoteStorage | null {
  if (s.kind === 's3' && s.s3) return createS3Storage(s.s3, s.s3.prefix ?? '')
  if (s.kind === 'webdav' && s.webdav) return createWebDavStorage(s.webdav)
  return null
}

const README = `Backup di Materialize

Questi file sono cifrati (AES-256-GCM): senza la chiave di ripristino non si leggono.

  database/   le copie del database, dalla più recente
  media/      le immagini e i file caricati
  fonts/      i caratteri del sito

Per rimetterli su un server:
  1. scarica la cartella (con lo strumento del servizio, per esempio rclone);
  2. nella cartella del sito: npx materialize decrypt <cartella scaricata> --key <chiave>
  3. npx materialize restore <cartella decifrata>/database/content-….db
     e copia media/ e fonts/ in .materialize/

https://github.com/materializecms/materialize/blob/main/docs/guida/12-aggiornamenti-e-backup.md
`

/** Every file under a folder, as paths relative to it; hidden files and the media cache left out. */
async function filesUnder(dir: string): Promise<string[]> {
  const out: string[] = []
  const walk = async (current: string) => {
    for (const item of await readdir(current, { withFileTypes: true }).catch(() => [])) {
      if (item.name.startsWith('.')) continue
      const path = join(current, item.name)
      if (item.isDirectory()) await walk(path)
      else if (item.isFile()) out.push(relative(dir, path).split('\\').join('/'))
    }
  }
  await walk(dir)
  return out
}

/**
 * One run: what is missing goes up, old database copies go away. `fresh` makes a new database
 * copy first (the "Esegui ora" button); otherwise the newest daily copy is sent.
 */
export async function runOffsite(
  s: OffsiteSettings,
  backups: Backups,
  mediaDir: string,
  fresh = false,
  /** For tests: a storage in memory. */
  storage: RemoteStorage | null = storageOf(s),
): Promise<OffsiteStatus> {
  if (!storage || !s.key) throw new Error(t('La copia fuori dal server non è configurata'))
  const key = parseRecoveryKey(s.key)
  const work = await mkdtemp(join(tmpdir(), 'materialize-offsite-'))
  try {
    const remote = new Set((await storage.list('')).map((i) => i.key))
    if (!remote.has('LEGGIMI.txt')) await storage.putText('LEGGIMI.txt', README)
    const send = async (local: string, remoteKey: string) => {
      const sealed = join(work, 'file')
      await encryptFile(local, sealed, key)
      await storage.put(remoteKey, sealed)
      await rm(sealed, { force: true })
    }

    let database: string | undefined
    if (backups.available()) {
      const latest = fresh ? await backups.create('esterno') : (await backups.list())[0]
      if (latest) {
        database = latest.name
        const target = `database/${latest.name}${SUFFIX}`
        if (!remote.has(target)) await send(join(backups.folder() as string, latest.name), target)
      }
    }

    const media = resolve(mediaDir)
    let mediaSent = 0
    for (const name of await filesUnder(media)) {
      const target = `media/${name}${SUFFIX}`
      if (remote.has(target)) continue
      await send(join(media, name), target)
      mediaSent++
    }
    const fonts = join(resolve(mediaDir), '..', 'fonts')
    let fontsSent = 0
    for (const name of await filesUnder(fonts)) {
      const target = `fonts/${name}${SUFFIX}`
      if (remote.has(target)) continue
      await send(join(fonts, name), target)
      fontsSent++
    }

    // The newest copies stay; the media are never deleted (an old copy of the database may use them).
    const copies = (await storage.list('database/'))
      .filter((i) => i.key.endsWith(SUFFIX))
      .sort((a, b) => b.key.localeCompare(a.key))
    for (const old of copies.slice(Math.max(1, s.keep))) await storage.delete(old.key)

    return { at: new Date().toISOString(), ok: true, database, media: mediaSent, fonts: fontsSent }
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

/** "Prova il collegamento": writes, reads back, lists and deletes a small file. */
export async function testOffsite(s: OffsiteSettings): Promise<void> {
  const storage = storageOf(s)
  if (!storage) throw new Error(t('Scegli S3 o WebDAV e compila i campi'))
  const key = `.materialize-prova-${randomBytes(4).toString('hex')}.txt`
  const text = `Prova di Materialize, ${new Date().toISOString()}`
  await storage.putText(key, text)
  try {
    if ((await storage.getText(key)) !== text) throw new Error(t('Il file di prova è tornato diverso'))
    await storage.list('')
  } finally {
    await storage.delete(key)
  }
}

/** Every encrypted file under a folder (or one file), decrypted next to it without the suffix. */
export async function decryptTree(source: string, key: Buffer): Promise<string[]> {
  const info = await stat(source)
  const files = info.isDirectory()
    ? (await filesUnder(source)).filter((f) => f.endsWith(SUFFIX)).map((f) => join(source, f))
    : [source]
  const done: string[] = []
  for (const file of files) {
    const target = file.endsWith(SUFFIX) ? file.slice(0, -SUFFIX.length) : `${file}.decifrato`
    await decryptFile(file, target, key)
    done.push(target)
  }
  return done
}
