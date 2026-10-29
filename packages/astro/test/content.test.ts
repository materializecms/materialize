import { defineBlock, defineCollection, defineConfig, f } from '@materializecms/core'
import { type ContentStore, createAuthStore, createContentStore, type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getEntries, getRoutes, getSingleton, previewEntry } from '../src/content.ts'
import { setRuntime } from '../src/runtime.ts'

const grid = defineBlock({
  name: 'grid',
  fields: { title: f.text({ required: true }), items: f.relation({ to: 'projects', many: true }) },
})

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  locales: { default: 'it', available: ['it', 'en'] },
  collections: [
    defineCollection({
      name: 'pages',
      url: (p) => (p.slug === 'home' ? '/' : `/${p.slug}`),
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), blocks: f.blocks([grid]) },
    }),
    defineCollection({
      name: 'projects',
      url: (p) => `/progetti/${p.slug}`,
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }) },
    }),
    defineCollection({ name: 'settings', singleton: true, fields: { siteName: f.text({ required: true }) } }),
  ],
})

let database: Database
let content: ContentStore

async function add(
  collection: string,
  data: Record<string, unknown>,
  options: { locale?: string; publish?: boolean } = {},
) {
  const doc = await content.create({
    collection,
    locale: options.locale ?? 'it',
    title: String(data.title ?? data.siteName),
    slug: (data.slug as string | undefined) ?? null,
    data,
  })
  if (options.publish !== false) await content.publish(doc.id)
  return doc.id
}

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  content = createContentStore(database.db)
  setRuntime({ config: () => config, content, auth: createAuthStore(database.db) })
})

afterEach(() => database.close())

describe('site content', () => {
  it('lists every published page with its address, locales included', async () => {
    await add('pages', { title: 'Home', slug: 'home', blocks: [] })
    await add('pages', { title: 'Studio', slug: 'studio', blocks: [] })
    await add('pages', { title: 'Studio', slug: 'studio', blocks: [] }, { locale: 'en' })
    await add('pages', { title: 'Bozza', slug: 'bozza', blocks: [] }, { publish: false })
    await add('settings', { siteName: 'Studio Rossi' })

    const routes = await getRoutes()
    expect(routes.map((r) => [r.params.path, r.props.entry.url])).toEqual([
      [undefined, '/'],
      ['studio', '/studio'],
      ['en/studio', '/en/studio'],
    ])
    expect((await getSingleton('settings'))?.data.siteName).toBe('Studio Rossi')
  })

  it('swaps relation ids for published entries', async () => {
    const live = await add('projects', { title: 'Casa sul lago', slug: 'casa-sul-lago' })
    const draft = await add('projects', { title: 'Loft', slug: 'loft' }, { publish: false })
    await add('pages', {
      title: 'Home',
      slug: 'home',
      blocks: [{ _type: 'grid', _key: 'a', title: 'Progetti', items: [draft, live] }],
    })

    const [home] = await getEntries('pages')
    const items = home?.data.blocks[0].items
    expect(items.map((p: { title: string; url: string }) => [p.title, p.url])).toEqual([
      ['Casa sul lago', '/progetti/casa-sul-lago'],
    ])
  })

  it('previews unsaved data with drafts of related entries', async () => {
    const draft = await add('projects', { title: 'Loft', slug: 'loft' }, { publish: false })
    const entry = await previewEntry('pages', 'it', {
      title: 'Nuova',
      slug: 'nuova',
      blocks: [{ _type: 'grid', _key: 'a', title: 'Progetti', items: [draft] }],
    })
    expect(entry.url).toBe('/nuova')
    expect(entry.data.blocks[0].items[0].title).toBe('Loft')
  })
})
