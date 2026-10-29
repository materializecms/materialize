import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  defineBlock,
  defineCollection,
  defineConfig,
  describeCollection,
  f,
  type InferCollection,
  MaterializeConfigError,
  prepare,
  slugify,
  titleOf,
  validate,
} from '../src/index.ts'

const hero = defineBlock({
  name: 'hero',
  fields: {
    title: f.text({ required: true, max: 80 }),
    image: f.media(),
  },
})

const gallery = defineBlock({
  name: 'gallery',
  fields: { images: f.array(f.media(), { min: 1 }) },
})

const pages = defineCollection({
  name: 'pages',
  localized: true,
  url: (doc) => `/${doc.slug}`,
  fields: {
    title: f.text({ required: true }),
    slug: f.slug({ from: 'title' }),
    status: f.select({ options: ['bozza', 'pronta'] }),
    blocks: f.blocks([hero, gallery]),
    seo: f.seo(),
  },
})

describe('slugify', () => {
  it('normalises accents, spaces and symbols', () => {
    expect(slugify('Casa sul Lago — Como!')).toBe('casa-sul-lago-como')
    expect(slugify('Perché è così?')).toBe('perche-e-cosi')
    expect(slugify('   ')).toBe('')
  })
})

describe('collections', () => {
  it('infers document types from the schema', () => {
    type Page = InferCollection<typeof pages>
    expectTypeOf<Page['title']>().toEqualTypeOf<string>()
    expectTypeOf<Page['status']>().toEqualTypeOf<'bozza' | 'pronta' | undefined>()
    type Item = NonNullable<Page['blocks']>[number]
    expectTypeOf<Extract<Item, { _type: 'hero' }>['title']>().toEqualTypeOf<string>()
  })

  it('picks title and slug fields automatically', () => {
    expect(pages.titleField).toBe('title')
    expect(pages.slugField).toBe('slug')
    expect(pages.label).toBe('Pages')
  })

  it('accepts valid data and drops unknown keys', () => {
    const result = validate(pages, {
      title: 'Home',
      slug: 'home',
      blocks: [{ _type: 'hero', _key: 'a1', title: 'Spazi che respirano.' }],
      extra: true,
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).not.toHaveProperty('extra')
  })

  it('reports every problem with its path', () => {
    const result = validate(pages, {
      title: '',
      slug: 'Not A Slug',
      status: 'archiviata',
      blocks: [
        { _type: 'hero', _key: 'a1' },
        { _type: 'gallery', _key: 'a2', images: [] },
      ],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      const paths = result.issues.map((i) => i.path)
      expect(paths).toEqual(expect.arrayContaining(['title', 'slug', 'status', 'blocks.0.title', 'blocks.1.images']))
    }
  })

  it('rejects unknown block types', () => {
    const result = validate(pages, { title: 'x', blocks: [{ _type: 'video', _key: 'k' }] })
    expect(result.ok).toBe(false)
  })

  it('fills an empty slug from its source field', () => {
    expect(prepare(pages, { title: 'Chi siamo' }).slug).toBe('chi-siamo')
    expect(prepare(pages, { title: 'Chi siamo', slug: 'studio' }).slug).toBe('studio')
  })

  it('finds a readable title', () => {
    expect(titleOf(pages, { title: 'Progetti' })).toBe('Progetti')
    expect(titleOf(pages, {})).toBe('Senza titolo')
  })
})

describe('defineConfig', () => {
  it('fills defaults', () => {
    const config = defineConfig({ site: { name: 'Studio Rossi' }, collections: [pages] })
    expect(config.locales).toEqual({ default: 'it', available: ['it'] })
    expect(config.database.url).toBe('file:.materialize/content.db')
    expect(config.server.port).toBe(4321)
  })

  it('lists every problem at once', () => {
    const bad = defineCollection({
      name: 'Bad Name',
      fields: {
        _hidden: f.text(),
        slug: f.slug({ from: 'missing' }),
        author: f.relation({ to: 'people' }),
      },
    })
    try {
      defineConfig({ site: { name: 'x' }, collections: [bad, bad] })
      expect.unreachable()
    } catch (error) {
      expect(error).toBeInstanceOf(MaterializeConfigError)
      const problems = (error as MaterializeConfigError).problems.join('\n')
      expect(problems).toContain('lowercase')
      expect(problems).toContain('defined twice')
      expect(problems).toContain('cannot start with "_"')
      expect(problems).toContain('"missing" does not exist')
      expect(problems).toContain('unknown collection "people"')
    }
  })
})

describe('describeCollection', () => {
  it('is JSON-safe and includes nested blocks', () => {
    const description = describeCollection(pages)
    expect(JSON.parse(JSON.stringify(description))).toEqual(description)
    const blocks = description.fields.find((x) => x.name === 'blocks')
    expect(blocks?.blocks?.map((b) => b.name)).toEqual(['hero', 'gallery'])
    expect(blocks?.blocks?.[0]?.fields[0]).toMatchObject({ name: 'title', kind: 'text', required: true })
  })
})
