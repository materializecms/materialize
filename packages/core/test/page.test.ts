import { describe, expect, it } from 'vitest'
import { buildSection, LIBRARY } from '../src/library.ts'
import {
  collapseComponents,
  collapseGlobals,
  cssLength,
  DEFAULT_THEME,
  detachComponent,
  expandComponents,
  expandGlobals,
  findNode,
  makeComponent,
  type PageNode,
  renderPage,
  renderSections,
  updateNode,
} from '../src/page.ts'

const all = LIBRARY.flatMap((c) => c.variants.map((v) => v.key))

describe('library', () => {
  it('builds every variant with unique ids', () => {
    expect(all.length).toBeGreaterThanOrEqual(100)
    const ids = new Set<string>()
    for (const key of all) {
      const section = buildSection(key, 'Studio Rossi')
      expect(section.section).toBe(key)
      // Every listed variant has its own design, none falls back to the empty section.
      expect(section.name, key).not.toBe('Sezione')
      const stack = [section]
      while (stack.length) {
        const n = stack.pop()
        if (!n) break
        expect(ids.has(n.id)).toBe(false)
        ids.add(n.id)
        stack.push(...(n.children ?? []))
      }
    }
  })
})

describe('renderSections', () => {
  const sections = all.map((k) => buildSection(k))
  const { html, css } = renderSections(sections, DEFAULT_THEME)

  it('renders html and css without gaps', () => {
    expect(html).not.toMatch(/undefined|NaN|\[object/)
    expect(css).not.toMatch(/undefined|NaN/)
    expect(css).toContain('@container mzpage (max-width:1023px)')
    expect(css).toContain('@container mzpage (max-width:639px)')
  })

  it('keeps a single h1 on the page', () => {
    expect(html.match(/<h1 /g)?.length).toBe(1)
  })

  it('animates on scroll only where supported, and never for reduced motion', () => {
    expect(css).toContain('@supports (animation-timeline:view())')
    expect(css).toMatch(/@media \(prefers-reduced-motion:no-preference\)\{[^@]*animation:mz/)
    expect(renderSections(sections, DEFAULT_THEME, { animations: 'none' }).css).not.toMatch(/animation:mz/)
  })

  it('escapes text and refuses script links', () => {
    const hero = buildSection('hero.split')
    const title = hero.children?.[0]?.children?.[1]
    if (!title) throw new Error('missing title')
    const evil = updateNode([hero], title.id, (n) => ({ ...n, text: '<script>x</script>' }))
    const button = findNode(evil, hero.children?.[0]?.children?.[3]?.children?.[0]?.id)
    if (!button) throw new Error('missing button')
    const out = renderPage(
      updateNode(evil, button.node.id, (n) => ({ ...n, href: 'javascript:alert(1)' })),
      DEFAULT_THEME,
    )
    expect(out.html).toContain('&lt;script&gt;')
    expect(out.html).not.toContain('javascript:')
    expect(out.html.startsWith('<div class="mz-page"')).toBe(true)
  })
})

describe('motion in the renderer', () => {
  it('writes interactions for the runtime and repeats marquee content', () => {
    const strip = buildSection('logos.row')
    const row = strip.children?.[1]
    if (!row) throw new Error('missing row')
    const page = updateNode([strip], row.id, (n) => ({
      ...n,
      marquee: { duration: 20 },
      interactions: [{ id: 'i1', trigger: 'scroll', from: { x: 100 }, to: { x: -100 } }],
    }))
    const { html, css } = renderPage(page, { ...DEFAULT_THEME, transition: 'fade', smoothScroll: true })
    expect(html).toContain('data-mz-motion="[{&quot;id&quot;:&quot;i1&quot;')
    expect(html).toContain('class="mz-track"')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('data-mz-smooth')
    expect(css).toContain('animation:mzMarquee 20s linear infinite')
    expect(css).toContain('@view-transition{navigation:auto}')
    // The editor never adds page transitions to its own document.
    expect(renderPage(page, { ...DEFAULT_THEME, transition: 'fade' }, { editor: true }).css).not.toContain(
      '@view-transition',
    )
  })
})

describe('globals and bound lists', () => {
  it('shares a section between pages through a reference', () => {
    const nav = { ...buildSection('nav.classic'), global: 'g1' }
    const { nodes, globals } = collapseGlobals([nav])
    expect(nodes[0]).toMatchObject({ id: nav.id, global: 'g1' })
    expect(nodes[0]?.children).toBeUndefined()
    expect(expandGlobals(nodes, globals)[0]?.children?.length).toBe(nav.children?.length)
  })

  it('repeats the template for every entry with its fields', () => {
    const list = {
      ...buildSection('gallery.grid'),
    }
    const grid = list.children?.[1]
    const card = grid?.children?.[0]
    if (!grid || !card) throw new Error('missing grid')
    const bound = updateNode([list], grid.id, (g) => ({
      ...g,
      bind: { collection: 'projects' },
      children: [
        {
          ...card,
          field: 'url',
          children: card.children?.map((ch) =>
            ch.type === 'image' ? { ...ch, field: 'cover' } : ch.name === 'Titolo' ? { ...ch, field: 'title' } : ch,
          ),
        },
      ],
    }))
    const { html } = renderPage(bound, DEFAULT_THEME, {
      data: {
        projects: [
          { title: 'Casa sul lago', url: '/progetti/casa', data: { cover: { src: '/media/a.jpg', alt: 'Lago' } } },
          { title: 'Loft <Navigli>', url: '/progetti/loft', data: {} },
        ],
      },
    })
    expect(html).toContain('href="/progetti/casa"')
    expect(html).toContain('src="/media/a.jpg"')
    expect(html).toContain('Loft &lt;Navigli&gt;')
  })
})

describe('components', () => {
  it('shares design between copies and keeps each copy content', () => {
    const card = buildSection('features.cards').children?.[1]?.children?.[0]
    if (!card) throw new Error('missing card')
    const { component, ref } = makeComponent(card, 'Scheda')
    const comps = { [component.id]: component }
    const a = { ...ref, id: 'a' }
    const b = { ...ref, id: 'b' }
    const page = expandComponents([a, b], comps)
    const titleId = component.variants[0]?.node.children?.[1]?.id as string
    // Copy b gets its own title; copy a gets a new background (design): every copy follows.
    let edited = updateNode(page, `b~${titleId}`, (n) => ({ ...n, text: 'Solo B' }))
    edited = updateNode(edited, 'a', (n) => ({ ...n, bg: 'accent' }))
    const out = collapseComponents(edited, comps)
    expect(out.nodes[1]?.overrides?.[titleId]?.text).toBe('Solo B')
    expect(out.nodes[0]?.overrides).toBeUndefined()
    expect(out.components[component.id]?.variants[0]?.node.bg).toBe('accent')
    const again = expandComponents(out.nodes, out.components)
    expect(findNode(again, `a~${titleId}`)?.node.text).not.toBe('Solo B')
    expect(findNode(again, `b~${titleId}`)?.node.text).toBe('Solo B')
    expect(again[0]?.bg).toBe('accent')
    expect(detachComponent(again[1] as PageNode).component).toBeUndefined()
  })
})

describe('lengths', () => {
  it('keeps pixels as numbers and other units as written', () => {
    expect(cssLength(24)).toBe('24px')
    expect(cssLength('50%')).toBe('50%')
    expect(cssLength('1.5rem')).toBe('1.5rem')
    expect(cssLength('12vw')).toBe('12cqw')
    expect(cssLength('100vh')).toBe('100svh')
    expect(cssLength('10px;color:red', 'auto')).toBe('auto')
  })
})
