import { createHmac } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spamReason } from '../src/forms.ts'
import { createApp } from '../src/index.ts'
import { t } from '../src/t.ts'

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
    ],
  })

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
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {}
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read freely
    return { status: res.status, body: body as Record<string, any>, headers: res.headers, cookie }
  }
}

/** A page with a contact form: name, email (required), a choice, consent and a file. */
const formPage = (form: Record<string, unknown> = {}) => [
  {
    id: 's1',
    type: 'frame',
    children: [
      {
        id: 'contatti',
        type: 'frame',
        form: { name: 'Contatti', subject: 'Richiesta', ...form },
        children: [
          { id: 'i1', type: 'input', text: 'Nome', fieldName: 'nome' },
          { id: 'i2', type: 'input', text: 'Email', fieldName: 'email', inputKind: 'email', required: true },
          {
            id: 'i3',
            type: 'input',
            text: 'Servizio',
            fieldName: 'servizio',
            inputKind: 'select',
            options: ['Sito', 'Brand'],
          },
          { id: 'i4', type: 'input', text: 'Privacy', fieldName: 'privacy', inputKind: 'checkbox', required: true },
          { id: 'i5', type: 'input', text: 'Allegato', fieldName: 'allegato', inputKind: 'file', accept: 'documents' },
          { id: 'b1', type: 'button', text: 'Invia', submit: true },
        ],
      },
    ],
  },
]

const visitor = client()
const send = (data: Record<string, string>, form = 'contatti') =>
  visitor('POST', `/api/forms/${form}`, { _t: '8000', ...data }, { accept: 'application/json' })

let admin: ReturnType<typeof client>

async function publish(page: unknown) {
  const doc = (await admin('POST', '/api/collections/pages', { data: { title: 'Contatti', page } })).body
  const res = await admin('POST', `/api/documents/${doc.id}/publish`)
  expect(res.status).toBe(200)
  return doc.id as string
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-forms-'))
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => configFor(join(dir, 'media')), database })
  admin = client()
  await admin('POST', '/api/setup', { email: 'a@prova.example', name: 'Anna', password: 'una-password-lunga' })
})
afterEach(async () => {
  database.close()
  await rm(dir, { recursive: true, force: true })
})

describe('forms', () => {
  it('checks the fields of the form on the page, and says which ones are wrong', async () => {
    await publish(formPage())
    const bad = await send({ nome: 'Luca', email: 'non-una-email', servizio: 'Altro' })
    expect(bad.status).toBe(422)
    expect(bad.body.error.issues).toEqual([
      { field: 'email', message: 'Scrivi un indirizzo email valido' },
      { field: 'servizio', message: 'Scegli una delle voci dell’elenco' },
      { field: 'privacy', message: 'Va spuntata per inviare' },
    ])
    const ok = await send({ nome: 'Luca', email: 'luca@example.com', servizio: 'Sito', privacy: 'on', extra: 'x' })
    expect(ok.status).toBe(200)
    const list = (await admin('GET', '/api/submissions')).body
    expect(list.items).toHaveLength(1)
    // Only the form's own fields; a ticked box reads "sì".
    expect(list.items[0]).toMatchObject({
      formName: 'Contatti',
      spam: null,
      data: { nome: 'Luca', email: 'luca@example.com', servizio: 'Sito', privacy: 'sì' },
    })
    expect(list.forms).toEqual([{ form: 'contatti', name: 'Contatti', total: 1 }])
  })

  it('without JavaScript, goes back to the page marked as sent or not', async () => {
    await publish(formPage())
    const post = (body: string) =>
      app.request('/api/forms/contatti', {
        method: 'POST',
        headers: {
          origin: 'http://localhost',
          referer: 'http://localhost/contatti',
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
      })
    expect((await post('email=x')).headers.get('location')).toBe('http://localhost/contatti#non-inviato')
    expect((await post('email=luca%40example.com&privacy=on')).headers.get('location')).toBe(
      'http://localhost/contatti#inviato',
    )
  })

  it('keeps spam apart without a CAPTCHA, and lets it be put back', async () => {
    await publish(formPage())
    const base = { email: 'luca@example.com', privacy: 'on' }
    await send({ ...base, nome: 'Bot', _t: '400' })
    await send({ ...base, nome: 'Offerta', servizio: 'Sito' })
    await send({ ...base, nome: 'Offerta', servizio: 'Sito' })
    await send({ ...base, nome: 'Link [url=http://x.example]qui[/url]' })
    // The trap field: dropped, with the same answer as everyone gets.
    expect((await send({ ...base, nome: 'Trappola', _gotcha: 'x' })).status).toBe(200)

    const real = (await admin('GET', '/api/submissions')).body
    expect(real.items.map((m: { data: { nome: string } }) => m.data.nome)).toEqual(['Offerta'])
    expect(real.spam).toBe(3)
    const spam = (await admin('GET', '/api/submissions?status=spam')).body.items
    expect(spam.map((m: { spam: string }) => m.spam).sort()).toEqual([
      'Compilato in meno di 3 secondi',
      'Link nascosti nel testo',
      'Messaggio ripetuto',
    ])
    // Saved once, read in the language of whoever opens the list.
    const english = (await admin('GET', '/api/submissions?status=spam', undefined, { 'x-mz-lang': 'en' })).body.items
    expect(english.map((m: { spam: string }) => m.spam).sort()).toEqual([
      'Filled in under 3 seconds',
      'Links hidden in the text',
      'Repeated message',
    ])
    await admin('PATCH', `/api/submissions/${spam[0].id}`, { spam: false })
    expect((await admin('GET', '/api/submissions')).body.items).toHaveLength(2)
  })

  it('takes files of the right kind, keeps them private and deletes them with the message', async () => {
    await publish(formPage())
    const body = new FormData()
    body.set('email', 'luca@example.com')
    body.set('privacy', 'on')
    body.set('_t', '9000')
    body.set('allegato', new File(['%PDF-1.4 preventivo'], 'Preventivo casa.pdf', { type: 'application/pdf' }))
    const res = await app.request('/api/forms/contatti', {
      method: 'POST',
      headers: { origin: 'http://localhost', accept: 'application/json' },
      body,
    })
    expect(res.status).toBe(200)

    const wrong = new FormData()
    wrong.set('email', 'luca@example.com')
    wrong.set('privacy', 'on')
    wrong.set('allegato', new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))
    const refused = await app.request('/api/forms/contatti', {
      method: 'POST',
      headers: { origin: 'http://localhost', accept: 'application/json' },
      body: wrong,
    })
    expect(refused.status).toBe(422)

    const [m] = (await admin('GET', '/api/submissions')).body.items
    expect(m.files).toEqual([expect.objectContaining({ field: 'allegato', name: 'Preventivo casa.pdf', size: 19 })])
    expect(m.data.allegato).toBe('Preventivo casa.pdf')
    expect((await visitor('GET', `/api/submissions/${m.id}/files/0`)).status).toBe(401)
    const file = await admin('GET', `/api/submissions/${m.id}/files/0`)
    expect(file.status).toBe(200)
    expect(file.headers.get('content-disposition')).toContain('attachment')
    expect(file.body).toBe('%PDF-1.4 preventivo')

    await admin('DELETE', `/api/submissions/${m.id}`)
    expect(await readdir(join(dir, 'uploads')).catch(() => [])).toEqual([])
  })

  it('exports a spreadsheet that does not run formulas', async () => {
    await publish(formPage())
    await send({ nome: '=HYPERLINK("x")', email: 'luca@example.com', privacy: 'on' })
    const csv = await admin('GET', '/api/submissions/export.csv')
    expect(csv.headers.get('content-type')).toContain('text/csv')
    const text = String(csv.body)
    expect(text.split('\r\n')[0]).toBe('Data,Modulo,Pagina,nome,email,privacy')
    // The byte order mark is there, for Excel (reading as text drops it).
    const raw = await app.request('/api/submissions/export.csv', { headers: { cookie: csv.cookie } })
    expect([...new Uint8Array(await raw.arrayBuffer()).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    expect(text).toContain(`"'=HYPERLINK(""x"")"`)
  })

  it('posts each message to the webhook, signed with the site key', async () => {
    const received: { body: string; signature: string }[] = []
    const server: Server = createServer((req, res) => {
      let body = ''
      req.on('data', (c) => {
        body += c
      })
      req.on('end', () => {
        received.push({ body, signature: String(req.headers['x-materialize-signature']) })
        res.end('ok')
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port
    try {
      await publish(formPage({ webhook: `http://127.0.0.1:${port}/hook` }))
      await send({ nome: 'Luca', email: 'luca@example.com', privacy: 'on' })
      for (let i = 0; i < 50 && !received.length; i++) await new Promise((r) => setTimeout(r, 20))
      expect(received).toHaveLength(1)
      const payload = JSON.parse(received[0]?.body ?? '{}')
      expect(payload).toMatchObject({ form: { id: 'contatti', name: 'Contatti' }, data: { nome: 'Luca' } })
      const { webhookSecret } = (await admin('GET', '/api/forms/settings')).body
      expect(received[0]?.signature).toBe(
        `sha256=${createHmac('sha256', webhookSecret)
          .update(received[0]?.body ?? '')
          .digest('hex')}`,
      )
      for (let i = 0; i < 50; i++) {
        if ((await admin('GET', '/api/submissions')).body.items[0].webhook === 'ok') break
        await new Promise((r) => setTimeout(r, 20))
      }
      expect((await admin('GET', '/api/submissions')).body.items[0].webhook).toBe('ok')
    } finally {
      server.close()
    }
  })

  it('lets only admins change where the messages go', async () => {
    const { body: invite } = await admin('POST', '/api/users/invites', { email: 'e@prova.example', role: 'editor' })
    const editor = client()
    await editor('POST', `/api/invites/${invite.link.split('/').pop()}/accept`, {
      name: 'Eva',
      password: 'password-editor',
    })
    const id = (await admin('POST', '/api/collections/pages', { data: { title: 'Contatti', page: formPage() } })).body
      .id
    const diverted = await editor('PUT', `/api/documents/${id}`, {
      data: { title: 'Contatti', page: formPage({ webhook: 'https://evil.example/hook' }) },
    })
    expect(diverted.status).toBe(403)
    const renamed = await editor('PUT', `/api/documents/${id}`, {
      data: { title: 'Contatti', page: formPage({ name: 'Preventivi' }) },
    })
    expect(renamed.status).toBe(200)
  })

  it('takes a form the site built by hand as it comes', async () => {
    const res = await send({ nome: 'Luca', messaggio: 'Ciao' }, 'modulo-del-sito')
    expect(res.status).toBe(200)
    expect((await admin('GET', '/api/submissions')).body.items[0].data).toEqual({ nome: 'Luca', messaggio: 'Ciao' })
  })
})

describe('spam signs', () => {
  it('counts links and filling time', () => {
    expect(spamReason({ m: 'Ciao' }, 5000)).toBeNull()
    expect(spamReason({ m: 'Ciao' }, null)).toBeNull()
    // Saved as kept texts: read in the language of whoever opens the message.
    const links = spamReason({ m: 'https://a.example https://b.example www.c.example http://d.example' }, 5000)
    expect(t.read(links)).toBe('Troppi link (4)')
    expect(t.in('en', 'Troppi link ({n})', { n: 4 })).toBe('Too many links (4)')
    expect(t.read(spamReason({ m: '<a href="x">y</a>' }, 5000))).toBe('Link nascosti nel testo')
  })
})
