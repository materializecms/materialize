import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MaterializeConfig } from '@materializecms/core'

export const CONFIG_FILES = ['materialize.config.ts', 'materialize.config.js', 'materialize.config.mjs']

export function findConfig(cwd: string): string | null {
  for (const name of CONFIG_FILES) {
    const path = resolve(cwd, name)
    if (existsSync(path)) return path
  }
  return null
}

/**
 * Imports the config fresh every time (the query string bypasses Node's module cache),
 * so `materialize dev` can pick up schema changes without a restart.
 */
export async function loadConfig(path: string): Promise<MaterializeConfig> {
  const mod = (await import(`${pathToFileURL(path).href}?v=${Date.now()}`)) as { default?: MaterializeConfig }
  if (!mod.default?.collections) {
    throw new Error(`${path} must export default defineConfig({ … })`)
  }
  return withEnvironment(mod.default)
}

/**
 * What belongs to the server rather than to the site, from its environment: the VPS installer
 * (install.sh) sets these in the service, so the site's own config stays the same everywhere.
 */
export function withEnvironment(config: MaterializeConfig, env = process.env): MaterializeConfig {
  const url = env.MATERIALIZE_SITE_URL?.trim()
  const port = Number(env.MATERIALIZE_PORT)
  const trust = env.MATERIALIZE_TRUST_PROXY
  return {
    ...config,
    site: config.site.url || !url ? config.site : { ...config.site, url },
    server: {
      ...config.server,
      port: Number.isInteger(port) && port > 0 ? port : config.server.port,
      trustProxy:
        trust === '1' || trust === 'true'
          ? true
          : trust === '0' || trust === 'false'
            ? false
            : config.server.trustProxy,
    },
  }
}
