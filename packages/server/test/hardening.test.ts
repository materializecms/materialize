import { defineCollection, defineConfig, f, type MaterializeConfig } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Prova' },
  collections: [
    defineCollection({
      name: 'pages',
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), page: f.page() },
    }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>

function client(host = 'localhost', extra: Record<string, string> = {}) {
  let cookie = ''
  const call = async (method: string, path: string, json?: unknown, raw?: string) => {
    const res = await app.request(`http://${host}${path}`, {
      method,
      headers: {
        origin: `http://${host}`,
        ...(json !== undefined || raw ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...extra,
      },
      body: raw ?? (json !== undefined ? JSON.stringify(json) : undefined),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {}
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read freely
    return { status: res.status, body: body as Record<string, any>, setCookie: set ?? '' }
  }
  return call
}

const start = (cfg: MaterializeConfig = config) => {
  app = createApp({ config: () => cfg, database })
}

let admin: ReturnType<typeof client>
let editor: ReturnType<typeof client>

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  start()
  admin = client()
  await admin('POST', '/api/setup', { email: 'a@prova.example', name: 'A', password: 'una-password-lunga' })
  const { body: invite } = await admin('POST', '/api/users/invites', { email: 'e@prova.example', role: 'editor' })
  editor = client()
  await editor('POST', `/api/invites/${invite.link.split('/').pop()}/accept`, {
    name: 'E',
    password: 'password-editor',
  })
})
afterEach(() => database.close())

/** A section with a copy of a component, with these overrides on its elements. */
const withCopy = (overrides: Record<string, unknown>) => [
  {
    id: 's1',
    type: 'frame',
    children: [{ id: 'c1', type: 'frame', component: 'card', overrides }],
  },
]

describe('component copies', () => {
  it('keep only words, links and images for an editor: never code or a form', async () => {
    const save = (page: unknown) => editor('POST', '/api/collections/pages', { data: { title: 'X', page } })
    expect((await save(withCopy({ t1: { text: 'Ciao', href: '/contatti' } }))).status).toBe(201)
    expect((await save(withCopy({ t1: { type: 'embed', html: '<script>x</script>' } }))).status).toBe(403)
    expect((await save(withCopy({ t1: { html: '<img src=x onerror=alert(1)>' } }))).status).toBe(403)
    expect(
      (await save(withCopy({ t1: { form: { to: 'attacker@example.com', webhook: 'http://127.0.0.1/' } } }))).status,
    ).toBe(403)
    // An administrator may (the code is theirs to write anyway).
    const mine = await admin('POST', '/api/collections/pages', {
      data: { title: 'Y', page: withCopy({ t1: { type: 'embed', html: '<b>ok</b>' } }) },
    })
    expect(mine.status).toBe(201)
    // An editor who leaves it as it is can still change the rest.
    const kept = await editor('PUT', `/api/documents/${mine.body.id}`, {
      data: { title: 'Z', page: withCopy({ t1: { type: 'embed', html: '<b>ok</b>' } }) },
    })
    expect(kept.status).toBe(200)
  })

  it('an editor cannot write a form’s automatic reply', async () => {
    const page = (autoReply: unknown) => [{ id: 'f1', type: 'frame', form: { name: 'Contatti', autoReply } }]
    const doc = (await admin('POST', '/api/collections/pages', { data: { title: 'C', page: page(null) } })).body
    const res = await editor('PUT', `/api/documents/${doc.id}`, {
      data: { title: 'C', page: page({ subject: 'Ciao', text: 'Clicca qui: https://evil.example' }) },
    })
    expect(res.status).toBe(403)
  })
})

describe('restoring a version', () => {
  it('goes through the same checks as a save', async () => {
    const embed = [{ id: 's1', type: 'frame', children: [{ id: 'e1', type: 'embed', html: '<script>x</script>' }] }]
    const doc = (await admin('POST', '/api/collections/pages', { data: { title: 'X', page: embed } })).body
    // Published: a version of its own (quick saves in a row are merged into one).
    await admin('POST', `/api/documents/${doc.id}/publish`)
    await admin('PUT', `/api/documents/${doc.id}`, { data: { title: 'X', page: [] } })
    const items = (await admin('GET', `/api/documents/${doc.id}/revisions`)).body.items
    const old = items.find((r: { kind: string }) => r.kind === 'publish')
    expect(old.data.page).toEqual(embed)
    expect((await editor('POST', `/api/documents/${doc.id}/revisions/${old.id}/restore`)).status).toBe(403)
    expect((await admin('POST', `/api/documents/${doc.id}/revisions/${old.id}/restore`)).status).toBe(200)
    expect((await editor('POST', `/api/documents/${doc.id}/revisions/nope/restore`)).status).toBe(404)
  })
})

describe('request sizes', () => {
  it('refuses huge bodies from strangers, takes big pages from the panel', async () => {
    const stranger = client()
    const huge = JSON.stringify({ email: 'a@prova.example', password: 'x'.repeat(3 * 1024 * 1024) })
    expect((await stranger('POST', '/api/auth/login', undefined, huge)).status).toBe(413)
    // Too long to be a password: refused before it is hashed.
    expect(
      (await stranger('POST', '/api/auth/login', { email: 'a@prova.example', password: 'x'.repeat(1001) })).status,
    ).toBe(422)
    const page = [{ id: 's1', type: 'frame', children: [{ id: 't1', type: 'text', text: 'parola '.repeat(500_000) }] }]
    expect((await admin('POST', '/api/collections/pages', { data: { title: 'Grande', page } })).status).toBe(201)
  })
})

describe('the public content API', () => {
  it('shows a form’s visible parts, not where its messages go', async () => {
    const form = {
      name: 'Contatti',
      success: 'Grazie!',
      subject: 'Richiesta',
      to: 'segreto@prova.example',
      webhook: 'https://hooks.example/abc',
      autoReply: { subject: 'Ciao', text: 'Ricevuto' },
    }
    const page = [{ id: 'f1', type: 'frame', form, children: [] }, ...withCopy({ t1: { form } })]
    const doc = (await admin('POST', '/api/collections/pages', { data: { title: 'Contatti', page } })).body
    expect((await admin('POST', `/api/documents/${doc.id}/publish`)).status).toBe(200)
    const visitor = client()
    for (const path of ['/api/content/pages', '/api/content/pages/contatti']) {
      const text = JSON.stringify((await visitor('GET', path)).body)
      expect(text).toContain('Grazie!')
      for (const secret of ['segreto@prova.example', 'hooks.example', 'Ricevuto', 'Richiesta'])
        expect(text).not.toContain(secret)
    }
  })
})

describe('the session cookie', () => {
  it('is secure behind a trusted HTTPS proxy, and at an https site', async () => {
    start({ ...config, server: { ...config.server, trustProxy: true } })
    const proxied = client('cms.example', { 'x-forwarded-proto': 'https' })
    const res = await proxied('POST', '/api/auth/login', { email: 'a@prova.example', password: 'una-password-lunga' })
    expect(res.setCookie).toMatch(/;\s*Secure/i)
    start({ ...config, site: { ...config.site, url: 'https://www.prova.example' } })
    const site = await client('www.prova.example')('POST', '/api/auth/login', {
      email: 'a@prova.example',
      password: 'una-password-lunga',
    })
    expect(site.setCookie).toMatch(/;\s*Secure/i)
    // Not trusted without the proxy setting, and never on this computer.
    start()
    expect(
      (
        await client('cms.example', { 'x-forwarded-proto': 'https' })('POST', '/api/auth/login', {
          email: 'a@prova.example',
          password: 'una-password-lunga',
        })
      ).setCookie,
    ).not.toMatch(/Secure/i)
  })
})

describe('newsletter tries', () => {
  it('are limited per person', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 11; i++) statuses.push((await editor('POST', '/api/newsletters/nope/test', {})).status)
    expect(statuses.slice(0, 10).every((s) => s !== 429)).toBe(true)
    expect(statuses.at(-1)).toBe(429)
  })
})

describe('saved secrets', () => {
  it('go only to the server they were given for', async () => {
    const ai = (baseUrl: string, apiKey?: string) =>
      admin('PUT', '/api/ai', { ai: { provider: 'openai', baseUrl, model: 'm', ...(apiKey ? { apiKey } : {}) } })
    expect((await ai('https://api.example.com/v1', 'sk-segreta')).body.ai.hasKey).toBe(true)
    expect((await ai('https://api.example.com/v1')).body.ai.hasKey).toBe(true)
    expect((await ai('https://evil.example/v1')).body.ai.hasKey).toBe(false)

    const mail = (host: string, pass?: string) =>
      admin('PUT', '/api/mail', {
        mail: {
          host,
          port: 587,
          security: 'starttls',
          user: 'u',
          from: 'a@prova.example',
          to: '',
          ...(pass ? { pass } : {}),
        },
      })
    expect((await mail('smtp.example.com', 'p')).body.mail.hasPassword).toBe(true)
    expect((await mail('smtp.example.com')).body.mail.hasPassword).toBe(true)
    expect((await mail('smtp.evil.example')).body.mail.hasPassword).toBe(false)

    const offsite = (url: string, password = '') =>
      admin('PUT', '/api/backups/offsite', { kind: 'webdav', keep: 7, webdav: { url, user: 'u', password } })
    expect((await offsite('https://dav.example.com/backup', 'segreta')).body.webdav.hasSecret).toBe(true)
    expect((await offsite('https://dav.example.com/altro')).body.webdav.hasSecret).toBe(true)
    expect((await offsite('https://evil.example/backup')).body.webdav.hasSecret).toBe(false)
  })
})
