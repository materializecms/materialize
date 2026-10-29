import type { Collection, Field, Fields, MaterializeConfig, Media } from '@materializecms/core'
import { type Component, normalizeTheme, type PageNode, type Theme } from '@materializecms/core/page'
import type { Redirect, SitemapPage, SiteSeo } from '@materializecms/core/seo'
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

/** Sections shared by several pages, by id. */
export async function getGlobals(): Promise<Record<string, PageNode>> {
  const { settings } = await getRuntime()
  return ((settings ? await settings.get('globals') : null) as Record<string, PageNode> | null) ?? {}
}

/**
 * The canvas page chosen in the panel as the template of a collection's entries, as published;
 * null when the collection has none (its entries keep their own layout).
 */
export async function getTemplate(collection: string): Promise<PageNode[] | null> {
  const { settings, config } = await getRuntime()
  const id = ((settings ? await settings.get('templates') : null) as Record<string, string> | null)?.[collection]
  if (!id) return null
  for (const c of config().collections) {
    const found = (await published(c.name).catch(() => [])).find((e) => e.id === id)
    if (found && Array.isArray(found.data.page)) return found.data.page as PageNode[]
  }
  return null
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

/** Published entries of a collection, in the default locale unless another is given. */
export async function getEntries<T extends Data = Data>(
  collection: string,
  options: { locale?: string } = {},
): Promise<Entry<T>[]> {
  const { config } = await getRuntime()
  return (await published(collection, options.locale ?? config().locales.default)) as Entry<T>[]
}

export async function getEntry<T extends Data = Data>(
  collection: string,
  slug: string,
  options: { locale?: string } = {},
): Promise<Entry<T> | undefined> {
  return (await getEntries<T>(collection, options)).find((e) => e.slug === slug)
}

/** The single document of a singleton collection, such as site settings. */
export async function getSingleton<T extends Data = Data>(
  collection: string,
  options: { locale?: string } = {},
): Promise<Entry<T> | undefined> {
  return (await getEntries<T>(collection, options))[0]
}

/**
 * Every published page of the site, for a catch-all route (`src/pages/[...path].astro`):
 * `export const getStaticPaths = getRoutes`.
 */
export async function getRoutes(): Promise<{ params: { path: string | undefined }; props: { entry: Entry } }[]> {
  const { config } = await getRuntime()
  const routes = []
  for (const collection of config().collections) {
    if (!collection.url) continue
    for (const entry of await published(collection.name)) {
      if (!entry.url) continue
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

/**
 * The same page in every language it is published in: translations share the collection and
 * the slug (singletons and pages without a slug match on the collection alone).
 */
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
    const same = (await published(entry.collection, locale)).find((e) => e.slug === entry.slug)
    if (same?.url) out.push({ locale, url: same.url })
  }
  return out
}

/** Every published page search engines may index, for sitemap.xml. */
export async function getSitemapPages(): Promise<SitemapPage[]> {
  const { config } = await getRuntime()
  const pages: SitemapPage[] = []
  for (const collection of config().collections) {
    if (!collection.url) continue
    for (const entry of await published(collection.name)) {
      if (!entry.url || entry.data.seo?.noindex || entry.data.seo?.canonical) continue
      const alternates = await getAlternates(entry)
      pages.push({ url: entry.url, updatedAt: entry.publishedAt, alternates })
    }
  }
  return pages.sort((a, b) => a.url.localeCompare(b.url))
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
