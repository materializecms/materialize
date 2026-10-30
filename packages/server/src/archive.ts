import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readdir, rename, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createGunzip, createGzip } from 'node:zlib'

/**
 * The whole site in one file (Impostazioni → Sicurezza → Scarica tutto): a .tar.gz with the
 * database, the original media and the downloaded fonts. Written as it is sent, so a library of
 * several GB needs no space on the server; read back by `materialize restore`.
 */

export interface ArchiveEntry {
  /** Path inside the archive: "content.db", "media/monolite-16ee2580.jpg"… */
  name: string
  /** The file on disk. */
  path: string
}

const BLOCK = 512

function octal(value: number, length: number): string {
  return `${value.toString(8).padStart(length - 1, '0')}\0`
}

/** A ustar header; names longer than 100 characters go in the prefix field. */
function header(name: string, size: number, mtime: Date): Buffer {
  let prefix = ''
  let short = name
  if (Buffer.byteLength(name) > 100) {
    const cut = name.lastIndexOf('/', 155)
    prefix = name.slice(0, cut)
    short = name.slice(cut + 1)
    if (cut < 0 || Buffer.byteLength(short) > 100 || Buffer.byteLength(prefix) > 155)
      throw new Error(`Name too long for the archive: ${name}`)
  }
  const h = Buffer.alloc(BLOCK)
  h.write(short, 0, 100, 'utf8')
  h.write(octal(0o644, 8), 100, 8, 'ascii')
  h.write(octal(0, 8), 108, 8, 'ascii')
  h.write(octal(0, 8), 116, 8, 'ascii')
  h.write(octal(size, 12), 124, 12, 'ascii')
  h.write(octal(Math.floor(mtime.getTime() / 1000), 12), 136, 12, 'ascii')
  h.write('        ', 148, 8, 'ascii')
  h.write('0', 156, 1, 'ascii')
  h.write('ustar\0', 257, 6, 'ascii')
  h.write('00', 263, 2, 'ascii')
  h.write(prefix, 345, 155, 'utf8')
  let sum = 0
  for (const byte of h) sum += byte
  h.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii')
  return h
}

async function* tarBlocks(entries: ArchiveEntry[]): AsyncGenerator<Buffer> {
  for (const entry of entries) {
    const info = await stat(entry.path).catch(() => null)
    if (!info?.isFile()) continue
    yield header(entry.name, info.size, info.mtime)
    let written = 0
    for await (const chunk of createReadStream(entry.path)) {
      written += (chunk as Buffer).length
      yield chunk as Buffer
    }
    // A file that grew while being read would break the archive: it is cut to the size declared.
    if (written !== info.size) throw new Error(`${entry.name} changed while being archived`)
    const pad = (BLOCK - (info.size % BLOCK)) % BLOCK
    if (pad) yield Buffer.alloc(pad)
  }
  yield Buffer.alloc(BLOCK * 2)
}

/** The archive as a stream of gzip bytes. */
export function tarGz(entries: ArchiveEntry[]): Readable {
  return Readable.from(tarBlocks(entries)).pipe(createGzip())
}

/** Every file of a folder (not the dot-folders such as .cache), as archive entries under `prefix`. */
export async function folderEntries(dir: string, prefix: string): Promise<ArchiveEntry[]> {
  const out: ArchiveEntry[] = []
  const walk = async (sub: string) => {
    for (const item of await readdir(join(dir, sub), { withFileTypes: true }).catch(() => [])) {
      if (item.name.startsWith('.')) continue
      const rel = sub ? `${sub}/${item.name}` : item.name
      if (item.isDirectory()) await walk(rel)
      else if (item.isFile()) out.push({ name: `${prefix}/${rel}`, path: join(dir, rel) })
    }
  }
  await walk('')
  return out
}

/**
 * Reads a .tar.gz, handing each file to `place`, which says where to write it (or null to
 * skip it). Files are written beside their destination first, then moved into place.
 */
export async function extractTarGz(file: string, place: (name: string) => string | null): Promise<string[]> {
  const written: string[] = []
  let buffer = Buffer.alloc(0)
  let current: {
    name: string
    remaining: number
    pad: number
    out: ReturnType<typeof createWriteStream> | null
    tmp: string
    dest: string
  } | null = null
  let ended = false

  const finish = async () => {
    if (!current) return
    const done = current
    current = null
    if (done.out) {
      await new Promise<void>((resolve, reject) => done.out?.end((e?: Error | null) => (e ? reject(e) : resolve())))
      await rename(done.tmp, done.dest)
      written.push(done.name)
    }
  }

  const gunzip = createReadStream(file).pipe(createGunzip())
  for await (const chunk of gunzip) {
    buffer = Buffer.concat([buffer, chunk as Buffer])
    while (!ended) {
      if (current) {
        if (current.remaining > 0) {
          if (!buffer.length) break
          const take = Math.min(current.remaining, buffer.length)
          const part = buffer.subarray(0, take)
          if (current.out && !current.out.write(part))
            await new Promise<void>((resolve) => current?.out?.once('drain', () => resolve()))
          current.remaining -= take
          buffer = buffer.subarray(take)
          continue
        }
        if (buffer.length < current.pad) break
        buffer = buffer.subarray(current.pad)
        await finish()
        continue
      }
      if (buffer.length < BLOCK) break
      const h = buffer.subarray(0, BLOCK)
      buffer = buffer.subarray(BLOCK)
      if (h.every((b) => b === 0)) {
        ended = true
        break
      }
      const field = (start: number, length: number) =>
        h
          .subarray(start, start + length)
          .toString('utf8')
          .replace(/\0.*$/s, '')
      const size = Number.parseInt(field(124, 12).trim() || '0', 8)
      const prefix = field(345, 155)
      const name = prefix ? `${prefix}/${field(0, 100)}` : field(0, 100)
      const type = field(156, 1)
      const dest = type === '0' || type === '' ? place(name) : null
      let out: ReturnType<typeof createWriteStream> | null = null
      const tmp = dest ? `${dest}.restoring` : ''
      if (dest) {
        await mkdir(dirname(dest), { recursive: true })
        out = createWriteStream(tmp)
      }
      current = { name, remaining: size, pad: (BLOCK - (size % BLOCK)) % BLOCK, out, tmp, dest: dest ?? '' }
    }
    if (ended) break
  }
  if (current) throw new Error('The archive is incomplete')
  return written
}

/** Copies a stream to a file (the archive being downloaded, in tests). */
export async function saveStream(stream: Readable, path: string): Promise<void> {
  await pipeline(stream, createWriteStream(path))
}
