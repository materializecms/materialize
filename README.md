# Materialize

CMS open source per agenzie e freelance: schema dei contenuti in codice, editor visuale sulla tela, siti statici velocissimi.

> Stato: **prima versione installabile**. Ci sono il core dello schema, il database, l'API con autenticazione, la CLI, il pannello con le modalità Contenuto e Design, il renderer Astro, la libreria media, la gestione delle persone e il comando per creare un nuovo sito. Il server MCP e le funzioni AI arrivano nelle fasi successive.

## Un nuovo sito

Richiede Node 24 o superiore. Nessun database da installare: SQLite è incluso.

```bash
npm create materialize@latest
```

Il comando chiede la cartella, copia un sito Astro con nove blocchi pronti (copertina, testo, galleria, citazione, numeri, servizi, domande, contatti, invito), installa le dipendenze e dice come partire: `npm run dev`, poi http://localhost:4321/admin per creare l'account.

## Sviluppare Materialize

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
- **Persone**: gli amministratori invitano editor e altri amministratori con un link valido 7 giorni, cambiano ruoli, rimuovono accessi e creano link per una nuova password (24 ore). C'è sempre almeno un amministratore. Ognuno cambia nome e password dal proprio profilo.
- **Importa da WordPress** (Impostazioni → Importa): articoli, pagine, immagini, categorie e SEO, dall'indirizzo del sito (anche bozze, con una password applicativa) o dal file di esportazione. Funziona con Gutenberg, Elementor, WPBakery, Divi e gli altri editor. Le immagini vanno nella libreria, i link interni puntano alle nuove pagine e i vecchi indirizzi vengono reindirizzati con un 301. Le pagine arrivano con i contenuti in ordine; l'impaginazione si rifà sul canvas.
- Cronologia con ripristino, annulla e ripristina (⌘Z, ⇧⌘Z), ricerca e comandi (⌘K), tema chiaro e scuro, lingue dei contenuti.

Senza un sito Astro collegato la tela usa uno stile neutro, che mostra struttura e contenuti.

## Il sito

Il sito è un progetto [Astro](https://astro.build) accanto a `materialize.config.ts`. Bastano poche convenzioni:

- **Un componente per tipo di blocco** in `src/blocks`, con il nome del blocco: `ProjectsGrid.astro` disegna i blocchi `projectsGrid`. Riceve i campi del blocco e `field(nome)`: mettilo sull'elemento che mostra un testo (`<h1 {...field('title')}>`) e gli editor potranno modificarlo direttamente sulla tela.
- **Un layout** in `src/layouts/Site.astro`, usato dalle pagine e dall'anteprima.
- **Una rotta per tutte le pagine**: in `src/pages/[...path].astro`, `export const getStaticPaths = getRoutes` crea una pagina per ogni documento pubblicato che ha un indirizzo.

```astro
---
import Blocks from '@materializecms/astro/components/Blocks.astro'
import { getRoutes } from '@materializecms/astro/content'
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

## L’editor delle pagine

Le pagine si compongono sulla tela con sezioni ed elementi (contenitori, testi, immagini, pulsanti, video, codice, scene WebGL), partendo da una libreria di oltre 100 sezioni. Ogni elemento ha:

- **design libero**: disposizione in riga, colonna o griglia, posizione libera e livelli, colori e sfumature, tipografia per elemento, bordi, ombre, fusione, filtri ed effetto vetro, con modifiche separate per tablet e mobile;
- **interazioni**: all’apertura, all’ingresso nello schermo, con lo scroll, al passaggio o al movimento del mouse, al clic; testi che entrano per parole o lettere, contatori, parallasse, elementi fissi durante lo scroll, nastri scorrevoli;
- **linee temporali**: ogni interazione può avere più fotogrammi chiave, ciascuno con la sua curva, da provare sulla tela con il cursore della linea temporale;
- **scene WebGL**: 21 shader (sfondi, movimento, effetti su immagine) più uno scritto a mano in GLSL, forme 3D e modelli glTF (.glb caricati nella libreria media) con materiali cromo, vetro, iridescente, argilla o fil di ferro; three.js si scarica solo nelle pagine che hanno una scena 3D;
- **componenti**: un elemento diventa riutilizzabile, con più varianti; il design vale per tutte le copie, testi, immagini e link restano di ogni copia;
- **dati**: un contenitore può ripetersi per ogni voce di una raccolta (per esempio i progetti), ordinata e filtrata per campo, con un pulsante “Mostra altri”; le sezioni globali, come menu e piè di pagina, valgono per tutte le pagine;
- **stili di testo condivisi**: uno stile con nome (carattere, dimensioni per dispositivo, colore) si crea da un testo e si applica agli altri; cambiandolo, cambiano tutti.

- **icone e forme**: icone a linee (frecce, contatti, social…), forme piene (arco, cerchio, onda…) e SVG incollati, ripuliti da script;
- **stati al passaggio del mouse**: colori, scala, spostamento, ombra, anche quando il puntatore è sulla scheda che contiene l’elemento; le copie di un componente possono passare a un’altra variante;
- **colori con nome** nel tema (uno per il tema chiaro, uno per lo scuro) e **punti di rottura** di tablet e mobile configurabili;
- **pagine modello**: una pagina può fare da modello per ogni voce di una raccolta (la pagina di ogni progetto), con anteprima su una voce vera;
- **moduli di contatto**: campi veri, invio senza ricaricare la pagina (e anche senza JavaScript), messaggi in Impostazioni → Messaggi e per email via SMTP; con l’email configurata anche inviti e reset password arrivano per posta;
- **lavoro in squadra**: commenti sugli elementi o sulla pagina, e chi altro ha aperta la pagina, con l’elemento che ha selezionato.

Sulla tela:

- ⇧ clic (sulla tela o nei livelli) seleziona più elementi, e così un riquadro trascinato dalla tela vuota o dallo sfondo di una sezione (con ⇧, ovunque): le modifiche di stile valgono per tutti; ⌘A seleziona gli elementi vicini; trascinandone uno si spostano tutti insieme;
- righelli in pixel della pagina lungo i bordi della tela, con la selezione evidenziata (⇧R per mostrarli o nasconderli);
- larghezze di prova per ogni dispositivo e tutti i dispositivi affiancati; ⌥⌘C / ⌥⌘V copia e incolla lo stile; ? mostra tutte le scorciatoie, e la prima volta un breve tour presenta l’editor;
- ⌘G raggruppa la selezione in un contenitore, ⇧⌘G lo separa; ⌘D duplica, ⌫ elimina;
- allinea e distribuisci (⌥⌘A, ⌥⌘H, ⌥⌘D, ⌥⌘W, ⌥⌘V, ⌥⌘S): gli elementi liberi si spostano, quelli in colonna o in riga si allineano tramite il loro contenitore;
- trascinando un elemento libero compaiono le guide magnetiche verso i bordi e i centri del contenitore e degli elementi vicini (⌘ per spostarlo senza agganci); tenendo premuto ⌥ si vedono le distanze dall’elemento sotto il puntatore.

Per tutto il sito si scelgono anche scorrimento morbido, cursore personalizzato e transizioni tra le pagine. Chi ha chiesto meno movimento al proprio dispositivo vede il sito fermo. Il codice personalizzato lo inserisce solo un amministratore.

## Caratteri

Nella scheda **Stili** dell’editor si può scegliere qualsiasi Google Font (circa 2000). I file non vengono caricati da Google: Materialize li scarica una volta da Fontsource, li conserva in `.materialize/fonts` e li serve dal sito stesso su `/fonts/…`, così i visitatori non contattano terze parti. Con `materialize build` i caratteri usati finiscono in `dist/` insieme alle pagine.

## Lo schema è codice

I contenuti si definiscono in `materialize.config.ts`, con tipi TypeScript ricavati automaticamente:

```ts
import { defineBlock, defineCollection, defineConfig, f } from '@materializecms/core'

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
| `packages/create-materialize` | `npm create materialize`: copia il sito di partenza in `template/` e installa le dipendenze                               |
| `examples/sito`       | Sito d'esempio di uno studio di architettura                                                                              |

## API

| Metodo e percorso                                                                                     | Descrizione                                                                                                    |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `GET /api/setup` · `POST /api/setup`                                                                  | Primo amministratore (solo se non ne esiste uno)                                                               |
| `POST /api/auth/login` · `logout` · `GET /api/auth/me`                                                | Sessione con cookie sicuro                                                                                     |
| `GET /api/schema`                                                                                     | Collezioni e campi, per costruire le form                                                                      |
| `GET` · `POST /api/collections/:nome`                                                                 | Elenco con ricerca, creazione con validazione                                                                  |
| `GET` · `PUT` · `DELETE /api/documents/:id`                                                           | Lettura, salvataggio della bozza (anche incompleta, con l'elenco dei campi da sistemare), eliminazione (admin) |
| `POST /api/documents/:id/publish` · `unpublish`                                                       | Pubblica la bozza se è valida, o la ritira dal sito                                                            |
| `GET /api/documents/:id/revisions` · `POST …/:rev/restore`                                            | Cronologia e ripristino                                                                                        |
| `GET /api/users` · `POST /api/users/invites` · `PATCH` · `DELETE /api/users/:id` · `POST …/:id/reset` | Persone e inviti (admin): elenco, invito, ruolo, rimozione, link per nuova password                            |
| `GET /api/invites/:token` · `POST …/accept`                                                           | Link di invito o di nuova password: si usa una volta, senza essere collegati                                   |
| `PATCH /api/auth/me` · `POST /api/auth/password`                                                      | Il proprio nome e la propria password                                                                          |
| `GET` · `POST /api/media` · `GET` · `PATCH` · `DELETE /api/media/:id`                                 | Libreria media: elenco e ricerca, caricamento, testo alternativo e utilizzi, eliminazione (admin)              |
| `GET /media/:file`                                                                                    | Immagini pubbliche: l’originale, o una variante con `@larghezza.formato`                                       |
| `GET /api/content/:nome` · `/:slug`                                                                   | API pubblica: solo contenuti pubblicati                                                                        |

Le bozze non toccano il sito online finché non pubblichi. Le richieste di modifica da altri siti vengono bloccate (CSRF); le password usano scrypt; dei token di sessione viene salvato solo l'hash.

## Comandi

```bash
npm run dev         # compila il pannello e avvia l'esempio con ricarica dello schema
npm run dev:admin   # sviluppo del pannello con ricarica istantanea (con npm run dev attivo)
npm run build       # compila il pannello

# nella cartella del sito
npx materialize build   # genera il sito statico in dist/, da pubblicare su qualsiasi hosting
npx materialize start   # produzione: sito statico, pannello e rigenerazione a ogni pubblicazione
npx materialize restore <file>   # rimette un backup o l'archivio completo (a server fermo)
npm test            # test (Vitest)
npm run typecheck   # TypeScript 7
npm run lint        # Biome
npm run check       # tutto quanto sopra
npm run audit       # vulnerabilità note nelle dipendenze
npm run release     # prepara i pacchetti npm in .release/ (non pubblica nulla)
```

## Sicurezza

Il pannello si protegge da solo:
- limiti agli accessi falliti;
- verifica in due passaggi;
- regole CSP;
- registro delle attività;
- backup giornalieri del database e delle immagini, e un archivio completo da scaricare.

HTTPS, proxy, Cloudflare, firewall e copie fuori dal server spettano a chi mette online il sito: sono spiegati in [docs/sicurezza.md](docs/sicurezza.md). Lo stato del singolo sito si vede in Impostazioni → Sicurezza.

## Pubblicare su npm

I pacchetti si chiamano `@materializecms/*`, più `create-materialize`. `npm run release` compila il pannello e i pacchetti (JavaScript con i tipi), li assembla in `.release/<pacchetto>` e crea gli archivi in `.release/tarballs`. Tutti i pacchetti hanno la stessa versione: per una nuova versione si aggiorna `version` in ogni `packages/*/package.json`.

La pubblicazione è un passo a parte, da un account npm con accesso allo scope `@materializecms`:

```bash
for p in core db admin server astro cli create-materialize; do npm publish .release/$p; done
```

Per provare prima l'installazione senza pubblicare, si possono caricare gli stessi pacchetti su un registro locale (per esempio Verdaccio) e lanciare `npm create materialize@latest` con `--registry`.

## Scelte tecniche

- **Node 24** esegue TypeScript direttamente: nessun passaggio di build in sviluppo. I pacchetti pubblicati invece sono compilati, perché Node non esegue TypeScript dentro `node_modules`.
- **SQLite via libSQL**: un file locale di default; con la stessa API funziona un database remoto Turso (`database.url` nel config).
- **Contenuti come JSON validato**: cambiare i campi nello schema non richiede migrazioni del database.

## Prossimi passi

1. Editor: libreria di sezioni pronte con più varianti, modifica collaborativa in tempo reale, commenti.
2. Traduzioni collegate tra loro, invio delle email (inviti e password) tramite SMTP o un servizio esterno.
3. Media su storage esterno (S3, R2) e CDN, documenti oltre alle immagini.
4. Server MCP e funzioni AI.
5. Rilasci automatici (changelog, pubblicazione da CI) e una guida al deploy su hosting comuni.
