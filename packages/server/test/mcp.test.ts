import { defineCollection, defineConfig, f } from '@materializecms/core'
import type { PageNode } from '@materializecms/core/page'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'
import { applyOperations, outline, ToolError } from '../src/tools.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  locales: { default: 'it', available: ['it'] },
  collections: [
    defineCollection({
      name: 'pages',
      url: (doc) => `/${doc.slug}`,
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), page: f.page() },
    }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>
let cookie = ''

async function call(method: string, path: string, json?: unknown, headers: Record<string, string> = {}) {
  const res = await app.request(path, {
    method,
    headers: {
      ...(json ? { 'content-type': 'application/json' } : {}),
      ...(cookie && !headers.authorization ? { cookie, origin: 'http://localhost' } : {}),
      ...headers,
    },
    body: json ? JSON.stringify(json) : undefined,
  })
  const set = res.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0] ?? ''
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

/** One JSON-RPC request to /mcp with a bearer token. */
async function mcp(token: string, method: string, params: unknown = {}) {
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  return { status: res.status, body: await res.json() }
}

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  cookie = ''
  await call('POST', '/api/setup', { email: 'elena@studiorossi.it', name: 'Elena', password: 'una-password-lunga' })
})

afterEach(() => database.close())

describe('personal access tokens', () => {
  it('act as their owner, are listed without the secret and can be revoked', async () => {
    const created = await call('POST', '/api/tokens', { name: 'Claude Desktop' })
    expect(created.status).toBe(201)
    const token: string = created.body.token
    expect(token.startsWith('mzp_')).toBe(true)
    const listed = await call('GET', '/api/tokens')
    expect(listed.body.tokens).toHaveLength(1)
    expect(JSON.stringify(listed.body)).not.toContain(token)

    const bearer = { authorization: `Bearer ${token}` }
    expect((await call('GET', '/api/auth/me', undefined, bearer)).body.user.email).toBe('elena@studiorossi.it')
    // A token cannot make tokens or touch accounts.
    expect((await call('POST', '/api/tokens', { name: 'x' }, bearer)).status).toBe(403)
    expect((await call('GET', '/api/mail', undefined, bearer)).status).toBe(403)

    await call('DELETE', `/api/tokens/${listed.body.tokens[0].id}`)
    expect((await call('GET', '/api/auth/me', undefined, bearer)).status).toBe(401)
  })

  it('rejects unknown tokens', async () => {
    expect((await call('GET', '/api/auth/me', undefined, { authorization: 'Bearer mzp_nope' })).status).toBe(401)
  })
})

describe('MCP server', () => {
  it('lists the tools and edits a page as the token owner', async () => {
    const { token } = (await call('POST', '/api/tokens', { name: 'test' })).body
    const init = await mcp(token, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    })
    expect(init.body.result.serverInfo.name).toBe('materialize')
    const tools = (await mcp(token, 'tools/list')).body.result.tools.map((t: { name: string }) => t.name)
    expect(tools).toEqual(
      expect.arrayContaining(['get_site', 'create_entry', 'get_page', 'edit_page', 'publish_entry']),
    )

    const run = async (name: string, args: unknown) =>
      (await mcp(token, 'tools/call', { name, arguments: args })).body.result
    const created = JSON.parse(
      (await run('create_entry', { collection: 'pages', data: { title: 'Prova', page: [] } })).content[0].text,
    )
    const edited = await run('edit_page', {
      id: created.id,
      operations: [
        { op: 'insert', parentId: null, node: { type: 'frame', children: [{ type: 'text', text: 'Ciao' }] } },
      ],
    })
    expect(edited.isError).toBeFalsy()
    expect(edited.content[0].text).toContain('"Ciao"')
    const saved = await call('GET', `/api/documents/${created.id}`)
    expect(saved.body.data.page[0].children[0].text).toBe('Ciao')

    const failed = await run('edit_page', { id: created.id, operations: [{ op: 'remove', nodeId: 'missing' }] })
    expect(failed.isError).toBe(true)
    expect(failed.content[0].text).toContain('Nothing was changed')
  })

  it('needs a valid token', async () => {
    expect((await mcp('mzp_wrong', 'tools/list')).status).toBe(401)
  })
})

describe('page operations', () => {
  const page: PageNode[] = [
    { id: 's1', type: 'frame', name: 'Hero', children: [{ id: 't1', type: 'text', text: 'Titolo', style: 'h1' }] },
  ]

  it('applies edits in order and keeps ids', () => {
    const next = applyOperations(
      page,
      [
        { op: 'update', nodeId: 't1', props: { text: 'Nuovo', style: null } },
        { op: 'insert', parentId: 's1', node: { type: 'button', text: 'Contatti' } },
        { op: 'duplicate', nodeId: 's1' },
        { op: 'add_section', key: 'hero.split' },
      ],
      'Studio',
    )
    expect(next).toHaveLength(3)
    expect(next[0]?.children?.[0]).toMatchObject({ id: 't1', text: 'Nuovo' })
    expect(next[0]?.children?.[0]?.style).toBeUndefined()
    expect(next[0]?.children?.[1]?.id).toBeTruthy()
    expect(next[1]?.id).not.toBe('s1')
    expect(outline(next)).toContain('[t1] text "Nuovo"')
  })

  it('stops at an operation that cannot apply', () => {
    expect(() => applyOperations(page, [{ op: 'move', nodeId: 's1', parentId: 't1', index: 0 }], 'x')).toThrow(
      ToolError,
    )
    expect(() => applyOperations(page, [{ op: 'insert', parentId: 't1', node: { type: 'text' } }], 'x')).toThrow(
      /only frames/,
    )
  })
})

describe('AI', () => {
  it('says when it is not configured, and never returns the key', async () => {
    const res = await call('POST', '/api/ai/text', { action: 'rewrite', text: 'ciao' })
    expect(res.body.error.code).toBe('ai_not_configured')
    const saved = await call('PUT', '/api/ai', {
      ai: { provider: 'openai', apiKey: 'sk-segreta', baseUrl: 'http://localhost:1/v1', model: 'm' },
    })
    expect(saved.body.ai).toMatchObject({ provider: 'openai', hasKey: true, ready: true })
    expect(JSON.stringify((await call('GET', '/api/ai')).body)).not.toContain('sk-segreta')
  })
})
