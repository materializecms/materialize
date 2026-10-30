import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'
import { codeAt, stepAt, verifyCode } from '../src/totp.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  collections: [defineCollection({ name: 'pages', fields: { title: f.text({ required: true }) } })],
})

let database: Database
let app: ReturnType<typeof createApp>

const cookies = new WeakMap<object, () => string>()
const cookieOf = (who: object) => cookies.get(who)?.() ?? ''

/** A browser of its own, with its session cookie and, optionally, its address. */
function client(ip?: string) {
  let cookie = ''
  const call = async (method: string, path: string, json?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: {
        origin: 'http://localhost',
        ...(ip ? { 'x-forwarded-for': ip } : {}),
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
  cookies.set(call, () => cookie)
  return call
}

let admin: ReturnType<typeof client>
const PASSWORD = 'una-password-lunga'

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  // Behind a proxy: the tests tell apart addresses with X-Forwarded-For.
  app = createApp({ config: () => ({ ...config, server: { ...config.server, trustProxy: true } }), database })
  admin = client('10.0.0.1')
  await admin('POST', '/api/setup', { email: 'elena@studiorossi.it', name: 'Elena', password: PASSWORD })
})

afterEach(() => database.close())

const login = (who: ReturnType<typeof client>, password = PASSWORD, email = 'elena@studiorossi.it') =>
  who('POST', '/api/auth/login', { email, password })

/** Turns two-step verification on for whoever `who` is; returns the secret and recovery codes. */
async function enable(who: ReturnType<typeof client>) {
  const { body } = await who('POST', '/api/auth/2fa/setup')
  const done = await who('POST', '/api/auth/2fa/enable', { code: codeAt(body.secret, stepAt()) })
  return { secret: body.secret as string, codes: done.body.recoveryCodes as string[] }
}

describe('sign-in limits', () => {
  it('pause an email after repeated failures, also for unknown emails', async () => {
    const someone = client('10.0.0.2')
    for (let i = 0; i < 5; i++) expect((await login(someone, 'sbagliata')).status).toBe(401)
    const locked = await login(someone)
    expect(locked.status).toBe(429)
    expect(locked.body.error.message).toMatch(/riprova tra/)
    // From another address too: the account is paused, not the attacker.
    expect((await login(client('10.0.0.3'))).status).toBe(429)

    const ghost = client('10.0.0.4')
    for (let i = 0; i < 5; i++) await login(ghost, 'x', 'nessuno@studiorossi.it')
    expect((await login(ghost, 'x', 'nessuno@studiorossi.it')).status).toBe(429)
  })

  it('pause an address that tries many accounts', async () => {
    const attacker = client('10.0.0.9')
    for (let i = 0; i < 20; i++) await login(attacker, 'x', `utente${i}@studiorossi.it`)
    expect((await login(attacker)).status).toBe(429)
    // Elena, from her own address, is not affected.
    expect((await login(client('10.0.0.10'))).status).toBe(200)
  })

  it('forget the failures of an email after a good sign-in', async () => {
    const me = client('10.0.0.5')
    for (let i = 0; i < 4; i++) await login(me, 'sbagliata')
    expect((await login(me)).status).toBe(200)
    for (let i = 0; i < 4; i++) await login(me, 'sbagliata')
    expect((await login(me)).status).toBe(200)
  })
})

describe('two-step verification', () => {
  it('codes follow RFC 6238 and work once', () => {
    // RFC 6238, appendix B: the SHA-1 secret "12345678901234567890" at 59 s gives 94287082.
    const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    expect(codeAt(secret, 1)).toBe('287082')
    const now = Date.now()
    const step = verifyCode(secret, codeAt(secret, stepAt(now)), null, now)
    expect(step).toBe(stepAt(now))
    expect(verifyCode(secret, codeAt(secret, stepAt(now)), step, now)).toBeNull()
  })

  it('asks for a code after the password, or a recovery code once', async () => {
    const { secret, codes } = await enable(admin)
    expect(codes).toHaveLength(10)
    expect((await admin('GET', '/api/auth/me')).body.user.twoFactor).toBe(true)

    const phone = client('10.0.0.6')
    const first = await login(phone)
    expect(first.body).toMatchObject({ twoFactor: true })
    expect((await phone('GET', '/api/auth/me')).status).toBe(401)
    const ticket = first.body.ticket
    expect((await phone('POST', '/api/auth/login/verify', { ticket, code: '000000' })).status).toBe(401)
    const ok = await phone('POST', '/api/auth/login/verify', { ticket, code: codeAt(secret, stepAt() + 1) })
    expect(ok.status).toBe(200)
    expect((await phone('GET', '/api/auth/me')).status).toBe(200)

    const lost = client('10.0.0.7')
    const again = (await login(lost)).body.ticket
    expect((await lost('POST', '/api/auth/login/verify', { ticket: again, code: codes[0] })).status).toBe(200)
    const third = (await login(client('10.0.0.8'))).body.ticket
    expect((await client('10.0.0.8')('POST', '/api/auth/login/verify', { ticket: third, code: codes[0] })).status).toBe(
      401,
    )
  })

  it('can be required for everyone, and reset by an administrator', async () => {
    // An administrator turns it on for themselves first.
    expect((await admin('PUT', '/api/security', { requireTwoFactor: true })).status).toBe(409)
    await enable(admin)
    expect((await admin('PUT', '/api/security', { requireTwoFactor: true })).status).toBe(200)

    const { body } = await admin('POST', '/api/users/invites', { email: 'marco@studiorossi.it', role: 'editor' })
    const marco = client('10.0.1.1')
    const joined = await marco('POST', `/api/invites/${body.link.split('/').pop()}/accept`, {
      name: 'Marco',
      password: 'password-di-marco',
    })
    expect((await marco('GET', '/api/auth/me')).body.needsTwoFactor).toBe(true)
    expect((await marco('GET', '/api/schema')).body.error.code).toBe('two_factor_required')
    await enable(marco)
    expect((await marco('GET', '/api/schema')).status).toBe(200)
    // Nor can it be turned off while required.
    expect((await marco('POST', '/api/auth/2fa/disable', { password: 'password-di-marco' })).status).toBe(409)

    const reset = await admin('DELETE', `/api/users/${joined.body.user.id}/two-factor`)
    expect(reset.body.user.twoFactor).toBe(false)
  })

  it('is not skipped by a password reset link', async () => {
    await enable(admin)
    const me = (await admin('GET', '/api/auth/me')).body.user
    // A second administrator sends the link.
    const { body } = await admin('POST', `/api/users/${me.id}/reset`)
    const res = await client('10.0.2.1')('POST', `/api/invites/${body.link.split('/').pop()}/accept`, {
      password: 'una-nuova-password',
    })
    expect(res.body).toMatchObject({ twoFactor: true })
  })
})

describe('devices', () => {
  it('are listed and can be signed out', async () => {
    const laptop = client('10.0.3.1')
    await login(laptop)
    const list = (await admin('GET', '/api/auth/security')).body.sessions
    expect(list).toHaveLength(2)
    expect(list.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
    const other = list.find((s: { current: boolean }) => !s.current)
    expect((await admin('DELETE', `/api/auth/sessions/${other.id}`)).status).toBe(200)
    expect((await laptop('GET', '/api/auth/me')).status).toBe(401)

    await login(laptop)
    expect((await admin('POST', '/api/auth/sessions/others')).body.ended).toBe(1)
    expect((await admin('GET', '/api/auth/me')).status).toBe(200)
  })
})

describe('activity log', () => {
  it('records sign-ins, people and publishing, for administrators only', async () => {
    await login(client('10.0.4.1'), 'sbagliata')
    await login(client('10.0.4.2'))
    const { body } = await admin('POST', '/api/users/invites', { email: 'marco@studiorossi.it', role: 'editor' })
    const marco = client('10.0.4.3')
    await marco('POST', `/api/invites/${body.link.split('/').pop()}/accept`, {
      name: 'Marco',
      password: 'password-di-marco',
    })
    const doc = (await admin('POST', '/api/collections/pages', { data: { title: 'Chi siamo' } })).body
    await admin('POST', `/api/documents/${doc.id}/publish`)

    const all = (await admin('GET', '/api/activity')).body.items as { action: string; target: string; ip: string }[]
    const actions = all.map((e) => e.action)
    expect(actions).toEqual(
      expect.arrayContaining(['login.failed', 'login.ok', 'user.invited', 'user.joined', 'document.published']),
    )
    expect(all.find((e) => e.action === 'login.failed')).toMatchObject({
      target: 'elena@studiorossi.it',
      ip: '10.0.4.1',
    })
    // Newest first.
    expect(actions[0]).toBe('document.published')

    const access = (await admin('GET', '/api/activity?group=access')).body.items as { action: string }[]
    expect(access.every((e) => /^(login|logout|session|twofactor|token|security)/.test(e.action))).toBe(true)
    expect((await marco('GET', '/api/activity')).status).toBe(403)
  })

  it('pages through older entries', async () => {
    for (let i = 0; i < 55; i++) await admin('POST', '/api/collections/pages', { data: { title: `Pagina ${i}` } })
    const first = (await admin('GET', '/api/activity?group=content')).body.items
    expect(first).toHaveLength(50)
    const last = first[first.length - 1]
    const more = (await admin('GET', `/api/activity?group=content&before=${last.seq}`)).body.items
    expect(more.length).toBeGreaterThanOrEqual(5)
  })
})

describe('security overview', () => {
  it('points at what to fix first', async () => {
    const before = (await admin('GET', '/api/security/overview')).body.checks as { id: string; status: string }[]
    expect(before.find((c) => c.id === 'admins-2fa')?.status).toBe('bad')
    expect(before.find((c) => c.id === 'mail')?.status).toBe('warn')
    await enable(admin)
    const after = (await admin('GET', '/api/security/overview')).body.checks as { id: string; status: string }[]
    expect(after.find((c) => c.id === 'admins-2fa')?.status).toBe('ok')
    expect(after.find((c) => c.id === 'everyone-2fa')?.status).toBe('ok')
  })
})

describe('backups', () => {
  it('copy the database, keep the newest and refuse foreign names', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const dir = await mkdtemp(join(tmpdir(), 'mz-backup-'))
    const db = await openDatabase({ url: `file:${join(dir, 'content.db')}` })
    const local = createApp({
      config: () => ({ ...config, database: { url: `file:${join(dir, 'content.db')}` } }),
      database: db,
    })
    const previous = app
    app = local
    try {
      const me = client('10.0.5.1')
      await me('POST', '/api/setup', { email: 'elena@studiorossi.it', name: 'Elena', password: PASSWORD })
      expect((await me('GET', '/api/backups')).body).toMatchObject({ enabled: true, keep: 14, available: true })
      await me('PUT', '/api/backups', { enabled: true, keep: 2 })
      for (let i = 0; i < 3; i++) expect((await me('POST', '/api/backups')).status).toBe(201)
      const items = (await me('GET', '/api/backups')).body.items as { name: string; size: number }[]
      expect(items).toHaveLength(2)
      expect(items[0]?.size).toBeGreaterThan(1000)

      // The copy is a working database with the same people in it.
      const { readFile } = await import('node:fs/promises')
      const copy = await openDatabase({ url: `file:${join(dir, 'backups', items[0]?.name as string)}` })
      const rows = await copy.client.execute('SELECT email FROM users')
      expect(rows.rows[0]?.email).toBe('elena@studiorossi.it')
      copy.close()
      expect((await readFile(join(dir, 'backups', items[0]?.name as string))).subarray(0, 15).toString()).toBe(
        'SQLite format 3',
      )

      expect((await me('GET', '/api/backups/..%2Fcontent.db')).status).toBe(404)
      expect((await me('DELETE', `/api/backups/${items[1]?.name}`)).status).toBe(200)
      const log = (await me('GET', '/api/activity?group=settings')).body.items.map((e: { action: string }) => e.action)
      expect(log).toContain('backup.created')
    } finally {
      app = previous
      db.close()
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('are not offered for a database kept elsewhere', async () => {
    expect((await admin('GET', '/api/backups')).body.available).toBe(false)
    expect((await admin('POST', '/api/backups')).status).toBe(409)
  })
})

describe('media backups and the whole archive', () => {
  it('copy new media, keep deleted ones, and pack everything in one archive', async () => {
    const { mkdtemp, rm, writeFile, readFile, mkdir, stat } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')
    const { extractTarGz } = await import('../src/archive.ts')
    const { restoreMedia } = await import('../src/backups.ts')
    const dir = await mkdtemp(join(tmpdir(), 'mz-media-'))
    const media = join(dir, 'media')
    await mkdir(join(media, '.cache', 'a.jpg'), { recursive: true })
    await writeFile(join(media, 'a.jpg'), 'immagine a')
    await writeFile(join(media, 'b.jpg'), 'immagine b')
    await writeFile(join(media, '.cache', 'a.jpg', '640.webp'), 'copia ridotta')
    const url = `file:${join(dir, 'content.db')}`
    const db = await openDatabase({ url })
    const previous = app
    app = createApp({ config: () => ({ ...config, database: { url }, media: { dir: media } }), database: db })
    try {
      const me = client('10.0.6.1')
      await me('POST', '/api/setup', { email: 'elena@studiorossi.it', name: 'Elena', password: PASSWORD })
      await me('POST', '/api/backups')
      expect((await me('GET', '/api/backups')).body.media.files).toBe(2)

      // A file deleted from the library stays in the copy.
      await rm(join(media, 'b.jpg'))
      await me('POST', '/api/backups')
      expect(await readFile(join(dir, 'backups', 'media', 'b.jpg'), 'utf8')).toBe('immagine b')
      expect(JSON.parse(await readFile(join(dir, 'backups', 'media', '.removed.json'), 'utf8'))).toHaveProperty('b.jpg')

      // The whole archive, downloaded and read back: database, originals, no resized copies.
      const res = await app.request('/api/backups/archive', {
        headers: { origin: 'http://localhost', cookie: cookieOf(me) },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get('content-disposition')).toMatch(/materialize-\d{4}-\d{2}-\d{2}\.tar\.gz/)
      const archive = join(dir, 'tutto.tar.gz')
      await writeFile(archive, Buffer.from(await res.arrayBuffer()))
      const out = join(dir, 'estratto')
      const written = await extractTarGz(archive, (name) => join(out, name))
      expect(written.sort()).toEqual(['content.db', 'materialize.json', 'media/a.jpg'])
      expect(await readFile(join(out, 'media', 'a.jpg'), 'utf8')).toBe('immagine a')
      const copy = await openDatabase({ url: `file:${join(out, 'content.db')}` })
      expect((await copy.client.execute('SELECT email FROM users')).rows[0]?.email).toBe('elena@studiorossi.it')
      copy.close()

      // A restored database gets its missing images back from the media copy; nothing outside it.
      const back = await restoreMedia(join(dir, 'content.db'), media, ['b.jpg', '../content.db', '.removed.json'])
      expect(back).toBe(1)
      expect(await stat(join(media, 'b.jpg')).catch(() => null)).not.toBeNull()
    } finally {
      app = previous
      db.close()
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('tracking and cookies', () => {
  it('saves services and code for admins, refusing wrong ids', async () => {
    expect((await admin('GET', '/api/tracking')).body.tracking).toEqual({})
    const wrong = await admin('PUT', '/api/tracking', { tracking: { ga4: 'UA-1234' } })
    expect(wrong.status).toBe(422)
    const ok = await admin('PUT', '/api/tracking', {
      tracking: {
        ga4: 'G-ABC1234',
        custom: [{ id: 'hj', name: 'Hotjar', place: 'head', category: 'analytics', code: '<script>hj()</script>' }],
      },
    })
    expect(ok.status).toBe(200)
    expect((await admin('GET', '/api/tracking')).body.tracking.ga4).toBe('G-ABC1234')
    const log = (await admin('GET', '/api/activity?group=settings')).body.items.map((e: { action: string }) => e.action)
    expect(log).toContain('settings.tracking')
  })

  it('refuses code that would break out of its template', async () => {
    const res = await admin('PUT', '/api/tracking', {
      tracking: { custom: [{ id: 'x', name: 'x', place: 'body', category: 'marketing', code: '</template><script>' }] },
    })
    expect(res.status).toBe(422)
  })
})
