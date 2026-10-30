import type { Collection, Field, Media } from '@materializecms/core'
import { slugify } from '@materializecms/core'
import type { PageNode } from '@materializecms/core/page'
import {
  type ConvertContext,
  htmlToPage,
  htmlToRichText,
  imagesIn,
  mainContent,
  originalOf,
  plain,
  type WpItem,
  type WpSite,
} from './wordpress.ts'

/**
 * A WordPress site into Materialize: which collection each kind of item goes to, which field
 * takes what, then the import itself (images into the library, links pointing to the new pages,
 * SEO kept, old addresses redirected).
 */

/** What of a WordPress item a field can take. */
export type WpSource =
  | 'title'
  | 'slug'
  | 'content'
  | 'excerpt'
  | 'date'
  | 'featured'
  | 'categories'
  | 'tags'
  | 'author'
  | 'seo'

export interface ImportTarget {
  collection: string
  /** Field name → what it takes. */
  fields: Record<string, WpSource>
}

export interface ImportPlan {
  posts: ImportTarget | null
  pages: ImportTarget | null
  /** Items published on WordPress are published here too (when complete); otherwise drafts. */
  publish: boolean
  /** Old addresses redirect to the new ones. */
  redirects: boolean
  locale: string
  /** For a choice field: WordPress category → option value; unmatched ones take `fallback`. */
  categories?: Record<string, string>
  fallbackCategory?: string
}

/** Which sources fit a field of this kind. */
export function sourcesFor(f: Field): WpSource[] {
  switch (f.kind) {
    case 'text':
      return f.options.multiline
        ? ['excerpt', 'title', 'categories', 'tags', 'author']
        : ['title', 'categories', 'tags', 'author', 'excerpt']
    case 'slug':
      return ['slug']
    case 'richText':
    case 'page':
      return ['content']
    case 'date':
      return ['date']
    case 'media':
      return ['featured']
    case 'select':
      return ['categories', 'tags']
    case 'relation':
      return ['author']
    case 'seo':
      return ['seo']
    default:
      return []
  }
}

/** A first guess at where an item kind goes and which field takes what. */
export function suggest(collections: Collection[], kind: 'post' | 'page'): ImportTarget | null {
  const has = (c: Collection, k: Field['kind']) => Object.values(c.fields).some((f) => f.kind === k)
  const pool = collections.filter((c) => !c.singleton)
  const target =
    kind === 'page'
      ? (pool.find((c) => has(c, 'page')) ?? pool.find((c) => /page|pagin/.test(c.name)))
      : (pool.find((c) => /post|blog|news|artic|diario|journal/.test(c.name) && has(c, 'richText')) ??
        pool.find((c) => has(c, 'richText') && has(c, 'date')))
  if (!target) return null
  const fields: Record<string, WpSource> = {}
  const taken = new Set<WpSource>()
  const pick = (name: string, source: WpSource) => {
    if (taken.has(source) && source !== 'categories') return
    fields[name] = source
    taken.add(source)
  }
  for (const [name, f] of Object.entries(target.fields)) {
    if (name === target.titleField) pick(name, 'title')
    else if (f.kind === 'slug') pick(name, 'slug')
    else if (f.kind === 'page' || (f.kind === 'richText' && !taken.has('content'))) pick(name, 'content')
    else if (f.kind === 'text' && f.options.multiline && /excerpt|summary|somm|riass|intro|desc/i.test(name))
      pick(name, 'excerpt')
    else if (f.kind === 'date') pick(name, 'date')
    else if (f.kind === 'media' && !taken.has('featured')) pick(name, 'featured')
    else if ((f.kind === 'select' || f.kind === 'text') && /categ/i.test(name)) pick(name, 'categories')
    else if (f.kind === 'text' && /tag|etichett/i.test(name)) pick(name, 'tags')
    else if ((f.kind === 'relation' || f.kind === 'text') && /author|autor/i.test(name)) pick(name, 'author')
    else if (f.kind === 'seo') pick(name, 'seo')
  }
  // A multi-line text not taken yet gets the excerpt.
  if (!taken.has('excerpt'))
    for (const [name, f] of Object.entries(target.fields))
      if (!fields[name] && f.kind === 'text' && f.options.multiline) {
        pick(name, 'excerpt')
        break
      }
  return { collection: target.name, fields }
}

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** The options of a choice field, as value and label. */
export function optionsOf(f: Field): { value: string; label: string }[] {
  const raw = (f.options.options ?? []) as (string | { value: string; label: string })[]
  return raw.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
}

/** A WordPress category to an option of a choice field, by value or label; null if none fits. */
export function matchOption(name: string, options: { value: string; label: string }[]): string | null {
  const n = fold(name)
  return options.find((o) => fold(o.value) === n || fold(o.label) === n)?.value ?? null
}

export interface ImportProgress {
  phase: 'media' | 'content' | 'done' | 'failed'
  done: number
  total: number
  created: { id: string; collection: string; title: string; published: boolean }[]
  skipped: { title: string; reason: string }[]
  problems: { title: string; reason: string }[]
  media: { downloaded: number; failed: number; reasons: Record<string, number> }
  redirects: number
  error?: string
}

export interface ImportDeps {
  collections: Collection[]
  /** The whole published page at an address, as HTML; null when it cannot be read. */
  fetchPage: (url: string) => Promise<string | null>
  /** Downloads an image into the library; null when it cannot be had. */
  saveImage: (url: string, alt: string) => Promise<Media | { error: string }>
  /** An existing document with this slug, in this collection and language. */
  exists: (collection: string, slug: string) => Promise<boolean>
  /** Entries of a collection by title, for relations (an author → a person of the team). */
  titles: (collection: string) => Promise<Map<string, string>>
  /** Creates a draft; returns its id and address. */
  create: (def: Collection, data: Record<string, unknown>) => Promise<{ id: string; title: string; url: string | null }>
  /** Publishes it; throws when fields are missing. */
  publish: (id: string) => Promise<void>
  /** The address a document will have, from its data. */
  urlOf: (def: Collection, data: Record<string, unknown>) => string | null
  addRedirects: (moves: { from: string; to: string }[]) => Promise<number>
  onProgress: (p: ImportProgress) => void
}

/** "Il titolo • Yoast" → "Il titolo": the site's name is added by Materialize itself. */
function seoTitle(title: string | undefined, site: string): string | undefined {
  if (!title) return undefined
  const clean = plain(title)
  const cut = clean.replace(
    new RegExp(`\\s*[|•\\-–—·:]\\s*${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'),
    '',
  )
  return cut || clean
}

const pathOf = (link: string, base: string) => {
  try {
    const u = new URL(link, base)
    return decodeURI(u.pathname).replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
}

export async function runImport(site: WpSite, plan: ImportPlan, deps: ImportDeps): Promise<ImportProgress> {
  const progress: ImportProgress = {
    phase: 'media',
    done: 0,
    total: 0,
    created: [],
    skipped: [],
    problems: [],
    media: { downloaded: 0, failed: 0, reasons: {} },
    redirects: 0,
  }
  const report = () => deps.onProgress({ ...progress })
  const targetOf = (item: WpItem) => (item.kind === 'post' ? plan.posts : plan.pages)
  const defOf = (t: ImportTarget) => deps.collections.find((c) => c.name === t.collection)
  const items = site.items.filter((i) => {
    const t = targetOf(i)
    return t && defOf(t)
  })

  // 0. Items the API gave empty (some themes and page builders keep the page elsewhere): their
  // published page is read instead, between its header and its footer.
  for (const item of items)
    if (plain(item.html).length < 40 && item.status === 'publish' && item.link) {
      const page = await deps.fetchPage(item.link)
      const main = page ? mainContent(page) : ''
      if (plain(main).length > plain(item.html).length) item.html = main
    }

  // 1. Images: each address once, the original size when WordPress has it.
  const wanted = new Map<string, string>()
  for (const item of items) {
    const t = targetOf(item) as ImportTarget
    const fields = Object.values(t.fields)
    if (fields.includes('content')) for (const src of imagesIn(item.html)) wanted.set(new URL(src, site.url).href, '')
    if (fields.includes('featured') && item.featured?.url)
      wanted.set(new URL(item.featured.url, site.url).href, item.featured.alt)
  }
  const images = new Map<string, Media>()
  progress.total = wanted.size
  report()
  const queue = [...wanted]
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [url, alt] = next
      const original = originalOf(url)
      let saved = original !== url ? await deps.saveImage(original, alt) : null
      if (!saved || 'error' in saved) saved = await deps.saveImage(url, alt)
      if ('error' in saved) {
        progress.media.failed++
        progress.media.reasons[saved.error] = (progress.media.reasons[saved.error] ?? 0) + 1
      } else {
        images.set(url, saved)
        progress.media.downloaded++
      }
      progress.done++
      report()
    }
  }
  await Promise.all([worker(), worker(), worker()])

  // 2. Where every item will live, so links between them point to the new pages.
  const plans = items.map((item) => {
    const t = targetOf(item) as ImportTarget
    const def = defOf(t) as Collection
    const slug = slugify(decodeURIComponent(item.slug)) || slugify(item.title) || item.sourceId
    const sample: Record<string, unknown> = {}
    for (const [name, source] of Object.entries(t.fields)) if (source === 'slug') sample[name] = slug
    return { item, t, def, slug, url: deps.urlOf(def, sample) }
  })
  const moved = new Map<string, string>()
  for (const p of plans) {
    const from = pathOf(p.item.link, site.url)
    if (from && p.url) moved.set(from, p.url)
  }
  const host = (() => {
    try {
      return new URL(site.url).host
    } catch {
      return ''
    }
  })()
  const ctx: ConvertContext = {
    image: (src) => images.get(new URL(src, site.url).href),
    link: (href) => {
      try {
        const u = new URL(href, site.url)
        if (u.host !== host) return href
        const image = images.get(u.href) ?? images.get(originalOf(u.href))
        if (image) return image.src
        const to = moved.get(decodeURI(u.pathname).replace(/\/+$/, '') || '/')
        return to ? to + u.hash : href
      } catch {
        return href
      }
    },
  }

  // 3. The documents.
  progress.phase = 'content'
  progress.done = 0
  progress.total = plans.length
  report()
  const relations = new Map<string, Map<string, string>>()
  const moves: { from: string; to: string }[] = []
  // Addresses taken by this import: WordPress allows the same slug under different parent pages.
  const taken = new Map<string, Set<string>>()
  for (const entry of plans) {
    const { item, t, def } = entry
    let { slug, url } = entry
    try {
      const mine = taken.get(def.name) ?? new Set<string>()
      taken.set(def.name, mine)
      if (mine.has(slug)) {
        let n = 2
        while (mine.has(`${slug}-${n}`) || (await deps.exists(def.name, `${slug}-${n}`))) n++
        const before = slug
        slug = `${slug}-${n}`
        const sample: Record<string, unknown> = {}
        for (const [name, source] of Object.entries(t.fields)) if (source === 'slug') sample[name] = slug
        url = deps.urlOf(def, sample)
        progress.problems.push({
          title: item.title,
          reason: `indirizzo già usato da un’altra pagina importata: ora è ${url ?? slug}, era ${before}`,
        })
      } else if (await deps.exists(def.name, slug)) {
        // Already there from before (a second import): left as it is.
        progress.skipped.push({ title: item.title, reason: 'c’è già un contenuto con lo stesso indirizzo' })
        continue
      }
      mine.add(slug)
      const data: Record<string, unknown> = {}
      for (const [name, source] of Object.entries(t.fields)) {
        const f = def.fields[name]
        if (!f) continue
        const value = await valueFor(f, source, item, ctx, plan, site, relations, deps)
        if (value !== undefined) data[name] = value
      }
      for (const [name, source] of Object.entries(t.fields)) if (source === 'slug') data[name] = slug
      const doc = await deps.create(def, data)
      let published = false
      if (plan.publish && item.status === 'publish')
        try {
          await deps.publish(doc.id)
          published = true
        } catch {
          progress.problems.push({ title: doc.title, reason: 'importato come bozza: ha campi da completare' })
        }
      progress.created.push({ id: doc.id, collection: def.name, title: doc.title, published })
      const from = pathOf(item.link, site.url)
      if (published && from && url && from !== url) moves.push({ from, to: url })
    } catch (error) {
      progress.problems.push({ title: item.title, reason: (error as Error).message })
    } finally {
      progress.done++
      report()
    }
  }
  if (plan.redirects && moves.length) progress.redirects = await deps.addRedirects(moves)
  progress.phase = 'done'
  report()
  return progress
}

async function valueFor(
  f: Field,
  source: WpSource,
  item: WpItem,
  ctx: ConvertContext,
  plan: ImportPlan,
  site: WpSite,
  relations: Map<string, Map<string, string>>,
  deps: ImportDeps,
): Promise<unknown> {
  const max = typeof f.options.max === 'number' ? f.options.max : undefined
  const clip = (s: string) => (max && s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)
  switch (source) {
    case 'title':
      return clip(item.title || 'Senza titolo')
    case 'slug':
      return undefined
    case 'excerpt':
      return item.excerpt ? clip(item.excerpt.replace(/\s*\[(…|&hellip;|\.\.\.)\]\s*$/, '…')) : undefined
    case 'date':
      return item.date.slice(0, 10)
    case 'content':
      if (f.kind === 'page') return htmlToPage(item.html, item.title, ctx) as PageNode[]
      if (f.kind === 'richText') return htmlToRichText(item.html, ctx)
      return clip(plain(item.html))
    case 'featured':
      return item.featured ? ctx.image(item.featured.url) : undefined
    case 'categories':
    case 'tags': {
      const names = source === 'categories' ? item.categories : item.tags
      if (f.kind === 'select') {
        const options = optionsOf(f)
        for (const name of names) {
          const chosen = plan.categories?.[name] ?? matchOption(name, options)
          if (chosen) return chosen
        }
        return plan.fallbackCategory || (f.required ? options[0]?.value : undefined)
      }
      return names.length ? clip(names.join(', ')) : undefined
    }
    case 'author': {
      if (!item.author) return undefined
      if (f.kind === 'relation') {
        const to = String(f.options.to)
        if (!relations.has(to)) relations.set(to, await deps.titles(to))
        return relations.get(to)?.get(fold(item.author))
      }
      return clip(item.author)
    }
    case 'seo': {
      if (!item.seo) return undefined
      // Search engines show about 60 and 160 characters: longer ones are cut on a word.
      const cut = (s: string | undefined, n: number) => {
        if (!s) return undefined
        if (s.length <= n) return s
        const head = s.slice(0, n - 1)
        return `${head.slice(0, Math.max(head.lastIndexOf(' '), n - 20)).trimEnd()}…`
      }
      const title = cut(seoTitle(item.seo.title, site.name), 70)
      const description = cut(item.seo.description ? plain(item.seo.description) : undefined, 170)
      return { ...(title ? { title } : {}), ...(description ? { description } : {}) }
    }
  }
}

export { fold }
