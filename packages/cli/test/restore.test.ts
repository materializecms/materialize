import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPendingRestore } from '../src/commands.ts'

vi.hoisted(() => {
  process.env.MATERIALIZE_LANG = 'it'
})

let dir: string
const configFor = () =>
  defineConfig({
    site: { name: 'Prova' },
    database: { url: `file:${join(dir, '.materialize', 'content.db')}` },
    media: { dir: join(dir, '.materialize', 'media') },
    collections: [defineCollection({ name: 'pages', fields: { title: f.text() } })],
  })

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-start-restore-'))
  await mkdir(join(dir, '.materialize', 'media'), { recursive: true })
})
afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

/** An archive like «Scarica tutto», made with the server's own writer. */
async function archive(path: string, files: { name: string; data: Buffer | string }[]) {
  const { saveStream, tarGz } = await import('../../server/src/archive.ts')
  const src = join(dir, 'src')
  await mkdir(src, { recursive: true })
  const entries = []
  for (const [i, file] of files.entries()) {
    const p = join(src, String(i))
    await writeFile(p, file.data)
    entries.push({ name: file.name, path: p })
  }
  await saveStream(tarGz(entries), path)
}

describe('an archive uploaded from the panel', () => {
  it('goes in at start-up, before the database opens, and leaves its outcome', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const config = configFor()
    // The site here now, and the one arriving.
    const here = await openDatabase(config.database)
    here.close()
    const other = await openDatabase({ url: `file:${join(dir, 'other.db')}` })
    await other.client.execute(
      "INSERT INTO users (id, email, name, role, password_hash, created_at) VALUES ('u1', 'luca@example.com', 'Luca', 'admin', 'x', 0)",
    )
    // As «Scarica tutto» makes it: a complete copy, written-ahead pages included.
    await other.client.execute({ sql: 'VACUUM INTO ?', args: [join(dir, 'copy.db')] })
    other.close()
    await mkdir(join(dir, '.materialize', 'restore'), { recursive: true })
    await archive(join(dir, '.materialize', 'restore', 'pending.tar.gz'), [
      { name: 'materialize.json', data: '{"version":"0.9.3"}' },
      { name: 'content.db', data: await readFile(join(dir, 'copy.db')) },
      { name: 'media/foto.jpg', data: 'una foto' },
    ])

    await applyPendingRestore(config)

    expect(existsSync(join(dir, '.materialize', 'restore', 'pending.tar.gz'))).toBe(false)
    const result = JSON.parse(await readFile(join(dir, '.materialize', 'restore', 'result.json'), 'utf8'))
    expect(result).toMatchObject({ ok: true, media: 1 })
    expect(
      (await readdir(join(dir, '.materialize', 'backups'))).some((n) => n.endsWith('-prima-del-ripristino.db')),
    ).toBe(true)
    const restored = await openDatabase(config.database)
    expect((await restored.client.execute('SELECT email FROM users')).rows[0]?.email).toBe('luca@example.com')
    restored.close()
  })

  it('a broken one does not stop the server: the site stays as it was', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const config = configFor()
    ;(await openDatabase(config.database)).close()
    await mkdir(join(dir, '.materialize', 'restore'), { recursive: true })
    await writeFile(join(dir, '.materialize', 'restore', 'pending.tar.gz'), 'non è un archivio')

    await applyPendingRestore(config)

    const result = JSON.parse(await readFile(join(dir, '.materialize', 'restore', 'result.json'), 'utf8'))
    expect(result.ok).toBe(false)
    expect(existsSync(join(dir, '.materialize', 'restore', 'pending.tar.gz'))).toBe(false)
    expect(existsSync(join(dir, '.materialize', 'content.db'))).toBe(true)
  })

  it('without one, nothing happens', async () => {
    await applyPendingRestore(configFor())
    expect(existsSync(join(dir, '.materialize', 'restore', 'result.json'))).toBe(false)
  })
})
