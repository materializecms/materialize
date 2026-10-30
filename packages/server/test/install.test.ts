import { defineCollection, defineConfig, f } from '@materializecms/core'
import { isPatch, newer, type UpdateStatus, type Updates } from '@materializecms/core/updates'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp, type ServerContext } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Nuovo sito' },
  collections: [
    defineCollection({ name: 'pages', fields: { title: f.text({ required: true }) } }),
    defineCollection({ name: 'settings', singleton: true, fields: { siteName: f.text({ required: true }) } }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>
let cookie = ''

const start = (extra: Partial<ServerContext> = {}) => {
  app = createApp({ config: () => config, database, ...extra })
  cookie = ''
}

async function call(method: string, path: string, json?: unknown) {
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

const admin = { email: 'elena@studiorossi.it', name: 'Elena', password: 'una-password-lunga' }

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
})
afterEach(() => database.close())

describe('installation', () => {
  it('checks the server and proposes the name and language', async () => {
    start()
    const { body } = await call('GET', '/api/setup')
    expect(body.needsSetup).toBe(true)
    expect(body.needsToken).toBe(false)
    expect(body.site).toEqual({ name: 'Nuovo sito', locale: 'it' })
    expect(body.checks.map((c: { id: string }) => c.id)).toEqual(['node', 'files', 'site', 'https', 'updates'])
  })

  it('names the site, sets its language and creates the administrator', async () => {
    start()
    const res = await call('POST', '/api/setup', { ...admin, site: { name: 'Studio Rossi', locale: 'en' } })
    expect(res.status).toBe(201)
    const settings = await call('GET', '/api/collections/settings?locale=en')
    expect(settings.body.items[0].title).toBe('Studio Rossi')
    expect(settings.body.items[0].status).toBe('published')
    const schema = (await call('GET', '/api/schema')).body
    expect(schema.locales.default).toBe('en')
    // The panel shows the name chosen here, not the one in the config.
    expect(schema.site.name).toBe('Studio Rossi')
    // Once installed, the setup says nothing more about the server.
    expect((await call('GET', '/api/setup')).body).toEqual({ needsSetup: false })
  })

  it('asks for the code from the start link when there is one', async () => {
    start({ setupToken: 'codice-segreto' })
    expect((await call('GET', '/api/setup')).body.needsToken).toBe(true)
    expect((await call('POST', '/api/setup', admin)).status).toBe(403)
    expect((await call('POST', '/api/setup', { ...admin, token: 'sbagliato' })).status).toBe(403)
    expect((await call('POST', '/api/setup', { ...admin, token: 'codice-segreto' })).status).toBe(201)
  })
})

describe('updates', () => {
  /** An Updates that records what it is asked, like materialize start would do the work. */
  function fake(overrides: Partial<UpdateStatus> = {}) {
    const calls: string[] = []
    let status: UpdateStatus = {
      current: '0.1.0',
      latest: '0.1.1',
      notes: [{ version: '0.1.1', notes: '- Correzione' }],
      checkedAt: null,
      previous: null,
      job: { state: 'idle' },
      last: null,
      ...overrides,
    }
    const updates: Updates = {
      status: async () => status,
      check: async () => {
        calls.push('check')
        status = { ...status, checkedAt: new Date().toISOString() }
        return status
      },
      install: async (version, backup) => {
        await backup()
        calls.push(`install ${version}`)
        status = { ...status, job: { state: 'restarting' } }
      },
      rollback: async () => {
        calls.push('rollback')
      },
    }
    return { updates, calls }
  }

  it('shows what is new and installs it for admins', async () => {
    const { updates, calls } = fake()
    start({ updates })
    await call('POST', '/api/setup', admin)
    const state = (await call('GET', '/api/updates')).body
    expect(state.latest).toBe('0.1.1')
    expect(state.settings).toEqual({ auto: false })
    expect((await call('POST', '/api/updates/check')).body.checkedAt).toBeTruthy()
    const res = await call('POST', '/api/updates/install', { version: '0.1.1' })
    expect(res.status).toBe(202)
    expect(res.body.job.state).toBe('restarting')
    expect(calls).toEqual(['check', 'install 0.1.1'])
    expect((await call('POST', '/api/updates/install', { version: 'latest' })).status).toBe(422)
    const log = (await call('GET', '/api/activity?group=settings')).body.items.map((e: { action: string }) => e.action)
    expect(log).toContain('update.install')
  })

  it('explains how to update by hand when the server cannot', async () => {
    start()
    await call('POST', '/api/setup', admin)
    const state = (await call('GET', '/api/updates')).body
    expect(state.unavailable).toMatch(/materialize start/)
    expect((await call('POST', '/api/updates/install', { version: '0.1.1' })).status).toBe(409)
  })

  it('keeps the choice about fixes installing by themselves', async () => {
    start({ updates: fake().updates })
    await call('POST', '/api/setup', admin)
    expect((await call('PUT', '/api/updates/settings', { auto: true })).body.settings).toEqual({ auto: true })
  })

  it('compares versions', () => {
    expect(newer('0.10.0', '0.9.9')).toBe(true)
    expect(newer('0.1.0', '0.1.0')).toBe(false)
    expect(isPatch('0.1.2', '0.1.0')).toBe(true)
    expect(isPatch('0.2.0', '0.1.0')).toBe(false)
    expect(isPatch('0.1.0', '0.1.0')).toBe(false)
  })
})
