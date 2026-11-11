import { defineCollection, defineConfig, f } from '@materializecms/core'

// Il modello dei contenuti del sito. Le pagine si compongono sulla tela del pannello,
// con le sezioni della libreria; gli articoli si scrivono dal pannello. Qui si aggiungono
// altre raccolte e altri campi quando servono. I nomi sono in due lingue: il pannello
// mostra quello della lingua di chi lo usa (un nome solo, 'Articoli', va bene lo stesso).

const pages = defineCollection({
  name: 'pages',
  label: { it: 'Pagine', en: 'Pages' },
  url: (page) => (page.slug === 'home' ? '/' : `/${page.slug}`),
  fields: {
    title: f.text({ label: { it: 'Titolo', en: 'Title' }, required: true, max: 80 }),
    slug: f.slug({ label: { it: 'Indirizzo', en: 'Address' }, from: 'title' }),
    page: f.page({ label: { it: 'Pagina', en: 'Page' } }),
    seo: f.seo({ label: { it: 'Motori di ricerca', en: 'Search engines' } }),
  },
})

// Il blog: si scrive dal pannello. Ogni articolo prende l'aspetto della pagina scelta come suo
// modello sulla tela (Modello → Articoli); finché non c'è, una pagina semplice e leggibile.
const posts = defineCollection({
  name: 'posts',
  label: { it: 'Articoli', en: 'Articles' },
  url: (post) => `/articoli/${post.slug}`,
  fields: {
    title: f.text({ label: { it: 'Titolo', en: 'Title' }, required: true, max: 90 }),
    slug: f.slug({ label: { it: 'Indirizzo', en: 'Address' }, from: 'title' }),
    date: f.date({ label: { it: 'Data', en: 'Date' }, required: true }),
    excerpt: f.text({ label: { it: 'Sommario', en: 'Summary' }, multiline: true, max: 220 }),
    cover: f.media({ label: { it: 'Copertina', en: 'Cover' } }),
    body: f.richText({ label: { it: 'Testo', en: 'Text' } }),
    seo: f.seo({ label: { it: 'Motori di ricerca', en: 'Search engines' } }),
  },
})

const settings = defineCollection({
  name: 'settings',
  label: { it: 'Impostazioni del sito', en: 'Site settings' },
  singleton: true,
  fields: {
    siteName: f.text({ label: { it: 'Nome del sito', en: 'Site name' }, required: true }),
  },
})

export default defineConfig({
  site: { name: '__SITE_NAME__' },
  collections: [pages, posts, settings],
})
