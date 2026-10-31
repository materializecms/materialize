import { defineCollection, defineConfig, f } from '@materializecms/core'
import { type Database, openDatabase } from '@materializecms/db'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createApp } from '../src/index.ts'
import { htmlToPage, htmlToRichText, readRest, readWxr, withoutShortcodes } from '../src/wordpress.ts'
import { suggest } from '../src/wpimport.ts'

const config = defineConfig({
  site: { name: 'Studio Rossi' },
  locales: { default: 'it', available: ['it'] },
  collections: [
    defineCollection({
      name: 'pages',
      url: (d) => (d.slug === 'home' ? '/' : `/${d.slug}`),
      fields: { title: f.text({ required: true }), slug: f.slug({ from: 'title' }), page: f.page(), seo: f.seo() },
    }),
    defineCollection({
      name: 'posts',
      url: (d) => `/diario/${d.slug}`,
      fields: {
        title: f.text({ required: true }),
        slug: f.slug({ from: 'title' }),
        excerpt: f.text({ multiline: true, max: 220 }),
        date: f.date({ required: true }),
        category: f.select({
          required: true,
          options: [
            { value: 'design', label: 'Design' },
            { value: 'studio', label: 'Studio' },
          ],
        }),
        cover: f.media(),
        body: f.richText(),
        seo: f.seo(),
      },
    }),
  ],
})

const WXR = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:wp="http://wordpress.org/export/1.2/">
<channel>
  <title>Studio Rossi</title>
  <link>https://studiorossi.example</link>
  <wp:wxr_version>1.2</wp:wxr_version>
  <item>
    <title><![CDATA[Logo]]></title>
    <wp:post_id>9</wp:post_id>
    <wp:post_type><![CDATA[attachment]]></wp:post_type>
    <wp:attachment_url><![CDATA[https://studiorossi.example/wp-content/uploads/logo.png]]></wp:attachment_url>
    <wp:postmeta><wp:meta_key><![CDATA[_wp_attachment_image_alt]]></wp:meta_key><wp:meta_value><![CDATA[Il logo]]></wp:meta_value></wp:postmeta>
  </item>
  <item>
    <title><![CDATA[Un nuovo progetto &amp; altro]]></title>
    <link>https://studiorossi.example/2026/10/nuovo-progetto/</link>
    <dc:creator><![CDATA[mario]]></dc:creator>
    <content:encoded><![CDATA[<!-- wp:paragraph --><p>Ciao <strong>mondo</strong>, leggi <a href="https://studiorossi.example/chi-siamo/">chi siamo</a>.</p><!-- /wp:paragraph -->
<!-- wp:heading --><h2>Il progetto</h2><!-- /wp:heading -->
<!-- wp:image --><figure class="wp-block-image"><img src="https://studiorossi.example/wp-content/uploads/foto-1024x768.jpg" alt="Foto"/></figure><!-- /wp:image -->]]></content:encoded>
    <excerpt:encoded><![CDATA[Il riassunto]]></excerpt:encoded>
    <wp:post_id>12</wp:post_id>
    <wp:post_date_gmt><![CDATA[2026-10-12 09:30:00]]></wp:post_date_gmt>
    <wp:post_name><![CDATA[nuovo-progetto]]></wp:post_name>
    <wp:status><![CDATA[publish]]></wp:status>
    <wp:post_type><![CDATA[post]]></wp:post_type>
    <category domain="category" nicename="design"><![CDATA[Design]]></category>
    <category domain="post_tag" nicename="web"><![CDATA[Web]]></category>
    <wp:postmeta><wp:meta_key><![CDATA[_thumbnail_id]]></wp:meta_key><wp:meta_value><![CDATA[9]]></wp:meta_value></wp:postmeta>
    <wp:postmeta><wp:meta_key><![CDATA[_yoast_wpseo_metadesc]]></wp:meta_key><wp:meta_value><![CDATA[Descrizione per Google]]></wp:meta_value></wp:postmeta>
  </item>
  <item>
    <title><![CDATA[Chi siamo]]></title>
    <link>https://studiorossi.example/chi-siamo/</link>
    <content:encoded><![CDATA[[vc_row][vc_column][vc_column_text]Siamo uno studio.

Lavoriamo a Milano.[/vc_column_text][/vc_column][/vc_row]]]></content:encoded>
    <wp:post_id>14</wp:post_id>
    <wp:post_date_gmt><![CDATA[2026-01-01 10:00:00]]></wp:post_date_gmt>
    <wp:post_name><![CDATA[chi-siamo]]></wp:post_name>
    <wp:status><![CDATA[publish]]></wp:status>
    <wp:post_type><![CDATA[page]]></wp:post_type>
  </item>
  <item>
    <title><![CDATA[Cestinato]]></title>
    <wp:post_id>15</wp:post_id>
    <wp:status><![CDATA[trash]]></wp:status>
    <wp:post_type><![CDATA[post]]></wp:post_type>
  </item>
</channel>
</rss>`

const ctx = { image: (src: string) => ({ src: `/media/${src.split('/').pop()}`, alt: '' }), link: (h: string) => h }

describe('reading WordPress', () => {
  it('reads the export file: posts, pages, images, categories and SEO', () => {
    const site = readWxr(WXR)
    expect(site.name).toBe('Studio Rossi')
    expect(site.items.map((i) => `${i.kind}:${i.slug}`)).toEqual(['post:nuovo-progetto', 'page:chi-siamo'])
    const post = site.items[0]
    expect(post).toMatchObject({
      title: 'Un nuovo progetto & altro',
      status: 'publish',
      date: '2026-10-12T09:30:00.000Z',
      excerpt: 'Il riassunto',
      categories: ['Design'],
      tags: ['Web'],
      author: 'mario',
      featured: { url: 'https://studiorossi.example/wp-content/uploads/logo.png', alt: 'Il logo' },
      seo: { description: 'Descrizione per Google' },
    })
    // Page builders' shortcodes go, their words stay.
    expect(site.items[1]?.html).toContain('Siamo uno studio.')
    expect(site.items[1]?.html).not.toContain('[vc_')
    expect(() => readWxr('<rss></rss>')).toThrow(/esportazione/)
  })

  it('reads the REST API page by page, falling back to published items without rights', async () => {
    const calls: string[] = []
    const json = (body: unknown, pages = 1) => ({
      status: 200,
      headers: new Headers({ 'x-wp-totalpages': String(pages) }),
      text: JSON.stringify(body),
    })
    const post = (id: number) => ({
      id,
      slug: `articolo-${id}`,
      status: 'publish',
      link: `https://blog.example/articolo-${id}/`,
      date_gmt: '2026-10-01T10:00:00',
      title: { rendered: `Articolo &#8220;${id}&#8221;` },
      content: { rendered: '<p>Testo</p>' },
      excerpt: { rendered: '<p>Breve</p>' },
      _embedded: { 'wp:term': [[{ taxonomy: 'category', name: 'Studio' }]] },
    })
    const site = await readRest('https://blog.example/', async (url) => {
      calls.push(url)
      if (url.endsWith('/wp-json/')) return json({ name: 'Blog &amp; co', home: 'https://blog.example' })
      if (url.includes('status=')) return { status: 400, headers: new Headers(), text: '{}' }
      if (url.includes('/posts') && url.includes('page=1&')) return json([post(1), post(2)], 2)
      if (url.includes('/posts') && url.includes('page=2&')) return json([post(3)], 2)
      return json([], 1)
    })
    expect(site.name).toBe('Blog & co')
    expect(site.items.map((i) => i.title)).toEqual(['Articolo “1”', 'Articolo “2”', 'Articolo “3”'])
    expect(site.items[0]).toMatchObject({ categories: ['Studio'], excerpt: 'Breve', date: '2026-10-01T10:00:00.000Z' })
    expect(calls.some((u) => u.includes('page=2'))).toBe(true)
  })
})

describe('converting HTML', () => {
  const html = `<p>Un <strong>testo</strong> con <em>stile</em> e <a href="/x">link</a>.</p>
<h3>Sezione</h3><ul><li>uno</li><li>due</li></ul>
<blockquote><p>Una citazione</p></blockquote>
<div class="wp-block-image"><a href="/foto.jpg"><img data-src="https://s.example/foto.jpg" src="data:image/gif;base64,R0"></a></div>
<div class="wp-block-buttons"><a class="wp-block-button__link" href="/contatti">Contattaci</a></div>
<script>alert(1)</script>`

  it('to rich text, with images and links', () => {
    const rich = htmlToRichText(html, ctx)
    expect(rich.map((b) => b.type)).toEqual([
      'paragraph',
      'heading',
      'listItem',
      'listItem',
      'quote',
      'image',
      'paragraph',
    ])
    expect(rich[0]?.children).toEqual([
      { text: 'Un ' },
      { text: 'testo', bold: true },
      { text: ' con ' },
      { text: 'stile', italic: true },
      { text: ' e ' },
      { text: 'link', href: '/x' },
      { text: '.' },
    ])
    expect(rich[1]).toMatchObject({ level: 3 })
    expect(rich[5]?.image?.src).toBe('/media/foto.jpg')
    expect(JSON.stringify(rich)).not.toContain('alert')
  })

  it('to a canvas page, one section per main title', () => {
    const page = htmlToPage(`<p>Intro</p><h2>Servizi</h2><p>Web</p>${html}`, 'Chi siamo', ctx)
    expect(page).toHaveLength(2)
    expect(page[0]?.children?.map((n) => n.text)).toEqual(['Chi siamo', 'Intro'])
    expect(page[1]?.children?.[0]).toMatchObject({ type: 'text', text: 'Servizi', style: 'h2' })
    expect(page[1]?.children?.some((n) => n.type === 'image' && n.src === '/media/foto.jpg')).toBe(true)
    expect(page[1]?.children?.some((n) => n.type === 'button' && n.text === 'Contattaci')).toBe(true)
  })

  it('keeps plain text written between page builder blocks', () => {
    expect(withoutShortcodes('[et_pb_text]Prima riga\nseconda[/et_pb_text]')).toBe('<p>Prima riga<br>seconda</p>')
  })
})

describe('importing', () => {
  let database: Database
  let app: ReturnType<typeof createApp>
  let cookie = ''
  const call = async (method: string, path: string, json?: unknown, form?: FormData) => {
    const res = await app.request(path, {
      method,
      headers: { origin: 'http://localhost', ...(json ? { 'content-type': 'application/json' } : {}), cookie },
      body: form ?? (json ? JSON.stringify(json) : undefined),
    })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0] ?? ''
    const text = await res.text()
    return { status: res.status, body: text ? JSON.parse(text) : null }
  }

  beforeEach(async () => {
    database = await openDatabase({ url: ':memory:' })
    app = createApp({ config: () => config, database })
    cookie = ''
    await call('POST', '/api/setup', { email: 'elena@example.com', name: 'Elena', password: 'una-password-lunga' })
  })
  afterEach(() => database.close())

  it('suggests where things go', () => {
    expect(suggest(config.collections, 'post')).toEqual({
      collection: 'posts',
      fields: {
        title: 'title',
        slug: 'slug',
        excerpt: 'excerpt',
        date: 'date',
        category: 'categories',
        cover: 'featured',
        body: 'content',
        seo: 'seo',
      },
    })
    expect(suggest(config.collections, 'page')?.fields).toMatchObject({ page: 'content', seo: 'seo' })
  })

  it('imports the export file: documents, links to the new pages and redirects', async () => {
    const form = new FormData()
    form.set('file', new File([WXR], 'export.xml', { type: 'text/xml' }))
    const analyzed = await call('POST', '/api/import/wordpress/analyze', undefined, form)
    expect(analyzed.body).toMatchObject({ counts: { posts: 1, pages: 1 }, categories: ['Design'] })
    const { token, suggestions } = analyzed.body
    const started = await call('POST', '/api/import/wordpress/run', {
      token,
      plan: { posts: suggestions.posts, pages: suggestions.pages, publish: true, redirects: true },
    })
    expect(started.status).toBe(202)
    let job = (await call('GET', `/api/import/jobs/${started.body.job}`)).body
    for (let i = 0; i < 100 && job.phase !== 'done' && job.phase !== 'failed'; i++) {
      await new Promise((r) => setTimeout(r, 50))
      job = (await call('GET', `/api/import/jobs/${started.body.job}`)).body
    }
    expect(job.phase).toBe('done')
    expect(job.created.map((d: { title: string }) => d.title).sort()).toEqual([
      'Chi siamo',
      'Un nuovo progetto & altro',
    ])
    // The images could not be downloaded here: the post is still in, as a draft if incomplete.
    const posts = (await call('GET', '/api/collections/posts')).body.items
    const post = (await call('GET', `/api/documents/${posts[0].id}`)).body
    expect(post.data).toMatchObject({ category: 'design', date: '2026-10-12', excerpt: 'Il riassunto' })
    expect(post.data.seo).toMatchObject({ description: 'Descrizione per Google' })
    // The link to the old "chi siamo" now points to the new page.
    expect(JSON.stringify(post.data.body)).toContain('"href":"/chi-siamo"')
    const redirects = (await call('GET', '/api/redirects')).body.redirects
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: '/2026/10/nuovo-progetto', to: '/diario/nuovo-progetto' }),
      ]),
    )

    // A second run finds them already there.
    const again = await call('POST', '/api/import/wordpress/run', {
      token,
      plan: { posts: suggestions.posts, pages: null, publish: false, redirects: false },
    })
    let second = (await call('GET', `/api/import/jobs/${again.body.job}`)).body
    for (let i = 0; i < 100 && second.phase !== 'done'; i++) {
      await new Promise((r) => setTimeout(r, 50))
      second = (await call('GET', `/api/import/jobs/${again.body.job}`)).body
    }
    expect(second.skipped).toHaveLength(1)
  })
})

describe('import plan', () => {
  it('gives a second page with the same address a suffix, and skips what was already there', async () => {
    const { runImport } = await import('../src/wpimport.ts')
    const page = (id: string, slug: string, title: string) => ({
      sourceId: id,
      kind: 'page' as const,
      title,
      slug,
      status: 'publish' as const,
      date: '2026-01-01T00:00:00.000Z',
      link: `https://s.example/${id}/${slug}/`,
      html: '<p>Testo</p>',
      excerpt: '',
      categories: [],
      tags: [],
    })
    const site = {
      name: 'S',
      url: 'https://s.example',
      items: [page('a', 'servizi', 'Servizi A'), page('b', 'servizi', 'Servizi B'), page('c', 'contatti', 'Contatti')],
    }
    const created: string[] = []
    const result = await runImport(
      site,
      {
        posts: null,
        pages: { collection: 'pages', fields: { title: 'title', slug: 'slug', page: 'content' } },
        publish: false,
        redirects: false,
        locale: 'it',
      },
      {
        collections: config.collections,
        saveImage: async () => ({ error: 'no' }),
        fetchPage: async () => null,
        exists: async (_c, slug) => slug === 'contatti',
        titles: async () => new Map(),
        create: async (_def, data) => {
          created.push(String(data.slug))
          return { id: String(created.length), title: String(data.title), url: `/${data.slug}` }
        },
        publish: async () => {},
        urlOf: (_d, data) => `/${data.slug}`,
        addRedirects: async () => 0,
        onProgress: () => {},
      },
    )
    expect(created).toEqual(['servizi', 'servizi-2'])
    expect(result.problems[0]?.reason).toContain('/servizi-2')
    expect(result.skipped.map((s) => s.title)).toEqual(['Contatti'])
  })
})
