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

const until = async (ok: () => boolean) => {
  for (let i = 0; i < 100 && !ok(); i++) await new Promise((r) => setTimeout(r, 10))
}
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
    const pat = (await admin('POST', '/api/tokens', { name: 'script' })).body.token as string
    expect((await app.request('/api/auth/me', { headers: { authorization: `Bearer ${pat}` } })).status).toBe(200)
    // A false Host must not end up in the link: it would take the token to someone else's server.
    const visitor = client('10.0.0.2', 'evil.example')
    expect((await visitor('POST', '/api/auth/forgot', { email: 'Elena@Example.com' })).body.ok).toBe(true)
    // Sent after the answer, so its timing says nothing about the account.
    await until(() => outbox.length > 0)
    expect(outbox).toHaveLength(1)
    const link = /https:\/\/www\.example\.com\/admin\/_invite\/([\w-]+)/.exec(outbox[0]?.text ?? '')
    expect(link).not.toBeNull()
    expect(outbox[0]?.text).not.toContain('evil.example')

    const token = link?.[1] ?? ''
    expect((await visitor('GET', `/api/invites/${token}`)).body.kind).toBe('reset')
    const done = await visitor('POST', `/api/invites/${token}/accept`, { password: 'una-nuova-password' })
    expect(done.status).toBeLessThan(300)
    // Whoever had the account is out: the old session and every access token stop working.
    expect((await admin('GET', '/api/auth/me')).status).toBe(401)
    expect((await app.request('/api/auth/me', { headers: { authorization: `Bearer ${pat}` } })).status).toBe(401)
    expect((await visitor('POST', `/api/invites/${token}/accept`, { password: 'ancora-un-altra' })).status).toBe(404)
    const fresh = client('10.0.0.3')
    expect(
      (await fresh('POST', '/api/auth/login', { email: 'elena@example.com', password: 'una-nuova-password' })).status,
    ).toBe(200)
  })

  it('sends no link when the site’s address is not set, unless on this computer', async () => {
    const config = () => ({ ...base, site: { name: 'Studio Rossi' }, server: { ...base.server, trustProxy: true } })
    app = createApp({ config, database })
    await setUpMail()
    const res = await client('10.0.0.2', 'evil.example')('POST', '/api/auth/forgot', { email: 'elena@example.com' })
    // The same answer as always: nothing tells the stranger what happened.
    expect(res.body).toEqual({ ok: true, mail: true })
    await new Promise((r) => setTimeout(r, 50))
    expect(outbox).toHaveLength(0)
    // The overview says what to set.
    const online = client('10.0.0.1', 'cms.example')
    expect((await online('POST', '/api/auth/login', { email: 'elena@example.com', password: PASSWORD })).status).toBe(
      200,
    )
    expect(JSON.stringify((await online('GET', '/api/security/overview')).body)).toContain('site-url')

    // On this computer (materialize dev) the address of the request is fine.
    await client('10.0.0.3')('POST', '/api/auth/forgot', { email: 'elena@example.com' })
    await until(() => outbox.length > 0)
    expect(outbox[0]?.text).toContain('http://localhost/admin/_invite/')
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
