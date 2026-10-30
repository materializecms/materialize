# Materialize

CMS open source per agenzie e freelance: schema dei contenuti in codice, editor visuale sulla tela, siti statici velocissimi.

> Stato: **Alpha**, verso la prima versione pubblica. Le novità di ogni versione sono in [CHANGELOG.md](CHANGELOG.md).

## Un nuovo sito

Richiede Node 24 o superiore. Nessun database da installare: SQLite è incluso.

```bash
npm create materialize@latest
```

Il comando chiede la cartella, copia un sito Astro con nove blocchi pronti (copertina, testo, galleria, citazione, numeri, servizi, domande, contatti, invito), installa le dipendenze e dice come partire: `npm run dev`, poi http://localhost:4321/admin.

### Dove installarlo

Con il pannello, Materialize è un programma Node sempre acceso: serve un **server tuo**, cioè un VPS (Hetzner, DigitalOcean, OVH, Aruba Cloud…) o un ambiente Docker. **Gli hosting condivisi PHP non sono adatti**, anche quelli con Node nel cPanel: memoria scarsa e processi sospesi quando non ci sono visite rendono lenti la generazione del sito e le immagini. Il sito generato, invece, è fatto di file statici e si può pubblicare anche su qualsiasi hosting statico.

### L'installazione nel browser

Al primo avvio il pannello guida l'installazione in tre passi: controlla il server (versione di Node, cartelle scrivibili, sito, HTTPS, aggiornamenti), chiede nome e lingua del sito, crea l'account amministratore, poi apre il pannello.

In produzione (`materialize start`) l'installazione chiede il link che il server scrive all'avvio, `/admin/?installa=<codice>`: così un server appena messo online non può essere preso da chi lo trova per primo. Il codice cambia a ogni avvio e non serve più dopo l'installazione. In sviluppo (`materialize dev`) non serve.

### Aggiornamenti

Con `materialize start`, il server gira sotto un piccolo supervisore che lo tiene acceso (lo riavvia se si ferma) e applica gli aggiornamenti. Una volta al giorno il server controlla se c'è una versione nuova; l'amministratore la vede in **Impostazioni → Aggiornamenti**, con le novità dal changelog, e la installa con un clic:

1. backup del database e dei media;
2. la nuova versione si scarica in `.materialize/updates/next`, mentre il sito resta online;
3. il server si riavvia sulla nuova versione, che deve partire e compilare il sito: se non ci riesce, torna da sola quella di prima;
4. la versione precedente resta in `.materialize/updates/previous`, per tornarci con un clic.

Si possono lasciar installare da sole le correzioni (stessa versione principale e secondaria, per esempio dalla 0.2.0 alla 0.2.1); le novità le decide sempre l'amministratore. Il server deve poter scrivere nella cartella del sito e trovare `npm`. Senza supervisore (`--no-supervisor`, o un altro programma che lancia il server) e in sviluppo il pannello mostra il comando da usare a mano. I file del sito (layout, blocchi, configurazione) non vengono mai toccati.

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

### Statistiche, tag e cookie

In **Impostazioni → Tracciamento e cookie** un amministratore aggiunge Google Analytics 4, Google Tag Manager, Meta Pixel, Plausible o Matomo con il solo ID, e qualsiasi altro codice da mettere nell’`<head>` o in fondo al `<body>`, scegliendo a cosa serve: necessario, statistiche o marketing. Il componente `Tracking` (già nel layout dei siti nuovi: `<Tracking lang={entry?.locale} />` nell’`<head>`) lo inserisce in tutte le pagine pubblicate, mai nell’anteprima dell’editor.

Il codice di statistica e marketing resta fermo finché il visitatore non accetta: compare da solo un banner con Rifiuta, Personalizza e Accetta tutti, e Google Consent Mode parte da «negato». La scelta vale un anno; si cambia dal pulsantino in basso a sinistra, da un link a `#preferenze-cookie` (per esempio nel piè di pagina) o da un elemento con `data-mz-consent-open`. Privacy e cookie policy restano da scrivere per il sito.

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
npm run smoke       # crea, compila e avvia un sito con i pacchetti di .release/
npm run bump patch  # nuova versione per tutti i pacchetti (patch, minor, major o 1.2.3)
```

## Sicurezza

Il pannello si protegge da solo:
- limiti agli accessi falliti;
- verifica in due passaggi;
- regole CSP;
- registro delle attività;
- backup giornalieri del database e delle immagini, e un archivio completo da scaricare.

HTTPS, proxy, Cloudflare, firewall e copie fuori dal server spettano a chi mette online il sito: sono spiegati in [docs/sicurezza.md](docs/sicurezza.md). Lo stato del singolo sito si vede in Impostazioni → Sicurezza.

## Pubblicare una versione

I pacchetti si chiamano `@materializecms/*`, più `create-materialize`, e hanno sempre tutti la stessa versione. Le novità per chi usa Materialize si scrivono man mano in [CHANGELOG.md](CHANGELOG.md), sotto «Prossima versione», in parole semplici: il pannello le mostrerà quando propone un aggiornamento.

Per una nuova versione:

```bash
npm run bump patch      # oppure minor, major, o una versione esatta come 0.2.0
git commit -am "Versione 0.1.1"
git tag v0.1.1 && git push --follow-tags
```

`bump` aggiorna la versione di tutti i pacchetti, delle dipendenze tra loro, dell'esempio e del lockfile, e dà la data alla sezione «Prossima versione» del changelog (si rifiuta se è vuota). Il tag fa partire su GitHub il workflow **Rilascio**: gli stessi controlli di ogni modifica, poi `npm run release` (pannello e pacchetti compilati in `.release/`), `npm run smoke` (un sito nuovo creato da quei pacchetti deve installarsi, compilarsi e avviarsi), la pubblicazione su npm con la provenienza firmata e una release su GitHub con le note del changelog. Serve il segreto `NPM_TOKEN`: un token npm di tipo «automation» con accesso allo scope `@materializecms`.

Si può fare tutto anche a mano: `npm run release`, `npm run smoke`, poi `npm run publish-release`, che pubblica i pacchetti nell'ordine giusto e salta quelli già presenti, così si può ripetere se si interrompe. Per una prova senza pubblicare davvero, lo stesso comando accetta un registro locale (per esempio [Verdaccio](https://verdaccio.org)): `npm run publish-release -- --registry http://localhost:4873`, poi `npm create materialize@latest` con `--registry`.

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
