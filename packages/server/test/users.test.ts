import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  collections: [defineCollection({ name: 'pages', fields: { title: f.text({ required: true }) } })],
})

let database: Database
let app: ReturnType<typeof createApp>

/** A browser of its own: each client keeps its session cookie. */
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

let admin: ReturnType<typeof client>

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  admin = client()
  await admin('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: 'una-password-lunga' })
})

afterEach(() => database.close())

const tokenOf = (link: string) => link.split('/').pop() as string

describe('invitations', () => {
  it('lets an invited editor join with their own password', async () => {
    const invited = await admin('POST', '/api/users/invites', { email: 'marco@example.com', role: 'editor' })
    expect(invited.status).toBe(201)
    expect(invited.body.link).toMatch(/^\/admin\/_invite\/[\w-]{40,}$/)
    expect((await admin('GET', '/api/users')).body.invites).toHaveLength(1)

    const marco = client()
    const token = tokenOf(invited.body.link)
    expect((await marco('GET', `/api/invites/${token}`)).body).toMatchObject({
      kind: 'invite',
      email: 'marco@example.com',
      site: 'Studio Rossi',
    })
    const joined = await marco('POST', `/api/invites/${token}/accept`, { name: 'Marco', password: 'password-di-marco' })
    expect(joined.status).toBe(201)
    expect((await marco('GET', '/api/auth/me')).body.user).toMatchObject({ name: 'Marco', role: 'editor' })

    // Used once, gone; editors do not manage people.
    expect((await client()('GET', `/api/invites/${token}`)).status).toBe(404)
    expect((await marco('GET', '/api/users')).status).toBe(403)
    expect((await admin('GET', '/api/users')).body.users.map((u: { name: string }) => u.name)).toEqual([
      'Elena',
      'Marco',
    ])
  })

  it('refuses to invite an address that already has an account', async () => {
    const res = await admin('POST', '/api/users/invites', { email: 'Elena@example.com', role: 'editor' })
    expect(res.status).toBe(409)
  })

  it('can be revoked', async () => {
    const { body } = await admin('POST', '/api/users/invites', { email: 'luca@example.com', role: 'editor' })
    expect((await admin('DELETE', `/api/users/invites/${body.invite.id}`)).status).toBe(204)
    expect((await client()('GET', `/api/invites/${tokenOf(body.link)}`)).status).toBe(404)
  })
})

describe('people', () => {
  async function addEditor() {
    const { body } = await admin('POST', '/api/users/invites', { email: 'marco@example.com', role: 'editor' })
    const marco = client()
    const { body: joined } = await marco('POST', `/api/invites/${tokenOf(body.link)}/accept`, {
      name: 'Marco',
      password: 'password-di-marco',
    })
    return { marco, id: joined.user.id as string }
  }

  it('always keeps at least one administrator', async () => {
    const me = (await admin('GET', '/api/auth/me')).body.user
    expect((await admin('PATCH', `/api/users/${me.id}`, { role: 'editor' })).status).toBe(409)
    expect((await admin('DELETE', `/api/users/${me.id}`)).status).toBe(409)

    const { id } = await addEditor()
    expect((await admin('PATCH', `/api/users/${id}`, { role: 'admin' })).body.user.role).toBe('admin')
    expect((await admin('PATCH', `/api/users/${me.id}`, { role: 'editor' })).status).toBe(200)
  })

  it('removes people and their sessions', async () => {
    const { marco, id } = await addEditor()
    expect((await admin('DELETE', `/api/users/${id}`)).status).toBe(204)
    expect((await marco('GET', '/api/auth/me')).status).toBe(401)
  })

  it('resets a forgotten password with a one-time link', async () => {
    const { marco, id } = await addEditor()
    const { body } = await admin('POST', `/api/users/${id}/reset`)
    const fresh = client()
    expect((await fresh('GET', `/api/invites/${tokenOf(body.link)}`)).body.kind).toBe('reset')
    expect(
      (await fresh('POST', `/api/invites/${tokenOf(body.link)}/accept`, { password: 'nuova-password-123' })).status,
    ).toBe(200)
    // The old session is signed out; the new password works.
    expect((await marco('GET', '/api/auth/me')).status).toBe(401)
    const again = client()
    expect(
      (await again('POST', '/api/auth/login', { email: 'marco@example.com', password: 'nuova-password-123' })).status,
    ).toBe(200)
  })

  it('lets people update their name and password', async () => {
    expect((await admin('PATCH', '/api/auth/me', { name: 'Elena Rossi' })).body.user.name).toBe('Elena Rossi')
    const wrong = await admin('POST', '/api/auth/password', { current: 'sbagliata', next: 'una-nuova-password' })
    expect(wrong.status).toBe(422)
    const ok = await admin('POST', '/api/auth/password', {
      current: 'una-password-lunga',
      next: 'una-nuova-password',
    })
    expect(ok.status).toBe(200)
    expect((await admin('GET', '/api/auth/me')).status).toBe(200)
  })

  it('lets people change their own email, confirmed with the password', async () => {
    const { marco } = await addEditor()
    const wrong = await marco('POST', '/api/auth/email', { email: 'marco@example.org', password: 'sbagliata' })
    expect(wrong.status).toBe(422)
    const taken = await marco('POST', '/api/auth/email', {
      email: 'Elena@example.com',
      password: 'password-di-marco',
    })
    expect(taken.status).toBe(409)
    const ok = await marco('POST', '/api/auth/email', { email: 'Marco@Example.org', password: 'password-di-marco' })
    expect(ok.body.user.email).toBe('marco@example.org')
    // The new address signs in, the old one no longer does.
    const fresh = client()
    expect(
      (await fresh('POST', '/api/auth/login', { email: 'marco@example.com', password: 'password-di-marco' })).status,
    ).toBe(401)
    expect(
      (await fresh('POST', '/api/auth/login', { email: 'marco@example.org', password: 'password-di-marco' })).status,
    ).toBe(200)
  })

  it('lets administrators correct someone else’s email', async () => {
    const { marco, id } = await addEditor()
    expect((await admin('PATCH', `/api/users/${id}`, { email: 'marco@example.org' })).body.user.email).toBe(
      'marco@example.org',
    )
    expect((await admin('PATCH', `/api/users/${id}`, { email: 'elena@example.com' })).status).toBe(409)
    expect((await admin('PATCH', `/api/users/${id}`, { email: 'non-una-email' })).status).toBe(422)
    // An editor cannot change other people.
    const me = (await admin('GET', '/api/auth/me')).body.user
    expect((await marco('PATCH', `/api/users/${me.id}`, { email: 'x@y.example' })).status).toBe(403)
  })
})
