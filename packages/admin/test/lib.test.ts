import type { FieldDescription, RichText } from '@materialize/core'
import { describe, expect, it } from 'vitest'
import { clean, getIn, move, setIn } from '../src/lib/doc.ts'
import { fromTiptap, toTiptap } from '../src/lib/richtext.ts'

const field = (
  name: string,
  kind: FieldDescription['kind'],
  extra: Partial<FieldDescription> = {},
): FieldDescription => ({
  name,
  kind,
  label: name,
  required: false,
  localized: false,
  options: {},
  ...extra,
})

describe('rich text', () => {
  it('round-trips through the Tiptap document model', () => {
    const value: RichText = [
      { type: 'heading', level: 2, children: [{ text: 'Lo studio' }] },
      { type: 'paragraph', children: [{ text: 'Luce ' }, { text: 'naturale', bold: true }, { text: ' e materia.' }] },
      { type: 'listItem', children: [{ text: 'Residenze' }] },
      { type: 'listItem', children: [{ text: 'Interni', href: '/interni' }] },
      { type: 'quote', children: [{ text: 'Meno, ma meglio.', italic: true }] },
    ]
    const doc = toTiptap(value)
    expect(doc.content?.map((n) => n.type)).toEqual(['heading', 'paragraph', 'bulletList', 'blockquote'])
    expect(fromTiptap(doc)).toEqual(value)
  })

  it('treats an editor with one empty paragraph as empty', () => {
    expect(fromTiptap(toTiptap([]))).toEqual([])
  })
})

describe('document helpers', () => {
  it('sets nested values immutably', () => {
    const data = { blocks: [{ _key: 'a', title: 'Uno' }] }
    const next = setIn(data, ['blocks', 0, 'title'], 'Due')
    expect(getIn(next, ['blocks', 0, 'title'])).toBe('Due')
    expect(data.blocks[0]?.title).toBe('Uno')
    expect(move(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
  })

  it('drops values the schema would reject before saving', () => {
    const fields = [
      field('title', 'text', { required: true }),
      field('subtitle', 'text'),
      field('image', 'media'),
      field('cta', 'link'),
      field('year', 'number'),
      field('seo', 'seo'),
    ]
    expect(
      clean(fields, {
        title: 'Casa sul lago',
        subtitle: '',
        image: { src: '', alt: '' },
        cta: { href: '', label: 'Scopri' },
        year: Number.NaN,
        seo: { title: '', noindex: false },
        stale: 'campo rimosso dallo schema',
      }),
    ).toEqual({ title: 'Casa sul lago' })
  })
})
