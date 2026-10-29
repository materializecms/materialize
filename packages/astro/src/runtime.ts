import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MaterializeConfig } from '@materializecms/core'
import {
  type AuthStore,
  type ContentStore,
  createAuthStore,
  createContentStore,
  createSettingsStore,
  openDatabase,
  type SettingsStore,
} from '@materializecms/db'

/** What the site needs from Materialize while Astro renders: the live schema and the stores. */
export interface Runtime {
  config: () => MaterializeConfig
  content: ContentStore
  auth: AuthStore
  /** Site-wide settings, such as the design theme. */
  settings?: SettingsStore
}

// Shared through globalThis: `materialize dev` sets it before starting Astro, and Astro's own
// module graph (where pages run) reads the same object.
const KEY = '__materialize_runtime__'
const CHANGED = '__materialize_content_changed__'
type Holder = { [KEY]?: Runtime | Promise<Runtime>; [CHANGED]?: () => void }
const holder = globalThis as Holder

export function setRuntime(runtime: Runtime): void {
  holder[KEY] = runtime
}

export function hasRuntime(): boolean {
  return holder[KEY] !== undefined
}

/** Called by the dev server: what to do when published content changes. The latest server wins. */
export function onContentChange(listener: () => void): void {
  holder[CHANGED] = listener
}

/** Published content changed: the dev server forgets the pages it has listed (getStaticPaths). */
export function contentChanged(): void {
  holder[CHANGED]?.()
}

export async function getRuntime(): Promise<Runtime> {
  const runtime = holder[KEY]
  if (!runtime) throw new Error('Materialize is not set up: add materialize() to the integrations in astro.config')
  return runtime
}

// Native import: Astro may load integrations through Vite, which would otherwise handle this import itself.
const nativeImport = new Function('url', 'return import(url)') as (
  url: string,
) => Promise<{ default?: MaterializeConfig }>

/** Loads materialize.config.ts and opens its database: used when Astro runs on its own (`astro build`). */
export function loadRuntime(root: string): Promise<Runtime> {
  const pending = (async () => {
    const mod = await nativeImport(pathToFileURL(resolve(root, 'materialize.config.ts')).href)
    const config = mod.default
    if (!config?.collections) throw new Error(`${root}/materialize.config.ts must export default defineConfig({ … })`)
    const url = config.database.url.startsWith('file:')
      ? `file:${resolveFile(root, config.database.url.slice('file:'.length))}`
      : config.database.url
    const database = await openDatabase({ url, authToken: config.database.authToken })
    return {
      config: () => config,
      content: createContentStore(database.db),
      auth: createAuthStore(database.db),
      settings: createSettingsStore(database.db),
    }
  })()
  holder[KEY] = pending
  return pending
}

const resolveFile = (root: string, path: string) => (isAbsolute(path) ? path : resolve(root, path))
