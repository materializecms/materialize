import type { AddressInfo } from 'node:net'
import { createServer as createTcpServer, type Server } from 'node:net'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'
import { newsletterHtml, parseSubscribersCsv } from '../src/newsletter.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi', url: 'https://studiorossi.example' },
  collections: [
    defineCollection({
      name: 'pages',
      url: (doc) => `/${doc.slug}`,
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), page: f.page() },
    }),
    defineCollection({
      name: 'posts',
      url: (doc) => `/diario/${doc.slug}`,
      fields: {
        title: f.text({ required: true }),
        slug: f.slug({ from: 'title' }),
        excerpt: f.text({ multiline: true }),
        date: f.date(),
        body: f.richText(),
      },
    }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>
let smtp: Server
/** Every email the fake mail server received, as raw text. */
let inbox: string[] = []

/** The smallest SMTP server that accepts mail and keeps it. */
function fakeSmtp(): Promise<number> {
  smtp = createTcpServer((socket) => {
    let data = false
    let buffer = ''
    socket.write('220 test\r\n')
    socket.on('data', (chunk) => {
      buffer += chunk.toString()
      if (data) {
        const end = buffer.indexOf('\r\n.\r\n')
        if (end < 0) return
        inbox.push(buffer.slice(0, end))
        buffer = buffer.slice(end + 5)
        data = false
        socket.write('250 ok\r\n')
      }
      let nl = buffer.indexOf('\r\n')
      while (!data && nl >= 0) {
        const line = buffer.slice(0, nl).toUpperCase()
        buffer = buffer.slice(nl + 2)
        if (line.startsWith('EHLO') || line.startsWith('HELO')) socket.write('250 test\r\n')
        else if (line.startsWith('DATA')) {
          data = true
          socket.write('354 go\r\n')
        } else if (line.startsWith('QUIT')) socket.end('221 bye\r\n')
        else socket.write('250 ok\r\n')
        nl = buffer.indexOf('\r\n')
      }
    })
  })
  return new Promise((resolve) => smtp.listen(0, '127.0.0.1', () => resolve((smtp.address() as AddressInfo).port)))
}

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
      redirect: 'manual',
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const text = await res.text()
    let body: unknown = text
    try {
      body = text ? JSON.parse(text) : null
    } catch {}
    // biome-ignore lint/suspicious/noExplicitAny: test responses are read freely
    return { status: res.status, body: body as Record<string, any>, headers: res.headers, text }
  }
}

let admin: ReturnType<typeof client>
const visitor = client()

/** Quoted-printable undone, so links can be read from the raw email. */
const plain = (raw: string) => {
  // Encoded header words first: their closing "?=" must not be taken for a soft line break.
  const words = raw
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?UTF-8\?B\?([^?]*)\?=/gi, (_, b: string) => Buffer.from(b, 'base64').toString('latin1'))
    .replace(/=\?UTF-8\?Q\?([^?]*)\?=/gi, (_, q: string) => q.replace(/_/g, ' '))
    .replace(/=\r?\n/g, '')
  const bytes = words.replace(/=([0-9A-F]{2})/g, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)))
  return Buffer.from(bytes, 'latin1').toString('utf8')
}

beforeEach(async () => {
  inbox = []
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  admin = client()
  await admin('POST', '/api/setup', { email: 'anna@prova.example', name: 'Anna', password: 'una-password-lunga' })
  const port = await fakeSmtp()
  await admin('PUT', '/api/mail', {
    mail: {
      host: '127.0.0.1',
      port,
      security: 'none',
      user: '',
      pass: null,
      from: 'Studio <sito@prova.example>',
      to: '',
    },
  })
})

afterEach(async () => {
  database.close()
  await new Promise((r) => smtp.close(r))
})

/** Publishes a page with a signup form: an email field and a consent box. */
async function signupForm() {
  const page = [
    {
      id: 's1',
      type: 'frame',
      children: [
        {
          id: 'iscriviti',
          type: 'frame',
          form: { name: 'Newsletter', newsletter: true },
          children: [
            { id: 'e', type: 'input', text: 'Email', fieldName: 'email', inputKind: 'email', required: true },
            { id: 'p', type: 'input', text: 'Privacy', fieldName: 'privacy', inputKind: 'checkbox', required: true },
          ],
        },
      ],
    },
  ]
  const doc = (await admin('POST', '/api/collections/pages', { data: { title: 'Home', slug: 'home', page } })).body
  await admin('POST', `/api/documents/${doc.id}/publish`)
}

describe('newsletter signup', () => {
  it('asks to confirm by email, and only confirmed addresses become subscribers', async () => {
    await signupForm()
    const res = await visitor(
      'POST',
      '/api/forms/iscriviti',
      { _t: '8000', email: 'Luca@Example.com', privacy: 'on' },
      { accept: 'application/json', 'accept-language': 'it-IT' },
    )
    expect(res.status).toBe(200)
    // No message in Impostazioni → Messaggi: a subscriber waiting to confirm.
    expect((await admin('GET', '/api/submissions')).body.items).toHaveLength(0)
    const list = (await admin('GET', '/api/subscribers')).body
    expect(list.counts).toEqual({ pending: 1, active: 0, unsubscribed: 0 })
    expect(list.items[0]).toMatchObject({ email: 'luca@example.com', status: 'pending' })

    expect(inbox).toHaveLength(1)
    const mail = plain(inbox[0] ?? '')
    expect(mail).toContain('Conferma l’iscrizione alla newsletter di Studio Rossi')
    const link = /https:\/\/studiorossi\.example\/api\/newsletter\/confirm\/([\w-]+)/.exec(mail)
    expect(link).not.toBeNull()
    const page = await visitor('GET', `/api/newsletter/confirm/${link?.[1]}`)
    expect(page.text).toContain('Iscrizione confermata')
    expect((await admin('GET', '/api/subscribers')).body.counts.active).toBe(1)

    // Signing up again while active sends nothing more.
    await visitor(
      'POST',
      '/api/forms/iscriviti',
      { _t: '8000', email: 'luca@example.com', privacy: 'on' },
      { accept: 'application/json' },
    )
    expect(inbox).toHaveLength(1)
  })

  it('imports a CSV as active, keeps out who left, and exports everyone', async () => {
    const csv =
      'Email Address;First Name\nmarta@example.com;Marta\nMARTA@example.com;Marta\nnot-an-email;X\npietro@example.com;\n'
    expect(parseSubscribersCsv(csv)).toEqual([
      { email: 'marta@example.com', name: 'Marta' },
      { email: 'pietro@example.com' },
    ])
    const res = await admin('POST', '/api/subscribers/import', { csv })
    expect(res.body).toMatchObject({ found: 2, added: 2, skipped: 0 })
    const { items } = (await admin('GET', '/api/subscribers?status=active')).body
    const pietro = items.find((s: { email: string }) => s.email === 'pietro@example.com')
    await visitor('POST', `/api/newsletter/unsubscribe/${pietro.token}`, undefined, {})
    const again = await admin('POST', '/api/subscribers/import', { csv })
    expect(again.body).toMatchObject({ added: 0, skipped: 1, unsubscribed: 1 })
    const out = await admin('GET', '/api/subscribers/export.csv')
    expect(out.text).toContain('pietro@example.com,,unsubscribed,import')
  })
})

describe('sending a newsletter', () => {
  it('sends to active subscribers with an unsubscribe link, and counts opens and clicks', async () => {
    await admin('POST', '/api/subscribers/import', { csv: 'email\nuno@example.com\ndue@example.com\n' })
    const created = (
      await admin('POST', '/api/newsletters', {
        subject: 'Novità di novembre',
        preheader: 'Tre progetti nuovi',
        body: [{ type: 'paragraph', children: [{ text: 'Guarda ' }, { text: 'il progetto', href: '/progetti/casa' }] }],
      })
    ).body
    // A try goes to the person writing it, and counts nothing.
    expect((await admin('POST', `/api/newsletters/${created.id}/test`, {})).status).toBe(200)
    expect(inbox).toHaveLength(1)
    expect(plain(inbox[0] ?? '')).toContain('[Prova] Novità di novembre')

    const sent = await admin('POST', `/api/newsletters/${created.id}/send`)
    expect(sent.status).toBe(200)
    // Sending starts at once, in the background: wait for it.
    let after = (await admin('GET', `/api/newsletters/${created.id}`)).body
    for (let i = 0; i < 100 && after.status === 'sending'; i++) {
      await new Promise((r) => setTimeout(r, 50))
      after = (await admin('GET', `/api/newsletters/${created.id}`)).body
    }
    expect(after.status).toBe('sent')
    expect(after.stats).toMatchObject({ total: 2, sent: 2, failed: 0 })
    expect(inbox).toHaveLength(3)

    const mail = plain(inbox[1] ?? '')
    expect(mail).toMatch(/List-Unsubscribe:\s+<https:\/\/studiorossi\.example\/api\/newsletter\/unsubscribe\//)
    expect(mail).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click')
    // The relative link is made absolute and passes through the site, signed.
    const click = /https:\/\/studiorossi\.example(\/api\/newsletter\/c\/[^"\s]+)/
      .exec(mail)?.[1]
      ?.replace(/&amp;/g, '&')
    expect(click).toBeTruthy()
    const go = await visitor('GET', click ?? '')
    expect(go.status).toBe(302)
    expect(go.headers.get('location')).toBe('https://studiorossi.example/progetti/casa')
    // Bent to another address, the signature no longer matches.
    const bent = (click ?? '').replace(
      encodeURIComponent('https://studiorossi.example/progetti/casa'),
      encodeURIComponent('https://evil.example'),
    )
    expect((await visitor('GET', bent)).status).toBe(400)
    const pixel = /https:\/\/studiorossi\.example(\/api\/newsletter\/o\/[^"\s]+\.gif)/.exec(mail)?.[1]
    expect((await visitor('GET', pixel ?? '')).headers.get('content-type')).toBe('image/gif')
    const stats = (await admin('GET', `/api/newsletters/${created.id}`)).body.stats
    expect(stats).toMatchObject({ opened: 1, clicked: 1 })

    // Sent: it cannot change any more.
    expect((await admin('PUT', `/api/newsletters/${created.id}`, { subject: 'x' })).body.error.code).toBe(
      'newsletter_sent',
    )
  })

  it('goes out by itself at the set time, and an article becomes a newsletter', async () => {
    await admin('POST', '/api/subscribers/import', { csv: 'email\nuno@example.com\n' })
    const post = (
      await admin('POST', '/api/collections/posts', {
        data: {
          title: 'Una casa nel bosco',
          slug: 'casa-nel-bosco',
          excerpt: 'Legno, luce e silenzio',
          body: [{ type: 'paragraph', children: [{ text: 'Il progetto racconta…' }] }],
        },
      })
    ).body
    await admin('POST', `/api/documents/${post.id}/publish`)
    const draft = (await admin('POST', '/api/newsletters/from-document', { id: post.id })).body
    expect(draft).toMatchObject({ subject: 'Una casa nel bosco', preheader: 'Legno, luce e silenzio', status: 'draft' })
    expect(JSON.stringify(draft.body)).toContain('"href":"/diario/casa-nel-bosco"')

    const at = new Date(Date.now() + 60 * 60_000)
    await admin('PUT', `/api/newsletters/${draft.id}/schedule`, { at: at.toISOString() })
    expect(await app.runNewsletters(new Date(Date.now() + 30 * 60_000), 0)).toBe(0)
    expect(await app.runNewsletters(new Date(Date.now() + 61 * 60_000), 0)).toBe(1)
    expect((await admin('GET', `/api/newsletters/${draft.id}`)).body.status).toBe('sent')
  })

  it('keeps the email readable: inline styles, absolute pictures, the footer', () => {
    const html = newsletterHtml({
      site: 'Studio Rossi',
      siteUrl: 'https://studiorossi.example',
      subject: 'Ciao',
      preheader: 'Anteprima',
      body: [{ type: 'image', children: [], image: { src: '/media/foto.jpg', alt: 'Foto' } }],
      accent: '#5b4bea',
      footer: 'Studio Rossi, via Roma 1, Milano',
      unsubscribeUrl: 'https://studiorossi.example/api/newsletter/unsubscribe/x',
      locale: 'it',
    })
    expect(html).toContain('src="https://studiorossi.example/media/foto.jpg"')
    expect(html).toContain('<img style="')
    expect(html).toContain('via Roma 1, Milano')
    expect(html).toContain('Disiscriviti')
  })
})

describe('signup sections in the library', () => {
  it('are real signup forms, with an email field and consent', async () => {
    const { buildSection } = await import('@materializecms/core/library')
    const { formDefinition, walk } = await import('@materializecms/core/page')
    for (const key of ['cta.newsletter', 'footer.newsletter']) {
      const forms: ReturnType<typeof formDefinition>[] = []
      walk([buildSection(key, 'Studio Rossi')], (n) => {
        const def = formDefinition(n)
        if (def) forms.push(def)
      })
      expect(forms).toHaveLength(1)
      expect(forms[0]).toMatchObject({ newsletter: true })
      expect(forms[0]?.fields.map((f) => [f.kind, f.required])).toEqual([
        ['email', true],
        ['checkbox', true],
      ])
    }
  })
})
