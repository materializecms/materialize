import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineBlock, defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
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
  return call('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: 'una-password-lunga' })
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
    expect((await call('GET', '/api/setup')).body.needsSetup).toBe(true)
    const created = await signUp()
    expect(created.status).toBe(201)
    expect(created.body.user.role).toBe('admin')
    expect((await call('GET', '/api/auth/me')).body.user.email).toBe('elena@example.com')
    expect((await signUp()).status).toBe(409)
  })

  it('rejects short passwords at setup', async () => {
    const res = await call('POST', '/api/setup', { email: 'a@b.example', name: 'A', password: 'corta' })
    expect(res.status).toBe(422)
    expect(res.body.error.issues[0].path).toBe('password')
  })

  it('logs in and out', async () => {
    await signUp()
    await call('POST', '/api/auth/logout')
    expect((await call('GET', '/api/auth/me')).status).toBe(401)
    expect((await call('POST', '/api/auth/login', { email: 'elena@example.com', password: 'sbagliata' })).status).toBe(
      401,
    )
    expect(
      (await call('POST', '/api/auth/login', { email: 'ELENA@example.com', password: 'una-password-lunga' })).status,
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
      body: 'email=a@b.example&password=x',
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

    await call('POST', '/api/auth/login', { email: 'elena@example.com', password: 'una-password-lunga' })
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
    // Each version says who made it.
    expect(first.authorName).toBe('Elena')
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

describe('scheduled publishing', () => {
  beforeEach(async () => {
    await signUp()
  })
  const inMinutes = (m: number) => new Date(Date.now() + m * 60_000)
  const create = async (data: Record<string, unknown>) =>
    (await call('POST', '/api/collections/pages', { data })).body.id as string
  const schedule = (id: string, action: string, at: Date | null) =>
    call('PUT', `/api/documents/${id}/schedule`, { action, at: at?.toISOString() ?? null })

  it('publishes the draft as it is when the time comes, as the person who set it', async () => {
    const id = await create({ title: 'Saldi' })
    const set = await schedule(id, 'publish', inMinutes(60))
    expect(set.status).toBe(200)
    expect(set.body.schedule.publish.createdByName).toBe('Elena')
    expect((await call('GET', '/api/collections/pages')).body.items[0].publishAt).toBeTruthy()

    // Edited after scheduling: the newer draft is what goes online.
    await call('PUT', `/api/documents/${id}`, { data: { title: 'Saldi d’inverno', slug: 'saldi' } })
    expect(await app.runSchedules(inMinutes(30))).toBe(0)
    expect(await app.runSchedules(inMinutes(61))).toBe(1)
    const doc = (await call('GET', `/api/documents/${id}`)).body
    expect(doc.status).toBe('published')
    expect(doc.schedule.publish).toBeNull()
    expect((await call('GET', '/api/content/pages/saldi')).body.data.title).toBe('Saldi d’inverno')
    const log = (await call('GET', '/api/activity?group=content')).body.items[0]
    expect(log).toMatchObject({ action: 'document.published', userName: 'Elena', detail: { scheduled: true } })
  })

  it('refuses a time in the past and an incomplete page, before they fail at night', async () => {
    const id = await create({ title: 'Saldi' })
    expect((await schedule(id, 'publish', inMinutes(-5))).body.error.code).toBe('past_time')
    const incomplete = await create({ blocks: [{ _type: 'hero', _key: 'k' }] })
    const res = await schedule(incomplete, 'publish', inMinutes(60))
    expect(res.status).toBe(422)
    expect(res.body.error.issues).toHaveLength(2)
  })

  it('fails with a reason when the page broke in the meantime, and keeps it to show', async () => {
    const id = await create({ title: 'Saldi', blocks: [{ _type: 'hero', _key: 'k', title: 'Luce' }] })
    await schedule(id, 'publish', inMinutes(60))
    await call('PUT', `/api/documents/${id}`, { data: { title: 'Saldi', blocks: [{ _type: 'hero', _key: 'k' }] } })
    await app.runSchedules(inMinutes(61))
    const doc = (await call('GET', `/api/documents/${id}`)).body
    expect(doc.status).toBe('draft')
    expect(doc.schedule.failed.error).toMatch(/Alcuni campi vanno completati/)
    // Publishing by hand clears it.
    await call('PUT', `/api/documents/${id}`, {
      data: { title: 'Saldi', blocks: [{ _type: 'hero', _key: 'k', title: 'Luce' }] },
    })
    await schedule(id, 'publish', inMinutes(90))
    await call('POST', `/api/documents/${id}/publish`)
    const after = (await call('GET', `/api/documents/${id}`)).body.schedule
    expect(after).toEqual({ publish: null, unpublish: null, failed: null })
  })

  it('takes a page off the site, never before it is published', async () => {
    const id = await create({ title: 'Promo' })
    expect((await schedule(id, 'unpublish', inMinutes(60))).body.error.code).toBe('not_published')
    await schedule(id, 'publish', inMinutes(60))
    expect((await schedule(id, 'unpublish', inMinutes(30))).body.error.code).toBe('before_publish')
    expect((await schedule(id, 'unpublish', inMinutes(120))).status).toBe(200)
    await app.runSchedules(inMinutes(61))
    expect((await call('GET', '/api/content/pages/promo')).status).toBe(200)
    await app.runSchedules(inMinutes(121))
    expect((await call('GET', '/api/content/pages/promo')).status).toBe(404)
  })

  it('cancels, lists what is coming, and forgets a deleted page', async () => {
    const a = await create({ title: 'Primo' })
    const b = await create({ title: 'Secondo' })
    await schedule(b, 'publish', inMinutes(120))
    await schedule(a, 'publish', inMinutes(60))
    expect((await call('GET', '/api/schedules')).body.items.map((i: { title: string }) => i.title)).toEqual([
      'Primo',
      'Secondo',
    ])
    expect((await schedule(a, 'publish', null)).body.schedule.publish).toBeNull()
    await call('DELETE', `/api/documents/${b}`)
    expect((await call('GET', '/api/schedules')).body.items).toEqual([])
  })
})

describe('shared preview links', () => {
  beforeEach(async () => {
    // A site that renders pages: the only kind where a preview link means something.
    app = createApp({ config: () => config, database, preview: true })
    await signUp()
  })
  const create = async (data: Record<string, unknown>) =>
    (await call('POST', '/api/collections/pages', { data })).body.id as string

  it('makes a secret link that works until it expires or is revoked', async () => {
    const id = await create({ title: 'Listino', slug: 'listino' })
    const made = await call('POST', `/api/documents/${id}/previews`, { days: 7 })
    expect(made.status).toBe(201)
    expect(made.body.url).toMatch(/^http:\/\/localhost\/_materialize\/share\/[\w-]{32}$/)
    expect(new Date(made.body.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)
    expect(made.body.createdByName).toBe('Elena')
    await call('POST', `/api/documents/${id}/previews`, { days: null })
    const list = (await call('GET', `/api/documents/${id}/previews`)).body.items
    expect(list).toHaveLength(2)
    expect(list[0].expiresAt).toBeNull()

    expect((await call('DELETE', `/api/previews/${made.body.id}`)).status).toBe(204)
    expect((await call('GET', `/api/documents/${id}/previews`)).body.items).toHaveLength(1)
    const log = (await call('GET', '/api/activity?group=content')).body.items.map((e: { action: string }) => e.action)
    expect(log.slice(0, 3)).toEqual(['document.preview_revoked', 'document.preview_shared', 'document.preview_shared'])
  })

  it('refuses content without a page, a site without pages, and strangers', async () => {
    const settings = (await call('POST', '/api/collections/settings', { data: { siteName: 'Rossi' } })).body.id
    expect((await call('POST', `/api/documents/${settings}/previews`, { days: 7 })).body.error.code).toBe('no_page')
    const id = await create({ title: 'Listino' })
    app = createApp({ config: () => config, database })
    expect((await call('POST', `/api/documents/${id}/previews`, { days: 7 })).body.error.code).toBe('no_site')
    cookie = ''
    expect((await call('GET', `/api/documents/${id}/previews`)).status).toBe(401)
  })

  it('forgets the links of a deleted document', async () => {
    const id = await create({ title: 'Listino' })
    await call('POST', `/api/documents/${id}/previews`, { days: 1 })
    await call('DELETE', `/api/documents/${id}`)
    const { createPreviewLinkStore } = await import('@materializecms/db')
    expect(await createPreviewLinkStore(database.db).forDocument(id)).toEqual([])
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
