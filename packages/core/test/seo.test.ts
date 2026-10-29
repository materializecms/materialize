import { describe, expect, it } from 'vitest'
import { type PageNode, sameDesign } from '../src/page.ts'
import { addMove, headHtml, pageChecks, pageHead, resolveRedirect, robotsTxt, sitemapXml } from '../src/seo.ts'

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
  it('finds missing alt texts, broken links and a missing description', () => {
    const checks = pageChecks({ title: 'Una pagina di prova', url: '/', nodes, knownUrls: ['/'] })
    const ids = checks.filter((c) => c.level !== 'ok').map((c) => c.id)
    expect(ids).toContain('description')
    expect(ids).toContain('alt:i')
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
