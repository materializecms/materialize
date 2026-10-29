import { defineBlock, defineCollection, defineConfig, f } from '@materializecms/core'

// Il modello dei contenuti del sito. Ogni blocco ha un componente con lo stesso nome
// in src/blocks (hero → Hero.astro); le modifiche si vedono subito nel pannello.

// ---------- blocchi: le sezioni con cui si compongono le pagine ----------

const hero = defineBlock({
  name: 'hero',
  label: 'Copertina',
  description: 'Titolo grande con immagine e pulsante',
  fields: {
    eyebrow: f.text({ label: 'Occhiello', max: 60 }),
    title: f.text({ label: 'Titolo', required: true, max: 90 }),
    subtitle: f.text({ label: 'Sottotitolo', multiline: true, max: 240 }),
    image: f.media({ label: 'Immagine', focalPoint: true }),
    cta: f.link({ label: 'Pulsante' }),
    variant: f.select({
      label: 'Impaginazione',
      options: [
        { value: 'split', label: 'Affiancata' },
        { value: 'center', label: 'Centrata' },
        { value: 'cover', label: 'A tutto schermo' },
      ],
    }),
  },
})

const text = defineBlock({
  name: 'text',
  label: 'Testo',
  description: 'Titolo e testo formattato',
  fields: {
    title: f.text({ label: 'Titolo' }),
    body: f.richText({ label: 'Testo', required: true }),
  },
})

const callToAction = defineBlock({
  name: 'cta',
  label: 'Invito',
  description: 'Fascia scura con un invito all’azione',
  fields: {
    title: f.text({ label: 'Titolo', required: true }),
    text: f.text({ label: 'Testo', multiline: true }),
    link: f.link({ label: 'Pulsante', required: true }),
  },
})

const gallery = defineBlock({
  name: 'gallery',
  label: 'Galleria',
  description: 'Griglia di immagini, regolare o a mosaico',
  fields: {
    title: f.text({ label: 'Titolo' }),
    images: f.array(f.media(), { label: 'Immagini', min: 1, max: 24 }),
    layout: f.select({
      label: 'Disposizione',
      options: [
        { value: 'mosaic', label: 'Mosaico' },
        { value: 'grid', label: 'Griglia' },
      ],
    }),
  },
})

const quote = defineBlock({
  name: 'quote',
  label: 'Citazione',
  description: 'Una frase in grande, con autore',
  fields: {
    quote: f.text({ label: 'Citazione', required: true, multiline: true, max: 280 }),
    author: f.text({ label: 'Autore' }),
    role: f.text({ label: 'Ruolo' }),
    portrait: f.media({ label: 'Ritratto' }),
  },
})

const stats = defineBlock({
  name: 'stats',
  label: 'Numeri',
  description: 'Cifre chiave in evidenza',
  fields: {
    title: f.text({ label: 'Titolo' }),
    items: f.array(
      f.group({
        value: f.text({ label: 'Numero', required: true }),
        label: f.text({ label: 'Descrizione', required: true }),
      }),
      { label: 'Numeri', min: 1, max: 6 },
    ),
  },
})

const faq = defineBlock({
  name: 'faq',
  label: 'Domande frequenti',
  description: 'Domande e risposte che si aprono',
  fields: {
    title: f.text({ label: 'Titolo', required: true }),
    items: f.array(
      f.group({
        question: f.text({ label: 'Domanda', required: true }),
        answer: f.text({ label: 'Risposta', required: true, multiline: true }),
      }),
      { label: 'Domande', min: 1 },
    ),
  },
})

const services = defineBlock({
  name: 'services',
  label: 'Servizi',
  description: 'Elenco numerato di servizi, vantaggi o fasi',
  fields: {
    eyebrow: f.text({ label: 'Occhiello' }),
    title: f.text({ label: 'Titolo', required: true }),
    items: f.array(
      f.group({
        title: f.text({ label: 'Titolo', required: true }),
        text: f.text({ label: 'Testo', multiline: true }),
      }),
      { label: 'Voci', min: 1, max: 9 },
    ),
  },
})

const contact = defineBlock({
  name: 'contact',
  label: 'Contatti',
  description: 'Invito e recapiti dalle impostazioni del sito',
  fields: {
    title: f.text({ label: 'Titolo', required: true }),
    text: f.text({ label: 'Testo', multiline: true }),
    link: f.link({ label: 'Pulsante' }),
  },
})

// ---------- raccolte ----------

const pages = defineCollection({
  name: 'pages',
  label: 'Pagine',
  url: (page) => (page.slug === 'home' ? '/' : `/${page.slug}`),
  fields: {
    title: f.text({ label: 'Titolo', required: true, max: 80 }),
    slug: f.slug({ label: 'Indirizzo', from: 'title' }),
    blocks: f.blocks([hero, text, gallery, quote, stats, services, faq, contact, callToAction], {
      label: 'Sezioni',
    }),
    seo: f.seo({ label: 'Motori di ricerca' }),
  },
})

const settings = defineCollection({
  name: 'settings',
  label: 'Impostazioni del sito',
  singleton: true,
  fields: {
    siteName: f.text({ label: 'Nome del sito', required: true }),
    contacts: f.group(
      {
        email: f.text({ label: 'Email' }),
        phone: f.text({ label: 'Telefono' }),
        address: f.text({ label: 'Indirizzo', multiline: true }),
      },
      { label: 'Contatti' },
    ),
    social: f.array(f.link(), { label: 'Social', max: 8 }),
    accent: f.color({ label: 'Colore principale' }),
  },
})

export default defineConfig({
  site: { name: '__SITE_NAME__' },
  collections: [pages, settings],
})
