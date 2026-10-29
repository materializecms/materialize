import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineBlock, defineCollection, defineConfig, f } from '@materialize/core'
import { type Database, openDatabase } from '@materialize/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, hashPassword, verifyPassword } from '../src/index.ts'

const hero = defineBlock({ name: 'hero', fields: { title: f.text({ required: true }) } })

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  locales: { default: 'it', available: ['it', 'en'] },
  collections: [
    defineCollection({
      name: 'pages',
      url: (doc) => (doc.slug === 'home' ? '/' : `/${doc.slug}`),
      fields: {
        title: f.text({ required: true }),
        slug: f.slug({ from: 'title' }),
        blocks: f.blocks([hero]),
      },
    }),
    defineCollection({ name: 'settings', singleton: true, fields: { siteName: f.text({ required: true }) } }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>
let cookie = ''

/** Small client that keeps the session cookie, like a browser would. */
async function call(method: string, path: string, json?: unknown) {
  const res = await app.request(path, {
    method,
    headers: {
      origin: 'http://localhost',
      ...(json ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  })
  const set = res.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0] ?? ''
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  cookie = ''
})

afterEach(() => database.close())

async function signUp() {
  return call('POST', '/api/setup', { email: 'elena@studiorossi.it', name: 'Elena', password: 'una-password-lunga' })
}

describe('passwords', () => {
  it('hashes with a salt and verifies', async () => {
    const a = await hashPassword('segreto-segreto')
    const b = await hashPassword('segreto-segreto')
    expect(a).not.toBe(b)
    expect(await verifyPassword('segreto-segreto', a)).toBe(true)
    expect(await verifyPassword('sbagliata', a)).toBe(false)
    expect(await verifyPassword('x', 'garbage')).toBe(false)
  })
})

describe('setup and auth', () => {
  it('creates the first admin once and signs them in', async () => {
    expect((await call('GET', '/api/setup')).body).toEqual({ needsSetup: true })
    const created = await signUp()
    expect(created.status).toBe(201)
    expect(created.body.user.role).toBe('admin')
    expect((await call('GET', '/api/auth/me')).body.user.email).toBe('elena@studiorossi.it')
    expect((await signUp()).status).toBe(409)
  })

  it('rejects short passwords at setup', async () => {
    const res = await call('POST', '/api/setup', { email: 'a@b.it', name: 'A', password: 'corta' })
    expect(res.status).toBe(422)
    expect(res.body.error.issues[0].path).toBe('password')
  })

  it('logs in and out', async () => {
    await signUp()
    await call('POST', '/api/auth/logout')
    expect((await call('GET', '/api/auth/me')).status).toBe(401)
    expect(
      (await call('POST', '/api/auth/login', { email: 'elena@studiorossi.it', password: 'sbagliata' })).status,
    ).toBe(401)
    expect(
      (await call('POST', '/api/auth/login', { email: 'ELENA@studiorossi.it', password: 'una-password-lunga' })).status,
    ).toBe(200)
    expect((await call('GET', '/api/auth/me')).status).toBe(200)
  })

  it('protects the management API', async () => {
    expect((await call('GET', '/api/schema')).status).toBe(401)
    expect((await call('GET', '/api/collections/pages')).status).toBe(401)
  })

  it('blocks cross-site form posts', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://evil.example' },
      body: 'email=a@b.it&password=x',
    })
    expect(res.status).toBe(403)
  })
})

describe('content workflow', () => {
  beforeEach(async () => {
    await signUp()
  })

  it('describes the schema for the admin', async () => {
    const res = await call('GET', '/api/schema')
    expect(res.body.site.name).toBe('Studio Rossi')
    expect(res.body.collections.map((c: { name: string }) => c.name)).toEqual(['pages', 'settings'])
  })

  it('saves incomplete drafts but only publishes valid content', async () => {
    const res = await call('POST', '/api/collections/pages', { data: { blocks: [{ _type: 'hero', _key: 'k' }] } })
    expect(res.status).toBe(201)
    expect(res.body.title).toBe('Senza titolo')
    expect(res.body.issues.map((i: { path: string; message: string }) => [i.path, i.message])).toEqual([
      ['title', 'Campo obbligatorio'],
      ['blocks.0.title', 'Campo obbligatorio'],
    ])

    const publish = await call('POST', `/api/documents/${res.body.id}/publish`)
    expect(publish.status).toBe(422)
    expect(publish.body.error.issues).toHaveLength(2)

    const fixed = await call('PUT', `/api/documents/${res.body.id}`, {
      data: { title: 'Studio', blocks: [{ _type: 'hero', _key: 'k', title: 'Luce' }] },
    })
    expect(fixed.body.issues).toEqual([])
    expect((await call('POST', `/api/documents/${res.body.id}/publish`)).status).toBe(200)
  })

  it('drafts, publishes and serves only published content', async () => {
    const created = await call('POST', '/api/collections/pages', { data: { title: 'Chi siamo' } })
    expect(created.status).toBe(201)
    expect(created.body.slug).toBe('chi-siamo')
    expect(created.body.url).toBe('/chi-siamo')
    expect(created.body.status).toBe('draft')
    const id = created.body.id

    expect((await call('GET', '/api/content/pages/chi-siamo')).status).toBe(404)

    expect((await call('POST', `/api/documents/${id}/publish`)).body.status).toBe('published')
    cookie = ''
    const live = await call('GET', '/api/content/pages/chi-siamo')
    expect(live.status).toBe(200)
    expect(live.body.data.title).toBe('Chi siamo')

    await call('POST', '/api/auth/login', { email: 'elena@studiorossi.it', password: 'una-password-lunga' })
    const edited = await call('PUT', `/api/documents/${id}`, { data: { title: 'Lo studio', slug: 'chi-siamo' } })
    expect(edited.body.status).toBe('changed')
    expect((await call('GET', '/api/content/pages/chi-siamo')).body.data.title).toBe('Chi siamo')

    const list = await call('GET', '/api/content/pages')
    expect(list.body.total).toBe(1)
    expect(list.body.items[0].data.title).toBe('Chi siamo')

    await call('POST', `/api/documents/${id}/unpublish`)
    expect((await call('GET', '/api/content/pages/chi-siamo')).status).toBe(404)
  })

  it('refuses a duplicate address', async () => {
    await call('POST', '/api/collections/pages', { data: { title: 'Progetti' } })
    const dup = await call('POST', '/api/collections/pages', { data: { title: 'Progetti' } })
    expect(dup.status).toBe(409)
    expect(dup.body.error.code).toBe('slug_taken')
  })

  it('keeps one document per singleton', async () => {
    expect((await call('POST', '/api/collections/settings', { data: { siteName: 'Studio Rossi' } })).status).toBe(201)
    expect((await call('POST', '/api/collections/settings', { data: { siteName: 'Altro' } })).status).toBe(409)
  })

  it('restores an earlier version', async () => {
    const created = await call('POST', '/api/collections/pages', { data: { title: 'Prima' } })
    const id = created.body.id
    // Publishing closes the version; quick consecutive saves would otherwise merge into one revision.
    await call('POST', `/api/documents/${id}/publish`)
    await call('PUT', `/api/documents/${id}`, { data: { title: 'Seconda', slug: 'prima' } })
    const history = await call('GET', `/api/documents/${id}/revisions`)
    const first = history.body.items.find(
      (r: { kind: string; data: { title: string } }) => r.kind === 'save' && r.data.title === 'Prima',
    )
    const restored = await call('POST', `/api/documents/${id}/revisions/${first.id}/restore`)
    expect(restored.body.data.title).toBe('Prima')
  })

  it('handles locales and unknown names clearly', async () => {
    expect((await call('POST', '/api/collections/pages', { data: { title: 'About' }, locale: 'en' })).status).toBe(201)
    expect((await call('POST', '/api/collections/pages', { data: { title: 'Über' }, locale: 'de' })).status).toBe(400)
    expect((await call('GET', '/api/collections/products')).status).toBe(404)
    expect((await call('GET', '/api/collections/pages?locale=en')).body.total).toBe(1)
  })

  it('deletes documents', async () => {
    const created = await call('POST', '/api/collections/pages', { data: { title: 'Da eliminare' } })
    expect((await call('DELETE', `/api/documents/${created.body.id}`)).status).toBe(204)
    expect((await call('GET', `/api/documents/${created.body.id}`)).status).toBe(404)
  })
})

describe('status page', () => {
  it('confirms the server is up', async () => {
    const res = await app.request('/')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Studio Rossi è online')
  })
})

describe('admin app', () => {
  it('explains how to build the admin when it is missing', async () => {
    const res = await app.request('/admin/collections')
    expect(res.status).toBe(503)
    expect(await res.text()).toContain('npm run build')
  })

  it('serves files and falls back to index.html for client routes', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mz-admin-'))
    await mkdir(join(dir, 'assets'))
    await writeFile(join(dir, 'index.html'), '<div id="root"></div>')
    await writeFile(join(dir, 'assets', 'app-123.js'), 'console.log(1)')
    const admin = createApp({ config: () => config, database, adminDir: dir })

    const asset = await admin.request('/admin/assets/app-123.js')
    expect(asset.headers.get('cache-control')).toContain('immutable')
    expect(await (await admin.request('/admin/pages/abc')).text()).toContain('root')
    expect((await admin.request('/admin/assets/missing.js')).status).toBe(404)
    expect((await admin.request('/admin/..%2Fsecret.txt')).status).toBe(404)
    await rm(dir, { recursive: true })
  })
})
