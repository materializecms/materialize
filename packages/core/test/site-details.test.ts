import { describe, expect, it } from 'vitest'
import { type PageNode, renderSections } from '../src/page.ts'
import { siteDetails } from '../src/seo.ts'

const section = (children: PageNode[]): PageNode[] => [{ id: 's', type: 'frame', children }]

describe('the site details', () => {
  it('come from Impostazioni → Sito, with the address on one line', () => {
    expect(
      siteDetails(
        {
          siteName: 'Studio Rossi',
          description: 'Architettura a Milano',
          business: {
            email: 'ciao@studio.example',
            phone: '+39 02 1234567',
            street: 'Via Roma 1',
            postalCode: '20121',
            city: 'Milano',
            region: 'MI',
          },
        },
        'Il mio sito',
      ),
    ).toEqual({
      name: 'Studio Rossi',
      tagline: 'Architettura a Milano',
      email: 'ciao@studio.example',
      phone: '+39 02 1234567',
      address: 'Via Roma 1, 20121 Milano (MI)',
    })
  })

  it('fall back to the name of the site settings, and leave out what is empty', () => {
    expect(siteDetails({ business: { email: '  ' } }, 'Il mio sito')).toEqual({ name: 'Il mio sito' })
  })
})

describe('an element showing a site detail', () => {
  const site = { email: 'ciao@studio.example', phone: '+39 02 1234567' }

  it('shows its current value, wherever it is', () => {
    const { html } = renderSections(
      section([{ id: 't', type: 'text', text: 'scrivici@…', site: 'email' }]),
      undefined,
      {
        site,
      },
    )
    expect(html).toContain('ciao@studio.example')
    expect(html).not.toContain('scrivici@…')
  })

  it('as a button, writes or calls', () => {
    const { html } = renderSections(
      section([
        { id: 'a', type: 'button', text: 'Email', site: 'email' },
        { id: 'b', type: 'button', text: 'Telefono', site: 'phone' },
      ]),
      undefined,
      { site },
    )
    expect(html).toContain('href="mailto:ciao@studio.example"')
    expect(html).toContain('href="tel:+39021234567"')
  })

  it('keeps its own text when the detail is not filled in', () => {
    const { html } = renderSections(
      section([{ id: 't', type: 'text', text: 'Via Roma 1', site: 'address' }]),
      undefined,
      {
        site,
      },
    )
    expect(html).toContain('Via Roma 1')
  })

  it('ignores a detail Materialize does not know', () => {
    const nodes = section([{ id: 't', type: 'text', text: 'Testo', site: 'password' as never }])
    expect(renderSections(nodes, undefined, { site: { ...site, password: 'x' } as never }).html).toContain('Testo')
  })
})
