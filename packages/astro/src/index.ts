import { existsSync, readdirSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AstroIntegration } from 'astro'
import { hasRuntime, loadRuntime, onContentChange } from './runtime.ts'

export type { Entry } from './content.ts'

export interface MaterializeOptions {
  /** Folder with one component per block type, named after the block (ProjectsGrid.astro → "projectsGrid"). */
  blocks?: string
  /** Site layout, used by pages and by the canvas preview. */
  layout?: string
}

const VIRTUAL = 'virtual:materialize/site'
const RESOLVED = `\0${VIRTUAL}`

/** Exposes the site's block components and layout to Materialize's own routes (the canvas preview). */
function sitePlugin(root: string, options: Required<MaterializeOptions>) {
  const blocksDir = resolve(root, options.blocks)
  const layout = resolve(root, options.layout)
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
      return `${imports.join('\n')}\n${layoutImport}\nexport const blocks = { ${entries.join(', ')} }\nexport { Layout }\n`
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
  const resolved = { blocks: options.blocks ?? 'src/blocks', layout: options.layout ?? 'src/layouts/Site.astro' }
  return {
    name: '@materializecms/astro',
    hooks: {
      'astro:config:setup': async ({ config, injectRoute, updateConfig }) => {
        const root = fileURLToPath(config.root)
        // Inside `materialize dev` the runtime is already shared; `astro build` on its own opens the database.
        if (!hasRuntime()) await loadRuntime(root)
        injectRoute({
          pattern: '/_materialize/preview',
          entrypoint: new URL('./preview.astro', import.meta.url),
          prerender: false,
        })
        updateConfig({ vite: { plugins: [sitePlugin(root, resolved)] } })
      },
    },
  }
}
