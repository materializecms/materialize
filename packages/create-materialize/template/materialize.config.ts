import { defineCollection, defineConfig, f } from '@materializecms/core'

// Il modello dei contenuti del sito. Le pagine si compongono sulla tela del pannello,
// con le sezioni della libreria; gli articoli si scrivono dal pannello. Qui si aggiungono
// altre raccolte e altri campi quando servono.

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

// Il blog: si scrive dal pannello. Ogni articolo prende l'aspetto della pagina scelta come suo
// modello sulla tela (Modello → Articoli); finché non c'è, una pagina semplice e leggibile.
const posts = defineCollection({
  name: 'posts',
  label: 'Articoli',
  url: (post) => `/articoli/${post.slug}`,
  fields: {
    title: f.text({ label: 'Titolo', required: true, max: 90 }),
    slug: f.slug({ label: 'Indirizzo', from: 'title' }),
    date: f.date({ label: 'Data', required: true }),
    excerpt: f.text({ label: 'Sommario', multiline: true, max: 220 }),
    cover: f.media({ label: 'Copertina' }),
    body: f.richText({ label: 'Testo' }),
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
  collections: [pages, posts, settings],
})
