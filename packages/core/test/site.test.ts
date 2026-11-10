import { describe, expect, it } from 'vitest'
import { type PageNode, renderPage } from '../src/page.ts'

const site = (nodes: unknown[], options = {}) => renderPage(nodes as PageNode[], undefined, options).html

describe('what visitors get', () => {
  it('shows nothing where the editor shows an empty picture or video', () => {
    const nodes = [
      {
        id: 's',
        type: 'frame',
        children: [
          { id: 'i', type: 'image', src: null },
          { id: 'v', type: 'video', src: null },
        ],
      },
    ]
    expect(site(nodes)).not.toContain('mz-ph')
    expect(renderPage(nodes as PageNode[], undefined, { editor: true }).html).toContain('mz-ph')
  })

  it('sends links to sections that are not on the page to the home page, and leaves the others', () => {
    const html = site(
      [
        {
          id: 'm',
          type: 'frame',
          children: [{ id: 't', type: 'text', text: 'x', runs: [{ t: 'Servizi', href: '#servizi' }] }],
        },
        {
          id: 'a',
          type: 'frame',
          anchor: 'qui',
          children: [
            { id: 'u', type: 'button', text: 'Qui', href: '#qui' },
            { id: 'c', type: 'button', text: 'Cookie', href: '#preferenze-cookie' },
          ],
        },
      ],
      { home: '/en/' },
    )
    expect(html).toContain('href="/en/#servizi"')
    expect(html).toContain('href="#qui"')
    expect(html).toContain('href="#preferenze-cookie"')
  })

  it('opens with a skip link when the page starts with a menu, in the page’s language', () => {
    const nodes = [
      { id: 'm', type: 'frame', sticky: true, children: [] },
      { id: 'h', type: 'frame', children: [{ id: 't', type: 'text', text: 'Ciao', style: 'h1' }] },
    ]
    const it = site(nodes)
    expect(it).toContain('class="mz-skip" href="#mz-contenuto">Vai al contenuto')
    expect(it).toContain('id="mz-contenuto"')
    expect(site(nodes, { locale: 'en' })).toContain('>Skip to content</a>')
    expect(site([{ id: 'h', type: 'frame', children: [] }])).not.toContain('mz-skip')
  })

  it('names the menu button in the page’s language', () => {
    const nodes = [{ id: 'm', type: 'frame', mobileMenu: true, children: [] }]
    expect(site(nodes, { locale: 'en' })).toContain('aria-label="Open the menu"')
    expect(site(nodes)).toContain('aria-label="Apri il menu"')
  })

  it('keeps decorative scenes away from screen readers', () => {
    expect(site([{ id: 's', type: 'scene', name: 'Scena WebGL', scene: { preset: 'mesh' } }])).toContain(
      'aria-hidden="true"',
    )
    expect(site([{ id: 's', type: 'scene', alt: 'Onde', scene: { preset: 'mesh' } }])).toContain('aria-label="Onde"')
  })

  it('tells the browser how wide images are, and loads the first one at once', () => {
    const html = renderPage(
      [
        {
          id: 'g',
          type: 'frame',
          layout: 'grid',
          cols: 3,
          children: [
            { id: 'a', type: 'image', src: '/media/a.jpg' },
            { id: 'b', type: 'image', src: '/media/b.jpg' },
          ],
        },
      ] as PageNode[],
      undefined,
      { srcset: () => '/media/a.jpg@640.webp 640w' },
    ).html
    expect(html).toContain('sizes="(max-width: 640px) 100vw, 34vw"')
    expect(html).toContain('fetchpriority="high"')
    expect(html.match(/loading="lazy"/g)).toHaveLength(1)
  })
})
