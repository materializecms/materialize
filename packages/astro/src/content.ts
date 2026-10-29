import type { Collection, Field, Fields, MaterializeConfig } from '@materializecms/core'
import { normalizeTheme, type Theme } from '@materializecms/core/page'
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
