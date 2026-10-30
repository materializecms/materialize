import { defineCollection, defineConfig, f } from '@materializecms/core'
import { documentSlots, localizeLinks, mergeTranslation, nodeSlots, withLocales } from '@materializecms/core/i18n'
import type { PageNode } from '@materializecms/core/page'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  locales: { default: 'it', available: ['it', 'en'] },
  collections: [
    defineCollection({
      name: 'pages',
      url: (doc) => (doc.slug === 'home' ? '/' : `/${doc.slug}`),
      fields: {
        title: f.text({ required: true }),
        slug: f.slug({ from: 'title' }),
        seo: f.seo(),
        page: f.page(),
      },
    }),
  ],
})

let database: Database
let app: ReturnType<typeof createApp>
let cookie = ''

async function call(method: string, path: string, json?: unknown) {
  const res = await app.request(path, {
    method,
    headers: {
      ...(json ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie, origin: 'http://localhost' } : {}),
    },
    body: json ? JSON.stringify(json) : undefined,
  })
  const set = res.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0] ?? ''
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

beforeEach(async () => {
  database = await openDatabase({ url: ':memory:' })
  app = createApp({ config: () => config, database })
  cookie = ''
  await call('POST', '/api/setup', { email: 'elena@studiorossi.it', name: 'Elena', password: 'una-password-lunga' })
})

afterEach(() => database.close())

const hero: PageNode[] = [
  {
    id: 's1',
    type: 'frame',
    name: 'Hero',
    children: [
      { id: 't1', type: 'text', text: 'Chi siamo', style: 'h1' },
      { id: 'b1', type: 'button', text: 'Contatti', href: '/contatti' },
    ],
  },
]

describe('translations', () => {
  it('copies a page into another language, linked to its original', async () => {
    const original = (
      await call('POST', '/api/collections/pages', {
        data: { title: 'Chi siamo', slug: 'chi-siamo', page: hero },
      })
    ).body
    const created = await call('POST', `/api/documents/${original.id}/translations`, { locale: 'en' })
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ locale: 'en', sourceId: original.id, slug: 'chi-siamo' })

    const listed = (await call('GET', `/api/documents/${created.body.id}/translations`)).body
    expect(listed.translations.map((t: { locale: string }) => t.locale)).toEqual(['it', 'en'])
    expect(listed.missing).toEqual([])
    expect((await call('POST', `/api/documents/${original.id}/translations`, { locale: 'en' })).status).toBe(409)
    expect((await call('POST', `/api/documents/${original.id}/translations`, { locale: 'fr' })).status).toBe(400)

    // The list shows which other languages each entry has.
    const list = (await call('GET', '/api/collections/pages?locale=it')).body
    expect(list.items[0].locales).toEqual(['en'])
  })

  it('brings a translation in line with a changed original, keeping its words', async () => {
    const original = (
      await call('POST', '/api/collections/pages', { data: { title: 'Chi siamo', slug: 'chi-siamo', page: hero } })
    ).body
    const en = (await call('POST', `/api/documents/${original.id}/translations`, { locale: 'en' })).body
    const translated = structuredClone(hero)
    ;(translated[0]?.children?.[0] as PageNode).text = 'About us'
    await call('PUT', `/api/documents/${en.id}`, { data: { ...en.data, page: translated } })
    // The original gets a new button and a different gap.
    const changed = structuredClone(hero)
    changed[0] = { ...(changed[0] as PageNode), gap: 40 }
    changed[0]?.children?.push({ id: 'b2', type: 'button', text: 'Lavori', href: '/lavori' })
    await call('PUT', `/api/documents/${original.id}`, { data: { ...original.data, page: changed } })

    const synced = (await call('POST', `/api/documents/${en.id}/sync`, {})).body
    expect(synced.added).toBe(1)
    const page = synced.document.data.page as PageNode[]
    expect(page[0]?.gap).toBe(40)
    expect(page[0]?.children?.map((n) => n.text)).toEqual(['About us', 'Contatti', 'Lavori'])
  })

  it('needs the AI to translate', async () => {
    const original = (await call('POST', '/api/collections/pages', { data: { title: 'Prova', page: hero } })).body
    const res = await call('POST', `/api/documents/${original.id}/translations`, { locale: 'en', translate: true })
    expect(res.body.error.code).toBe('ai_not_configured')
  })
})

describe('languages', () => {
  it('are chosen in the panel, over the config', async () => {
    expect((await call('GET', '/api/locales')).body.locales).toEqual({ default: 'it', available: ['it', 'en'] })
    const saved = await call('PUT', '/api/locales', { default: 'it', available: ['it', 'en', 'fr'] })
    expect(saved.body.locales.available).toEqual(['it', 'en', 'fr'])
    expect((await call('GET', '/api/schema')).body.locales.available).toContain('fr')
    expect((await call('PUT', '/api/locales', { default: 'de', available: ['it'] })).status).toBe(400)
    expect((await call('PUT', '/api/locales', { default: 'it', available: ['it', 'xx-yy'] })).status).toBe(422)
  })

  it('keep global sections in one structure, with words per language', async () => {
    const nav: PageNode = {
      id: 'g1',
      type: 'frame',
      name: 'Menu',
      children: [{ id: 'n1', type: 'text', text: 'Lavori' }],
    }
    await call('PUT', '/api/globals', { globals: { g1: nav } })
    const en: PageNode = { ...nav, gap: 99, children: [{ id: 'n1', type: 'text', text: 'Work', color: 'accent' }] }
    await call('PUT', '/api/globals', { globals: { g1: en }, locale: 'en' })
    const it = (await call('GET', '/api/globals')).body.globals.g1
    const inEnglish = (await call('GET', '/api/globals?locale=en')).body.globals.g1
    expect(it.children[0].text).toBe('Lavori')
    expect(inEnglish.children[0].text).toBe('Work')
    // Design stays the main language's.
    expect(inEnglish.gap).toBeUndefined()
    expect(inEnglish.children[0].color).toBeUndefined()
  })
})

describe('translation helpers', () => {
  it('keep formatting marks around the translated words', () => {
    const nodes: PageNode[] = [
      {
        id: 't',
        type: 'text',
        text: 'Scrivici oggi',
        runs: [
          { t: 'Scrivici ', b: true },
          { t: 'oggi', href: '/contatti' },
        ],
      },
      { id: 'n', type: 'text', text: '120+' },
      { id: 'l', type: 'text', text: 'IT / EN', langs: 'code' },
    ]
    const slots = nodeSlots(nodes)
    expect(slots.map((s) => s.text)).toEqual(['<b>Scrivici </b><a1>oggi</a1>'])
    slots[0]?.set('<b>Write to us </b><a1>today</a1>')
    expect(nodes[0]?.runs).toEqual([
      { t: 'Write to us ', b: true },
      { t: 'today', href: '/contatti' },
    ])
    expect(nodes[0]?.text).toBe('Write to us today')
  })

  it('find the texts of a document through its fields', () => {
    const data = { title: 'Chi siamo', slug: 'chi-siamo', seo: { description: 'Lo studio' }, page: hero }
    const slots = documentSlots(config.collections[0]?.fields ?? {}, data)
    expect(slots.map((s) => s.text)).toEqual(['Chi siamo', 'Lo studio', 'Chi siamo', 'Contatti'])
  })

  it('merge words into the original structure and localize links', () => {
    const translation: PageNode[] = [{ id: 's1', type: 'frame', children: [{ id: 't1', type: 'text', text: 'About' }] }]
    const merged = mergeTranslation(hero, translation)
    expect(merged[0]?.name).toBe('Hero')
    expect(merged[0]?.children?.map((n) => n.text)).toEqual(['About', 'Contatti'])
    const linked = localizeLinks(merged, { '/contatti': '/en/contact' })
    expect(linked[0]?.children?.[1]?.href).toBe('/en/contact')
    expect(withLocales(config, { default: 'en', available: ['it', 'en'] }).locales.default).toBe('en')
    expect(withLocales(config, { default: 'fr', available: ['it'] }).locales.default).toBe('it')
  })
})
