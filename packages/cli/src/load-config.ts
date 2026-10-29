import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { MaterializeConfig } from '@materialize/core'

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
  return mod.default
}
