import { defineCollection, defineConfig, f } from '@materializecms/core'

// Il modello dei contenuti del sito. Le pagine si compongono sulla tela del pannello,
// con le sezioni della libreria; qui si aggiungono raccolte e campi quando servono.

const pages = defineCollection({
  name: 'pages',
  label: 'Pagine',
  url: (page) => (page.slug === 'home' ? '/' : `/${page.slug}`),
  fields: {
    title: f.text({ label: 'Titolo', required: true, max: 80 }),
    slug: f.slug({ label: 'Indirizzo', from: 'title' }),
    page: f.page({ label: 'Pagina' }),
    seo: f.seo({ label: 'Motori di ricerca' }),
  },
})

const settings = defineCollection({
  name: 'settings',
  label: 'Impostazioni del sito',
  singleton: true,
  fields: {
    siteName: f.text({ label: 'Nome del sito', required: true }),
    email: f.text({ label: 'Email' }),
  },
})

export default defineConfig({
  site: { name: '__SITE_NAME__' },
  collections: [pages, settings],
})
