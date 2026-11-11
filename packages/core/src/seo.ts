/**
 * Search engines and sharing: the tags of a page's head (with structured data), the sitemap,
 * robots.txt, redirects and the checks shown in the editor. Pure functions, shared by the site and the admin.
 */
import type { Media, Seo } from './fields.ts'
import { type PageNode, type SiteDetails, textTag } from './page.ts'
import { t } from './t.ts'

/** Kinds of business for structured data: what Google shows next to the site's name. */
export const businessTypes = () =>
  [
    { value: 'Organization', label: t('Organizzazione') },
    { value: 'LocalBusiness', label: t('Attività locale') },
    { value: 'ProfessionalService', label: t('Studio professionale') },
    { value: 'Store', label: t('Negozio') },
    { value: 'Restaurant', label: t('Ristorante') },
    { value: 'Person', label: t('Persona') },
  ] as const

export type BusinessType = ReturnType<typeof businessTypes>[number]['value']

/** Structured data a page can declare: Google may show it as a rich result. */
export const schemaTypes = () =>
  [
    { value: '', label: t('Pagina') },
    { value: 'article', label: t('Articolo') },
    { value: 'project', label: t('Progetto o opera') },
    { value: 'service', label: t('Servizio') },
    { value: 'event', label: t('Evento') },
    { value: 'faq', label: t('Domande frequenti') },
  ] as const

/** Site-wide settings for search engines and sharing, kept in the "seo" setting. */
export interface SiteSeo {
  siteName?: string
  /** "%s" is the page title: "%s · Studio Rossi". */
  titleTemplate?: string
  /** Used by pages without their own description. */
  description?: string
  /** Shared image for pages without their own. */
  image?: Media
  favicon?: Media
  /** Account on X, such as "@nomeaccount". */
  xHandle?: string
  business?: {
    type?: BusinessType
    name?: string
    logo?: Media
    phone?: string
    email?: string
    street?: string
    city?: string
    postalCode?: string
    region?: string
    country?: string
    /** Such as "Mo-Fr 09:00-18:00". */
    hours?: string
    /** Profiles on other sites: Instagram, LinkedIn… */
    sameAs?: string[]
  }
  /** Keeps AI crawlers (GPTBot, CCBot…) from reading the site to train models. */
  blockAi?: boolean
  /** false: no llms.txt and no Markdown copies of the pages for AI search and assistants. */
  llms?: boolean
  /** Collections in /rss.xml; unset, every collection with pages and a date field, empty for no feed. */
  feed?: string[]
  /** Paths search engines should not visit, one per line. */
  disallow?: string[]
  /** Verification codes from Google Search Console and Bing Webmaster Tools. */
  google?: string
  bing?: string
}

/** What the site's sections can show of Impostazioni → Sito: name, contacts, address, hours. */
export function siteDetails(seo: SiteSeo, name?: string): SiteDetails {
  const b = seo.business ?? {}
  const place = [b.postalCode, b.city].filter(Boolean).join(' ')
  const address = [b.street, [place, b.region ? `(${b.region})` : ''].filter(Boolean).join(' ')]
    .filter(Boolean)
    .join(', ')
  const out: SiteDetails = {
    name: seo.siteName || name,
    tagline: seo.description,
    email: b.email,
    phone: b.phone,
    address,
    hours: b.hours,
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => typeof v === 'string' && v.trim())) as SiteDetails
}

/** A permanent redirect: an old address that now lives elsewhere. */
export interface Redirect {
  from: string
  to: string
  /** Added by Materialize when a page's address changed. */
  auto?: boolean
}

export interface HeadTag {
  tag: 'title' | 'meta' | 'link' | 'script'
  attrs: Record<string, string>
  content?: string
}

export interface PageHeadInput {
  /** Title of the document, used when the SEO title is empty. */
  title: string
  /** Path of the page, such as "/progetti/casa-sul-lago". */
  url: string | null
  locale: string
  seo?: Seo
  site?: SiteSeo
  /** Absolute address of the site ("https://…"), needed for canonical, sharing and structured data. */
  siteUrl?: string | URL
  /** The same page in other languages. */
  alternates?: { locale: string; url: string }[]
  defaultLocale?: string
  publishedAt?: Date | null
  updatedAt?: Date | null
  /** Description from the page itself (an excerpt) when the SEO one is empty. */
  description?: string
  /** First image of the page, when no sharing image is set. */
  image?: Media
  /** Path of the site's RSS feed, announced on every page. */
  feed?: string
  /** Path of the page's Markdown copy, for AI assistants. */
  markdown?: string
  /**
   * The published pages above this one, from the home page down (names without the site's
   * suffix): the breadcrumb trail. Unset, the trail is the home page and this page, since an
   * address such as /progetti may not exist as a page.
   */
  trail?: { name: string; url: string }[]
  /** A dated entry of a collection of posts: an article for sharing and structured data, unless its SEO says otherwise. */
  article?: boolean
}

const absolute = (path: string, base?: string | URL) => {
  if (/^https?:\/\//.test(path)) return path
  return base ? new URL(path, base).href : path
}

/** The title shown in the browser tab and on Google. */
export function pageTitle(input: Pick<PageHeadInput, 'title' | 'url' | 'seo' | 'site'>): string {
  if (input.seo?.title) return input.seo.title
  const name = input.site?.siteName
  if (input.url === '/' && name) return name
  const template = input.site?.titleTemplate || (name ? `%s · ${name}` : '%s')
  return template.replace('%s', input.title)
}

/** Languages whose sharing locale is not simply the code twice (en → en_US, not en_EN). */
const TERRITORIES: Record<string, string> = { it: 'IT', en: 'US', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT' }

/** og:locale wants language_TERRITORY (it_IT): Facebook ignores a bare "it". */
export function ogLocale(locale: string): string {
  if (/[-_]/.test(locale)) return locale.replace('-', '_')
  const territory = TERRITORIES[locale.toLowerCase()]
  return territory ? `${locale.toLowerCase()}_${territory}` : locale
}

/**
 * The first real paragraph of a canvas page, cut to about 160 characters on a word: the
 * description of a page that has none. Body text only: headings, labels, buttons, menus and
 * footers say little about the page.
 */
export function pageSummary(nodes: PageNode[], max = 160): string | undefined {
  let found: string | undefined
  const walk = (list: PageNode[]) => {
    for (const n of list) {
      if (found) return
      if (n.hidden) continue
      if (n.section?.startsWith('nav') || n.section?.startsWith('footer')) continue
      if (n.type === 'text' && !n.href && (n.style ?? 'body') === 'body' && textTag(n) === 'p') {
        const text = (n.runs?.map((r) => r.t).join('') ?? n.text ?? '').replace(/\s+/g, ' ').trim()
        // A few words are a label or a caption, not what the page is about.
        if (text.length >= 40 && text.split(' ').length >= 6) found = text
      }
      if (n.children) walk(n.children)
    }
  }
  walk(nodes)
  return found === undefined ? undefined : clip(found, max)
}

/** Cut on a word, with an ellipsis, so search results do not end mid-word. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–—-]+$/, '')}…`
}

/** Every tag of a page's head for search engines and sharing. */
export function pageHead(input: PageHeadInput): HeadTag[] {
  const { site = {}, siteUrl } = input
  // Posts are articles by default; the SEO panel's choice wins.
  const seo: Seo = input.article && !input.seo?.schema ? { ...input.seo, schema: 'article' } : (input.seo ?? {})
  const base = siteUrl ? String(siteUrl) : undefined
  const title = pageTitle(input)
  const description = seo.description || input.description || site.description
  const image = seo.image ?? input.image ?? site.image
  const canonical = seo.canonical
    ? absolute(seo.canonical, base)
    : input.url && base
      ? absolute(input.url, base)
      : undefined
  const meta = (attrs: Record<string, string | undefined>): HeadTag[] =>
    Object.values(attrs).every((v) => v !== undefined && v !== '')
      ? [{ tag: 'meta', attrs: attrs as Record<string, string> }]
      : []
  const robots = [seo.noindex && 'noindex', seo.nofollow && 'nofollow'].filter(Boolean).join(', ')
  const shareTitle = seo.socialTitle || title
  const shareDescription = seo.socialDescription || description
  const imageUrl = image?.src ? absolute(image.src, base) : undefined

  const tags: HeadTag[] = [
    { tag: 'title', attrs: {}, content: title },
    ...meta({ name: 'description', content: description }),
    ...meta({ name: 'robots', content: robots || undefined }),
    ...(canonical && !seo.noindex ? [{ tag: 'link' as const, attrs: { rel: 'canonical', href: canonical } }] : []),
    ...(input.alternates && input.alternates.length > 1 && base
      ? [
          ...input.alternates.map((a) => ({
            tag: 'link' as const,
            attrs: { rel: 'alternate', hreflang: a.locale, href: absolute(a.url, base) },
          })),
          ...input.alternates
            .filter((a) => a.locale === input.defaultLocale)
            .map((a) => ({
              tag: 'link' as const,
              attrs: { rel: 'alternate', hreflang: 'x-default', href: absolute(a.url, base) },
            })),
        ]
      : []),
    ...meta({ property: 'og:type', content: seo.schema === 'article' ? 'article' : 'website' }),
    ...meta({ property: 'og:title', content: shareTitle }),
    ...meta({ property: 'og:description', content: shareDescription }),
    ...meta({ property: 'og:url', content: canonical }),
    ...meta({ property: 'og:site_name', content: site.siteName }),
    ...meta({ property: 'og:locale', content: ogLocale(input.locale) }),
    ...meta({ property: 'og:image', content: imageUrl }),
    ...meta({ property: 'og:image:alt', content: imageUrl ? image?.alt : undefined }),
    ...meta({ property: 'og:image:width', content: imageUrl && image?.width ? String(image.width) : undefined }),
    ...meta({ property: 'og:image:height', content: imageUrl && image?.height ? String(image.height) : undefined }),
    ...meta({ name: 'twitter:card', content: imageUrl ? 'summary_large_image' : 'summary' }),
    ...meta({ name: 'twitter:site', content: site.xHandle }),
    ...meta({ name: 'google-site-verification', content: input.url === '/' ? site.google : undefined }),
    ...meta({ name: 'msvalidate.01', content: input.url === '/' ? site.bing : undefined }),
  ]
  if (input.feed)
    tags.push({
      tag: 'link',
      attrs: { rel: 'alternate', type: 'application/rss+xml', title: site.siteName || 'RSS', href: input.feed },
    })
  if (input.markdown && !seo.noindex)
    tags.push({ tag: 'link', attrs: { rel: 'alternate', type: 'text/markdown', href: input.markdown } })
  if (site.favicon?.src) {
    tags.push({ tag: 'link', attrs: { rel: 'icon', href: site.favicon.src } })
    tags.push({ tag: 'link', attrs: { rel: 'apple-touch-icon', href: site.favicon.src } })
  }
  for (const data of structuredData({ ...input, seo, name: input.title, title, description, image, canonical })) {
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, content: JSON.stringify(data) })
  }
  return tags
}

type Json = Record<string, unknown>

/** Drops empty values, so the JSON-LD only says what is known. */
function clean<T extends Json>(o: T): T {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)),
  ) as T
}

/** The business behind the site, as schema.org data. */
export function businessData(site: SiteSeo, siteUrl?: string): Json | null {
  const b = site.business
  const name = b?.name || site.siteName
  if (!name) return null
  const type = b?.type || 'Organization'
  const address =
    b?.street || b?.city
      ? clean({
          '@type': 'PostalAddress',
          streetAddress: b.street,
          addressLocality: b.city,
          postalCode: b.postalCode,
          addressRegion: b.region,
          addressCountry: b.country,
        })
      : undefined
  return clean({
    '@type': type,
    '@id': siteUrl ? `${absolute('/', siteUrl)}#org` : undefined,
    name,
    url: siteUrl ? absolute('/', siteUrl) : undefined,
    logo: b?.logo?.src ? absolute(b.logo.src, siteUrl) : undefined,
    image:
      type !== 'Organization' && type !== 'Person' && site.image?.src ? absolute(site.image.src, siteUrl) : undefined,
    telephone: b?.phone,
    email: b?.email,
    address,
    openingHours: type !== 'Organization' && type !== 'Person' ? b?.hours : undefined,
    sameAs: b?.sameAs?.filter(Boolean),
  })
}

function structuredData(
  input: PageHeadInput & { name: string; title: string; description?: string; image?: Media; canonical?: string },
): Json[] {
  const { seo = {}, site = {} } = input
  const base = input.siteUrl ? String(input.siteUrl) : undefined
  const out: Json[] = []
  const org = businessData(site, base)
  const publisher = org ? { '@id': org['@id'] ?? undefined, '@type': org['@type'], name: org.name } : undefined
  // The business once, on the home page; other pages point to it.
  if (input.url === '/' && org) {
    out.push({ '@context': 'https://schema.org', ...org })
    if (base)
      out.push(
        clean({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: site.siteName || org.name,
          url: absolute('/', base),
          inLanguage: input.locale,
        }),
      )
  }
  const image = input.image?.src ? absolute(input.image.src, base) : undefined
  // The page's own title: the one in the tab ends with the site's name.
  const headline = seo.title || input.name
  const common = clean({
    '@context': 'https://schema.org',
    url: input.canonical,
    inLanguage: input.locale,
    description: input.description,
    image,
  })
  switch (seo.schema) {
    case 'article':
      out.push(
        clean({
          ...common,
          '@type': 'Article',
          headline: headline.slice(0, 110),
          datePublished: input.publishedAt?.toISOString(),
          dateModified: (input.updatedAt ?? input.publishedAt)?.toISOString(),
          author: publisher,
          publisher,
        }),
      )
      break
    case 'project':
      out.push(clean({ ...common, '@type': 'CreativeWork', name: headline, creator: publisher }))
      break
    case 'service':
      out.push(
        clean({ ...common, '@type': 'Service', name: headline, provider: publisher, areaServed: site.business?.city }),
      )
      break
    case 'event': {
      const e = seo.event
      if (!e?.start) break
      out.push(
        clean({
          ...common,
          '@type': 'Event',
          name: headline,
          startDate: e.start,
          endDate: e.end,
          eventAttendanceMode: e.online
            ? 'https://schema.org/OnlineEventAttendanceMode'
            : 'https://schema.org/OfflineEventAttendanceMode',
          location: e.online
            ? clean({ '@type': 'VirtualLocation', url: input.canonical })
            : e.place
              ? clean({ '@type': 'Place', name: e.place, address: e.address })
              : undefined,
          organizer: publisher,
          offers:
            e.price !== undefined && e.price !== ''
              ? clean({
                  '@type': 'Offer',
                  price: e.price,
                  priceCurrency: 'EUR',
                  url: input.canonical,
                  availability: 'https://schema.org/InStock',
                })
              : undefined,
        }),
      )
      break
    }
    case 'faq': {
      const items = (seo.faq ?? []).filter((f) => f.q && f.a)
      if (items.length)
        out.push({
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        })
      break
    }
  }
  // The trail from the home page, for pages below it: only addresses that are real pages, and
  // this page's own title, never the one with the site's name after it.
  if (base && input.url && input.url !== '/') {
    const trail = (input.trail ?? [{ name: site.siteName || 'Home', url: '/' }]).filter((c) => c.url !== input.url)
    const items = [...trail, { name: seo.title || input.name, url: input.url }]
    if (items.length > 1)
      out.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((c, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: c.name,
          item: absolute(c.url, base),
        })),
      })
  }
  return out
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
const escapeText = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

/** The tags as HTML, for the page's head. */
export function headHtml(tags: HeadTag[]): string {
  return tags
    .map((t) => {
      const attrs = Object.entries(t.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join('')
      if (t.tag === 'meta' || t.tag === 'link') return `<${t.tag}${attrs}>`
      // JSON-LD: "</script>" inside a value must not end the script.
      const body = t.tag === 'script' ? (t.content ?? '').replace(/</g, '\\u003c') : escapeText(t.content ?? '')
      return `<${t.tag}${attrs}>${body}</${t.tag}>`
    })
    .join('\n')
}

export interface SitemapPage {
  url: string
  updatedAt?: Date | null
  alternates?: { locale: string; url: string }[]
}

/** sitemap.xml: every page search engines may index, with its other languages. */
export function sitemapXml(pages: SitemapPage[], siteUrl: string | URL): string {
  const base = String(siteUrl)
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  const items = pages.map((p) => {
    const alts =
      p.alternates && p.alternates.length > 1
        ? p.alternates.map(
            (a) => `\n    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${esc(absolute(a.url, base))}"/>`,
          )
        : []
    const lastmod = p.updatedAt ? `\n    <lastmod>${p.updatedAt.toISOString().slice(0, 10)}</lastmod>` : ''
    return `  <url>\n    <loc>${esc(absolute(p.url, base))}</loc>${lastmod}${alts.join('')}\n  </url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${items.join('\n')}\n</urlset>\n`
}

/** Crawlers that collect pages to train AI models, not to send visitors. */
export const AI_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
  'cohere-training-data-crawler',
]

/**
 * Crawlers of AI search and assistants, which read a page to answer someone and link to it:
 * never blocked by `blockAi`, like Google and Bing.
 */
export const AI_SEARCH_CRAWLERS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot']

/** robots.txt: what crawlers may visit, and where the sitemap is. */
export function robotsTxt(site: SiteSeo, siteUrl?: string | URL): string {
  const lines = ['User-agent: *']
  const disallow = (site.disallow ?? []).map((d) => d.trim()).filter(Boolean)
  lines.push(...(disallow.length ? disallow.map((d) => `Disallow: ${d.startsWith('/') ? d : `/${d}`}`) : ['Allow: /']))
  lines.push('Disallow: /admin/', 'Disallow: /_materialize/')
  if (site.blockAi) for (const bot of AI_CRAWLERS) lines.push('', `User-agent: ${bot}`, 'Disallow: /')
  if (site.blockAi) for (const bot of AI_SEARCH_CRAWLERS) lines.push('', `User-agent: ${bot}`, 'Allow: /')
  if (siteUrl) lines.push('', `Sitemap: ${absolute('/sitemap.xml', String(siteUrl))}`)
  return `${lines.join('\n')}\n`
}

/** A path as stored in a redirect: leading slash, no trailing one, no host. */
export function normalizePath(path: string): string {
  const p =
    path
      .trim()
      .replace(/^https?:\/\/[^/]+/, '')
      .split(/[?#]/)[0] ?? ''
  return `/${p.replace(/^\/+|\/+$/g, '')}`
}

/** Where an address redirects to, following chains (a → b → c) without looping. */
export function resolveRedirect(redirects: Redirect[], path: string): string | null {
  const map = new Map(redirects.map((r) => [normalizePath(r.from), r.to]))
  let at = normalizePath(path)
  const seen = new Set<string>()
  let to: string | null = null
  while (map.has(at) && !seen.has(at)) {
    seen.add(at)
    to = map.get(at) as string
    if (/^https?:\/\//.test(to)) break
    at = normalizePath(to)
  }
  return to
}

/**
 * A page moved from one address to another: the redirect list with old → new added, earlier
 * redirects to the old address pointed at the new one, and none left that would loop.
 */
export function addMove(redirects: Redirect[], from: string, to: string): Redirect[] {
  const a = normalizePath(from)
  const b = normalizePath(to)
  if (a === b) return redirects
  const kept = redirects
    .filter((r) => normalizePath(r.from) !== a && normalizePath(r.from) !== b)
    .map((r) => (normalizePath(r.to) === a ? { ...r, to: b } : r))
  return [...kept, { from: a, to: b, auto: true }]
}

export type CheckLevel = 'error' | 'warning' | 'ok'
export interface SeoCheck {
  id: string
  level: CheckLevel
  label: string
  detail?: string
  /** The element to select to fix it. */
  nodeId?: string
}

export interface CheckInput {
  title: string
  url: string | null
  seo?: Seo
  site?: SiteSeo
  /** A page built on the canvas, with components and shared sections expanded. */
  nodes?: PageNode[]
  /** Every address on the site (published pages and redirects), to find broken links. */
  knownUrls?: string[]
}

const HEADINGS: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4 }

/** What a page still lacks for search engines and sharing, worst first: shown in the editor. */
export function pageChecks(input: CheckInput): SeoCheck[] {
  const { seo = {}, site = {} } = input
  const out: SeoCheck[] = []
  const add = (id: string, level: CheckLevel, label: string, detail?: string, nodeId?: string) =>
    out.push({ id, level, label, detail, nodeId })

  if (seo.noindex)
    add(
      'noindex',
      'warning',
      t('La pagina è nascosta ai motori di ricerca'),
      t('Togli “Nascondi” se deve comparire su Google.'),
    )

  const title = pageTitle(input)
  if (title.length > 60)
    add('title', 'warning', t('Titolo lungo ({n} caratteri)', { n: title.length }), t('Google ne mostra circa 60.'))
  else if (title.length < 15)
    add('title', 'warning', t('Titolo molto corto'), t('Descrivi la pagina in 30–60 caratteri.'))
  else add('title', 'ok', t('Titolo di lunghezza giusta'))

  const description = seo.description || site.description
  if (!description)
    add('description', 'error', t('Manca la descrizione'), t('È il testo sotto al titolo nei risultati di Google.'))
  else if (description.length < 70)
    add('description', 'warning', t('Descrizione corta'), t('Meglio tra 120 e 160 caratteri.'))
  else if (description.length > 160)
    add(
      'description',
      'warning',
      t('Descrizione lunga ({n} caratteri)', { n: description.length }),
      t('Google la taglia a circa 160.'),
    )
  else add('description', 'ok', t('Descrizione di lunghezza giusta'))

  if (input.url && input.url.length > 75)
    add('url', 'warning', t('Indirizzo lungo'), t('Indirizzi brevi si leggono e si ricordano meglio.'))

  if (input.nodes) {
    let h1 = 0
    let extraH1: PageNode | null = null
    let words = 0
    let firstImage = false
    const known = input.knownUrls ? new Set(input.knownUrls.map(normalizePath)) : null
    // Broken links grouped by address: the same missing page linked six times is one problem.
    const broken = new Map<string, PageNode[]>()
    const checkLink = (href: string | undefined, node: PageNode) => {
      if (!known || !href?.startsWith('/') || href.startsWith('//') || href.startsWith('/media/')) return
      if (href.startsWith('/api/') || href.startsWith('/#')) return
      const path = normalizePath(href)
      if (!known.has(path)) broken.set(path, [...(broken.get(path) ?? []), node])
    }
    const walk = (list: PageNode[]) => {
      for (const n of list) {
        if (n.hidden) continue
        if (n.type === 'text') {
          const level = HEADINGS[textTag(n)] ?? 0
          const text = n.runs?.map((r) => r.t).join('') ?? n.text ?? ''
          words += text.split(/\s+/).filter(Boolean).length
          if (level === 1) {
            h1++
            if (h1 === 2) extraH1 = n
          }
          for (const r of n.runs ?? []) checkLink(r.href, n)
        }
        if (n.type === 'image' && n.src) firstImage = true
        if (!n.submit) checkLink(n.href, n)
        if (n.children) walk(n.children)
      }
    }
    walk(input.nodes)
    for (const [path, at] of broken)
      add(
        `link:${path}`,
        'error',
        t('Collegamento a una pagina che non esiste: {path}', { path }),
        at.length > 1 ? t('In {n} punti della pagina.', { n: at.length }) : undefined,
        at[0]?.id,
      )
    if (h1 === 0)
      add('h1', 'error', t('Manca il titolo principale (H1)'), t('Dai lo stile “Titolo 1” al titolo della pagina.'))
    else if (h1 > 1)
      add(
        'h1',
        'warning',
        t('{n} titoli principali (H1)', { n: h1 }),
        t('Clicca per selezionare il secondo: se non è il titolo della pagina, in Testo scegli Tag → Paragrafo o H2.'),
        (extraH1 as PageNode | null)?.id,
      )
    else add('h1', 'ok', t('Un solo titolo principale (H1)'))
    if (words < 150)
      add(
        'words',
        'warning',
        t.n(words, 'Poco testo ({n} parola)', 'Poco testo ({n} parole)'),
        t('Le pagine con almeno 300 parole si posizionano meglio.'),
      )
    else add('words', 'ok', t('{n} parole', { n: words }))
    if (!seo.image && !site.image && !firstImage)
      add('image', 'warning', t('Nessuna immagine per la condivisione'), t('Sui social apparirà solo il testo.'))
    else add('image', 'ok', t('Immagine per la condivisione'))
  }

  const order: Record<CheckLevel, number> = { error: 0, warning: 1, ok: 2 }
  return out.sort((a, b) => order[a.level] - order[b.level])
}

// ---------- feeds and AI search ----------

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export interface FeedItem {
  title: string
  url: string
  date: Date
  description?: string
  image?: Media
}

/** RSS 2.0, newest first: for feed readers, newsletters that read feeds, and AI search. */
export function rssXml(input: {
  title: string
  description?: string
  siteUrl: string | URL
  language: string
  items: FeedItem[]
}): string {
  const base = String(input.siteUrl)
  const items = [...input.items]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((i) => {
      const link = absolute(i.url, base)
      const image = i.image?.src ? absolute(i.image.src, base) : null
      return [
        '    <item>',
        `      <title>${xml(i.title)}</title>`,
        `      <link>${xml(link)}</link>`,
        `      <guid isPermaLink="true">${xml(link)}</guid>`,
        `      <pubDate>${i.date.toUTCString()}</pubDate>`,
        i.description ? `      <description>${xml(i.description)}</description>` : '',
        image ? `      <enclosure url="${xml(image)}" type="${mimeOf(image)}" length="0"/>` : '',
        '    </item>',
      ]
        .filter(Boolean)
        .join('\n')
    })
  const self = absolute('/rss.xml', base)
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${xml(input.title)}</title>
    <link>${xml(absolute('/', base))}</link>
    <description>${xml(input.description || input.title)}</description>
    <language>${xml(input.language)}</language>
    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>
${items.join('\n')}
  </channel>
</rss>
`
}

const mimeOf = (src: string) => {
  const ext = src.split('?')[0]?.split('.').pop()?.toLowerCase()
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'avif' ? 'image/avif' : 'image/jpeg'
}

/**
 * The collections in the RSS feed: the chosen ones, or by default every collection with pages,
 * several documents and a date (articles, news, events).
 */
export function feedCollections(
  collections: readonly { name: string; singleton: boolean; url?: unknown; fields: Record<string, { kind: string }> }[],
  chosen?: string[],
): string[] {
  const eligible = collections.filter((c) => c.url && !c.singleton)
  if (chosen) return eligible.filter((c) => chosen.includes(c.name)).map((c) => c.name)
  return eligible.filter((c) => Object.values(c.fields).some((f) => f.kind === 'date')).map((c) => c.name)
}

/** Where a page's Markdown copy lives: /diario/articolo → /diario/articolo.md, the home page → /index.md. */
export const markdownPath = (url: string) => (url === '/' || url === '' ? '/index.md' : `${url.replace(/\/+$/, '')}.md`)

export interface LlmsSection {
  title: string
  items: { title: string; url: string; description?: string }[]
}

/**
 * llms.txt (llmstxt.org): what the site is and its pages, in Markdown, so an AI assistant finds
 * the right page without reading the whole site. Links point to each page's Markdown copy.
 */
export function llmsTxt(input: {
  name: string
  description?: string
  details?: string[]
  siteUrl: string | URL
  sections: LlmsSection[]
}): string {
  const base = String(input.siteUrl)
  const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim()
  const out = [`# ${oneLine(input.name)}`, '']
  if (input.description) out.push(`> ${oneLine(input.description)}`, '')
  if (input.details?.length) out.push(...input.details.map((d) => `- ${oneLine(d)}`), '')
  for (const section of input.sections) {
    if (!section.items.length) continue
    out.push(`## ${oneLine(section.title)}`, '')
    for (const i of section.items) {
      const link = `[${oneLine(i.title).replace(/[[\]]/g, '')}](${absolute(markdownPath(i.url), base)})`
      out.push(`- ${link}${i.description ? `: ${oneLine(i.description)}` : ''}`)
    }
    out.push('')
  }
  return `${out.join('\n').trimEnd()}\n`
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  laquo: '«',
  raquo: '»',
  middot: '·',
  copy: '©',
}
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(n) ? String.fromCodePoint(n) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })

/** Elements whose content is not the page's text: menus, footers, code, things hidden from readers. */
const SKIP = new Set([
  'script',
  'style',
  'svg',
  'noscript',
  'template',
  'iframe',
  'form',
  'nav',
  'footer',
  'button',
  'select',
  'video',
  'audio',
  'canvas',
  'dialog',
  'head',
])
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])
const BLOCK = new Set([
  'p',
  'div',
  'section',
  'article',
  'main',
  'header',
  'aside',
  'figure',
  'figcaption',
  'ul',
  'ol',
  'table',
  'tr',
  'blockquote',
  'pre',
  'dl',
  'dt',
  'dd',
  'details',
  'summary',
])

const attr = (attrs: string, name: string) => {
  const m = attrs.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null
}

/**
 * A rendered page as Markdown, for AI assistants: the main content (menus, footers, scripts and
 * hidden copies left out), with headings, lists, links and image descriptions.
 */
export function htmlToMarkdown(html: string, baseUrl?: string | URL): string {
  const main =
    html.match(/<main\b[^>]*>([\s\S]*)<\/main>/i)?.[1] ?? html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html
  const base = baseUrl ? String(baseUrl) : undefined
  const full = (href: string) => (base && href.startsWith('/') ? absolute(href, base) : href)
  let out = ''
  let skip = 0
  let pre = 0
  const stack: { name: string; skip: boolean }[] = []
  const links: { start: number; href: string | null }[] = []
  const lists: { ordered: boolean; n: number }[] = []
  const marks: { start: number; sign: string }[] = []
  const block = (prefix = '') => {
    out = out.replace(/[ \t]+$/, '')
    if (out && !out.endsWith('\n\n')) out += out.endsWith('\n') ? '\n' : '\n\n'
    out += prefix
  }
  const close = (name: string) => {
    if (name === 'a') {
      const link = links.pop()
      if (!link) return
      const label = out.slice(link.start).trim()
      out = out.slice(0, link.start)
      const real = link.href && !link.href.startsWith('#') && !/^(javascript|mailto|tel):/i.test(link.href)
      out += label && real && link.href ? `[${label.replace(/\n+/g, ' ')}](${full(link.href)})` : label
    } else if (name === 'strong' || name === 'b' || name === 'em' || name === 'i') {
      const mark = marks.pop()
      if (!mark) return
      const inside = out.slice(mark.start)
      // Nothing in it: no marks either.
      if (!inside.trim()) out = out.slice(0, mark.start - mark.sign.length) + inside
      else out = `${out.replace(/[ \t]+$/, '')}${mark.sign}`
    } else if (name === 'ul' || name === 'ol') {
      lists.pop()
      block()
    } else if (name === 'pre') {
      pre--
      out += '\n```'
      block()
    } else if (name === 'li') {
      out = out.replace(/[ \t]+$/, '')
      if (!out.endsWith('\n')) out += '\n'
    } else if (/^h[1-6]$/.test(name) || BLOCK.has(name)) block()
  }
  const token = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>|([^<]+)/g
  for (const m of main.matchAll(token)) {
    const [, closing, rawName, attrs = '', text] = m
    if (text !== undefined) {
      if (skip) continue
      const t = decode(text)
      out += pre
        ? t
        : t.replace(/\s+/g, ' ').replace(/^ /, /[\s([]$|^$/.test(out) || marks.at(-1)?.start === out.length ? '' : ' ')
      continue
    }
    if (!rawName) continue
    const name = rawName.toLowerCase()
    if (closing) {
      // Closes up to the matching element: forgiving with HTML that leaves some open.
      let at = stack.length - 1
      while (at >= 0 && stack[at]?.name !== name) at--
      if (at === -1) continue
      for (const open of stack.splice(at).reverse()) {
        if (open.skip) skip--
        else if (!skip) close(open.name)
      }
      continue
    }
    if (VOID.has(name) || attrs.trim().endsWith('/')) {
      if (skip) continue
      if (name === 'br') out += '\n'
      else if (name === 'hr') block('---\n\n')
      else if (name === 'img') {
        const alt = attr(attrs, 'alt')?.trim()
        const src = attr(attrs, 'src')
        if (alt && src) out += `![${alt.replace(/[[\]]/g, '')}](${full(src)})`
      }
      continue
    }
    const hidden =
      /\saria-hidden\s*=\s*["']?true/i.test(attrs) ||
      /\shidden(\s|=|$)/i.test(attrs) ||
      // A canvas page's navigation section.
      (name === 'header' && /\sclass\s*=\s*["'][^"']*\bmz-n\b/.test(attrs))
    if (skip || SKIP.has(name) || hidden) {
      stack.push({ name, skip: true })
      skip++
      continue
    }
    stack.push({ name, skip: false })
    if (/^h[1-6]$/.test(name)) block(`${'#'.repeat(Number(name[1]))} `)
    else if (name === 'li') {
      const list = lists.at(-1)
      out = out.replace(/[ \t]+$/, '')
      if (out && !out.endsWith('\n')) out += '\n'
      out += `${'  '.repeat(Math.max(0, lists.length - 1))}${list?.ordered ? `${++list.n}.` : '-'} `
    } else if (name === 'ul' || name === 'ol') {
      if (!lists.length) block()
      lists.push({ ordered: name === 'ol', n: 0 })
    } else if (name === 'blockquote') block('> ')
    else if (name === 'pre') {
      block('```\n')
      pre++
    } else if (name === 'a') {
      // Buttons side by side are links with no space between them.
      if (/[^\s([«"'“]$/.test(out)) out += ' '
      links.push({ start: out.length, href: attr(attrs, 'href') })
    } else if (name === 'strong' || name === 'b' || name === 'em' || name === 'i') {
      const sign = name === 'strong' || name === 'b' ? '**' : '*'
      out += sign
      marks.push({ start: out.length, sign })
    } else if (BLOCK.has(name)) block()
  }
  return `${out
    .replace(/^(#{1,6}|-|\d+\.) *\n/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()}\n`
}
