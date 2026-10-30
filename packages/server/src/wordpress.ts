import type { Media, RichText, RichTextBlock, RichTextRun } from '@materializecms/core'
import { newId, type PageNode, type Run } from '@materializecms/core/page'
import { DomUtils, parseDocument } from 'htmlparser2'

/**
 * WordPress, read: from a site's REST API (/wp-json, also with an application password for drafts
 * and private pages) or from its export file (Strumenti → Esporta, WXR). Both become the same
 * list of items, whatever built them (the block editor, Elementor, WPBakery, Divi…): the REST API
 * gives each page as WordPress renders it, the export file its stored content without the
 * page builders' shortcodes.
 */

export interface WpItem {
  sourceId: string
  kind: 'post' | 'page'
  title: string
  slug: string
  status: 'publish' | 'draft' | 'private' | 'pending' | 'future'
  /** ISO date and time of publication. */
  date: string
  /** The address on the WordPress site. */
  link: string
  html: string
  excerpt: string
  featured?: { url: string; alt: string }
  categories: string[]
  tags: string[]
  author?: string
  seo?: { title?: string; description?: string }
}

export interface WpSite {
  name: string
  url: string
  items: WpItem[]
}

/** What reading needs from the network: the body as text, the status and the headers. */
export type Fetcher = (url: string) => Promise<{ status: number; headers: Headers; text: string }>

export class WordPressError extends Error {}

// ---------- the DOM, from htmlparser2 ----------

interface DomNode {
  type: string
  name?: string
  attribs?: Record<string, string>
  children?: DomNode[]
  data?: string
}

const parse = (html: string, xml = false) =>
  parseDocument(html, xml ? { xmlMode: true } : { decodeEntities: true }) as unknown as DomNode

function textOf(node: DomNode): string {
  if (node.type === 'text') return node.data ?? ''
  if (node.name === 'script' || node.name === 'style') return ''
  // CDATA sections (the export file) hold their text as a child.
  return (node.children ?? []).map(textOf).join('')
}

/** HTML or entities to plain text: "Ciao &amp; benvenuti" → "Ciao & benvenuti". */
export const plain = (html: string) => textOf(parse(html)).replace(/\s+/g, ' ').trim()

const STATUSES = new Set(['publish', 'draft', 'private', 'pending', 'future'])

// ---------- REST API ----------

/**
 * Reads a site through its REST API. `credentials` (user and application password, from the
 * WordPress profile) also brings drafts and private items. `limit` stops early, to try.
 */
export async function readRest(base: string, fetcher: Fetcher, options: { limit?: number } = {}): Promise<WpSite> {
  const root = base.replace(/\/+$/, '')
  // Pretty permalinks answer at /wp-json; plain ones only at ?rest_route=.
  const endpoints = [
    (route: string, query = '') => `${root}/wp-json${route}${query ? `?${query}` : ''}`,
    (route: string, query = '') => `${root}/?rest_route=${route}${query ? `&${query}` : ''}`,
  ]
  let api: (typeof endpoints)[number] | null = null
  let info: { name?: string; url?: string; home?: string } = {}
  for (const endpoint of endpoints) {
    const res = await fetcher(endpoint('/')).catch(() => null)
    if (res?.status === 200) {
      try {
        info = JSON.parse(res.text)
        api = endpoint
        break
      } catch {}
    }
  }
  if (!api)
    throw new WordPressError(
      'Non trovo l’API di WordPress a questo indirizzo: controlla che sia il sito giusto, oppure usa il file di esportazione.',
    )
  const endpoint = api

  const items: WpItem[] = []
  for (const kind of ['post', 'page'] as const) {
    const route = kind === 'post' ? '/wp/v2/posts' : '/wp/v2/pages'
    for (let page = 1; ; page++) {
      // A trial needs only the first few: smaller pages answer much sooner.
      const size = Math.min(100, options.limit ?? 100)
      const base = `per_page=${size}&page=${page}&_embed=1&orderby=date&order=desc`
      let res = await fetcher(endpoint(route, `${base}&status=publish,future,draft,pending,private`))
      // Without the right to see drafts, WordPress refuses the status filter: published ones only.
      if (res.status === 400 || res.status === 401 || res.status === 403) res = await fetcher(endpoint(route, base))
      if (res.status === 400 && page > 1) break
      if (res.status === 401 || res.status === 403)
        throw new WordPressError('WordPress non dà accesso ai contenuti: controlla utente e password applicativa.')
      if (res.status !== 200) throw new WordPressError(`WordPress ha risposto ${res.status} leggendo ${route}`)
      const list = JSON.parse(res.text) as RestPost[]
      for (const p of list) items.push(fromRest(p, kind))
      const pages = Number(res.headers.get('x-wp-totalpages') ?? 1)
      if (options.limit && items.filter((i) => i.kind === kind).length >= options.limit) break
      if (page >= pages || !list.length) break
    }
  }
  const limited = options.limit
    ? [
        ...items.filter((i) => i.kind === 'post').slice(0, options.limit),
        ...items.filter((i) => i.kind === 'page').slice(0, options.limit),
      ]
    : items
  return { name: plain(info.name ?? '') || root, url: info.home ?? info.url ?? root, items: limited }
}

interface RestPost {
  id: number
  date_gmt?: string
  date?: string
  slug: string
  status: string
  link: string
  title?: { rendered?: string }
  content?: { rendered?: string }
  excerpt?: { rendered?: string }
  yoast_head_json?: { title?: string; description?: string; og_description?: string }
  _embedded?: {
    author?: { name?: string }[]
    'wp:featuredmedia'?: { source_url?: string; alt_text?: string }[]
    'wp:term'?: { taxonomy?: string; name?: string }[][]
  }
}

function fromRest(p: RestPost, kind: 'post' | 'page'): WpItem {
  const terms = (p._embedded?.['wp:term'] ?? []).flat()
  const media = p._embedded?.['wp:featuredmedia']?.[0]
  const yoast = p.yoast_head_json
  return {
    sourceId: String(p.id),
    kind,
    title: plain(p.title?.rendered ?? ''),
    slug: p.slug,
    status: (STATUSES.has(p.status) ? p.status : 'draft') as WpItem['status'],
    date: isoDate(p.date_gmt ? `${p.date_gmt}Z` : (p.date ?? '')),
    link: p.link,
    html: p.content?.rendered ?? '',
    excerpt: plain(p.excerpt?.rendered ?? ''),
    featured: media?.source_url ? { url: media.source_url, alt: media.alt_text ?? '' } : undefined,
    categories: terms.filter((t) => t.taxonomy === 'category' && t.name).map((t) => plain(t.name as string)),
    tags: terms.filter((t) => t.taxonomy === 'post_tag' && t.name).map((t) => plain(t.name as string)),
    author: p._embedded?.author?.[0]?.name,
    seo: yoast ? { title: yoast.title, description: yoast.description ?? yoast.og_description } : undefined,
  }
}

function isoDate(value: string): string {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

// ---------- export file (WXR) ----------

/** Reads the file of Strumenti → Esporta → Tutti i contenuti. */
export function readWxr(xml: string): WpSite {
  const doc = parse(xml, true)
  const find = (node: DomNode, name: string): DomNode | undefined => {
    for (const c of node.children ?? []) {
      if (c.name === name) return c
      const deep = find(c, name)
      if (deep) return deep
    }
    return undefined
  }
  const channel = find(doc, 'channel')
  if (!channel || !find(channel, 'wp:wxr_version'))
    throw new WordPressError('Questo non è un file di esportazione di WordPress (Strumenti → Esporta).')
  const child = (node: DomNode, name: string) => (node.children ?? []).find((c) => c.name === name)
  const text = (node: DomNode | undefined) => (node ? textOf(node).trim() : '')
  const rawItems = (channel.children ?? []).filter((c) => c.name === 'item')

  const attachments = new Map<string, { url: string; alt: string }>()
  const meta = (item: DomNode) => {
    const out: Record<string, string> = {}
    for (const m of (item.children ?? []).filter((c) => c.name === 'wp:postmeta'))
      out[text(child(m, 'wp:meta_key'))] = text(child(m, 'wp:meta_value'))
    return out
  }
  for (const item of rawItems)
    if (text(child(item, 'wp:post_type')) === 'attachment')
      attachments.set(text(child(item, 'wp:post_id')), {
        url: text(child(item, 'wp:attachment_url')),
        alt: meta(item)._wp_attachment_image_alt ?? '',
      })

  const items: WpItem[] = []
  for (const item of rawItems) {
    const type = text(child(item, 'wp:post_type'))
    if (type !== 'post' && type !== 'page') continue
    const status = text(child(item, 'wp:status'))
    if (status === 'trash' || status === 'auto-draft' || status === 'inherit') continue
    const m = meta(item)
    const terms = (item.children ?? []).filter((c) => c.name === 'category')
    const date = text(child(item, 'wp:post_date_gmt'))
    items.push({
      sourceId: text(child(item, 'wp:post_id')),
      kind: type,
      title: plain(text(child(item, 'title'))),
      slug: text(child(item, 'wp:post_name')) || text(child(item, 'wp:post_id')),
      status: (STATUSES.has(status) ? status : 'draft') as WpItem['status'],
      date: isoDate(
        date && !date.startsWith('0000') ? `${date.replace(' ', 'T')}Z` : text(child(item, 'wp:post_date')),
      ),
      link: text(child(item, 'link')),
      html: withoutShortcodes(text(child(item, 'content:encoded'))),
      excerpt: plain(text(child(item, 'excerpt:encoded'))),
      featured: m._thumbnail_id ? attachments.get(m._thumbnail_id) : undefined,
      categories: terms.filter((t) => t.attribs?.domain === 'category').map((t) => plain(text(t))),
      tags: terms.filter((t) => t.attribs?.domain === 'post_tag').map((t) => plain(text(t))),
      author: text(child(item, 'dc:creator')) || undefined,
      seo:
        m._yoast_wpseo_title || m._yoast_wpseo_metadesc || m.rank_math_title || m.rank_math_description
          ? {
              title: m._yoast_wpseo_title || m.rank_math_title || undefined,
              description: m._yoast_wpseo_metadesc || m.rank_math_description || undefined,
            }
          : undefined,
    })
  }
  return { name: plain(text(child(channel, 'title'))), url: text(child(channel, 'link')), items }
}

/**
 * Stored content of page builders is made of shortcodes ([vc_row], [et_pb_text]…): the marks go,
 * the words and images inside them stay. Unknown wrappers too: they show nothing on their own.
 */
export function withoutShortcodes(html: string): string {
  return html
    .replace(/<!--\s*\/?wp:[\s\S]*?-->/g, '')
    .replace(/\[\/?[a-z][\w-]*(?:\s[^\]]*)?\]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n\s*\n/)
    .map((block) => (/^\s*</.test(block) ? block : `<p>${block.trim().replace(/\n/g, '<br>')}</p>`))
    .join('\n')
}

// ---------- a published page, when the API gives no content ----------

/**
 * The main content of a whole published page, as HTML: what a theme or a page builder shows
 * between its header and its footer. Used when WordPress keeps the page outside its content
 * (some themes, some page builders), so the API answers empty.
 */
export function mainContent(html: string): string {
  const doc = parse(html)
  const all: DomNode[] = []
  const walk = (n: DomNode) => {
    all.push(n)
    for (const c of n.children ?? []) walk(c)
  }
  walk(doc)
  const cls = (n: DomNode) => ` ${n.attribs?.class ?? ''} `
  const attr = (n: DomNode, k: string) => n.attribs?.[k] ?? ''
  const pick =
    // Elementor, Divi, then the usual theme markup.
    all.find((n) => /^wp-(page|post)$|^single-post$/.test(attr(n, 'data-elementor-type'))) ??
    all.find((n) => / et-l--post | et_builder_inner_content /.test(cls(n))) ??
    all.find((n) => n.name === 'main' || attr(n, 'role') === 'main') ??
    all.find((n) => n.name === 'article') ??
    all.find((n) => / entry-content | post-content | page-content /.test(cls(n))) ??
    all.find((n) => n.name === 'body') ??
    doc
  // What surrounds the content on every page goes: menus, headers, footers, sidebars, forms.
  const drop = (n: DomNode): boolean =>
    ['header', 'footer', 'nav', 'aside', 'script', 'style', 'noscript', 'form', 'template'].includes(n.name ?? '') ||
    /^(header|footer|popup)$/.test(attr(n, 'data-elementor-type')) ||
    / elementor-location-(header|footer|popup) | site-header | site-footer | screen-reader-text /.test(cls(n))
  const clean = (n: DomNode) => {
    n.children = (n.children ?? []).filter((c) => !drop(c))
    for (const c of n.children) clean(c)
  }
  clean(pick)
  return DomUtils.getOuterHTML(pick as never)
}

// ---------- HTML to Materialize ----------

/** What the conversion needs from the import: where images and links now live. */
export interface ConvertContext {
  /** The library image for a WordPress image address, once downloaded. */
  image: (url: string) => Media | undefined
  /** The new address for a link to the old site; other links stay as they are. */
  link: (href: string) => string
}

/** Every image address in some HTML, the original size first (WordPress adds "-1024x768"). */
export function imagesIn(html: string): string[] {
  const out: string[] = []
  const walk = (n: DomNode) => {
    if (n.name === 'img') {
      const src = imageSrc(n)
      if (src) out.push(src)
    }
    for (const c of n.children ?? []) walk(c)
  }
  walk(parse(html))
  return [...new Set(out)]
}

function imageSrc(img: DomNode): string | undefined {
  const a = img.attribs ?? {}
  // Lazy-loading plugins keep the real address aside.
  const src = a['data-src'] || a['data-lazy-src'] || a.src
  if (!src || src.startsWith('data:')) return undefined
  return src
}

/** The full-size original of a resized WordPress image: "foto-1024x768.jpg" → "foto.jpg". */
export const originalOf = (url: string) => url.replace(/-\d{2,5}x\d{2,5}(?=\.[a-z0-9]+(?:[?#].*)?$)/i, '')

const BLOCKS = new Set([
  'p',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'ul',
  'ol',
  'li',
  'blockquote',
  'figure',
  'img',
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'table',
  'tr',
  'td',
  'th',
  'tbody',
  'thead',
  'pre',
  'figcaption',
  'hr',
  'iframe',
  'video',
  'form',
  'nav',
])
const SKIP = new Set(['script', 'style', 'noscript', 'form', 'svg', 'button', 'input', 'select', 'textarea', 'nav'])

function runsOf(nodes: DomNode[], ctx: ConvertContext, mark: { b?: boolean; i?: boolean; href?: string } = {}) {
  const runs: { text: string; b?: boolean; i?: boolean; href?: string }[] = []
  const walk = (n: DomNode, m: typeof mark) => {
    if (n.type === 'text') {
      const t = (n.data ?? '').replace(/\s+/g, ' ')
      if (t) runs.push({ text: t, ...m })
      return
    }
    if (n.type !== 'tag' || SKIP.has(n.name ?? '')) return
    if (n.name === 'br') {
      runs.push({ text: '\n', ...m })
      return
    }
    if (n.name === 'img') return
    const next = { ...m }
    if (n.name === 'strong' || n.name === 'b') next.b = true
    if (n.name === 'em' || n.name === 'i') next.i = true
    if (n.name === 'a' && n.attribs?.href) next.href = ctx.link(n.attribs.href)
    for (const c of n.children ?? []) walk(c, next)
  }
  for (const n of nodes) walk(n, mark)
  // Same marks side by side join; spaces at the edges go.
  const merged: typeof runs = []
  for (const r of runs) {
    const last = merged[merged.length - 1]
    if (last && last.b === r.b && last.i === r.i && last.href === r.href) last.text += r.text
    else merged.push({ ...r })
  }
  if (merged[0]) merged[0].text = merged[0].text.replace(/^\s+/, '')
  const end = merged[merged.length - 1]
  if (end) end.text = end.text.replace(/\s+$/, '')
  return merged.filter((r) => r.text)
}

type Piece =
  | {
      kind: 'text'
      style: 'p' | 'h1' | 'h2' | 'h3' | 'h4' | 'quote' | 'li' | 'caption'
      runs: ReturnType<typeof runsOf>
    }
  | { kind: 'image'; src: string }
  | { kind: 'button'; text: string; href: string }

/** The content of some HTML in reading order: titles, paragraphs, list items, quotes, images, buttons. */
function pieces(html: string, ctx: ConvertContext): Piece[] {
  const out: Piece[] = []
  const inlineBuffer: DomNode[] = []
  const flush = () => {
    if (!inlineBuffer.length) return
    const runs = runsOf(inlineBuffer.splice(0), ctx)
    if (runs.length) out.push({ kind: 'text', style: 'p', runs })
  }
  const walk = (n: DomNode, quote = false) => {
    if (n.type === 'text') {
      if ((n.data ?? '').trim()) inlineBuffer.push(n)
      return
    }
    if (n.type !== 'tag') return
    const name = n.name ?? ''
    if (SKIP.has(name)) return
    if (!BLOCKS.has(name)) {
      // A lone image inside a link or a span still counts as an image.
      if (name === 'a' && isButton(n)) {
        flush()
        const text = textOf(n).replace(/\s+/g, ' ').trim()
        if (text) out.push({ kind: 'button', text, href: ctx.link(n.attribs?.href ?? '#') })
        return
      }
      const img = findImg(n)
      if (img && !textOf(n).trim()) {
        flush()
        const src = imageSrc(img)
        if (src) out.push({ kind: 'image', src })
        return
      }
      inlineBuffer.push(n)
      return
    }
    flush()
    if (name === 'img') {
      const src = imageSrc(n)
      if (src) out.push({ kind: 'image', src })
      return
    }
    if (/^h[1-6]$/.test(name)) {
      const runs = runsOf(n.children ?? [], ctx)
      const level = Math.min(4, Number(name[1]))
      if (runs.length) out.push({ kind: 'text', style: `h${level}` as 'h1', runs })
      return
    }
    if (name === 'p' || name === 'figcaption' || name === 'pre') {
      // Images inside a paragraph come out on their own.
      for (const img of allImgs(n)) {
        const src = imageSrc(img)
        if (src) out.push({ kind: 'image', src })
      }
      const runs = runsOf(n.children ?? [], ctx)
      if (runs.length)
        out.push({ kind: 'text', style: quote ? 'quote' : name === 'figcaption' ? 'caption' : 'p', runs })
      return
    }
    if (name === 'li') {
      const runs = runsOf(
        (n.children ?? []).filter((c) => c.name !== 'ul' && c.name !== 'ol'),
        ctx,
      )
      if (runs.length) out.push({ kind: 'text', style: 'li', runs })
      for (const c of n.children ?? []) if (c.name === 'ul' || c.name === 'ol') walk(c)
      return
    }
    if (name === 'blockquote') {
      const before = out.length
      for (const c of n.children ?? []) walk(c, true)
      flush()
      // A quote written without paragraphs inside.
      if (out.length === before) {
        const runs = runsOf(n.children ?? [], ctx)
        if (runs.length) out.push({ kind: 'text', style: 'quote', runs })
      }
      return
    }
    if (name === 'iframe' || name === 'video') {
      const src = n.attribs?.src
      // Videos and embeds stay a link to the original, to put back by hand.
      if (src) out.push({ kind: 'text', style: 'p', runs: [{ text: 'Video: ' }, { text: src, href: src }] })
      return
    }
    if (name === 'hr') return
    for (const c of n.children ?? []) walk(c, quote)
    flush()
  }
  for (const c of parse(html).children ?? []) walk(c)
  flush()
  return out
}

const isButton = (a: DomNode) =>
  /(^|\s)(wp-block-button__link|elementor-button|et_pb_button|vc_btn|button|btn)(\s|$|-)/.test(a.attribs?.class ?? '')
const findImg = (n: DomNode): DomNode | undefined =>
  n.name === 'img' ? n : (n.children ?? []).map(findImg).find(Boolean)
const allImgs = (n: DomNode): DomNode[] => (n.name === 'img' ? [n] : (n.children ?? []).flatMap(allImgs))

const toRichRuns = (runs: ReturnType<typeof runsOf>): RichTextRun[] =>
  runs.map((r) => ({
    text: r.text,
    ...(r.b ? { bold: true } : {}),
    ...(r.i ? { italic: true } : {}),
    ...(r.href ? { href: r.href } : {}),
  }))

/** HTML to Materialize rich text: paragraphs, titles, lists, quotes and images (from the library). */
export function htmlToRichText(html: string, ctx: ConvertContext): RichText {
  const out: RichTextBlock[] = []
  for (const p of pieces(html, ctx)) {
    if (p.kind === 'image') {
      const img = ctx.image(p.src)
      if (img) out.push({ type: 'image', children: [], image: img })
    } else if (p.kind === 'button') {
      out.push({ type: 'paragraph', children: [{ text: p.text, bold: true, href: p.href }] })
    } else if (p.style === 'h1' || p.style === 'h2')
      out.push({ type: 'heading', level: 2, children: toRichRuns(p.runs) })
    else if (p.style === 'h3') out.push({ type: 'heading', level: 3, children: toRichRuns(p.runs) })
    else if (p.style === 'h4') out.push({ type: 'heading', level: 4, children: toRichRuns(p.runs) })
    else if (p.style === 'quote') out.push({ type: 'quote', children: toRichRuns(p.runs) })
    else if (p.style === 'li') out.push({ type: 'listItem', children: toRichRuns(p.runs) })
    else if (p.style === 'caption')
      out.push({ type: 'paragraph', children: toRichRuns(p.runs).map((r) => ({ ...r, italic: true })) })
    else out.push({ type: 'paragraph', children: toRichRuns(p.runs) })
  }
  return out
}

/**
 * HTML to a page on the canvas, plainly laid out: a section for each main title, with its words,
 * images and buttons in order. The layout of the original is redone afterwards (by hand or with
 * the assistant); here nothing of the content is lost.
 */
export function htmlToPage(html: string, title: string, ctx: ConvertContext): PageNode[] {
  const sections: PageNode[] = []
  let current: PageNode | null = null
  const section = (): PageNode => {
    current = { id: newId(), type: 'frame', name: 'Sezione', layout: 'col', gap: 20, size: 'm', children: [] }
    sections.push(current)
    return current
  }
  const add = (n: PageNode) => (current ?? section()).children?.push(n)
  const text = (runs: ReturnType<typeof runsOf>, style: PageNode['style'], name: string): PageNode => {
    const r: Run[] = runs.map((x) => ({
      t: x.text,
      ...(x.b ? { b: true } : {}),
      ...(x.i ? { i: true } : {}),
      ...(x.href ? { href: x.href } : {}),
    }))
    const plainText = r.map((x) => x.t).join('')
    const simple = r.length === 1 && !r[0]?.b && !r[0]?.i && !r[0]?.href
    return { id: newId(), type: 'text', name, text: plainText, ...(simple ? {} : { runs: r }), style, width: 'fill' }
  }
  const all = pieces(html, ctx)
  // The page title opens the page, unless the content has a main title of its own.
  const ownTitle = all.some((p) => p.kind === 'text' && p.style === 'h1')
  if (title && !ownTitle) add(text([{ text: title }], 'h1', 'Titolo'))
  for (const p of all) {
    if (p.kind === 'image') {
      const img = ctx.image(p.src)
      if (img)
        add({
          id: newId(),
          type: 'image',
          name: 'Immagine',
          src: img.src,
          alt: img.alt,
          ratio: img.width && img.height ? `${img.width}/${img.height}` : '16/9',
          radius: 'card',
          width: 'fill',
        })
      continue
    }
    if (p.kind === 'button') {
      add({
        id: newId(),
        type: 'button',
        name: 'Pulsante',
        text: p.text,
        href: p.href,
        variant: 'primary',
        width: 'hug',
        padX: 24,
        padY: 14,
        radius: 'btn',
      })
      continue
    }
    if ((p.style === 'h1' || p.style === 'h2') && (current as PageNode | null)?.children?.length) section()
    const style: PageNode['style'] =
      p.style === 'h1'
        ? 'h1'
        : p.style === 'h2'
          ? 'h2'
          : p.style === 'h3' || p.style === 'h4'
            ? 'h3'
            : p.style === 'caption'
              ? 'small'
              : 'body'
    const runs =
      p.style === 'li'
        ? [{ text: '• ' }, ...p.runs]
        : p.style === 'quote'
          ? p.runs.map((r) => ({ ...r, i: true }))
          : p.runs
    add(
      text(
        runs,
        style,
        p.style === 'li'
          ? 'Punto elenco'
          : p.style.startsWith('h')
            ? 'Titolo'
            : p.style === 'quote'
              ? 'Citazione'
              : 'Testo',
      ),
    )
  }
  return sections
}
