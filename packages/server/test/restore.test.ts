import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { saveStream, tarGz } from '../src/archive.ts'
import { createApp, VERSION } from '../src/index.ts'
import { applyArchive, type Restorer } from '../src/restore.ts'

const PASSWORD = 'una-password-lunga'
let dir: string
let database: Database
let app: ReturnType<typeof createApp>
let scheduled: string[]
let available: string | undefined

const configFor = () =>
  defineConfig({
    site: { name: 'Studio Rossi' },
    database: { url: `file:${join(dir, 'content.db')}` },
    media: { dir: join(dir, 'media') },
    collections: [defineCollection({ name: 'pages', fields: { title: f.text({ required: true }) } })],
  })

function client() {
  let cookie = ''
  return async (
    method: string,
    path: string,
    init: { json?: unknown; body?: Buffer; type?: string; token?: string } = {},
  ) => {
    const res = await app.request(path, {
      method,
      headers: {
        origin: 'http://localhost',
        ...(init.json ? { 'content-type': 'application/json' } : {}),
        ...(init.body ? { 'content-type': init.type ?? 'application/gzip' } : {}),
        ...(cookie ? { cookie } : {}),
        ...(init.token ? { 'x-mz-setup-token': init.token } : {}),
      },
      body: init.json ? JSON.stringify(init.json) : init.body ? new Uint8Array(init.body) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const data = Buffer.from(await res.arrayBuffer())
    const text = data.toString('utf8')
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {}
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read freely
    return { status: res.status, body: body as Record<string, any>, bytes: data }
  }
}

const restorer: Restorer = {
  unavailable: () => available,
  schedule: async (file) => {
    scheduled.push(file)
  },
  result: async () => null,
}

/** An archive made by hand: what «Scarica tutto» would write, or something broken on purpose. */
async function archiveOf(files: Record<string, string | Buffer>): Promise<Buffer> {
  const src = join(dir, `src-${Math.random()}`)
  await mkdir(src, { recursive: true })
  const entries = []
  for (const [name, data] of Object.entries(files)) {
    const path = join(src, name.replace(/\//g, '__'))
    await writeFile(path, data)
    entries.push({ name, path })
  }
  const out = join(dir, `a-${Math.random()}.tar.gz`)
  await saveStream(tarGz(entries), out)
  return readFile(out)
}

const manifest = (version = VERSION) =>
  JSON.stringify({ site: 'Altro sito', version, createdAt: '2026-11-10T10:00:00Z' })

let admin: ReturnType<typeof client>

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-restore-'))
  scheduled = []
  available = undefined
  const config = configFor()
  database = await openDatabase(config.database)
  app = createApp({ config: () => config, database, restore: restorer, setupToken: 'codice-segreto' })
  admin = client()
})

afterEach(async () => {
  database.close()
  await rm(dir, { recursive: true, force: true })
})

const setUp = () =>
  admin('POST', '/api/setup', {
    json: { email: 'elena@example.com', name: 'Elena', password: PASSWORD, token: 'codice-segreto' },
  })

describe('restoring an archive from the panel', () => {
  it('takes an archive made by «Scarica tutto», checks it and restarts with it', async () => {
    await setUp()
    // A real archive of this very site, as «Scarica tutto» downloads it.
    const archive = await admin('GET', '/api/backups/archive')
    expect(archive.status).toBe(200)
    const done = await admin('POST', '/api/backups/restore', { body: archive.bytes })
    expect(done.status).toBe(200)
    expect(done.body.summary).toMatchObject({ site: 'Studio Rossi', version: VERSION, database: true })
    await new Promise((r) => setTimeout(r, 350))
    expect(scheduled).toHaveLength(1)
    expect((await admin('GET', '/api/backups')).body.restore).toMatchObject({ last: null })
  })

  it('refuses what is not a whole archive from this version or an older one', async () => {
    await setUp()
    const sqlite = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(100)])
    const refused = async (body: Buffer) => (await admin('POST', '/api/backups/restore', { body })).status
    expect(await refused(Buffer.from('non è un archivio'))).toBe(422)
    const good = await archiveOf({ 'materialize.json': manifest(), 'content.db': sqlite })
    expect(await refused(good.subarray(0, good.length - 40))).toBe(422)
    expect(await refused(await archiveOf({ 'content.db': sqlite }))).toBe(422)
    expect(await refused(await archiveOf({ 'materialize.json': manifest('99.0.0'), 'content.db': sqlite }))).toBe(422)
    expect(await refused(await archiveOf({ 'materialize.json': manifest(), 'content.db': 'non un database' }))).toBe(
      422,
    )
    expect(await refused(await archiveOf({ 'materialize.json': manifest(), 'media/a.jpg': 'x' }))).toBe(422)
    expect(scheduled).toHaveLength(0)
    expect(await refused(good)).toBe(200)
  })

  it('belongs to administrators, and answers when the server cannot restart by itself', async () => {
    await setUp()
    const stranger = client()
    const sqlite = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(100)])
    const good = await archiveOf({ 'materialize.json': manifest(), 'content.db': sqlite })
    expect((await stranger('POST', '/api/backups/restore', { body: good })).status).toBe(401)
    available = 'In sviluppo si fa da terminale.'
    const res = await admin('POST', '/api/backups/restore', { body: good })
    expect(res.status).toBe(409)
    expect((await admin('GET', '/api/backups')).body.restore.unavailable).toBe('In sviluppo si fa da terminale.')
  })

  it('from the installation: with its code, and only before the first account', async () => {
    const sqlite = Buffer.concat([Buffer.from('SQLite format 3\0'), Buffer.alloc(100)])
    const good = await archiveOf({ 'materialize.json': manifest(), 'content.db': sqlite })
    const visitor = client()
    expect((await visitor('GET', '/api/setup')).body.restore).toMatchObject({ last: null })
    expect((await visitor('POST', '/api/setup/restore', { body: good })).status).toBe(403)
    expect((await visitor('POST', '/api/setup/restore', { body: good, token: 'sbagliato' })).status).toBe(403)
    expect((await visitor('POST', '/api/setup/restore', { body: good, token: 'codice-segreto' })).status).toBe(200)
    await setUp()
    expect((await visitor('POST', '/api/setup/restore', { body: good, token: 'codice-segreto' })).status).toBe(409)
  })

  it('stops an archive larger than the limit', async () => {
    await setUp()
    const before = process.env.MATERIALIZE_RESTORE_MAX
    process.env.MATERIALIZE_RESTORE_MAX = '1'
    try {
      const big = Buffer.alloc(2 * 1024 * 1024, 1)
      expect((await admin('POST', '/api/backups/restore', { body: big })).status).toBe(413)
    } finally {
      if (before === undefined) delete process.env.MATERIALIZE_RESTORE_MAX
      else process.env.MATERIALIZE_RESTORE_MAX = before
    }
  })
})

describe('putting an archive in place', () => {
  it('replaces the database, keeps the old one among the backups, and writes nothing outside', async () => {
    // The site to move: one account, one image.
    const other = await mkdtemp(join(tmpdir(), 'mz-other-'))
    const otherDb = await openDatabase({ url: `file:${join(other, 'content.db')}` })
    await otherDb.client.execute(
      "INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u1', 'luca@example.com', 'Luca', 'admin', 'x', 0)",
    )
    await otherDb.client.execute({ sql: 'VACUUM INTO ?', args: [join(other, 'copy.db')] })
    otherDb.close()
    const archive = join(dir, 'trasloco.tar.gz')
    await saveStream(
      tarGz([
        { name: 'materialize.json', path: await writeAndPath(other, 'm.json', manifest()) },
        { name: 'content.db', path: join(other, 'copy.db') },
        { name: 'media/foto.jpg', path: await writeAndPath(other, 'foto.jpg', 'una foto') },
        { name: 'media/../fuori.txt', path: await writeAndPath(other, 'fuori.txt', 'no') },
      ]),
      archive,
    )
    database.close()
    const { kept, written } = await applyArchive({
      file: archive,
      database: { url: `file:${join(dir, 'content.db')}` },
      mediaDir: join(dir, 'media'),
    })
    expect(written.sort()).toEqual(['content.db', 'media/foto.jpg'])
    expect(kept).toMatch(/prima-del-ripristino\.db$/)
    expect(await readFile(join(dir, 'media', 'foto.jpg'), 'utf8')).toBe('una foto')
    database = await openDatabase({ url: `file:${join(dir, 'content.db')}` })
    expect((await database.client.execute('SELECT email FROM users')).rows.map((r) => r.email)).toEqual([
      'luca@example.com',
    ])
    await rm(other, { recursive: true, force: true })
  })
})

async function writeAndPath(folder: string, name: string, data: string) {
  const path = join(folder, name)
  await writeFile(path, data)
  return path
}
