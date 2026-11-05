import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import type { PageNode } from '@materializecms/core/page'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type AiUsage, complete, runTurn } from '../src/ai.ts'
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
  await call('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: 'una-password-lunga' })
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
    expect((await call('GET', '/api/auth/me', undefined, bearer)).body.user.email).toBe('elena@example.com')
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

  it('keeps a text within the field, and counts the tokens of each request', async () => {
    // A stand-in for an OpenAI-compatible server: too long the first time, short the second.
    const prompts: string[] = []
    const replies = ['x'.repeat(300), 'Un testo breve.']
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const { messages } = JSON.parse(raw) as { messages: { content: string }[] }
        prompts.push(messages[1]?.content ?? '')
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            choices: [{ message: { role: 'assistant', content: replies.shift() } }],
            usage: { prompt_tokens: 100, completion_tokens: 10, prompt_tokens_details: { cached_tokens: 40 } },
          }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      await call('PUT', '/api/ai', {
        ai: { provider: 'openai', apiKey: '', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'm' },
      })
      const res = await call('POST', '/api/ai/text', { action: 'formal', text: 'ciao a tutti', max: 220 })
      expect(res.body.text).toBe('Un testo breve.')
      expect(prompts).toHaveLength(2)
      expect(prompts[0]).toContain('at most 220 characters')
      expect(prompts[1]).toContain('it has 300')
      // Both requests are counted in this month's usage, cached tokens apart.
      await new Promise((r) => setTimeout(r, 50))
      expect((await call('GET', '/api/ai')).body.usage).toMatchObject({
        requests: 2,
        input: 120,
        cacheRead: 80,
        output: 20,
      })
    } finally {
      server.close()
    }
  })
})

describe('shorten', () => {
  it('asks for a length, and goes to the main model when the quick one returns the text as is', async () => {
    const calls: { model: string; prompt: string }[] = []
    const text = 'Siti, prodotti ed esperienze 3D che si muovono come il tuo brand. Strategia, design e sviluppo.'
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const { model, messages } = JSON.parse(raw) as { model: string; messages: { content: string }[] }
        calls.push({ model, prompt: messages[1]?.content ?? '' })
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            choices: [
              { message: { role: 'assistant', content: model === 'grande' ? 'Siti ed esperienze 3D.' : text } },
            ],
          }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      await call('PUT', '/api/ai', {
        ai: {
          provider: 'openai',
          apiKey: '',
          baseUrl: `http://127.0.0.1:${port}/v1`,
          model: 'grande',
          fastModel: 'piccolo',
        },
      })
      const res = await call('POST', '/api/ai/text', { action: 'shorten', text })
      expect(res.body.text).toBe('Siti ed esperienze 3D.')
      expect(calls.map((c) => c.model)).toEqual(['piccolo', 'piccolo', 'grande'])
      expect(calls[0]?.prompt).toContain(
        `The text has ${text.length} characters: aim for about ${Math.round(text.length * 0.65)}`,
      )
    } finally {
      server.close()
    }
  })
})

describe('assistant with Claude', () => {
  it('runs the quick actions on Haiku, unless another model is chosen', async () => {
    const models: string[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const { model } = JSON.parse(raw) as { model: string }
        models.push(model)
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model,
            content: [{ type: 'text', text: 'ok' }],
            stop_reason: 'end_turn',
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const ai = {
        provider: 'anthropic' as const,
        apiKey: 'chiave-di-prova',
        baseUrl: `http://127.0.0.1:${port}`,
        model: '',
      }
      await complete(ai, { system: 's', prompt: 'p', fast: true })
      await complete(ai, { system: 's', prompt: 'p' })
      await complete({ ...ai, fastModel: 'claude-sonnet-5-5' }, { system: 's', prompt: 'p', fast: true })
      expect(models).toEqual(['claude-haiku-5-5', 'claude-opus-5-5', 'claude-sonnet-5-5'])
    } finally {
      server.close()
    }
  })

  it('marks the instructions and the conversation for the prompt cache, and reports the tokens', async () => {
    const bodies: Record<string, unknown>[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        bodies.push(JSON.parse(raw))
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            id: 'msg_1',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-5-5',
            content: [{ type: 'text', text: 'Fatto.' }],
            stop_reason: 'end_turn',
            usage: {
              input_tokens: 30,
              output_tokens: 5,
              cache_read_input_tokens: 900,
              cache_creation_input_tokens: 70,
            },
          }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      const usage: AiUsage[] = []
      const reply = await runTurn(
        {
          provider: 'anthropic',
          apiKey: 'chiave-di-prova',
          baseUrl: `http://127.0.0.1:${port}`,
          model: 'claude-opus-5-5',
          onUsage: (u) => usage.push(u),
        },
        { provider: 'anthropic', messages: [] },
        {
          system: 'Istruzioni',
          text: 'Ciao',
          images: [{ mime: 'image/jpeg', data: 'AAAA' }],
          tools: [],
          onEvent: () => {},
        },
      )
      expect(reply).toBe('Fatto.')
      // A reference picture goes before the words, as an image block.
      expect((bodies[0]?.messages as { content: unknown }[] | undefined)?.[0]?.content).toEqual([
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } },
        { type: 'text', text: 'Ciao' },
      ])
      expect(bodies[0]?.cache_control).toEqual({ type: 'ephemeral' })
      expect(bodies[0]?.system).toEqual([{ type: 'text', text: 'Istruzioni', cache_control: { type: 'ephemeral' } }])
      expect(usage).toEqual([{ requests: 1, input: 30, output: 5, cacheRead: 900, cacheWrite: 70 }])
    } finally {
      server.close()
    }
  })
})

describe('brand voice', () => {
  it('goes with every text the AI writes, but not with spelling fixes', async () => {
    const systems: string[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const { messages } = JSON.parse(raw) as { messages: { content: string }[] }
        systems.push(messages[0]?.content ?? '')
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'Fatto.' } }] }))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      await call('PUT', '/api/ai', {
        ai: { provider: 'openai', apiKey: '', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'm' },
      })
      expect((await call('GET', '/api/voice')).body.voice).toEqual({})
      const saved = await call('PUT', '/api/voice', {
        voice: {
          about: 'Studio di architettura a Milano',
          tones: ['Elegante'],
          address: 'lei',
          avoid: 'eccellenza, leader',
        },
      })
      expect(saved.status).toBe(200)
      expect((await call('PUT', '/api/voice', { voice: { tones: ['Urlato'] } })).status).toBe(422)

      await call('POST', '/api/ai/text', { action: 'rewrite', text: 'Siamo i migliori' })
      await call('POST', '/api/ai/text', { action: 'fix', text: 'Siamo i miglori' })
      await call('POST', '/api/ai/text', { action: 'seo_title', text: 'La pagina dello studio' })
      // Changing a text: the style only, so no facts about the brand end up in it.
      expect(systems[0]).toContain('<brand_voice>')
      expect(systems[0]).toContain('Never use these words or phrases: eccellenza, leader.')
      expect(systems[0]).toContain('Address readers formally')
      expect(systems[0]).not.toContain('Studio di architettura a Milano')
      expect(systems[1]).not.toContain('<brand_voice>')
      // Writing from scratch: who the brand is, too.
      expect(systems[2]).toContain('Who we are and who we write for: Studio di architettura a Milano')
      // Too few published texts to read a voice from.
      expect((await call('POST', '/api/voice/suggest')).body.error.code).toBe('too_little_text')
    } finally {
      server.close()
    }
  })
})

describe('AI review', () => {
  it('lists what to fix with the exact words, drops made-up quotes, and applies a suggestion', async () => {
    const prompts: string[] = []
    const answer = {
      issues: [
        { slot: 1, kind: 'spelling', find: 'archittetura', replace: 'architettura', note: 'Refuso' },
        { slot: 1, kind: 'grammar', find: 'parole che non ci sono', replace: 'x', note: 'Inventata' },
        { slot: 2, kind: 'link', find: 'Scopri i servizi', replace: '', note: 'Porta ai contatti' },
      ],
    }
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const { messages } = JSON.parse(raw) as { messages: { content: string }[] }
        prompts.push(messages[1]?.content ?? '')
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify(answer) } }] }))
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      await call('PUT', '/api/ai', {
        ai: { provider: 'openai', apiKey: '', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'm' },
      })
      const contact = (await call('POST', '/api/collections/pages', { data: { title: 'Contatti', slug: 'contatti' } }))
        .body
      await call('POST', `/api/documents/${contact.id}/publish`)
      const page = [
        {
          id: 's',
          type: 'frame',
          children: [
            { id: 't', type: 'text', text: 'Studio di archittetura a Milano' },
            { id: 'b', type: 'button', text: 'Scopri i servizi', href: '/contatti' },
          ],
        },
      ]
      const data = { title: 'Studio', slug: 'studio', page }
      const doc = (await call('POST', '/api/collections/pages', { data })).body
      const res = await call('POST', `/api/documents/${doc.id}/review`, { data })
      expect(res.status).toBe(200)
      // Where each link goes, with the title of that page.
      expect(prompts[0]).toContain('[2] Scopri i servizi\n  links: 1 → /contatti (page "Contatti")')
      expect(res.body.issues.map((i: { find: string }) => i.find)).toEqual(['archittetura', 'Scopri i servizi'])
      expect(res.body.issues[0]).toMatchObject({ node: 't', kind: 'spelling' })

      const applied = await call('POST', `/api/documents/${doc.id}/review/apply`, {
        data,
        slot: 1,
        find: 'archittetura',
        replace: 'architettura',
      })
      expect(applied.body.data.page[0].children[0].text).toBe('Studio di architettura a Milano')
      // The draft itself is not touched: the editor takes the change.
      expect((await call('GET', `/api/documents/${doc.id}`)).body.data.page[0].children[0].text).toContain(
        'archittetura',
      )
      const gone = await call('POST', `/api/documents/${doc.id}/review/apply`, {
        data: applied.body.data,
        slot: 1,
        find: 'archittetura',
        replace: 'architettura',
      })
      expect(gone.body.error.code).toBe('changed')
    } finally {
      server.close()
    }
  })
})

describe('site from a brief', () => {
  it('makes new drafts only, and proposes theme and voice without applying them', async () => {
    const existing = (
      await call('POST', '/api/collections/pages', {
        data: { title: 'Vecchia', slug: 'vecchia', page: [{ id: 'x', type: 'frame', children: [] }] },
      })
    ).body
    let createdId = ''
    const toolResults: string[] = []
    const call_ = (id: string, name: string, args: unknown) => ({
      id,
      type: 'function',
      function: { name, arguments: JSON.stringify(args) },
    })
    let step = 0
    let system = ''
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const { messages } = JSON.parse(raw) as { messages: { role: string; content: string }[] }
        system = messages[0]?.content ?? ''
        for (const m of messages.slice(-3)) if (m.role === 'tool') toolResults.push(m.content)
        const last = messages.at(-1)
        if (step === 2 && last?.role === 'tool') createdId = JSON.parse(last.content).id
        const steps = [
          () => [
            call_('a', 'propose_theme', { display: 'Fraunces', colors: { light: { accent: '#b4532a' } } }),
            call_('b', 'propose_voice', { about: 'Panificio a Bologna', tones: ['Amichevole'], address: 'tu' }),
          ],
          () => [call_('c', 'create_entry', { collection: 'pages', data: { title: 'Home', slug: 'home' } })],
          () => [
            call_('d', 'edit_page', { id: createdId, operations: [{ op: 'add_section', key: 'nav.classic' }] }),
            call_('e', 'edit_page', { id: existing.id, operations: [{ op: 'remove', nodeId: 'x' }] }),
            call_('f', 'update_entry', { id: existing.id, data: { title: 'Cambiata' } }),
          ],
        ]
        const next = steps[step++]
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            choices: [
              {
                message: next
                  ? { role: 'assistant', content: null, tool_calls: next() }
                  : { role: 'assistant', content: 'Ho preparato la home.' },
              },
            ],
          }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      await call('PUT', '/api/ai', {
        ai: { provider: 'openai', apiKey: '', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'm' },
      })
      const themeBefore = (await call('GET', '/api/theme')).body.theme
      const res = await app.request('/api/ai/site', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: 'http://localhost' },
        body: JSON.stringify({ brief: 'Un panificio di quartiere a Bologna, pane a lievito madre e colazioni.' }),
      })
      expect(res.status).toBe(200)
      const events = (await res.text())
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => JSON.parse(l.slice(5)))
      const result = events.find((e) => e.type === 'result')
      expect(events.find((e) => e.type === 'created')?.doc.title).toBe('Home')
      expect(result.created).toHaveLength(1)
      expect(result.theme.display).toBe('Fraunces')
      expect(result.theme.colors.light.accent).toBe('#b4532a')
      expect(result.voice).toMatchObject({ about: 'Panificio a Bologna', address: 'tu' })
      expect(events.at(-1)).toMatchObject({ type: 'done', runId: expect.any(String) })
      expect(system).toContain('Existing entries: pages: "Vecchia" (slug vecchia)')
      expect(system).toContain('Write every text in Italian')

      // The new draft has the section; nothing else changed.
      const home = (await call('GET', `/api/documents/${createdId}`)).body
      expect(home.status).toBe('draft')
      expect(home.data.page[0].section).toBe('nav.classic')
      const old = (await call('GET', `/api/documents/${existing.id}`)).body
      expect(old.title).toBe('Vecchia')
      expect(old.data.page).toHaveLength(1)
      expect(toolResults.filter((t) => t.includes('only the drafts you created'))).toHaveLength(2)
      expect((await call('GET', '/api/theme')).body.theme).toEqual(themeBefore)
      expect((await call('GET', '/api/voice')).body.voice).toEqual({})
    } finally {
      server.close()
    }
  })
})

describe('dashboard request', () => {
  it('changes drafts and lists them, but cannot publish', async () => {
    const doc = (await call('POST', '/api/collections/pages', { data: { title: 'Contatti', slug: 'contatti' } })).body
    const results: string[] = []
    let step = 0
    let toolNames: string[] = []
    const server = createServer((req, res) => {
      let raw = ''
      req.on('data', (chunk) => {
        raw += chunk
      })
      req.on('end', () => {
        const parsed = JSON.parse(raw) as {
          messages: { role: string; content: string }[]
          tools: { function: { name: string } }[]
        }
        toolNames = parsed.tools.map((t) => t.function.name)
        for (const m of parsed.messages.slice(-2)) if (m.role === 'tool') results.push(m.content)
        const calls = [
          [
            {
              id: 'a',
              type: 'function',
              function: {
                name: 'update_entry',
                arguments: JSON.stringify({ id: doc.id, data: { title: 'Scrivici' } }),
              },
            },
            {
              id: 'b',
              type: 'function',
              function: { name: 'publish_entry', arguments: JSON.stringify({ id: doc.id }) },
            },
          ],
        ][step++]
        res.setHeader('content-type', 'application/json')
        res.end(
          JSON.stringify({
            choices: [
              {
                message: calls
                  ? { role: 'assistant', content: null, tool_calls: calls }
                  : { role: 'assistant', content: 'Ho cambiato il titolo.' },
              },
            ],
          }),
        )
      })
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    try {
      const { port } = server.address() as AddressInfo
      await call('PUT', '/api/ai', {
        ai: { provider: 'openai', apiKey: '', baseUrl: `http://127.0.0.1:${port}/v1`, model: 'm' },
      })
      const res = await app.request('/api/ai/studio', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, origin: 'http://localhost' },
        body: JSON.stringify({ message: 'Chiama la pagina contatti «Scrivici»' }),
      })
      const events = (await res.text())
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => JSON.parse(l.slice(5)))
      expect(toolNames).not.toContain('publish_entry')
      expect(toolNames).not.toContain('update_theme')
      expect(results.some((r) => r.includes('There is no tool "publish_entry"'))).toBe(true)
      expect(events.find((e) => e.type === 'touched')?.doc).toMatchObject({ id: doc.id, title: 'Scrivici' })
      const after = (await call('GET', `/api/documents/${doc.id}`)).body
      expect(after).toMatchObject({ title: 'Scrivici', status: 'draft' })
    } finally {
      server.close()
    }
  })
})
