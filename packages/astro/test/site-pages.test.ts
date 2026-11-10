import { defineCollection, defineConfig, f } from '@materializecms/core'
import type { PageNode } from '@materializecms/core/page'
import {
  type ContentStore,
  createAuthStore,
  createContentStore,
  createSettingsStore,
  type Database,
  openDatabase,
} from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getEntries, getEntry, getRoutes, getSitemapPages, getTrail, isPost, summaryOf } from '../src/content.ts'
import { withMain } from '../src/landmarks.ts'
import { setRuntime } from '../src/runtime.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  locales: { default: 'it', available: ['it', 'en'] },
  collections: [
    defineCollection({
      name: 'pages',
      url: (p) => (p.slug === 'home' ? '/' : `/${p.slug}`),
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), page: f.page() },
    }),
    defineCollection({
      name: 'projects',
      url: (p) => `/progetti/${p.slug}`,
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }) },
    }),
    defineCollection({
      name: 'posts',
      url: (p) => `/diario/${p.slug}`,
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), date: f.date() },
    }),
  ],
})

let database: Database
let content: ContentStore
let settings: ReturnType<typeof createSettingsStore>

async function add(collection: string, data: Record<string, unknown>, locale = 'it', sourceId?: string) {
  const doc = await content.create({
    collection,
    locale,
    title: String(data.title),
    slug: (data.slug as string | undefined) ?? null,
    data,
    ...(sourceId ? { sourceId } : {}),
  })
  await content.publish(doc.id)
  return doc.id
}

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  content = createContentStore(database.db)
  settings = createSettingsStore(database.db)
  setRuntime({ config: () => config, content, auth: createAuthStore(database.db), settings })
})

afterEach(() => database.close())

describe('template pages', () => {
  it('stay out of menus and routes, unless asked for', async () => {
    await add('pages', { title: 'Home', slug: 'home', page: [] })
    await add('pages', { title: 'Studio', slug: 'studio', page: [] })
    const template = await add('pages', { title: 'Modello articolo', slug: 'modello-articolo', page: [] })
    await settings.set('templates', { posts: template })

    expect((await getEntries('pages')).map((e) => e.title)).toEqual(['Home', 'Studio'])
    expect((await getEntries('pages', { templates: true })).map((e) => e.title)).toContain('Modello articolo')
    // Asked for by name, it is still found.
    expect((await getEntry('pages', 'modello-articolo'))?.title).toBe('Modello articolo')
    expect((await getRoutes()).map((r) => r.props.entry.title)).not.toContain('Modello articolo')
    expect((await getSitemapPages()).map((p) => p.url)).not.toContain('/modello-articolo')
    // Its translation lays out the English posts: out of the English menus too.
    await add('pages', { title: 'Post template', slug: 'post-template', page: [] }, 'en', template)
    expect((await getEntries('pages', { locale: 'en' })).map((e) => e.title)).toEqual([])
  })
})

describe('breadcrumb trail', () => {
  it('lists only the pages above that exist, from the home page', async () => {
    await add('pages', { title: 'Home', slug: 'home', page: [] })
    await add('projects', { title: 'Casa sul lago', slug: 'casa-sul-lago' })
    const [project] = await getEntries('projects')
    expect((await getTrail(project as never)).map((e) => e.url)).toEqual(['/'])

    // A listing page at /progetti joins the trail.
    await add('pages', { title: 'Progetti', slug: 'progetti', page: [] })
    expect((await getTrail(project as never)).map((e) => e.url)).toEqual(['/', '/progetti'])
  })
})

describe('posts and summaries', () => {
  it('knows posts by their dated collection', async () => {
    await add('posts', { title: 'Nuovo studio', slug: 'nuovo-studio', date: '2026-01-02' })
    await add('pages', { title: 'Studio', slug: 'studio', page: [] })
    expect(await isPost((await getEntries('posts'))[0] as never)).toBe(true)
    expect(await isPost((await getEntries('pages'))[0] as never)).toBe(false)
  })

  it('describes a canvas page by its first paragraph', async () => {
    const page: PageNode[] = [
      {
        id: 's',
        type: 'frame',
        children: [
          { id: 'h', type: 'text', style: 'h1', text: 'Lo studio' },
          { id: 'p', type: 'text', text: 'Progettiamo case e interni che durano nel tempo, con materiali naturali.' },
        ],
      },
    ]
    await add('pages', { title: 'Studio', slug: 'studio', page })
    const [studio] = await getEntries('pages')
    expect(await summaryOf(studio as never)).toBe(
      'Progettiamo case e interni che durano nel tempo, con materiali naturali.',
    )
  })
})

describe('main landmark', () => {
  const html =
    '<div class="mz-page"><header class="mz-n n-nav" data-mz-sticky=""><a class="mz-n n-l">Logo</a></header>' +
    '<section class="mz-n n-hero"><h1 class="mz-n n-h">Ciao</h1></section>' +
    '<section class="mz-n n-hero2">x</section><footer class="mz-n n-foot">©</footer></div>'
  const nodes: PageNode[] = [
    { id: 'nav', type: 'frame', section: 'nav.simple' },
    { id: 'hero', type: 'frame', section: 'hero.split' },
    { id: 'hero2', type: 'frame' },
    { id: 'foot', type: 'frame', section: 'footer.simple' },
  ]

  it('wraps the content between the menu and the footer', () => {
    expect(withMain(html, nodes)).toBe(
      '<div class="mz-page"><header class="mz-n n-nav" data-mz-sticky=""><a class="mz-n n-l">Logo</a></header>' +
        '<main><section class="mz-n n-hero"><h1 class="mz-n n-h">Ciao</h1></section>' +
        '<section class="mz-n n-hero2">x</section></main><footer class="mz-n n-foot">©</footer></div>',
    )
  })

  it('wraps up to the end of the page without a footer, and leaves pages it cannot read', () => {
    const noFooter = withMain(html.replace('<footer class="mz-n n-foot">©</footer>', ''), nodes.slice(0, 3))
    expect(noFooter.endsWith('<section class="mz-n n-hero2">x</section></main></div>')).toBe(true)
    expect(withMain(html, [{ id: 'other', type: 'frame' }])).toBe(html)
    expect(withMain('<div class="mz-page"><main>x</main></div>', nodes)).toBe(
      '<div class="mz-page"><main>x</main></div>',
    )
  })
})
