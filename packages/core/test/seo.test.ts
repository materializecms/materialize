import { describe, expect, it } from 'vitest'
import { type PageNode, sameDesign } from '../src/page.ts'
import {
  addMove,
  feedCollections,
  headHtml,
  htmlToMarkdown,
  llmsTxt,
  markdownPath,
  pageChecks,
  pageHead,
  resolveRedirect,
  robotsTxt,
  rssXml,
  sitemapXml,
} from '../src/seo.ts'

describe('page head', () => {
  const site = { siteName: 'Studio Rossi', business: { type: 'LocalBusiness' as const, city: 'Milano' } }

  it('builds title, canonical, sharing and structured data', () => {
    const html = headHtml(
      pageHead({
        title: 'Casa sul lago',
        url: '/progetti/casa-sul-lago',
        locale: 'it',
        site,
        siteUrl: 'https://studiorossi.example',
        seo: { description: 'Una casa', socialTitle: 'Guarda', schema: 'article' },
      }),
    )
    expect(html).toContain('<title>Casa sul lago · Studio Rossi</title>')
    expect(html).toContain('<link rel="canonical" href="https://studiorossi.example/progetti/casa-sul-lago">')
    expect(html).toContain('<meta property="og:title" content="Guarda">')
    expect(html).toContain('"@type":"Article"')
    expect(html).toContain('"@type":"BreadcrumbList"')
  })

  it('declares the business on the home page only, and never lets JSON close the script', () => {
    const home = headHtml(pageHead({ title: 'Home', url: '/', locale: 'it', site, siteUrl: 'https://a.example' }))
    expect(home).toContain('"@type":"LocalBusiness"')
    expect(home).toContain('<title>Studio Rossi</title>')
    const faq = headHtml(
      pageHead({ title: 'FAQ', url: '/faq', locale: 'it', seo: { schema: 'faq', faq: [{ q: '</script>', a: 'x' }] } }),
    )
    expect(faq).not.toContain('</script><')
    expect(faq).toContain('\\u003c/script>')
  })

  it('hides from search engines and links languages', () => {
    const tags = pageHead({
      title: 'X',
      url: '/x',
      locale: 'it',
      siteUrl: 'https://a.example',
      seo: { noindex: true, nofollow: true },
      alternates: [
        { locale: 'it', url: '/x' },
        { locale: 'en', url: '/en/x' },
      ],
      defaultLocale: 'it',
    })
    const html = headHtml(tags)
    expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
    expect(html).not.toContain('rel="canonical"')
    expect(html).toContain('hreflang="en" href="https://a.example/en/x"')
    expect(html).toContain('hreflang="x-default" href="https://a.example/x"')
  })
})

describe('sitemap and robots', () => {
  it('lists pages with their languages', () => {
    const xml = sitemapXml(
      [
        {
          url: '/',
          updatedAt: new Date('2026-01-02'),
          alternates: [
            { locale: 'it', url: '/' },
            { locale: 'en', url: '/en' },
          ],
        },
      ],
      'https://a.example',
    )
    expect(xml).toContain('<loc>https://a.example/</loc>')
    expect(xml).toContain('<lastmod>2026-01-02</lastmod>')
    expect(xml).toContain('hreflang="en"')
  })

  it('blocks AI crawlers on request', () => {
    const txt = robotsTxt({ blockAi: true, disallow: ['privato'] }, 'https://a.example')
    expect(txt).toContain('Disallow: /privato')
    expect(txt).toContain('User-agent: GPTBot\nDisallow: /')
    // AI search sends visitors, like Google: it stays allowed.
    expect(txt).toContain('User-agent: PerplexityBot\nAllow: /')
    expect(txt).toContain('User-agent: OAI-SearchBot\nAllow: /')
    expect(txt).toContain('Sitemap: https://a.example/sitemap.xml')
  })
})

describe('redirects', () => {
  it('follows chains and never loops', () => {
    let list = addMove([], '/a', '/b')
    list = addMove(list, '/b', '/c')
    expect(resolveRedirect(list, '/a/')).toBe('/c')
    expect(resolveRedirect(list, '/b')).toBe('/c')
    // Moving back to an old address frees it.
    list = addMove(list, '/c', '/a')
    expect(resolveRedirect(list, '/a')).toBeNull()
    expect(resolveRedirect(list, '/c')).toBe('/a')
    expect(
      resolveRedirect(
        [
          { from: '/x', to: '/y' },
          { from: '/y', to: '/x' },
        ],
        '/x',
      ),
    ).toBe('/x')
  })
})

describe('checks', () => {
  const nodes: PageNode[] = [
    {
      id: 's',
      type: 'frame',
      children: [
        { id: 't', type: 'text', style: 'h1', text: 'Ciao' },
        { id: 'i', type: 'image', src: '/media/a.jpg' },
        { id: 'b', type: 'button', text: 'Vai', href: '/manca' },
      ],
    },
  ]
  it('finds broken links and a missing description (alt texts are in the accessibility checks)', () => {
    const checks = pageChecks({ title: 'Una pagina di prova', url: '/', nodes, knownUrls: ['/'] })
    const ids = checks.filter((c) => c.level !== 'ok').map((c) => c.id)
    expect(ids).toContain('description')
    expect(ids).not.toContain('alt:i')
    expect(ids).toContain('link:/manca')
    expect(checks.find((c) => c.id === 'h1')?.level).toBe('ok')
  })

  it('tells content changes from design changes', () => {
    const edited = structuredClone(nodes)
    ;(edited[0]?.children?.[0] as PageNode).text = 'Salve'
    expect(sameDesign(nodes, edited)).toBe(true)
    ;(edited[0]?.children?.[0] as PageNode).style = 'h2'
    expect(sameDesign(nodes, edited)).toBe(false)
  })
})

describe('feeds and AI search', () => {
  it('writes an RSS feed, newest first, with escaped text', () => {
    const xml = rssXml({
      title: 'Studio Rossi',
      siteUrl: 'https://a.example',
      language: 'it',
      items: [
        { title: 'Vecchio', url: '/diario/vecchio', date: new Date('2026-01-02') },
        {
          title: 'Luce & ombra',
          url: '/diario/luce',
          date: new Date('2026-03-04'),
          description: 'Case <calde>',
          image: { src: '/media/luce.webp', alt: 'Luce' },
        },
      ],
    })
    expect(xml.indexOf('Luce &amp; ombra')).toBeLessThan(xml.indexOf('Vecchio'))
    expect(xml).toContain('<link>https://a.example/diario/luce</link>')
    expect(xml).toContain('<description>Case &lt;calde&gt;</description>')
    expect(xml).toContain('url="https://a.example/media/luce.webp" type="image/webp"')
    expect(xml).toContain('href="https://a.example/rss.xml" rel="self"')
  })

  it('puts dated collections with pages in the feed, or the chosen ones', () => {
    const collections: { name: string; singleton: boolean; url?: boolean; fields: Record<string, { kind: string }> }[] =
      [
        { name: 'pages', singleton: false, url: true, fields: { title: { kind: 'text' } } },
        { name: 'posts', singleton: false, url: true, fields: { date: { kind: 'date' } } },
        { name: 'news', singleton: false, fields: { date: { kind: 'date' } } },
      ]
    expect(feedCollections(collections)).toEqual(['posts'])
    expect(feedCollections(collections, ['pages', 'news'])).toEqual(['pages'])
    expect(feedCollections(collections, [])).toEqual([])
  })

  it('lists the pages in llms.txt, linking their Markdown copies', () => {
    const txt = llmsTxt({
      name: 'Studio Rossi',
      description: 'Architettura a Milano',
      details: ['Telefono: 02 123'],
      siteUrl: 'https://a.example',
      sections: [
        {
          title: 'Pagine',
          items: [
            { title: 'Home', url: '/' },
            { title: 'Chi siamo', url: '/chi-siamo', description: 'Lo studio' },
          ],
        },
        { title: 'Vuota', items: [] },
      ],
    })
    expect(txt).toBe(
      '# Studio Rossi\n\n> Architettura a Milano\n\n- Telefono: 02 123\n\n## Pagine\n\n' +
        '- [Home](https://a.example/index.md)\n- [Chi siamo](https://a.example/chi-siamo.md): Lo studio\n',
    )
    expect(markdownPath('/diario/luce/')).toBe('/diario/luce.md')
  })

  it('turns a page into Markdown without menus, footers, forms or hidden copies', () => {
    const html = `<html><head><title>x</title><style>p{}</style></head><body>
      <header class="mz-n n-1"><a href="/">Logo</a><a href="#lavori">Lavori</a></header>
      <main><h1>Casa sul <em>lago</em></h1>
      <p>Un progetto di <strong>luce</strong> e <a href="/progetti">legno</a>, 2026.</p>
      <div aria-hidden="true"><p>copia del nastro</p></div>
      <ul><li>Uno</li><li>Due <a href="#x">ancora</a></li></ul>
      <img src="/media/casa.jpg" alt="La casa al tramonto"><img src="/deco.svg" alt="">
      <a href="#contatti">Inizia</a><a href="/lavori">Guarda i lavori</a>
      <form><label>Nome</label><input name="n"></form>
      <script>alert(1)</script></main>
      <footer>© Studio</footer></body></html>`
    expect(htmlToMarkdown(html, 'https://a.example')).toBe(
      [
        '# Casa sul *lago*',
        '',
        'Un progetto di **luce** e [legno](https://a.example/progetti), 2026.',
        '',
        '- Uno',
        '- Due ancora',
        '',
        '![La casa al tramonto](https://a.example/media/casa.jpg) Inizia [Guarda i lavori](https://a.example/lavori)',
        '',
      ].join('\n'),
    )
  })
})
