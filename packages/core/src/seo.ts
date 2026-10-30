/**
 * Search engines and sharing: the tags of a page's head (with structured data), the sitemap,
 * robots.txt, redirects and the checks shown in the editor. Pure functions, shared by the site and the admin.
 */
import type { Media, Seo } from './fields.ts'
import { type PageNode, textTag } from './page.ts'

/** Kinds of business for structured data: what Google shows next to the site's name. */
export const BUSINESS_TYPES = [
  { value: 'Organization', label: 'Organizzazione' },
  { value: 'LocalBusiness', label: 'Attività locale' },
  { value: 'ProfessionalService', label: 'Studio professionale' },
  { value: 'Store', label: 'Negozio' },
  { value: 'Restaurant', label: 'Ristorante' },
  { value: 'Person', label: 'Persona' },
] as const

/** Structured data a page can declare: Google may show it as a rich result. */
export const SCHEMA_TYPES = [
  { value: '', label: 'Pagina' },
  { value: 'article', label: 'Articolo' },
  { value: 'project', label: 'Progetto o opera' },
  { value: 'service', label: 'Servizio' },
  { value: 'event', label: 'Evento' },
  { value: 'faq', label: 'Domande frequenti' },
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
  /** Account on X, such as "@studiorossi". */
  xHandle?: string
  business?: {
    type?: (typeof BUSINESS_TYPES)[number]['value']
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
  /** Paths search engines should not visit, one per line. */
  disallow?: string[]
  /** Verification codes from Google Search Console and Bing Webmaster Tools. */
  google?: string
  bing?: string
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

/** Every tag of a page's head for search engines and sharing. */
export function pageHead(input: PageHeadInput): HeadTag[] {
  const { seo = {}, site = {}, siteUrl } = input
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
    ...meta({ property: 'og:locale', content: input.locale.replace('-', '_') }),
    ...meta({ property: 'og:image', content: imageUrl }),
    ...meta({ property: 'og:image:alt', content: imageUrl ? image?.alt : undefined }),
    ...meta({ property: 'og:image:width', content: imageUrl && image?.width ? String(image.width) : undefined }),
    ...meta({ property: 'og:image:height', content: imageUrl && image?.height ? String(image.height) : undefined }),
    ...meta({ name: 'twitter:card', content: imageUrl ? 'summary_large_image' : 'summary' }),
    ...meta({ name: 'twitter:site', content: site.xHandle }),
    ...meta({ name: 'google-site-verification', content: input.url === '/' ? site.google : undefined }),
    ...meta({ name: 'msvalidate.01', content: input.url === '/' ? site.bing : undefined }),
  ]
  if (site.favicon?.src) {
    tags.push({ tag: 'link', attrs: { rel: 'icon', href: site.favicon.src } })
    tags.push({ tag: 'link', attrs: { rel: 'apple-touch-icon', href: site.favicon.src } })
  }
  for (const data of structuredData({ ...input, title, description, image, canonical })) {
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
  input: PageHeadInput & { title: string; description?: string; image?: Media; canonical?: string },
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
  const headline = seo.title || input.title
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
  // The trail from the home page, for pages below it.
  const parts = (input.url ?? '').split('/').filter(Boolean)
  if (base && parts.length > 1) {
    out.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: parts.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: i === parts.length - 1 ? headline : p.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase()),
        item: absolute(`/${parts.slice(0, i + 1).join('/')}`, base),
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
  'CCBot',
  'Google-Extended',
  'Applebot-Extended',
  'Bytespider',
  'meta-externalagent',
  'PerplexityBot',
]

/** robots.txt: what crawlers may visit, and where the sitemap is. */
export function robotsTxt(site: SiteSeo, siteUrl?: string | URL): string {
  const lines = ['User-agent: *']
  const disallow = (site.disallow ?? []).map((d) => d.trim()).filter(Boolean)
  lines.push(...(disallow.length ? disallow.map((d) => `Disallow: ${d.startsWith('/') ? d : `/${d}`}`) : ['Allow: /']))
  lines.push('Disallow: /admin/', 'Disallow: /_materialize/')
  if (site.blockAi) for (const bot of AI_CRAWLERS) lines.push('', `User-agent: ${bot}`, 'Disallow: /')
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
      'La pagina è nascosta ai motori di ricerca',
      'Togli “Nascondi” se deve comparire su Google.',
    )

  const title = pageTitle(input)
  if (title.length > 60)
    add('title', 'warning', `Titolo lungo (${title.length} caratteri)`, 'Google ne mostra circa 60.')
  else if (title.length < 15) add('title', 'warning', 'Titolo molto corto', 'Descrivi la pagina in 30–60 caratteri.')
  else add('title', 'ok', 'Titolo di lunghezza giusta')

  const description = seo.description || site.description
  if (!description)
    add('description', 'error', 'Manca la descrizione', 'È il testo sotto al titolo nei risultati di Google.')
  else if (description.length < 70)
    add('description', 'warning', 'Descrizione corta', 'Meglio tra 120 e 160 caratteri.')
  else if (description.length > 160)
    add(
      'description',
      'warning',
      `Descrizione lunga (${description.length} caratteri)`,
      'Google la taglia a circa 160.',
    )
  else add('description', 'ok', 'Descrizione di lunghezza giusta')

  if (input.url && input.url.length > 75)
    add('url', 'warning', 'Indirizzo lungo', 'Indirizzi brevi si leggono e si ricordano meglio.')

  if (input.nodes) {
    let h1 = 0
    let lastLevel = 0
    let skipped: PageNode | null = null
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
          if (level) {
            if (lastLevel && level > lastLevel + 1 && !skipped) skipped = n
            lastLevel = level
          }
          for (const r of n.runs ?? []) checkLink(r.href, n)
        }
        if (n.type === 'image') {
          if (n.src) firstImage = true
          if (n.src && !n.alt?.trim())
            add(
              `alt:${n.id}`,
              'warning',
              `Immagine senza descrizione: ${n.name || 'immagine'}`,
              'Serve a chi non vede e a Google Immagini.',
              n.id,
            )
        }
        if (n.type === 'button' && !n.text?.trim() && !n.submit)
          add(`btn:${n.id}`, 'warning', 'Pulsante senza testo', undefined, n.id)
        if (!n.submit) checkLink(n.href, n)
        if (n.children) walk(n.children)
      }
    }
    walk(input.nodes)
    for (const [path, at] of broken)
      add(
        `link:${path}`,
        'error',
        `Collegamento a una pagina che non esiste: ${path}`,
        at.length > 1 ? `In ${at.length} punti della pagina.` : undefined,
        at[0]?.id,
      )
    if (h1 === 0)
      add('h1', 'error', 'Manca il titolo principale (H1)', 'Dai lo stile “Titolo 1” al titolo della pagina.')
    else if (h1 > 1)
      add(
        'h1',
        'warning',
        `${h1} titoli principali (H1)`,
        'Clicca per selezionare il secondo: se non è il titolo della pagina, in Testo scegli Tag → Paragrafo o H2.',
        (extraH1 as PageNode | null)?.id,
      )
    else add('h1', 'ok', 'Un solo titolo principale (H1)')
    const skip = skipped as PageNode | null
    if (skip)
      add(
        'levels',
        'warning',
        'Livelli dei titoli saltati',
        'Per esempio da Titolo 1 a Titolo 3 senza un Titolo 2.',
        skip.id,
      )
    if (words < 150)
      add('words', 'warning', `Poco testo (${words} parole)`, 'Le pagine con almeno 300 parole si posizionano meglio.')
    else add('words', 'ok', `${words} parole`)
    if (!seo.image && !site.image && !firstImage)
      add('image', 'warning', 'Nessuna immagine per la condivisione', 'Sui social apparirà solo il testo.')
    else add('image', 'ok', 'Immagine per la condivisione')
  }

  const order: Record<CheckLevel, number> = { error: 0, warning: 1, ok: 2 }
  return out.sort((a, b) => order[a.level] - order[b.level])
}
