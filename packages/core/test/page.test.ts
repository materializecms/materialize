import { describe, expect, it } from 'vitest'
import { buildSection, LIBRARY } from '../src/library.ts'
import { DEFAULT_THEME, findNode, renderPage, renderSections, updateNode } from '../src/page.ts'

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
