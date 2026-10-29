import { defineBlock, defineCollection, defineConfig, f } from '@materialize/core'

const hero = defineBlock({
  name: 'hero',
  label: 'Hero',
  fields: {
    title: f.text({ required: true, max: 90 }),
    subtitle: f.text({ multiline: true }),
    image: f.media(),
    cta: f.link(),
  },
})

const text = defineBlock({
  name: 'text',
  label: 'Testo',
  fields: { title: f.text(), body: f.richText({ required: true }) },
})

const pages = defineCollection({
  name: 'pages',
  label: 'Pagine',
  url: (page) => (page.slug === 'home' ? '/' : `/${page.slug}`),
  fields: {
    title: f.text({ required: true }),
    slug: f.slug({ from: 'title' }),
    blocks: f.blocks([hero, text]),
    seo: f.seo(),
  },
})

const settings = defineCollection({
  name: 'settings',
  label: 'Impostazioni del sito',
  singleton: true,
  fields: { siteName: f.text({ required: true }), email: f.text() },
})

export default defineConfig({
  site: { name: '__SITE_NAME__' },
  collections: [pages, settings],
})
