import type { Collection, Field, Fields, MaterializeConfig, Media } from '@materializecms/core'
import { mergeTranslation } from '@materializecms/core/i18n'
import {
  type Component,
  expandComponents,
  expandGlobals,
  normalizeTheme,
  type PageNode,
  type SiteDetails,
  type Theme,
} from '@materializecms/core/page'
import {
  type FeedItem,
  feedCollections,
  type LlmsSection,
  pageSummary,
  type Redirect,
  type SitemapPage,
  type SiteSeo,
  siteDetails,
} from '@materializecms/core/seo'
import type { TrackingSettings } from '@materializecms/core/tracking'
import type { StoredDocument } from '@materializecms/db'
import { getRuntime } from './runtime.ts'

// biome-ignore lint/suspicious/noExplicitAny: site templates read content freely; the schema validated it
export type Data = Record<string, any>

/** A published document, ready for templates: relations hold the related entries instead of ids. */
export interface Entry<T extends Data = Data> {
  id: string
  collection: string
  locale: string
  slug: string | null
  /** Public path, with the locale prefix for non-default locales; null when the collection has no pages. */
  url: string | null
  title: string
  data: T
  publishedAt: Date | null
  /** Readable values where the data holds a code: a choice's label, a related entry's title. */
  labels: Record<string, string>
  /** The original this entry translates (another language); null for originals. */
  sourceId?: string | null
}

function labelsOf(collection: Collection, data: Data): Record<string, string> {
  const labels: Record<string, string> = {}
  for (const [name, f] of Object.entries(collection.fields)) {
    const v = data[name]
    if (f.kind === 'select' && typeof v === 'string') {
      const opts = (f.options as { options?: (string | { value: string; label?: string })[] }).options ?? []
      const hit = opts.find((o) => (typeof o === 'string' ? o : o.value) === v)
      if (hit && typeof hit !== 'string' && hit.label) labels[name] = hit.label
    }
    // Relations are already the related entries here.
    if (f.kind === 'relation' && v) {
      const titles = (Array.isArray(v) ? v : [v]).map((e: { title?: string }) => e?.title).filter(Boolean)
      if (titles.length) labels[name] = titles.join(', ')
    }
  }
  return labels
}

type Mode = 'published' | 'draft'

function collectionOf(config: MaterializeConfig, name: string): Collection {
  const found = config.collections.find((c) => c.name === name)
  if (!found) throw new Error(`Materialize: there is no collection named "${name}"`)
  return found
}

function urlOf(config: MaterializeConfig, collection: Collection, locale: string, data: Data): string | null {
  if (!collection.url) return null
  const path = collection.url(data as never)
  if (locale === config.locales.default) return path
  return `/${locale}${path === '/' ? '' : path}`
}

function toEntry(config: MaterializeConfig, doc: StoredDocument, data: Data): Entry {
  const collection = collectionOf(config, doc.collection)
  return {
    id: doc.id,
    collection: doc.collection,
    locale: doc.locale,
    slug: doc.slug,
    url: urlOf(config, collection, doc.locale, data),
    title: doc.title,
    data,
    publishedAt: doc.publishedAt,
    labels: labelsOf(collection, data),
    sourceId: doc.sourceId,
  }
}

/** Swaps relation ids for the related entries (one level deep, so cycles cannot loop). */
async function resolveFields(fields: Fields, value: Data, mode: Mode): Promise<Data> {
  const out: Data = { ...value }
  for (const [name, def] of Object.entries(fields)) {
    if (value[name] !== undefined) out[name] = await resolveValue(def, value[name], mode)
  }
  return out
}

async function resolveValue(def: Field, value: unknown, mode: Mode): Promise<unknown> {
  switch (def.kind) {
    case 'relation': {
      const ids = Array.isArray(value) ? (value as string[]) : [value as string]
      const { content, config } = await getRuntime()
      const docs = await content.getMany(ids)
      const entries = ids.flatMap((id) => {
        const doc = docs.find((d) => d.id === id)
        const data = mode === 'draft' ? doc?.data : doc?.publishedData
        return doc && data ? [toEntry(config(), doc, data)] : []
      })
      return def.options.many ? entries : (entries[0] ?? null)
    }
    case 'blocks':
      return Promise.all(
        (value as Data[]).map(async (block) => {
          const blockDef = def.blocks?.find((b) => b.name === block._type)
          return blockDef ? resolveFields(blockDef.fields, block, mode) : block
        }),
      )
    case 'group':
      return def.children ? resolveFields(def.children, value as Data, mode) : value
    case 'array':
      return def.item ? Promise.all((value as unknown[]).map((v) => resolveValue(def.item as Field, v, mode))) : value
    default:
      return value
  }
}

async function published(collection: string, locale?: string): Promise<Entry[]> {
  const { content, config } = await getRuntime()
  const cfg = config()
  const def = collectionOf(cfg, collection)
  const docs = await content.published(collection, locale)
  return Promise.all(
    docs.map(async (doc) => toEntry(cfg, doc, await resolveFields(def.fields, doc.publishedData ?? {}, 'published'))),
  )
}

/**
 * Sections shared by several pages, by id; in another language, with that language's words
 * (Impostazioni → Lingue: structure and design stay the main language's).
 */
export async function getGlobals(locale?: string): Promise<Record<string, PageNode>> {
  const { settings, config } = await getRuntime()
  const main = ((settings ? await settings.get('globals') : null) as Record<string, PageNode> | null) ?? {}
  if (!settings || !locale || locale === config().locales.default) return main
  const words = ((await settings.get(`globals:${locale}`)) as Record<string, PageNode> | null) ?? {}
  return Object.fromEntries(
    Object.entries(main).map(([id, n]) => [id, words[id] ? (mergeTranslation([n], [words[id]])[0] as PageNode) : n]),
  )
}

/** Translations of an entry are linked to their original; older ones share its slug. */
const sameGroup = (a: Entry, b: Entry) =>
  a.sourceId || b.sourceId
    ? (a.sourceId ?? a.id) === (b.sourceId ?? b.id)
    : a.collection === b.collection && a.slug === b.slug

/**
 * Where each page of the main language lives in another one, by address: internal links on a
 * translated page go to the translated pages.
 */
export async function getLinkMap(locale: string): Promise<Record<string, string>> {
  const { config } = await getRuntime()
  const cfg = config()
  if (locale === cfg.locales.default) return {}
  const map: Record<string, string> = {}
  for (const collection of cfg.collections) {
    if (!collection.url) continue
    const all = await published(collection.name)
    const here = all.filter((e) => e.locale === locale)
    for (const e of all) {
      if (e.locale !== cfg.locales.default || !e.url) continue
      const t = here.find((x) => sameGroup(x, e))
      if (t?.url) map[e.url.replace(/\/+$/, '') || '/'] = t.url
    }
  }
  return map
}

/**
 * The canvas page chosen in the panel as the template of a collection's entries, as published;
 * null when the collection has none (its entries keep their own layout).
 */
export async function getTemplate(collection: string, locale?: string): Promise<PageNode[] | null> {
  const { settings, config } = await getRuntime()
  const id = ((settings ? await settings.get('templates') : null) as Record<string, string> | null)?.[collection]
  if (!id) return null
  for (const c of config().collections) {
    const all = await published(c.name).catch(() => [])
    const found = all.find((e) => e.id === id)
    if (!found) continue
    // The template translated into the entry's language, when there is one.
    const translated =
      locale && locale !== found.locale ? all.find((e) => e.locale === locale && sameGroup(e, found)) : null
    const page = (translated ?? found).data.page
    if (Array.isArray(page)) return page as PageNode[]
  }
  return null
}

/** Pages used as a collection's template: they lay out other entries and have no address of their own. */
async function templateIds(): Promise<Set<string>> {
  const { settings } = await getRuntime()
  return new Set(
    Object.values(((settings ? await settings.get('templates') : null) as Record<string, string> | null) ?? {}),
  )
}

/** A template, or a translation of one (it lays out the entries in that language). */
const isTemplate = (entry: Entry, ids: Set<string>) =>
  ids.has(entry.id) || (!!entry.sourceId && ids.has(entry.sourceId))

/**
 * The entry's own summary, its first multi-line text (an excerpt, a description), or on a canvas
 * page its first paragraph: what search engines show when the SEO panel has no description.
 */
export async function summaryOf(entry: Entry): Promise<string | undefined> {
  const { config } = await getRuntime()
  const def = collectionOf(config(), entry.collection)
  for (const [name, f] of Object.entries(def.fields)) {
    const v = entry.data[name]
    if (f.kind === 'text' && f.options.multiline && typeof v === 'string' && v.trim()) return v.trim()
  }
  if (Array.isArray(entry.data.page)) {
    // Components hold content too; shared menus and footers are skipped by pageSummary.
    const nodes = expandComponents(
      expandGlobals(entry.data.page as PageNode[], await getGlobals(entry.locale)),
      await getComponents(),
    )
    return pageSummary(nodes)
  }
  return undefined
}

/** Reusable components, by id. */
export async function getComponents(): Promise<Record<string, Component>> {
  const { settings } = await getRuntime()
  return ((settings ? await settings.get('components') : null) as Record<string, Component> | null) ?? {}
}

/** The design theme chosen in the panel, used by pages built on the canvas. */
export async function getTheme(): Promise<Theme> {
  const { settings } = await getRuntime()
  return normalizeTheme(settings ? await settings.get('theme') : null)
}

/**
 * Published entries of a collection, in the default locale unless another is given. Pages used
 * as a collection's template are left out (they have no address: a menu built from this list
 * would link to a missing page); `templates: true` keeps them.
 */
export async function getEntries<T extends Data = Data>(
  collection: string,
  options: { locale?: string; templates?: boolean } = {},
): Promise<Entry<T>[]> {
  const { config } = await getRuntime()
  const all = await published(collection, options.locale ?? config().locales.default)
  if (options.templates) return all as Entry<T>[]
  const templates = await templateIds()
  return all.filter((e) => !isTemplate(e, templates)) as Entry<T>[]
}

/** One entry by its slug: asked for by name, so a template is found too. */
export async function getEntry<T extends Data = Data>(
  collection: string,
  slug: string,
  options: { locale?: string } = {},
): Promise<Entry<T> | undefined> {
  return (await getEntries<T>(collection, { ...options, templates: true })).find((e) => e.slug === slug)
}

/**
 * The site's details from Impostazioni → Sito (name, description, contacts, address), for the texts
 * and buttons that show one. The name: the one saved there, else the site settings', else the config's.
 */
export async function getSiteDetails(): Promise<SiteDetails> {
  const { config } = await getRuntime()
  const settings = config().collections.find((c) => c.singleton && c.fields.siteName)
  const named = settings ? (await getSingleton(settings.name).catch(() => undefined))?.data.siteName : undefined
  const name = typeof named === 'string' && named.trim() ? named : config().site.name
  return siteDetails(await getSiteSeo().catch(() => ({})), name)
}

/** The single document of a singleton collection, such as site settings. */
export async function getSingleton<T extends Data = Data>(
  collection: string,
  options: { locale?: string } = {},
): Promise<Entry<T> | undefined> {
  return (await getEntries<T>(collection, { ...options, templates: true }))[0]
}

/**
 * Every published page of the site, for a catch-all route (`src/pages/[...path].astro`):
 * `export const getStaticPaths = getRoutes`.
 */
export async function getRoutes(): Promise<{ params: { path: string | undefined }; props: { entry: Entry } }[]> {
  const { config } = await getRuntime()
  const templates = await templateIds()
  const routes = []
  for (const collection of config().collections) {
    if (!collection.url) continue
    for (const entry of await published(collection.name)) {
      if (!entry.url || isTemplate(entry, templates)) continue
      routes.push({ params: { path: entry.url.replace(/^\/+|\/+$/g, '') || undefined }, props: { entry } })
    }
  }
  return routes
}

/** Builds an entry from unsaved editor data, resolving relations to drafts: used by the canvas preview. */
export async function previewEntry(collection: string, locale: string, data: Data): Promise<Entry> {
  const { config } = await getRuntime()
  const cfg = config()
  const def = collectionOf(cfg, collection)
  const resolved = await resolveFields(def.fields, data, 'draft')
  const title = typeof data[def.titleField] === 'string' ? data[def.titleField] : ''
  return {
    id: 'preview',
    collection,
    locale,
    slug: def.slugField ? (data[def.slugField] ?? null) : null,
    url: urlOf(cfg, def, locale, data),
    title,
    data: resolved,
    publishedAt: null,
    labels: labelsOf(def, resolved),
  }
}

/** Name of the collection's blocks field, if it has one. */
export async function blocksFieldOf(collection: string): Promise<string | undefined> {
  const { config } = await getRuntime()
  return Object.entries(collectionOf(config(), collection).fields).find(([, f]) => f.kind === 'blocks')?.[0]
}

/** Site-wide settings for search engines and sharing (Impostazioni → SEO). */
export async function getSiteSeo(): Promise<SiteSeo> {
  const { settings } = await getRuntime()
  return ((settings ? await settings.get('seo') : null) as SiteSeo | null) ?? {}
}

/** Old addresses and where they now live. */
export async function getRedirects(): Promise<Redirect[]> {
  const { settings } = await getRuntime()
  return ((settings ? await settings.get('redirects') : null) as Redirect[] | null) ?? []
}

/** The same page in every language it is published in (its original and translations). */
export async function getAlternates(entry: Entry): Promise<{ locale: string; url: string }[]> {
  if (!entry.url) return []
  const { config } = await getRuntime()
  const cfg = config()
  const out: { locale: string; url: string }[] = []
  for (const locale of cfg.locales.available) {
    if (locale === entry.locale) {
      out.push({ locale, url: entry.url })
      continue
    }
    const same = (await published(entry.collection, locale)).find((e) => sameGroup(e, entry))
    if (same?.url) out.push({ locale, url: same.url })
  }
  return out
}

/**
 * The published pages above an entry, from its language's home page down (/progetti for
 * /progetti/casa-sul-lago): the breadcrumb. Addresses that are not pages are left out.
 */
export async function getTrail(entry: Entry): Promise<Entry[]> {
  if (!entry.url) return []
  const { config } = await getRuntime()
  const cfg = config()
  const parts = entry.url.split('/').filter(Boolean)
  const above = new Set(['/', ...parts.slice(0, -1).map((_, i) => `/${parts.slice(0, i + 1).join('/')}`)])
  above.delete(entry.url)
  if (!above.size) return []
  const templates = await templateIds()
  const found = new Map<string, Entry>()
  for (const collection of cfg.collections) {
    if (!collection.url) continue
    for (const e of await published(collection.name, entry.locale))
      if (e.url && above.has(e.url) && !found.has(e.url) && !isTemplate(e, templates)) found.set(e.url, e)
  }
  return [...above].flatMap((url) => {
    const e = found.get(url)
    return e ? [e] : []
  })
}

/**
 * Whether an entry is a post (news, an article): a dated entry of a collection like the ones the
 * RSS feed picks by default. Shared as an article unless its SEO says otherwise.
 */
export async function isPost(entry: Entry): Promise<boolean> {
  const { config } = await getRuntime()
  return feedCollections(config().collections).includes(entry.collection)
}

/** Every published page search engines may index, for sitemap.xml. */
export async function getSitemapPages(): Promise<SitemapPage[]> {
  const { config } = await getRuntime()
  const templates = await templateIds()
  const pages: SitemapPage[] = []
  for (const collection of config().collections) {
    if (!collection.url) continue
    for (const entry of await published(collection.name)) {
      if (!entry.url || isTemplate(entry, templates) || entry.data.seo?.noindex || entry.data.seo?.canonical) continue
      const alternates = await getAlternates(entry)
      pages.push({ url: entry.url, updatedAt: entry.publishedAt, alternates })
    }
  }
  return pages.sort((a, b) => a.url.localeCompare(b.url))
}

/** A date for feeds: the document's own date field, or when it was published. */
function dateOf(collection: Collection, entry: Entry): Date | null {
  for (const [name, f] of Object.entries(collection.fields)) {
    const v = entry.data[name]
    if (f.kind === 'date' && typeof v === 'string' && v) {
      const d = new Date(v)
      if (!Number.isNaN(d.getTime())) return d
    }
  }
  return entry.publishedAt
}

/** The newest published entries of the feed's collections (Impostazioni → SEO), in the main language. */
export async function getFeedItems(limit = 50): Promise<FeedItem[]> {
  const { config } = await getRuntime()
  const cfg = config()
  const seo = await getSiteSeo()
  const items: FeedItem[] = []
  for (const name of feedCollections(cfg.collections, seo.feed)) {
    const def = collectionOf(cfg, name)
    for (const entry of await published(name, cfg.locales.default)) {
      const date = dateOf(def, entry)
      if (!entry.url || !date || entry.data.seo?.noindex) continue
      items.push({
        title: entry.data.seo?.title || entry.title,
        url: entry.url,
        date,
        description: entry.data.seo?.description || (await summaryOf(entry)),
        image: entry.data.seo?.image ?? firstImage(entry.data),
      })
    }
  }
  return items.sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, limit)
}

/** Whether the site has a feed, to announce it in every page's head. */
export async function hasFeed(): Promise<boolean> {
  const { config } = await getRuntime()
  return feedCollections(config().collections, (await getSiteSeo()).feed).length > 0
}

/** Every indexable page, by collection, with its summary: the body of llms.txt. */
export async function getLlmsSections(): Promise<LlmsSection[]> {
  const { config } = await getRuntime()
  const cfg = config()
  const templates = await templateIds()
  const sections: LlmsSection[] = []
  for (const collection of cfg.collections) {
    if (!collection.url) continue
    const items: LlmsSection['items'] = []
    for (const entry of await published(collection.name, cfg.locales.default)) {
      if (!entry.url || isTemplate(entry, templates) || entry.data.seo?.noindex || entry.data.seo?.canonical) continue
      items.push({
        title: entry.data.seo?.title || entry.title,
        url: entry.url,
        description: entry.data.seo?.description || (await summaryOf(entry)),
      })
    }
    // The home page first, then by address.
    items.sort((a, b) => (a.url === '/' ? -1 : b.url === '/' ? 1 : a.url.localeCompare(b.url)))
    sections.push({ title: collection.label, items })
  }
  return sections
}

/** The first image in a document's data (a cover, a hero), to share the page when no image is chosen. */
export function firstImage(value: unknown, depth = 0): Media | undefined {
  if (!value || typeof value !== 'object' || depth > 6) return undefined
  const v = value as Record<string, unknown>
  const picture = typeof v.alt === 'string' || v.type === 'image'
  if (
    picture &&
    typeof v.src === 'string' &&
    /\.(jpe?g|png|webp|avif)$|^\/media\/.+\.(jpe?g|png|webp|avif)/i.test(v.src)
  )
    return { src: v.src, alt: typeof v.alt === 'string' ? v.alt : '' }
  for (const child of Array.isArray(value) ? value : Object.values(v)) {
    const found = firstImage(child, depth + 1)
    if (found) return found
  }
  return undefined
}

/** The site's languages: the main one and every one pages can be published in. */
export async function getLocales(): Promise<{ default: string; available: string[] }> {
  const { config } = await getRuntime()
  return config().locales
}

/** Analytics, tags and the cookie banner (Impostazioni → Tracciamento e cookie). */
export async function getTracking(): Promise<TrackingSettings | null> {
  const { settings } = await getRuntime()
  return ((settings ? await settings.get('tracking') : null) as TrackingSettings | null) ?? null
}
