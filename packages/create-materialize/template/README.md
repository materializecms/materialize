# __SITE_NAME__

**English** · [Italiano](#in-italiano)

A site made with [Materialize](https://www.npmjs.com/package/create-materialize): content in the panel, fast static pages.

## Getting started

```bash
npm run dev
```

Open http://localhost:4321/admin, create the administrator account, then a page with the address `home`: start from a ready-made page or build it with the library's sections.

## Where to change things

| What | Where |
| --- | --- |
| Pages, sections, animations | The panel, on the canvas |
| The site's colors, fonts and shapes | The panel, the editor's **Styles** tab |
| Visitor comments | The panel, **Settings → Comments**; the component is `<Comments>` in `src/pages/[...path].astro` |
| The content model (collections and fields) | `materialize.config.ts` |
| Shared HTML structure (meta tags, fonts) | `src/layouts/Site.astro` |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Panel and site with a live preview |
| `npm run build` | Static site in `dist/`, to publish on any hosting |
| `npm run start` | Panel and site in production: every publish rebuilds the site |

Content and images live in `.materialize/`: back it up.

## In italiano

Sito creato con Materialize: contenuti nel pannello, pagine statiche e veloci.

**Avvio**: `npm run dev`, poi apri http://localhost:4321/admin, crea l’account di amministratore e una pagina con indirizzo `home`: parti da una pagina pronta o componila con le sezioni della libreria.

**Dove mettere le mani**

| Cosa | Dove |
| --- | --- |
| Pagine, sezioni, animazioni | Il pannello, sulla tela |
| Colori, caratteri e forme del sito | Il pannello, scheda **Stili** dell’editor |
| Commenti dei visitatori | Il pannello, **Impostazioni → Commenti**; il componente è `<Comments>` in `src/pages/[...path].astro` |
| Modello dei contenuti (raccolte e campi) | `materialize.config.ts` |
| Struttura HTML comune (meta, caratteri) | `src/layouts/Site.astro` |

**Comandi**: `npm run dev` (pannello e sito con anteprima dal vivo), `npm run build` (sito statico in `dist/`, da pubblicare su qualsiasi hosting), `npm run start` (pannello e sito in produzione: ogni pubblicazione ricostruisce il sito).

Contenuti e immagini restano in `.materialize/`: fanne un backup.
