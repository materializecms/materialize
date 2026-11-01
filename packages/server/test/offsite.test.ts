import { randomBytes } from 'node:crypto'
import { copyFile, mkdir, mkdtemp, readFile, rm, truncate, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createBackups } from '../src/backups.ts'
import {
  DEFAULT_OFFSITE,
  decryptFile,
  decryptTree,
  encryptFile,
  newRecoveryKey,
  parseRecoveryKey,
  runOffsite,
} from '../src/offsite.ts'
import type { RemoteItem, RemoteStorage } from '../src/remote-storage.ts'
import { signS3 } from '../src/remote-storage.ts'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-offsite-'))
})
afterEach(() => rm(dir, { recursive: true, force: true }))

describe('S3 signature', () => {
  it('matches the example in Amazon’s documentation (GET object)', () => {
    const signed = signS3(
      {
        endpoint: 'https://s3.amazonaws.com',
        region: 'us-east-1',
        bucket: 'examplebucket',
        accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
        secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      },
      'GET',
      'test.txt',
      {},
      { range: 'bytes=0-9' },
      new Date('2013-05-24T00:00:00Z'),
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(signed.url).toBe('https://examplebucket.s3.amazonaws.com/test.txt')
    expect(signed.headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    )
  })

  it('puts the bucket in the path for the other services', () => {
    const signed = signS3(
      {
        endpoint: 'https://abc.r2.cloudflarestorage.com',
        region: 'auto',
        bucket: 'backup',
        accessKeyId: 'k',
        secretAccessKey: 's',
      },
      'PUT',
      'media/foto 1.jpg.mzb',
    )
    expect(signed.url).toBe('https://abc.r2.cloudflarestorage.com/backup/media/foto%201.jpg.mzb')
  })
})

describe('encryption', () => {
  const key = parseRecoveryKey(newRecoveryKey())

  it('gives back the same bytes, also across several blocks', async () => {
    const data = randomBytes(2.5 * 1024 * 1024)
    await writeFile(join(dir, 'a'), data)
    await encryptFile(join(dir, 'a'), join(dir, 'a.mzb'), key)
    const sealed = await readFile(join(dir, 'a.mzb'))
    expect(sealed.subarray(0, 4).toString()).toBe('MZB1')
    expect(sealed.includes(data.subarray(0, 64))).toBe(false)
    await decryptFile(join(dir, 'a.mzb'), join(dir, 'b'), key)
    expect((await readFile(join(dir, 'b'))).equals(data)).toBe(true)
  })

  it('handles an empty file', async () => {
    await writeFile(join(dir, 'empty'), '')
    await encryptFile(join(dir, 'empty'), join(dir, 'empty.mzb'), key)
    await decryptFile(join(dir, 'empty.mzb'), join(dir, 'back'), key)
    expect((await readFile(join(dir, 'back'))).length).toBe(0)
  })

  it('refuses a wrong key, a changed byte and a file cut at a block boundary', async () => {
    await writeFile(join(dir, 'a'), randomBytes(2 * 1024 * 1024 + 10))
    await encryptFile(join(dir, 'a'), join(dir, 'a.mzb'), key)
    const other = parseRecoveryKey(newRecoveryKey())
    await expect(decryptFile(join(dir, 'a.mzb'), join(dir, 'x'), other)).rejects.toThrow(/Chiave sbagliata|modificato/)

    const changed = await readFile(join(dir, 'a.mzb'))
    changed[100] = (changed[100] as number) ^ 1
    await writeFile(join(dir, 'changed.mzb'), changed)
    await expect(decryptFile(join(dir, 'changed.mzb'), join(dir, 'x'), key)).rejects.toThrow()

    // The first two blocks, whole: without the last one the file must not pass for complete.
    await copyFile(join(dir, 'a.mzb'), join(dir, 'cut.mzb'))
    await truncate(join(dir, 'cut.mzb'), 12 + 2 * (4 + 1024 * 1024 + 16))
    await expect(decryptFile(join(dir, 'cut.mzb'), join(dir, 'x'), key)).rejects.toThrow(/incompleto|modificato/)
  })

  it('reads the key with or without its mark and spaces, and refuses a wrong one', () => {
    const text = newRecoveryKey()
    expect(parseRecoveryKey(` ${text.slice(0, 20)} ${text.slice(20)} `).equals(parseRecoveryKey(text))).toBe(true)
    expect(() => parseRecoveryKey('mzk1-corta')).toThrow(/non è valida/)
  })
})

/** A storage in memory, with the files it received. */
function memoryStorage() {
  const files = new Map<string, Buffer>()
  const storage: RemoteStorage = {
    async put(key, file) {
      files.set(key, await readFile(file))
    },
    async putText(key, text) {
      files.set(key, Buffer.from(text))
    },
    async get(key, file) {
      await writeFile(file, files.get(key) ?? Buffer.alloc(0))
    },
    async getText(key) {
      return (files.get(key) ?? Buffer.alloc(0)).toString()
    },
    async list(prefix) {
      return [...files]
        .filter(([k]) => k.startsWith(prefix))
        .map(([k, v]): RemoteItem => ({ key: k, size: v.length, modified: new Date() }))
    },
    async delete(key) {
      files.delete(key)
    },
  }
  return { storage, files }
}

describe('the nightly copy', () => {
  it('sends the newest database copy and the new media once, encrypted, and keeps `keep` copies', async () => {
    const site = join(dir, 'site')
    await mkdir(join(site, 'media', '.cache'), { recursive: true })
    await mkdir(join(site, 'fonts', 'inter'), { recursive: true })
    await writeFile(join(site, 'media', 'foto.jpg'), 'immagine')
    await writeFile(join(site, 'media', '.cache', 'foto@960.webp'), 'variante')
    await writeFile(join(site, 'fonts', 'inter', 'inter.woff2'), 'carattere')
    const database = await openDatabase({ url: `file:${join(site, 'content.db')}` })
    const backups = createBackups(database, () => join(site, 'media'))
    const recoveryKey = newRecoveryKey()
    const settings = { ...DEFAULT_OFFSITE, kind: 's3' as const, keep: 2, key: recoveryKey }
    const { storage, files } = memoryStorage()

    const first = await runOffsite(settings, backups, join(site, 'media'), true, storage)
    expect(first).toMatchObject({ ok: true, media: 1, fonts: 1 })
    expect([...files.keys()].sort()).toEqual([
      'LEGGIMI.txt',
      `database/${first.database}.mzb`,
      'fonts/inter/inter.woff2.mzb',
      'media/foto.jpg.mzb',
    ])
    // Nothing readable leaves the server.
    expect(files.get('media/foto.jpg.mzb')?.includes(Buffer.from('immagine'))).toBe(false)

    const again = await runOffsite(settings, backups, join(site, 'media'), false, storage)
    expect(again).toMatchObject({ ok: true, media: 0, fonts: 0 })

    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 1100))
      await runOffsite(settings, backups, join(site, 'media'), true, storage)
    }
    expect([...files.keys()].filter((k) => k.startsWith('database/'))).toHaveLength(2)

    // What came back decrypts to the original.
    const down = join(dir, 'down', 'media')
    await mkdir(down, { recursive: true })
    await storage.get('media/foto.jpg.mzb', join(down, 'foto.jpg.mzb'))
    expect(await decryptTree(join(dir, 'down'), parseRecoveryKey(recoveryKey))).toEqual([join(down, 'foto.jpg')])
    expect(await readFile(join(down, 'foto.jpg'), 'utf8')).toBe('immagine')
    database.close()
  }, 20_000)
})

describe('WebDAV listing', () => {
  /** Nextcloud writes <d:collection/>; rclone <D:collection xmlns:D="DAV:"/>. Both are folders. */
  const styles = {
    nextcloud: (href: string, folder: boolean, size = 0) =>
      `<d:response><d:href>${href}</d:href><d:propstat><d:prop><d:resourcetype>${folder ? '<d:collection/>' : ''}</d:resourcetype>${folder ? '' : `<d:getcontentlength>${size}</d:getcontentlength>`}<d:getlastmodified>Sun, 01 Nov 2026 10:00:00 GMT</d:getlastmodified></d:prop></d:propstat></d:response>`,
    rclone: (href: string, folder: boolean, size = 0) =>
      `<D:response><D:href>${href}</D:href><D:propstat><D:prop><D:resourcetype>${folder ? '<D:collection xmlns:D="DAV:"/>' : ''}</D:resourcetype>${folder ? '' : `<D:getcontentlength>${size}</D:getcontentlength>`}</D:prop></D:propstat></D:response>`,
  }
  for (const [name, row] of Object.entries(styles))
    it(`reads folders and files in the ${name} style`, async () => {
      const { createServer } = await import('node:http')
      const { createWebDavStorage } = await import('../src/remote-storage.ts')
      const tree: Record<string, string[]> = {
        '/dav/backup/': [
          row('/dav/backup/', true),
          row('/dav/backup/LEGGIMI.txt', false, 660),
          row('/dav/backup/media/', true),
        ],
        '/dav/backup/media/': [row('/dav/backup/media/', true), row('/dav/backup/media/foto%20uno.jpg.mzb', false, 41)],
      }
      const server = createServer((req, res) => {
        const rows = tree[req.url ?? '']
        if (req.method !== 'PROPFIND' || !rows) return res.writeHead(404).end()
        res.writeHead(207, { 'content-type': 'application/xml' })
        res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:" xmlns:D="DAV:">${rows.join('')}</d:multistatus>`)
      })
      await new Promise<void>((r) => server.listen(0, r))
      const { port } = server.address() as { port: number }
      try {
        const storage = createWebDavStorage({ url: `http://localhost:${port}/dav/backup`, user: 'u', password: 'p' })
        const items = await storage.list('')
        expect(items.map((i) => [i.key, i.size])).toEqual([
          ['LEGGIMI.txt', 660],
          ['media/foto uno.jpg.mzb', 41],
        ])
      } finally {
        server.close()
      }
    })
})
