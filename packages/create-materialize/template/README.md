# __SITE_NAME__

Sito creato con [Materialize](https://www.npmjs.com/package/create-materialize): contenuti nel pannello, pagine statiche e veloci.

## Avvio

```bash
npm run dev
```

Apri http://localhost:4321/admin, crea l’account di amministratore e poi una pagina con indirizzo `home`: parti da una pagina pronta o componila con le sezioni della libreria.

## Dove mettere le mani

| Cosa | Dove |
| --- | --- |
| Pagine, sezioni, animazioni | Il pannello, sulla tela |
| Colori, caratteri e forme del sito | Il pannello, scheda **Stili** dell’editor |
| Modello dei contenuti (raccolte e campi) | `materialize.config.ts` |
| Struttura HTML comune (meta, caratteri) | `src/layouts/Site.astro` |

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Pannello e sito con anteprima dal vivo |
| `npm run build` | Sito statico in `dist/`, da pubblicare su qualsiasi hosting |
| `npm run start` | Pannello e sito in produzione: ogni pubblicazione ricostruisce il sito |

Contenuti e immagini restano in `.materialize/`: fanne un backup.
