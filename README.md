# Materialize

CMS open source per agenzie e freelance: schema dei contenuti in codice, editor visuale sulla tela, siti statici velocissimi.

> Stato: **fase 2 · Editor, prima parte**. Ci sono il core dello schema, il database, l'API con autenticazione, la CLI e il pannello di amministrazione con le modalità Contenuto e Design. Il renderer Astro (l'aspetto vero del sito sulla tela), la libreria media e il server MCP arrivano nelle fasi successive.

## Avvio rapido

Richiede Node 24 o superiore. Nessun database da installare: SQLite è incluso.

```bash
npm install
npm run dev
```

Il sito d'esempio (Studio Rossi) parte su http://localhost:4321. Apri http://localhost:4321/admin: al primo accesso crei l'account amministratore direttamente dal pannello.

## Il pannello

- **Contenuto**: form generati dallo schema, con titolo in evidenza, editor di testo formattato, immagini con punto focale, relazioni, blocchi riordinabili e anteprima per i motori di ricerca.
- **Design**: la pagina sulla tela, con livelli, inspector, inserimento di blocchi tra le sezioni, modifica del testo direttamente sulla tela e anteprima desktop, tablet e mobile.
- **Bozze sempre al sicuro**: salvataggio automatico mentre scrivi, anche se la pagina è incompleta. Si pubblica solo quando è tutto a posto, e il pannello porta dritto ai campi da sistemare.
- Cronologia con ripristino, annulla e ripristina (⌘Z, ⇧⌘Z), ricerca e comandi (⌘K), tema chiaro e scuro, lingue dei contenuti.

Per ora la tela usa uno stile neutro, uguale per ogni sito: mostra struttura e contenuti reali. L'aspetto definitivo arriverà con il renderer, che userà i componenti del sito.

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

| Cartella                      | Contenuto                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `packages/core`               | Schema come codice: collezioni, blocchi, campi, tipi, validazione, descrizione per l'admin     |
| `packages/db`                 | Documenti con bozza e versione pubblicata, revisioni, utenti e sessioni (Drizzle + libSQL)     |
| `packages/server`             | API HTTP (Hono): setup, login, gestione contenuti, API pubblica; serve il pannello su `/admin` |
| `packages/admin`              | Pannello di amministrazione (React, Tailwind, Tiptap), compilato con Vite                      |
| `packages/cli`                | Comando `materialize dev` / `materialize start`                                                |
| `packages/create-materialize` | `npm create materialize` per un nuovo progetto                                                 |
| `examples/sito`       | Sito d'esempio di uno studio di architettura                                                   |

## API

| Metodo e percorso                                          | Descrizione                                                                                                    |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/setup` · `POST /api/setup`                       | Primo amministratore (solo se non ne esiste uno)                                                               |
| `POST /api/auth/login` · `logout` · `GET /api/auth/me`     | Sessione con cookie sicuro                                                                                     |
| `GET /api/schema`                                          | Collezioni e campi, per costruire le form                                                                      |
| `GET` · `POST /api/collections/:nome`                      | Elenco con ricerca, creazione con validazione                                                                  |
| `GET` · `PUT` · `DELETE /api/documents/:id`                | Lettura, salvataggio della bozza (anche incompleta, con l'elenco dei campi da sistemare), eliminazione (admin) |
| `POST /api/documents/:id/publish` · `unpublish`            | Pubblica la bozza se è valida, o la ritira dal sito                                                            |
| `GET /api/documents/:id/revisions` · `POST …/:rev/restore` | Cronologia e ripristino                                                                                        |
| `GET /api/content/:nome` · `/:slug`                        | API pubblica: solo contenuti pubblicati                                                                        |

Le bozze non toccano il sito online finché non pubblichi. Le richieste di modifica da altri siti vengono bloccate (CSRF); le password usano scrypt; dei token di sessione viene salvato solo l'hash.

## Comandi

```bash
npm run dev         # compila il pannello e avvia l'esempio con ricarica dello schema
npm run dev:admin   # sviluppo del pannello con ricarica istantanea (con npm run dev attivo)
npm run build       # compila il pannello
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

1. Renderer Astro con pubblicazione incrementale, e tela con l'aspetto vero del sito.
2. Editor: stili e animazioni per blocco, più tipi di blocco, trascinamento sulla tela, modifica collaborativa.
3. Media: caricamento, ottimizzazione, CDN.
4. Server MCP e funzioni AI.
5. Build dei pacchetti per la pubblicazione su npm.
