import { describe, expect, it } from 'vitest'
import { sanitizeSvg } from '../src/icons.ts'
import { type Component, expandComponents, type PageNode, renderPage, renderSections, safeHref } from '../src/page.ts'

/** Saved pages are written by editors, an AI or an import: nothing in them may become markup or script. */
describe('saved pages render safely', () => {
  const html = (nodes: unknown[]) => {
    const out = renderPage(nodes as PageNode[])
    return `${out.html}<style>${out.css}</style>`
  }

  it('keeps element names to the ones the editor offers', () => {
    const out = html([{ id: 'a', type: 'text', text: 'x', tag: 'img src=x onerror=alert(1) x' }])
    expect(out).not.toContain('onerror')
    expect(out).toContain('<p')
    expect(html([{ id: 'b', type: 'text', text: 'Titolo', tag: 'h2' }])).toContain('<h2')
  })

  it('never renders rich text taken from the saved page', () => {
    expect(html([{ id: 'a', type: 'text', text: 'x', rich: '<img src=x onerror=alert(2)>' }])).not.toContain('alert(2)')
  })

  it('escapes the hover effect and drops unknown ones', () => {
    expect(html([{ id: 'a', type: 'frame', children: [], hover: 'x" onmouseover="alert(3)' }])).not.toContain(
      'onmouseover',
    )
  })

  it('keeps CSS values inside their declaration and the <style> element', () => {
    const out = html([
      { id: 'a', type: 'frame', children: [], overflow: 'x}</style><script>alert(4)</script>' },
      { id: 'b', type: 'image', src: '/a.jpg', focal: { x: '1;}</style><script>alert(5)</script>', y: 2 } },
    ])
    expect(out).not.toContain('<script>')
    expect(out).not.toContain('</style><')
  })

  it('lets a component copy change its content only', () => {
    const components: Record<string, Component> = {
      card: {
        id: 'card',
        name: 'Card',
        variants: [
          {
            id: 'v',
            name: 'V',
            node: { id: 'root', type: 'frame', children: [{ id: 't1', type: 'text', text: 'Ciao' }] } as PageNode,
          },
        ],
      },
    }
    const [copy] = expandComponents(
      [
        {
          id: 'n',
          type: 'frame',
          component: 'card',
          overrides: { t1: { text: 'Salve', type: 'embed', html: '<script>x</script>', form: { to: 'a@b.c' } } },
        } as unknown as PageNode,
      ],
      components,
    )
    const child = copy?.children?.[0] as PageNode & { html?: string; form?: unknown }
    expect(child.text).toBe('Salve')
    expect(child.type).toBe('text')
    expect(child.html).toBeUndefined()
    expect(child.form).toBeUndefined()
  })
})

describe('custom SVG', () => {
  it('drops scripts, handlers, links and animation, however they are written', () => {
    const tricks = [
      '<svg><script>alert(1)</script ><path d="M0 0"/></svg>',
      '<svg><animate onbegin=alert(1) attributeName=x dur=1s /></svg>',
      '<svg><a href=javascript&colon;alert(1)><rect width=1 height=1/></a></svg>',
      '<svg><set attributeName="href" to="jav&#x61;script:alert(1)"/></svg>',
      '<svg><rect fill="url(javascript:alert(1))" onclick="x"/><image href="x" onerror="alert(1)"/></svg>',
      '<svg><style>*{}</style><foreignObject><div onclick=1></div></foreignObject></svg>',
    ]
    for (const t of tricks)
      expect(sanitizeSvg(t)).not.toMatch(/alert|script|onclick|onbegin|onerror|href|style|animate|<set/i)
  })

  it('keeps a real drawing as it is', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs><g fill="url(#g)"><path d="M12 2L2 22h20z" stroke-width="2"/><circle cx="12" cy="12" r="3"/></g></svg>'
    expect(sanitizeSvg(svg)).toBe(svg)
    expect(sanitizeSvg('not an svg')).toBe('')
  })
})

describe('values written straight into the page', () => {
  const sec = (children: PageNode[]): PageNode[] => [{ id: 's', type: 'frame', children }]
  it('cannot open attributes, styles or scripts', () => {
    const { html } = renderSections(
      sec([
        { id: 'i', type: 'input', text: 'x', inputKind: 'x" autofocus onfocus="alert(1)' as never },
        { id: 'f', type: 'frame', bgImage: { src: '/m.jpg', alt: '' }, bgDim: '1)}</style><script>alert(2)' as never },
        { id: 'm', type: 'frame', marquee: { duration: '1s}body{display:none' as never }, children: [] },
        { id: 'l', type: 'input', text: 'f', inputKind: 'file', accept: 'nope' as never },
      ]),
    )
    expect(html).not.toMatch(/onfocus|alert|display:none/)
    expect(html).toContain('type="text"')
  })

  it('links: no javascript, however it is written', () => {
    for (const h of [
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      '\u0001javascript:alert(1)',
      ' JavaScript:x',
      'data:text/html,x',
    ])
      expect(safeHref(h)).toBe('#')
    for (const h of ['/chi-siamo', 'https://example.com', 'mailto:a@example.com', 'tel:+39', '#sezione', 'pagina'])
      expect(safeHref(h)).toBe(h)
  })
})
