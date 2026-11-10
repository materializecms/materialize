import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { devGuard, devSiteHost, ProductionSite } from '../src/site.ts'

describe('dev site', () => {
  it('listens for hot reload where the CMS listens', () => {
    expect(devSiteHost('127.0.0.1')).toBe('127.0.0.1')
    expect(devSiteHost('0.0.0.0')).toBe('0.0.0.0')
    expect(devSiteHost(undefined)).toBe(true)
  })

  it('refuses the project files a browser never needs', () => {
    for (const url of [
      '/materialize.config.ts',
      '/astro.config.mjs',
      '/package.json',
      '/package-lock.json',
      '/tsconfig.json',
      '/.env',
      '/.env.local',
      '/%2Eenv',
      '//package.json',
      '/.materialize/content.db',
      '/.git/config',
      '/package.json?import',
      '/@fs/Users/elena/sito/materialize.config.ts',
    ])
      expect(devGuard(url), url).toBe(404)
    for (const url of [
      '/',
      '/src/components/Menu.astro?astro&type=script&index=0&lang.ts',
      '/node_modules/.vite/deps/astro.js',
      '/@vite/client',
      '/blog/package.json-tips',
      '/blog/.envelope',
    ])
      expect(devGuard(url), url).toBeNull()
    // A malformed address: Astro would log a URI error and answer 500.
    expect(devGuard('/%E0%A4%A')).toBe(400)
  })
})

describe('production site', () => {
  let dir = ''
  let server: Server | undefined
  afterEach(async () => {
    await new Promise((resolve) => (server ? server.close(resolve) : resolve(null)))
    server = undefined
    await rm(dir, { recursive: true, force: true })
  })

  it('answers 400 to a malformed address', async () => {
    dir = await mkdtemp(join(tmpdir(), 'mz-prod-'))
    await mkdir(join(dir, 'build/client'), { recursive: true })
    await writeFile(join(dir, 'build/client/index.html'), '<p>ciao</p>')
    const site = new ProductionSite(dir, () => {})
    // biome-ignore lint/suspicious/noExplicitAny: a finished build, without running Astro
    ;(site as any).live = { dir: join(dir, 'build'), ssr: () => {} }
    server = createServer((req, res) => void site.handle(req, res))
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve))
    const { port } = server.address() as { port: number }
    expect((await fetch(`http://127.0.0.1:${port}/%E0%A4%A`)).status).toBe(400)
    expect((await fetch(`http://127.0.0.1:${port}/`)).status).toBe(200)
  })
})
