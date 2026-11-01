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
let cookie = ''
const call = async (method: string, path: string, json?: unknown) => {
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

const s3 = {
  endpoint: 'https://abc.r2.cloudflarestorage.com',
  region: 'auto',
  bucket: 'backup',
  accessKeyId: 'chiave',
  secretAccessKey: 'segreto-del-bucket',
}

beforeEach(async () => {
  cookie = ''
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  await call('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: 'una-password-lunga' })
})
afterEach(() => database.close())

describe('the copy outside the server, from the panel', () => {
  it('makes the recovery key on the first save and returns it that once', async () => {
    const first = await call('PUT', '/api/backups/offsite', { kind: 's3', keep: 30, s3 })
    expect(first.status).toBe(200)
    expect(first.body.recoveryKey).toMatch(/^mzk1-[\w-]{43}$/)
    const again = await call('PUT', '/api/backups/offsite', {
      kind: 's3',
      keep: 14,
      s3: { ...s3, secretAccessKey: '' },
    })
    expect(again.body.recoveryKey).toBeUndefined()
    expect(again.body.keep).toBe(14)
  })

  it('never sends secrets back, and keeps the saved one when the field is left empty', async () => {
    await call('PUT', '/api/backups/offsite', { kind: 's3', keep: 30, s3 })
    await call('PUT', '/api/backups/offsite', { kind: 's3', keep: 30, s3: { ...s3, secretAccessKey: '' } })
    const state = await call('GET', '/api/backups/offsite')
    expect(JSON.stringify(state.body)).not.toContain('segreto-del-bucket')
    expect(JSON.stringify(state.body)).not.toContain('mzk1-')
    expect(state.body.s3).toMatchObject({ bucket: 'backup', secretAccessKey: '', hasSecret: true })
    expect(state.body.hasKey).toBe(true)
  })

  it('shows the key again only with the right password', async () => {
    const { body } = await call('PUT', '/api/backups/offsite', { kind: 's3', keep: 30, s3 })
    expect((await call('POST', '/api/backups/offsite/key', { password: 'sbagliata' })).status).toBe(422)
    const right = await call('POST', '/api/backups/offsite/key', { password: 'una-password-lunga' })
    expect(right.body.recoveryKey).toBe(body.recoveryKey)
  })

  it('says why a test fails, in words', async () => {
    const res = await call('POST', '/api/backups/offsite/test', {
      kind: 'webdav',
      keep: 30,
      webdav: { url: 'https://non-esiste.invalid/dav/', user: 'u', password: 'p' },
    })
    expect(res.body.ok).toBe(false)
    expect(res.body.message).toMatch(/non si trova|non risponde/)
  })

  it('is for administrators only', async () => {
    cookie = ''
    expect((await call('GET', '/api/backups/offsite')).status).toBe(401)
  })
})
