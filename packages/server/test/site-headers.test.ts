import { mkdtemp, rm } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, type MaterializeConfig } from '@materializecms/core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type RunningServer, type SiteHandler, startServer } from '../src/index.ts'

let server: RunningServer | undefined
let dir = ''

afterEach(async () => {
  await server?.close()
  server = undefined
  if (dir) await rm(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/** A real server on a free port, with a stand-in for the Astro site. */
async function start(site: SiteHandler, input: Partial<Parameters<typeof defineConfig>[0]> = {}) {
  if (dir) await rm(dir, { recursive: true, force: true })
  dir = await mkdtemp(join(tmpdir(), 'mz-site-'))
  const config: MaterializeConfig = defineConfig({
    collections: [],
    ...input,
    site: input.site ?? { name: 'Prova' },
    database: { url: `file:${join(dir, 'content.db')}` },
    media: { dir: join(dir, 'media') },
  })
  const port = 20000 + Math.floor(Math.random() * 20000)
  server = await startServer(config, { port, host: '127.0.0.1', site })
  // node:http rather than fetch, which would not send another Host.
  return (path: string, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; headers: { get: (name: string) => string | null } }>((resolve, reject) => {
      request({ host: '127.0.0.1', port, path, headers }, (res) => {
        res.resume()
        resolve({
          status: res.statusCode ?? 0,
          headers: { get: (name) => (res.headers[name] as string | undefined) ?? null },
        })
      })
        .on('error', reject)
        .end()
    })
}

const page: SiteHandler = (req, res) => {
  if (req.url === '/vecchia') {
    res.writeHead(301, { location: '/nuova' })
    res.end()
  } else if (req.url === '/condividi') {
    res.writeHead(200, { 'content-type': 'text/html', 'x-robots-tag': 'noindex' })
    res.end('<p>anteprima</p>')
  } else if (req.url?.startsWith('/%')) {
    decodeURIComponent(req.url)
  } else {
    res.writeHead(req.url === '/' ? 200 : 404, { 'content-type': 'text/html' })
    res.end('<p>ciao</p>')
  }
}

describe('public site headers', () => {
  it('sends the security headers on pages, 404s and redirects', async () => {
    const get = await start(page)
    for (const [path, status] of [
      ['/', 200],
      ['/manca', 404],
      ['/vecchia', 301],
      ['/sitemap.xml', 404],
    ] as const) {
      const res = await get(path)
      expect(res.status).toBe(status)
      expect(res.headers.get('x-content-type-options')).toBe('nosniff')
      expect(res.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
      expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
      // The editor previews the site in a frame of the same origin.
      expect(res.headers.get('content-security-policy')).toBe("frame-ancestors 'self'")
      expect(res.headers.get('strict-transport-security')).toBeNull()
    }
  })

  it('keeps the headers the site sets itself', async () => {
    const get = await start(page)
    const res = await get('/condividi')
    expect(res.headers.get('x-robots-tag')).toBe('noindex')
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('sends HSTS only over https', async () => {
    let get = await start(page, { server: { trustProxy: true } })
    expect((await get('/', { 'x-forwarded-proto': 'https' })).headers.get('strict-transport-security')).toBe(
      'max-age=15552000',
    )
    expect((await get('/', { 'x-forwarded-proto': 'http' })).headers.get('strict-transport-security')).toBeNull()
    await server?.close()

    // Without trustProxy, anyone could send the header: it does not count.
    get = await start(page)
    expect((await get('/', { 'x-forwarded-proto': 'https' })).headers.get('strict-transport-security')).toBeNull()
    await server?.close()

    // An https site address counts, except on this computer.
    get = await start(page, { site: { name: 'Prova', url: 'https://www.prova.example' } })
    expect((await get('/', { host: 'www.prova.example' })).headers.get('strict-transport-security')).toBe(
      'max-age=15552000',
    )
    expect((await get('/')).headers.get('strict-transport-security')).toBeNull()
  })

  it('answers 400 to a malformed address, without logging an error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const get = await start(page)
    const res = await get('/%E0%A4%A')
    expect(res.status).toBe(400)
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(error).not.toHaveBeenCalled()
  })

  it('leaves the API to its own headers', async () => {
    const get = await start(page)
    const res = await get('/api/setup')
    expect(res.headers.get('content-security-policy')).toBeNull()
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })
})
