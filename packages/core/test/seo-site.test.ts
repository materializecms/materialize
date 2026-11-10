import { describe, expect, it } from 'vitest'
import type { PageNode } from '../src/page.ts'
import { headHtml, ogLocale, pageHead, pageSummary } from '../src/seo.ts'

const site = { siteName: 'Studio Rossi' }
const base = 'https://studiorossi.example'
const ld = (html: string, type: string) =>
  html
    .split('<script type="application/ld+json">')
    .slice(1)
    .map((s) => JSON.parse(s.split('</script>')[0] as string))
    .find((d) => d['@type'] === type)

describe('sharing locale', () => {
  it('adds the territory Facebook wants, keeping one already given', () => {
    expect(ogLocale('it')).toBe('it_IT')
    expect(ogLocale('en')).toBe('en_US')
    expect(ogLocale('pt')).toBe('pt_PT')
    expect(ogLocale('pt-BR')).toBe('pt_BR')
    expect(ogLocale('nl')).toBe('nl')
    const html = headHtml(pageHead({ title: 'Studio', url: '/studio', locale: 'de', site }))
    expect(html).toContain('<meta property="og:locale" content="de_DE">')
  })
})

describe('description from a canvas page', () => {
  const text = (id: string, t: string, extra: Partial<PageNode> = {}): PageNode => ({
    id,
    type: 'text',
    text: t,
    ...extra,
  })
  const long =
    'Progettiamo case e interni che durano nel tempo, con materiali naturali, luce studiata e un cantiere seguito da vicino dal primo schizzo alla consegna delle chiavi.'

  it('takes the first body paragraph, skipping headings, labels, links and menus', () => {
    const nodes: PageNode[] = [
      {
        id: 'nav',
        type: 'frame',
        section: 'nav.simple',
        children: [text('n1', 'Un testo nel menu che è lungo abbastanza da sembrare un paragrafo vero')],
      },
      {
        id: 'hero',
        type: 'frame',
        children: [
          text('e', 'Studio di architettura', { style: 'eyebrow' }),
          text('h', 'Case che durano nel tempo e nella memoria di chi le abita', { style: 'h1' }),
          text('b', 'Scopri i nostri progetti più recenti e i nostri servizi', { href: '/progetti' }),
          text('short', 'Milano, dal 1998'),
          text('p', long),
        ],
      },
    ]
    const summary = pageSummary(nodes) as string
    expect(summary.startsWith('Progettiamo case')).toBe(true)
    expect(summary.length).toBeLessThanOrEqual(160)
    expect(summary.endsWith('…')).toBe(true)
    // Cut on a word.
    expect(long.startsWith(summary.slice(0, -1))).toBe(true)
    expect(long[summary.length - 1]).toBe(' ')
  })

  it('keeps a short paragraph whole and finds nothing on a page of headings', () => {
    expect(pageSummary([text('p', 'Un paragrafo breve ma vero, con abbastanza parole dentro.')])).toBe(
      'Un paragrafo breve ma vero, con abbastanza parole dentro.',
    )
    expect(pageSummary([text('h', 'Solo un titolo grande in questa pagina vuota', { style: 'h2' })])).toBeUndefined()
  })
})

describe('breadcrumbs', () => {
  it('starts at the home page and names this page without the site suffix', () => {
    const html = headHtml(
      pageHead({ title: 'Casa sul lago', url: '/progetti/casa-sul-lago', locale: 'it', site, siteUrl: base }),
    )
    expect(html).toContain('<title>Casa sul lago · Studio Rossi</title>')
    const list = ld(html, 'BreadcrumbList')
    // /progetti is not known to be a page: no crumb for it.
    expect(list.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, name: 'Studio Rossi', item: `${base}/` },
      { '@type': 'ListItem', position: 2, name: 'Casa sul lago', item: `${base}/progetti/casa-sul-lago` },
    ])
  })

  it('includes the pages above when they exist', () => {
    const html = headHtml(
      pageHead({
        title: 'Casa sul lago',
        url: '/progetti/casa-sul-lago',
        locale: 'it',
        site,
        siteUrl: base,
        trail: [
          { name: 'Studio Rossi', url: '/' },
          { name: 'Progetti', url: '/progetti' },
        ],
      }),
    )
    expect(ld(html, 'BreadcrumbList').itemListElement.map((i: { name: string }) => i.name)).toEqual([
      'Studio Rossi',
      'Progetti',
      'Casa sul lago',
    ])
  })

  it('has none on the home page', () => {
    const html = headHtml(pageHead({ title: 'Home', url: '/', locale: 'it', site, siteUrl: base }))
    expect(ld(html, 'BreadcrumbList')).toBeUndefined()
  })
})

describe('posts', () => {
  const post = { title: 'Nuovo studio', url: '/diario/nuovo-studio', locale: 'it', site, siteUrl: base }

  it('are articles by default, with a headline free of the site name', () => {
    const html = headHtml(pageHead({ ...post, article: true, publishedAt: new Date('2026-01-02') }))
    expect(html).toContain('<meta property="og:type" content="article">')
    const article = ld(html, 'Article')
    expect(article.headline).toBe('Nuovo studio')
    expect(article.datePublished).toBe('2026-01-02T00:00:00.000Z')
  })

  it('keep the type chosen in the SEO panel, and other pages stay websites', () => {
    const html = headHtml(
      pageHead({ ...post, article: true, seo: { schema: 'event', event: { start: '2026-03-01' } } }),
    )
    expect(html).toContain('<meta property="og:type" content="website">')
    expect(ld(html, 'Event')).toBeDefined()
    expect(ld(html, 'Article')).toBeUndefined()
    expect(headHtml(pageHead(post))).toContain('<meta property="og:type" content="website">')
  })
})
