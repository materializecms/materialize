# Materialize

CMS open source per agenzie e freelance: schema dei contenuti in codice, editor visuale sulla tela, siti statici velocissimi.

> Stato: **libreria media**. Ci sono il core dello schema, il database, l'API con autenticazione, la CLI, il pannello con le modalità Contenuto e Design, il renderer Astro e la libreria media con immagini ottimizzate. Il server MCP e le funzioni AI arrivano nelle fasi successive.

## Avvio rapido

Richiede Node 24 o superiore. Nessun database da installare: SQLite è incluso.

```bash
npm install
npm run dev
```

Il sito d'esempio (Studio Rossi) parte su http://localhost:4321 e il pannello su http://localhost:4321/admin: al primo accesso crei l'account amministratore direttamente dal pannello. Sito, pannello e API vivono sullo stesso indirizzo.

## Il pannello

- **Contenuto**: form generati dallo schema, con titolo in evidenza, editor di testo formattato, immagini con punto focale, relazioni, blocchi riordinabili e anteprima per i motori di ricerca.
- **Design**: la pagina vera sulla tela, disegnata dai componenti del sito, con livelli, inspector, modifica del testo direttamente sulla pagina e anteprima desktop, tablet e mobile. I blocchi si spostano trascinandoli sulla pagina. Ogni modifica si vede subito: viene ridisegnato solo il blocco che cambia.
- **Stile di ogni blocco**: sfondo, spazio sopra e sotto, animazione all'ingresso (con anteprima) e ancora per i link interni. Le scelte sono nomi del tema del sito, non colori liberi: le pagine restano coerenti chiunque le modifichi.
- **Bozze sempre al sicuro**: salvataggio automatico mentre scrivi, anche se la pagina è incompleta. Si pubblica solo quando è tutto a posto, e il pannello porta dritto ai campi da sistemare.
- **Media**: libreria con caricamento trascinando i file, ricerca, testo alternativo e conteggio delle pagine che usano ogni immagine. Dal campo immagine si carica, si sceglie dalla libreria o si trascina un file.
- Cronologia con ripristino, annulla e ripristina (⌘Z, ⇧⌘Z), ricerca e comandi (⌘K), tema chiaro e scuro, lingue dei contenuti.

Senza un sito Astro collegato la tela usa uno stile neutro, che mostra struttura e contenuti.

## Il sito

Il sito è un progetto [Astro](https://astro.build) accanto a `materialize.config.ts`. Bastano poche convenzioni:

- **Un componente per tipo di blocco** in `src/blocks`, con il nome del blocco: `ProjectsGrid.astro` disegna i blocchi `projectsGrid`. Riceve i campi del blocco e `field(nome)`: mettilo sull'elemento che mostra un testo (`<h1 {...field('title')}>`) e gli editor potranno modificarlo direttamente sulla tela.
- **Un layout** in `src/layouts/Site.astro`, usato dalle pagine e dall'anteprima.
- **Una rotta per tutte le pagine**: in `src/pages/[...path].astro`, `export const getStaticPaths = getRoutes` crea una pagina per ogni documento pubblicato che ha un indirizzo.

```astro
---
import Blocks from '@materialize/astro/components/Blocks.astro'
import { getRoutes } from '@materialize/astro/content'
import Site from '../layouts/Site.astro'

export const getStaticPaths = getRoutes
const { entry } = Astro.props
---

<Site title={entry.title} entry={entry}>
  <Blocks blocks={entry.data.blocks} />
</Site>
```

### Immagini

Le immagini caricate perdono i metadati della fotocamera (posizione GPS compresa) e vengono raddrizzate. Il componente `Media` le serve in AVIF e WebP in più larghezze (`/media/foto.jpg@960.avif`), così ogni dispositivo scarica solo quello che gli serve: le varianti si creano alla prima richiesta e restano in cache in `.materialize/media`. Con `materialize build` le immagini usate dalle pagine finiscono in `dist/client`, pronte per qualsiasi hosting.

### Stile dei blocchi

Ogni blocco può avere `_style` con `background` (`default`, `muted`, `dark`, `accent`), `spacing` (`none`, `compact`, `normal`, `spacious`), `animation` (`fade`, `rise`, `zoom`, `slide`) e `anchor`. `Blocks` li trasforma in variabili CSS sul contenitore del blocco; il sito decide cosa significano definendo `--theme-muted-bg`, `--theme-dark-bg`, `--theme-dark-fg`, `--theme-accent-bg` e simili. I componenti leggono `--mz-bg`, `--mz-fg` e `--mz-space` con i loro valori predefiniti. Le animazioni partono allo scorrimento, in solo CSS, e non partono per chi ha chiesto meno movimento.

L'esempio Studio Rossi ha undici tipi di blocco: copertina, testo, progetti, galleria, citazione, numeri, servizi, team, domande frequenti, contatti e invito.

Nei template le relazioni arrivano già risolte: un campo `relation` contiene i documenti collegati, con titolo, indirizzo e dati. Per il resto ci sono `getEntries`, `getEntry`, `getSingleton` e i componenti `RichText` e `Media` (immagini con punto focale).

In sviluppo le pagine si generano a ogni richiesta, quindi una pubblicazione si vede subito. In produzione (`materialize start`) il sito è fatto di file statici e si rigenera da solo dopo ogni pubblicazione, di solito in meno di un secondo: la nuova versione sostituisce la precedente solo quando è completa.

## Lo schema è codice

I contenuti si definiscono in `materialize.config.ts`, con tipi TypeScript ricavati automaticamente:

```ts
import { defineBlock, defineCollection, defineConfig, f } from '@materialize/core'

const hero = defineBlock({
  name: 'hero',
  fields: {
    title: f.text({ required: true, max: 90 }),
    image: f.media({ focalPoint: true }),
  },
})

const pages = defineCollection({
  name: 'pages',
  url: (page) => `/${page.slug}`,
  fields: {
    title: f.text({ required: true }),
    slug: f.slug({ from: 'title' }),
    blocks: f.blocks([hero]),
    seo: f.seo(),
  },
})

export default defineConfig({ site: { name: 'Il mio sito' }, collections: [pages] })
```

Con `materialize dev` ogni salvataggio dello schema viene ricaricato senza riavviare. Se lo schema ha un errore, il server resta sulla versione precedente e spiega cosa correggere.

Campi disponibili: `text`, `richText`, `number`, `boolean`, `date`, `select`, `slug`, `media`, `link`, `relation`, `blocks`, `group`, `array`, `seo`, `color`, `json`.

## Struttura

| Cartella                      | Contenuto                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`               | Schema come codice: collezioni, blocchi, campi, tipi, validazione, descrizione per l'admin                                |
| `packages/db`                 | Documenti con bozza e versione pubblicata, revisioni, utenti e sessioni (Drizzle + libSQL)                                |
| `packages/server`             | API HTTP (Hono): setup, login, gestione contenuti, API pubblica; serve il pannello su `/admin`                            |
| `packages/admin`              | Pannello di amministrazione (React, Tailwind, Tiptap), compilato con Vite                                                 |
| `packages/astro`              | Integrazione Astro: contenuti pubblicati per le pagine, componenti per blocchi e testo, anteprima delle bozze per la tela |
| `packages/cli`                | Comando `materialize dev` / `materialize start`                                                                           |
| `packages/create-materialize` | `npm create materialize` per un nuovo progetto                                                                            |
| `examples/sito`       | Sito d'esempio di uno studio di architettura                                                                              |

## API

| Metodo e percorso                                                     | Descrizione                                                                                                    |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/setup` · `POST /api/setup`                                  | Primo amministratore (solo se non ne esiste uno)                                                               |
| `POST /api/auth/login` · `logout` · `GET /api/auth/me`                | Sessione con cookie sicuro                                                                                     |
| `GET /api/schema`                                                     | Collezioni e campi, per costruire le form                                                                      |
| `GET` · `POST /api/collections/:nome`                                 | Elenco con ricerca, creazione con validazione                                                                  |
| `GET` · `PUT` · `DELETE /api/documents/:id`                           | Lettura, salvataggio della bozza (anche incompleta, con l'elenco dei campi da sistemare), eliminazione (admin) |
| `POST /api/documents/:id/publish` · `unpublish`                       | Pubblica la bozza se è valida, o la ritira dal sito                                                            |
| `GET /api/documents/:id/revisions` · `POST …/:rev/restore`            | Cronologia e ripristino                                                                                        |
| `GET` · `POST /api/media` · `GET` · `PATCH` · `DELETE /api/media/:id` | Libreria media: elenco e ricerca, caricamento, testo alternativo e utilizzi, eliminazione (admin)              |
| `GET /media/:file`                                                    | Immagini pubbliche: l’originale, o una variante con `@larghezza.formato`                                       |
| `GET /api/content/:nome` · `/:slug`                                   | API pubblica: solo contenuti pubblicati                                                                        |

Le bozze non toccano il sito online finché non pubblichi. Le richieste di modifica da altri siti vengono bloccate (CSRF); le password usano scrypt; dei token di sessione viene salvato solo l'hash.

## Comandi

```bash
npm run dev         # compila il pannello e avvia l'esempio con ricarica dello schema
npm run dev:admin   # sviluppo del pannello con ricarica istantanea (con npm run dev attivo)
npm run build       # compila il pannello

# nella cartella del sito
npx materialize build   # genera il sito statico in dist/, da pubblicare su qualsiasi hosting
npx materialize start   # produzione: sito statico, pannello e rigenerazione a ogni pubblicazione
npm test            # test (Vitest)
npm run typecheck   # TypeScript 7
npm run lint        # Biome
npm run check       # tutto quanto sopra
```

## Scelte tecniche

- **Node 24** esegue TypeScript direttamente: nessun passaggio di build in sviluppo. Il codice resta compatibile con Bun.
- **SQLite via libSQL**: un file locale di default; con la stessa API funziona un database remoto Turso (`database.url` nel config).
- **Contenuti come JSON validato**: cambiare i campi nello schema non richiede migrazioni del database.

## Prossimi passi

1. Editor: libreria di sezioni pronte con più varianti, modifica collaborativa in tempo reale, commenti.
2. Utenti e inviti, traduzioni collegate tra loro.
3. Media su storage esterno (S3, R2) e CDN, documenti oltre alle immagini.
4. Server MCP e funzioni AI.
5. Build dei pacchetti per la pubblicazione su npm, e il sito nel modello di `create-materialize`.
