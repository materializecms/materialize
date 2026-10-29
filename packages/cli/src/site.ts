import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MediaFiles } from '@materialize/server'

export const ASTRO_CONFIGS = ['astro.config.ts', 'astro.config.mjs', 'astro.config.js']

/** True when the project has an Astro site next to materialize.config.ts. */
export const hasSite = (root: string) => ASTRO_CONFIGS.some((name) => existsSync(resolve(root, name)))

export type Handler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

/** Astro's dev server, mounted inside Materialize: pages render on demand from the database. */
export async function startDevSite(
  root: string,
  port: number,
): Promise<{ handle: Handler; close: () => Promise<void> }> {
  const { dev } = await import('astro')
  const server = await dev({
    root,
    logLevel: 'warn',
    // The canvas shows the site itself: Astro's own toolbar would get in the way.
    devToolbar: { enabled: false },
    // Astro also listens on its own port, where the browser connects for hot reload.
    server: { port, host: 'localhost' },
    vite: { server: { hmr: { clientPort: port } } },
  })
  return { handle: (req, res) => server.handle(req, res), close: () => server.stop() }
}

/** Builds the static site into `outDir` (client/ holds the pages, server/ the preview renderer). */
export async function buildSite(root: string, outDir: string): Promise<void> {
  const { build } = await import('astro')
  await build({ root, outDir, logLevel: 'warn' })
}

/**
 * Copies every library image the built pages use (originals and resized copies) into the
 * static output, so `dist/` works on any host without the Materialize server.
 */
export async function exportMedia(client: string, files: MediaFiles): Promise<number> {
  const urls = new Set<string>()
  const walk = async (dir: string) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) await walk(path)
      else if (/\.(html|css|xml|json)$/.test(entry.name)) {
        for (const match of (await readFile(path, 'utf8')).matchAll(/\/media\/[a-z0-9-]+\.[a-z]+(?:@\d+\.[a-z]+)?/g)) {
          urls.add(match[0])
        }
      }
    }
  }
  await walk(client)
  let copied = 0
  for (const url of urls) {
    const name = url.slice('/media/'.length)
    const parsed = /^(.+)@(\d+)\.(avif|webp|jpg|png)$/.exec(name)
    const file = await files.open(
      parsed ? (parsed[1] as string) : name,
      parsed ? { width: Number(parsed[2]), format: parsed[3] as 'avif' | 'webp' | 'jpg' | 'png' } : undefined,
    )
    if (!file) continue
    const target = join(client, url)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(file.path, target)
    copied++
  }
  return copied
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

async function isFile(path: string) {
  return (await stat(path).catch(() => null))?.isFile() ?? false
}

/**
 * The site in production: static files from the latest build, the preview renderer on demand,
 * and a fresh build after every publish. Builds go to a new folder and replace the live one only
 * when complete, so visitors never see a half-written site.
 */
export class ProductionSite {
  private live: { dir: string; ssr: Handler } | null = null
  private building: Promise<void> | null = null
  private queued = false
  private readonly root: string
  private readonly builds: string
  private readonly log: (message: string, ok: boolean) => void

  constructor(root: string, log: (message: string, ok: boolean) => void) {
    this.root = root
    this.log = log
    this.builds = resolve(root, '.materialize/site')
  }

  /** Rebuilds now, or right after the build in progress: rapid publishes coalesce into one extra build. */
  rebuild(): Promise<void> {
    if (this.building) {
      this.queued = true
      return this.building
    }
    this.building = (async () => {
      do {
        this.queued = false
        await this.buildOnce()
      } while (this.queued)
    })().finally(() => {
      this.building = null
    })
    return this.building
  }

  private async buildOnce() {
    const started = performance.now()
    const dir = join(this.builds, String(Date.now()))
    try {
      await buildSite(this.root, dir)
      const entry = (await import(pathToFileURL(join(dir, 'server/entry.mjs')).href)) as { handler: Handler }
      const previous = this.live?.dir
      this.live = { dir, ssr: entry.handler }
      this.log(`Sito aggiornato in ${Math.round(performance.now() - started)} ms`, true)
      for (const old of await readdir(this.builds)) {
        const path = join(this.builds, old)
        if (path !== dir && path !== previous) await rm(path, { recursive: true, force: true })
      }
    } catch (error) {
      await rm(dir, { recursive: true, force: true })
      this.log(`Il sito non si è aggiornato: ${error instanceof Error ? error.message : String(error)}`, false)
    }
  }

  handle: Handler = async (req, res) => {
    const live = this.live
    if (!live) {
      res.writeHead(503, { 'content-type': TYPES['.html'] as string, 'retry-after': '2' })
      res.end('<meta http-equiv="refresh" content="2">Il sito si sta preparando…')
      return
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname.startsWith('/_materialize/')) return live.ssr(req, res)
    const client = join(live.dir, 'client')
    const path = decodeURIComponent(url.pathname)
    const candidates = [path, join(path, 'index.html'), `${path.replace(/\/$/, '')}.html`]
    for (const candidate of candidates) {
      const file = normalize(join(client, candidate))
      if (!file.startsWith(client + sep) || !(await isFile(file))) continue
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': candidate.startsWith('/_astro/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      })
      res.end(req.method === 'HEAD' ? undefined : await readFile(file))
      return
    }
    const notFound = join(client, '404.html')
    res.writeHead(404, { 'content-type': TYPES['.html'] as string })
    res.end((await isFile(notFound)) ? await readFile(notFound) : 'Pagina non trovata')
  }
}
