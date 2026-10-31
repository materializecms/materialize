import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

let dir: string
let database: Database
let app: ReturnType<typeof createApp>
let cookie = ''

const headers = () => ({ origin: 'http://localhost', ...(cookie ? { cookie } : {}) })

async function json(method: string, path: string, body?: unknown) {
  const res = await app.request(path, {
    method,
    headers: { ...headers(), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const set = res.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0] ?? ''
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

async function upload(name: string, data: Buffer, type = 'image/jpeg') {
  const form = new FormData()
  form.set('file', new File([new Uint8Array(data)], name, { type }))
  const res = await app.request('/api/media', { method: 'POST', headers: headers(), body: form })
  type Body = { id: string; url: string; error: { code: string } } & Record<string, unknown>
  return { status: res.status, body: (await res.json()) as Body }
}

/** A photo as a camera would save it: rotated by an EXIF flag and carrying metadata. */
const photo = () =>
  sharp({ create: { width: 1200, height: 800, channels: 3, background: '#b08d57' } })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Copyright: 'Camera Studio' } } })
    .toBuffer()

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'mz-media-'))
  const config = defineConfig({
    site: { name: 'Studio Rossi' },
    media: { dir },
    collections: [defineCollection({ name: 'pages', fields: { title: f.text({ required: true }), image: f.media() } })],
  })
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  cookie = ''
  await json('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: 'una-password-lunga' })
})

afterEach(async () => {
  database.close()
  await rm(dir, { recursive: true, force: true })
})

describe('media library', () => {
  it('stores uploads upright and without camera metadata', async () => {
    const res = await upload('Casa sul Lago.JPG', await photo())
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ filename: 'Casa sul Lago.JPG', mime: 'image/jpeg', width: 800, height: 1200 })
    expect(res.body.url).toMatch(/^\/media\/casa-sul-lago-[0-9a-f]{8}\.jpg$/)

    const file = await app.request(res.body.url)
    expect(file.headers.get('cache-control')).toContain('immutable')
    const meta = await sharp(Buffer.from(await file.arrayBuffer())).metadata()
    expect(meta.exif).toBeUndefined()
    expect(meta.orientation).toBeUndefined()
  })

  it('serves resized copies in modern formats', async () => {
    const { body } = await upload('facciata.jpg', await photo())
    const res = await app.request(`${body.url}@640.avif`)
    expect(res.headers.get('content-type')).toBe('image/avif')
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
    expect(meta.width).toBe(640)
    expect((await app.request(`${body.url}@640.exe`)).status).toBe(404)
    expect((await app.request('/media/..%2Fcontent.db')).status).toBe(404)
  })

  it('rejects files that are not images, whatever their name says', async () => {
    const res = await upload('foto.jpg', Buffer.from('<script>alert(1)</script>'))
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('invalid_file')
  })

  it('lists, describes, counts usage and deletes', async () => {
    const { body: asset } = await upload('interno.jpg', await photo())
    await json('PATCH', `/api/media/${asset.id}`, { alt: 'Soggiorno con luce da sud' })
    expect((await json('GET', '/api/media?search=sud')).body.items.map((a: { id: string }) => a.id)).toEqual([asset.id])

    await json('POST', '/api/collections/pages', { data: { title: 'Home', image: { src: asset.url, alt: '' } } })
    expect((await json('GET', `/api/media/${asset.id}`)).body.usage).toBe(1)

    expect((await json('DELETE', `/api/media/${asset.id}`)).status).toBe(204)
    expect((await app.request(asset.url)).status).toBe(404)
  })

  it('requires a signed-in user to upload', async () => {
    cookie = ''
    expect((await upload('x.jpg', await photo())).status).toBe(401)
  })
})
