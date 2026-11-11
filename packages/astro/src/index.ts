import { existsSync, readdirSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { htmlToMarkdown, markdownPath } from '@materializecms/core/seo'
import type { AstroIntegration } from 'astro'
import { getRedirects, getSitemapPages, getSiteSeo, hasFeed } from './content.ts'
import { getRuntime, hasRuntime, loadRuntime, onContentChange } from './runtime.ts'

export type { Entry } from './content.ts'

export interface MaterializeOptions {
  /** Folder with one component per block type, named after the block (ProjectsGrid.astro → "projectsGrid"). */
  blocks?: string
  /** Site layout, used by pages and by the canvas preview. */
  layout?: string
  /** The catch-all page that renders every document: shared preview links render drafts with it. */
  page?: string
}

const VIRTUAL = 'virtual:materialize/site'
const RESOLVED = `\0${VIRTUAL}`

/** Exposes the site's block components and layout to Materialize's own routes (the canvas preview). */
function sitePlugin(root: string, options: Required<MaterializeOptions>) {
  const blocksDir = resolve(root, options.blocks)
  const layout = resolve(root, options.layout)
  const page = resolve(root, options.page)
  return {
    name: 'materialize:site',
    resolveId: (id: string) => (id === VIRTUAL ? RESOLVED : undefined),
    load(id: string) {
      if (id !== RESOLVED) return undefined
      const files = existsSync(blocksDir) ? readdirSync(blocksDir).filter((f) => f.endsWith('.astro')) : []
      const imports = files.map((f, i) => `import B${i} from ${JSON.stringify(resolve(blocksDir, f))}`)
      const entries = files.map((f, i) => {
        const name = basename(f, '.astro')
        return `${JSON.stringify(name.charAt(0).toLowerCase() + name.slice(1))}: B${i}`
      })
      const layoutImport = existsSync(layout)
        ? `import Layout from ${JSON.stringify(layout)}`
        : `const Layout = () => { throw new Error('Materialize: create ${options.layout} to preview pages') }`
      // Without the catch-all page, shared previews fall back to the layout and the blocks.
      const pageImport = existsSync(page) ? `import Page from ${JSON.stringify(page)}` : 'const Page = null'
      return `${imports.join('\n')}\n${layoutImport}\n${pageImport}\nexport const blocks = { ${entries.join(', ')} }\nexport { Layout, Page }\n`
    },
    configureServer(server: {
      watcher: { on: (event: string, cb: (path: string) => void) => void }
      moduleGraph: { getModuleById: (id: string) => unknown; invalidateModule: (mod: never) => void }
      environments: Record<string, { hot: { send: (event: string, data: unknown) => void } }>
    }) {
      // Astro remembers getStaticPaths() in dev; after a publish, new or moved pages must show up.
      onContentChange(() => {
        for (const environment of Object.values(server.environments)) environment.hot.send('astro:content-changed', {})
      })
      // A new or removed block component must show up without restarting the dev server.
      const refresh = (path: string) => {
        if (!path.startsWith(blocksDir)) return
        const mod = server.moduleGraph.getModuleById(RESOLVED)
        if (mod) server.moduleGraph.invalidateModule(mod as never)
      }
      server.watcher.on('add', refresh)
      server.watcher.on('unlink', refresh)
    },
  }
}

/**
 * Connects an Astro site to Materialize: pages read published content with
 * `@materializecms/astro/content`, and the admin previews drafts with the site's real components.
 */
export default function materialize(options: MaterializeOptions = {}): AstroIntegration {
  const resolved = {
    blocks: options.blocks ?? 'src/blocks',
    layout: options.layout ?? 'src/layouts/Site.astro',
    page: options.page ?? 'src/pages/[...path].astro',
  }
  let siteUrl: string | undefined
  return {
    name: '@materializecms/astro',
    hooks: {
      'astro:config:setup': async ({ addMiddleware, command, config, injectRoute, updateConfig }) => {
        const root = fileURLToPath(config.root)
        // Inside `materialize dev` the runtime is already shared; `astro build` on its own opens the database.
        if (!hasRuntime()) await loadRuntime(root)
        // The public address, for sitemap, feed and canonical links: astro.config's own `site` wins,
        // then the one Materialize knows (site.url, or MATERIALIZE_SITE_URL on a server or in Docker).
        siteUrl =
          config.site ??
          ((await getRuntime()
            .then((r) => r.config().site.url)
            .catch(() => undefined)) ||
            process.env.MATERIALIZE_SITE_URL?.trim() ||
            undefined)
        if (siteUrl && !config.site) updateConfig({ site: siteUrl })
        injectRoute({
          pattern: '/_materialize/preview',
          entrypoint: new URL('./preview.astro', import.meta.url),
          prerender: false,
        })
        injectRoute({
          pattern: '/_materialize/share/[token]',
          entrypoint: new URL('./share.astro', import.meta.url),
          prerender: false,
        })
        addMiddleware({
          entrypoint: new URL(`./middleware${extname(fileURLToPath(import.meta.url))}`, import.meta.url),
          order: 'post',
        })
        // A site's own sitemap.xml or robots.txt (in src/pages or public/) wins over these.
        const own = (name: string) =>
          ['src/pages', 'public'].some((dir) =>
            ['', '.ts', '.js'].some((ext) => existsSync(resolve(root, dir, `${name}${ext}`))),
          )
        // The feed and llms.txt only when they have something to say; in dev always, and they answer 404.
        const seo = await getSiteSeo().catch(() => ({}) as Awaited<ReturnType<typeof getSiteSeo>>)
        const feed = command === 'dev' || (await hasFeed().catch(() => false))
        const llms = command === 'dev' || seo.llms !== false
        const routes = [
          'sitemap.xml',
          'sitemap.css',
          'robots.txt',
          ...(feed ? ['rss.xml'] : []),
          ...(llms ? ['llms.txt'] : []),
        ]
        for (const name of routes) {
          // The sitemap's stylesheet goes with Materialize's sitemap, not with one the site wrote itself.
          if (own(name) || (name === 'sitemap.css' && own('sitemap.xml'))) continue
          injectRoute({
            pattern: `/${name}`,
            // TypeScript here, compiled JavaScript in the published package.
            entrypoint: new URL(`./routes/${name}${extname(fileURLToPath(import.meta.url))}`, import.meta.url),
            prerender: true,
          })
        }
        // Old addresses: real redirects in dev, small redirect pages in the static build.
        const redirects = await getRedirects().catch(() => [])
        if (redirects.length)
          updateConfig({
            redirects: Object.fromEntries(
              redirects
                .filter((r) => r.from !== r.to)
                .map((r) => [r.from, { status: 301 as const, destination: r.to }]),
            ),
          })
        updateConfig({
          vite: {
            plugins: [sitePlugin(root, resolved)],
            // three.js (685 kB) loads only on pages with a 3D scene: no warning for it at every build,
            // unless the site chose its own limit.
            ...(config.vite?.build?.chunkSizeWarningLimit === undefined && { build: { chunkSizeWarningLimit: 1024 } }),
          },
        })
      },
      // A Markdown copy of every indexable page next to its HTML (/diario/articolo.md), for AI
      // assistants; in dev the middleware converts on request.
      'astro:build:done': async ({ dir, logger }) => {
        const seo = await getSiteSeo().catch(() => null)
        if (!seo || seo.llms === false) return
        const out = fileURLToPath(dir)
        let written = 0
        for (const page of await getSitemapPages()) {
          const clean = page.url.replace(/\/+$/, '')
          const html = [join(out, clean, 'index.html'), join(out, `${clean || '/index'}.html`)].find((f) =>
            existsSync(f),
          )
          if (!html) continue
          const target = join(out, markdownPath(page.url))
          await mkdir(dirname(target), { recursive: true })
          await writeFile(target, htmlToMarkdown(await readFile(html, 'utf8'), siteUrl))
          written++
        }
        if (written) logger.info(`${written} pagine in Markdown per le AI`)
      },
    },
  }
}
