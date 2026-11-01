import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../src/index.ts'

// Emails are kept here instead of going out.
const outbox: { to: string; subject: string; text: string }[] = []
vi.mock('../src/mail.ts', async (actual) => ({
  ...(await actual<typeof import('../src/mail.ts')>()),
  sendMail: async (_settings: unknown, message: { to: string; subject: string; text: string }) => {
    outbox.push(message)
  },
}))

const base = defineConfig({
  site: { name: 'Studio Rossi', url: 'https://www.example.com' },
  collections: [defineCollection({ name: 'pages', fields: { title: f.text({ required: true }) } })],
})

let database: Database
let app: ReturnType<typeof createApp>

function client(ip: string, host = 'localhost') {
  let cookie = ''
  return async (method: string, path: string, json?: unknown) => {
    const res = await app.request(`http://${host}${path}`, {
      method,
      headers: {
        origin: `http://${host}`,
        'x-forwarded-for': ip,
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

const PASSWORD = 'una-password-lunga'
let admin: ReturnType<typeof client>

const setUpMail = () =>
  admin('PUT', '/api/mail', {
    mail: {
      host: 'smtp.example.com',
      port: 587,
      security: 'starttls',
      user: 'u',
      pass: 'p',
      from: 'sito@example.com',
      to: 'sito@example.com',
    },
  })

beforeEach(async () => {
  outbox.length = 0
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => ({ ...base, server: { ...base.server, trustProxy: true } }), database })
  admin = client('10.0.0.1')
  await admin('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: PASSWORD })
})

afterEach(() => database.close())

describe('a forgotten password', () => {
  it('says when email is not set up, so the page can tell who can help', async () => {
    const visitor = client('10.0.0.2')
    expect((await visitor('GET', '/api/auth/recovery')).body).toEqual({ mail: false })
    const res = await visitor('POST', '/api/auth/forgot', { email: 'elena@example.com' })
    expect(res.body).toEqual({ ok: true, mail: false })
    expect(outbox).toHaveLength(0)
  })

  it('sends a link to the site’s own address, which sets a new password once', async () => {
    expect((await setUpMail()).status).toBe(200)
    // A false Host must not end up in the link: it would take the token to someone else's server.
    const visitor = client('10.0.0.2', 'evil.example')
    expect((await visitor('POST', '/api/auth/forgot', { email: 'Elena@Example.com' })).body.ok).toBe(true)
    expect(outbox).toHaveLength(1)
    const link = /https:\/\/www\.example\.com\/admin\/_invite\/([\w-]+)/.exec(outbox[0]?.text ?? '')
    expect(link).not.toBeNull()
    expect(outbox[0]?.text).not.toContain('evil.example')

    const token = link?.[1] ?? ''
    expect((await visitor('GET', `/api/invites/${token}`)).body.kind).toBe('reset')
    const done = await visitor('POST', `/api/invites/${token}/accept`, { password: 'una-nuova-password' })
    expect(done.status).toBeLessThan(300)
    expect((await visitor('POST', `/api/invites/${token}/accept`, { password: 'ancora-un-altra' })).status).toBe(404)
    const fresh = client('10.0.0.3')
    expect(
      (await fresh('POST', '/api/auth/login', { email: 'elena@example.com', password: 'una-nuova-password' })).status,
    ).toBe(200)
  })

  it('answers the same for an email without an account, and sends nothing', async () => {
    await setUpMail()
    const res = await client('10.0.0.2')('POST', '/api/auth/forgot', { email: 'nessuno@example.com' })
    expect(res.body).toEqual({ ok: true, mail: true })
    expect(outbox).toHaveLength(0)
  })

  it('pauses after a few requests for the same email', async () => {
    await setUpMail()
    const statuses = []
    for (let i = 0; i < 5; i++)
      statuses.push((await client(`10.0.1.${i}`)('POST', '/api/auth/forgot', { email: 'elena@example.com' })).status)
    expect(statuses.slice(0, 3)).toEqual([200, 200, 200])
    expect(statuses.at(-1)).toBe(429)
    expect(outbox.length).toBeLessThanOrEqual(3)
  })
})
