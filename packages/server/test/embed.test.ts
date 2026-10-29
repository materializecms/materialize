import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Prova' },
  collections: [
    defineCollection({
      name: 'pages',
      fields: { title: f.text({ required: true }), page: f.page() },
    }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>

function client() {
  let cookie = ''
  return async (method: string, path: string, json?: unknown) => {
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
}

const section = (html?: string) => [
  {
    id: 's1',
    type: 'frame',
    children: [html === undefined ? { id: 't1', type: 'text', text: 'Ciao' } : { id: 'e1', type: 'embed', html }],
  },
]

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
})
afterEach(() => database.close())

describe('custom code', () => {
  it('only admins add or change it, everyone can edit the rest', async () => {
    const admin = client()
    await admin('POST', '/api/setup', { email: 'a@prova.it', name: 'A', password: 'una-password-lunga' })
    const { body: invite } = await admin('POST', '/api/users/invites', { email: 'e@prova.it', role: 'editor' })
    const editor = client()
    await editor('POST', `/api/invites/${invite.link.split('/').pop()}/accept`, {
      name: 'E',
      password: 'password-editor',
    })

    expect(
      (await editor('POST', '/api/collections/pages', { data: { title: 'X', page: section('<script>x</script>') } }))
        .status,
    ).toBe(403)
    const { body: doc } = await admin('POST', '/api/collections/pages', {
      data: { title: 'X', page: section('<b>ok</b>') },
    })
    // The editor changes the title, the code stays as it was: allowed.
    expect(
      (await editor('PUT', `/api/documents/${doc.id}`, { data: { title: 'Y', page: section('<b>ok</b>') } })).status,
    ).toBe(200)
    expect(
      (await editor('PUT', `/api/documents/${doc.id}`, { data: { title: 'Y', page: section('<img onerror=x>') } }))
        .status,
    ).toBe(403)
    expect(
      (
        await editor('PUT', '/api/globals', {
          globals: { g: { id: 'g', type: 'frame', children: [{ id: 'e', type: 'embed', html: 'x' }] } },
        })
      ).status,
    ).toBe(403)
  })
})
