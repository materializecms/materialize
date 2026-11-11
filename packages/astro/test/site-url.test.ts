import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { defineCollection, defineConfig, f } from '@materializecms/core'
import { createAuthStore, createContentStore, createSettingsStore, openDatabase } from '@materializecms/db'
import { afterEach, describe, expect, it } from 'vitest'
import materialize from '../src/index.ts'
import { setRuntime } from '../src/runtime.ts'

const pages = defineCollection({
  name: 'pages',
  url: (p) => `/${p.slug}`,
  fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }) },
})

/** Runs the integration's setup the way Astro does, and returns the `site` it set, if any. */
async function siteSet(site: { url?: string }, astroSite?: string): Promise<string | undefined> {
  const database = await openDatabase({ url: ':memory:' })
  const config = defineConfig({ site: { name: 'Prova', ...site }, collections: [pages] })
  setRuntime({
    config: () => config,
    content: createContentStore(database.db),
    auth: createAuthStore(database.db),
    settings: createSettingsStore(database.db),
  })
  let set: string | undefined
  const hook = materialize().hooks['astro:config:setup'] as (options: unknown) => Promise<void>
  await hook({
    command: 'build',
    config: { root: pathToFileURL(`${mkdtempSync(join(tmpdir(), 'mz-site-'))}/`), site: astroSite },
    addMiddleware: () => {},
    injectRoute: () => {},
    updateConfig: (patch: { site?: string }) => {
      if (patch.site) set = patch.site
    },
  })
  database.close()
  return set
}

const env = process.env.MATERIALIZE_SITE_URL
afterEach(() => {
  if (env === undefined) delete process.env.MATERIALIZE_SITE_URL
  else process.env.MATERIALIZE_SITE_URL = env
})

// Without `site`, Astro publishes no sitemap and no feed: sites set up with MATERIALIZE_SITE_URL
// (Docker, the VPS installer) used to go without both.
describe('the public address reaches Astro', () => {
  it('from the site config', async () => {
    expect(await siteSet({ url: 'https://studio.example' })).toBe('https://studio.example')
  })

  it('from MATERIALIZE_SITE_URL', async () => {
    process.env.MATERIALIZE_SITE_URL = 'https://docker.example'
    expect(await siteSet({})).toBe('https://docker.example')
  })

  it('never over the one written in astro.config', async () => {
    process.env.MATERIALIZE_SITE_URL = 'https://docker.example'
    expect(await siteSet({ url: 'https://studio.example' }, 'https://astro.example')).toBeUndefined()
  })

  it('nowhere to be found: nothing is set', async () => {
    delete process.env.MATERIALIZE_SITE_URL
    expect(await siteSet({})).toBeUndefined()
  })
})
