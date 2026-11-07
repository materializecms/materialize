import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Prova' },
  collections: [
    defineCollection({
      name: 'posts',
      url: (doc) => `/${doc.slug}`,
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }) },
    }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>

function client() {
  let cookie = ''
  return async (method: string, path: string, json?: unknown, extra: Record<string, string> = {}) => {
    const res = await app.request(path, {
      method,
      headers: {
        origin: 'http://localhost',
        ...(json ? { 'content-type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...extra,
      },
      body: json ? JSON.stringify(json) : undefined,
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const text = await res.text()
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read freely
    return { status: res.status, body: (text ? JSON.parse(text) : null) as Record<string, any> }
  }
}

let anna: ReturnType<typeof client>
let marco: ReturnType<typeof client>
let doc: string

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  anna = client()
  marco = client()
  await anna('POST', '/api/setup', { email: 'anna@prova.example', name: 'Anna', password: 'una-password-lunga' })
  const { body: invite } = await anna('POST', '/api/users/invites', { email: 'marco@prova.example', role: 'editor' })
  await marco('POST', `/api/invites/${invite.link.split('/').pop()}/accept`, {
    name: 'Marco',
    password: 'password-marco',
  })
  doc = (await anna('POST', '/api/collections/posts', { data: { title: 'Ciao' } })).body.id
})

afterEach(() => database.close())

const save = (who: ReturnType<typeof client>, title: string, tab?: string) =>
  who('PUT', `/api/documents/${doc}`, { data: { title } }, tab ? { 'x-mz-tab': tab } : {})

describe('edit turns', () => {
  it('lets one person edit at a time, and the others see who', async () => {
    const first = await anna('POST', `/api/documents/${doc}/turn`, { tab: 'anna-tab-1' })
    expect(first.body).toMatchObject({ mine: true, holder: { name: 'Anna', self: true } })
    const other = await marco('POST', `/api/documents/${doc}/turn`, { tab: 'marco-tab-1' })
    expect(other.body).toMatchObject({ mine: false, holder: { name: 'Anna', self: false } })

    // Marco's save is refused; Anna's goes through.
    const refused = await save(marco, 'Di Marco', 'marco-tab-1')
    expect(refused.status).toBe(409)
    expect(refused.body.error.message).toContain('Anna sta modificando')
    expect((await save(anna, 'Di Anna', 'anna-tab-1')).status).toBe(200)

    // Anna in a second tab: read only there too.
    expect((await anna('POST', `/api/documents/${doc}/turn`, { tab: 'anna-tab-2' })).body).toMatchObject({
      mine: false,
      holder: { self: true },
    })
    expect((await save(anna, 'Seconda scheda', 'anna-tab-2')).body.error.code).toBe('not_your_turn')
  })

  it('can be taken over, and the one who had it is told by whom', async () => {
    await anna('POST', `/api/documents/${doc}/turn`, { tab: 'anna-tab-1' })
    const taken = await marco('POST', `/api/documents/${doc}/turn`, { tab: 'marco-tab-1', take: true })
    expect(taken.body).toMatchObject({ mine: true, holder: { name: 'Marco' } })
    const told = await anna('POST', `/api/documents/${doc}/turn`, { tab: 'anna-tab-1' })
    expect(told.body).toMatchObject({ mine: false, holder: { name: 'Marco' }, takenBy: 'Marco' })
    expect((await save(anna, 'Troppo tardi', 'anna-tab-1')).status).toBe(409)
    expect((await save(marco, 'Ora Marco', 'marco-tab-1')).status).toBe(200)
  })

  it('ends when the document is closed, and saves without a turn go through', async () => {
    await anna('POST', `/api/documents/${doc}/turn`, { tab: 'anna-tab-1' })
    await anna('DELETE', `/api/documents/${doc}/turn?tab=anna-tab-1`)
    expect((await marco('POST', `/api/documents/${doc}/turn`, { tab: 'marco-tab-1' })).body.mine).toBe(true)
    // Nobody on turn on another document: saving works as always.
    const other = (await anna('POST', '/api/collections/posts', { data: { title: 'Altro' } })).body.id
    expect((await marco('PUT', `/api/documents/${other}`, { data: { title: 'Libero' } })).status).toBe(200)
  })
})
