import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

let dir: string
let database: Database
let app: ReturnType<typeof createApp>

const configFor = (media: string) =>
  defineConfig({
    site: { name: 'Prova' },
    media: { dir: media },
    collections: [
      defineCollection({
        name: 'pages',
        url: (doc) => `/${doc.slug}`,
        fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), page: f.page() },
      }),
      defineCollection({
        name: 'posts',
        url: (doc) => `/articoli/${doc.slug}`,
        fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), date: f.date() },
      }),
    ],
  })

function client(ip = '10.0.0.1') {
  let cookie = ''
  return async (method: string, path: string, json?: unknown, extra: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: {
        origin: 'http://localhost',
        'x-forwarded-for': ip,
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...extra,
      },
      body: json ? JSON.stringify(json) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {}
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read freely
    return { status: res.status, body: body as Record<string, any>, headers: res.headers }
  }
}

let admin: ReturnType<typeof client>
const PATH = '/articoli/il-primo'

const write = (who: ReturnType<typeof client>, data: Record<string, string>) =>
  who('POST', '/api/discussion', { path: PATH, _t: '9000', ...data }, { accept: 'application/json' })

async function publish(collection: string, data: Record<string, unknown>) {
  const doc = (await admin('POST', `/api/collections/${collection}`, { data })).body
  expect((await admin('POST', `/api/documents/${doc.id}/publish`)).status).toBe(200)
  return doc.id as string
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-discussion-'))
  database = await openDatabase({ url: ':memory:' })
  // Behind a proxy: the tests tell visitors apart with X-Forwarded-For.
  const config = configFor(join(dir, 'media'))
  app = createApp({ config: () => ({ ...config, server: { ...config.server, trustProxy: true } }), database })
  admin = client('10.0.0.99')
  await admin('POST', '/api/setup', { email: 'a@prova.example', name: 'Anna', password: 'una-password-lunga' })
  await publish('posts', { title: 'Il primo', slug: 'il-primo', date: '2026-11-11' })
  await publish('pages', { title: 'Chi siamo', slug: 'chi-siamo', page: [] })
})

afterEach(async () => {
  database.close()
  await rm(dir, { recursive: true, force: true })
})

describe('visitor comments', () => {
  it('wait for approval, then show on their article, without the email', async () => {
    const visitor = client('10.0.0.2')
    const sent = await write(visitor, { name: 'Luca', email: 'luca@example.com', text: 'Bell’articolo!' })
    expect(sent.status).toBe(201)
    expect(sent.body.comment).toBeUndefined()
    expect((await visitor('GET', `/api/discussion?path=${PATH}`)).body.comments).toEqual([])

    const waiting = await admin('GET', '/api/discussion/admin?status=pending')
    expect(waiting.body).toMatchObject({
      pending: 1,
      items: [{ name: 'Luca', email: 'luca@example.com', title: 'Il primo' }],
    })
    const id = waiting.body.items[0].id
    expect((await admin('PATCH', `/api/discussion/admin/${id}`, { status: 'approved' })).status).toBe(200)

    const shown = await visitor('GET', `/api/discussion?path=${PATH}`)
    expect(shown.headers.get('cache-control')).toBe('no-store')
    expect(shown.body.comments).toMatchObject([{ name: 'Luca', text: 'Bell’articolo!' }])
    expect(JSON.stringify(shown.body)).not.toContain('luca@example.com')
  })

  it('without moderation, show at once', async () => {
    await admin('PUT', '/api/discussion/settings', { moderation: false, notify: false })
    const sent = await write(client('10.0.0.3'), { name: 'Sara', text: 'Ciao' })
    expect(sent.body.comment).toMatchObject({ name: 'Sara', text: 'Ciao' })
    expect((await client()('GET', `/api/discussion?path=${PATH}`)).body.comments).toHaveLength(1)
  })

  it('set spam aside: the hidden field, a hurry, links, a repeat', async () => {
    const bot = await write(client('10.0.0.4'), { name: 'X', text: 'Compra', _gotcha: 'http://spam.example' })
    expect(bot.status).toBe(201)
    await write(client('10.0.0.5'), { name: 'Y', text: 'Veloce', _t: '300' })
    await write(client('10.0.0.6'), {
      name: 'Z',
      text: 'https://a.example https://b.example https://c.example https://d.example',
    })
    await write(client('10.0.0.7'), { name: 'Anna', text: 'Uguale' })
    await write(client('10.0.0.8'), { name: 'Anna', text: 'Uguale' })
    const lists = await admin('GET', '/api/discussion/admin?status=spam')
    // The hidden field leaves nothing behind; the others wait in the spam folder.
    expect(lists.body.spam).toBe(3)
    expect(lists.body.pending).toBe(1)
  })

  it('only on pages whose collection has comments, and with a name and a text', async () => {
    const visitor = client('10.0.0.9')
    expect((await visitor('POST', '/api/discussion', { path: '/chi-siamo', name: 'A', text: 'B' })).status).toBe(404)
    expect((await visitor('POST', '/api/discussion', { path: '/articoli/nessuno', name: 'A', text: 'B' })).status).toBe(
      404,
    )
    const empty = await write(visitor, { name: '', text: '', email: 'non-una-email' })
    expect(empty.status).toBe(422)
    expect(empty.body.error.issues.map((i: { field: string }) => i.field)).toEqual(['name', 'email', 'text'])

    // Turned off for articles: the form is gone from them too.
    await admin('PUT', '/api/discussion/settings', { collections: [], moderation: true, notify: false })
    expect((await write(client('10.0.0.10'), { name: 'A', text: 'B' })).status).toBe(404)
  })

  it('come back to the page without JavaScript', async () => {
    const res = await app.request('/api/discussion', {
      method: 'POST',
      headers: {
        origin: 'http://localhost',
        referer: `http://localhost${PATH}`,
        'content-type': 'application/x-www-form-urlencoded',
        'x-forwarded-for': '10.0.0.11',
      },
      body: new URLSearchParams({ path: PATH, name: 'Senza JS', text: 'Funziona anche così' }).toString(),
    })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`http://localhost${PATH}#commento-inviato`)
  })

  it('are moderated from the panel only, and deleted by administrators only', async () => {
    await write(client('10.0.0.12'), { name: 'Luca', text: 'Ciao' })
    expect((await client('10.0.0.13')('GET', '/api/discussion/admin')).status).toBe(401)
    const id = (await admin('GET', '/api/discussion/admin?status=pending')).body.items[0].id
    expect((await client('10.0.0.13')('DELETE', `/api/discussion/admin/${id}`)).status).toBe(401)
    expect((await admin('DELETE', `/api/discussion/admin/${id}`)).status).toBe(204)
    expect((await admin('GET', '/api/discussion/admin')).body.total).toBe(0)
  })

  it('are on by default where there are pages with a date, and limited per address', async () => {
    const state = await admin('GET', '/api/discussion/settings')
    expect(state.body.on).toEqual(['posts'])
    expect(state.body.settings).toMatchObject({ moderation: true, notify: true })
    const flood = client('10.0.0.14')
    const answers = []
    for (let i = 0; i < 4; i++) answers.push((await write(flood, { name: 'F', text: `Messaggio ${i}` })).status)
    expect(answers).toEqual([201, 201, 201, 429])
  })

  it('stay with their article when its address changes', async () => {
    await admin('PUT', '/api/discussion/settings', { moderation: false, notify: false })
    await write(client('10.0.0.20'), { name: 'Sara', text: 'Resto qui' })
    const posts = (await admin('GET', '/api/collections/posts')).body.items as { id: string }[]
    const id = posts[0]?.id
    const doc = (await admin('GET', `/api/documents/${id}`)).body
    await admin('PUT', `/api/documents/${id}`, { data: { ...doc.data, slug: 'nuovo-indirizzo' } })
    expect((await admin('POST', `/api/documents/${id}/publish`)).status).toBe(200)
    const moved = await client()('GET', '/api/discussion?path=/articoli/nuovo-indirizzo/')
    expect(moved.body.comments).toMatchObject([{ name: 'Sara' }])
    expect((await client()('GET', `/api/discussion?path=${PATH}`)).body.comments).toEqual([])
  })

  it('answer a body that is not an object as an empty comment', async () => {
    const res = await app.request('/api/discussion', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.21' },
      body: 'null',
    })
    expect(res.status).toBe(404)
  })
})
