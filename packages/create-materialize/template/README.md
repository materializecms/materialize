# __SITE_NAME__

Sito creato con [Materialize](https://www.npmjs.com/package/create-materialize): contenuti nel pannello, pagine statiche e veloci.

## Avvio

```bash
npm run dev
```

Apri http://localhost:4321/admin, crea l’account di amministratore e poi una pagina con indirizzo `home`.

## Dove mettere le mani

| Cosa | Dove |
| --- | --- |
| Modello dei contenuti (raccolte, blocchi, campi) | `materialize.config.ts` |
| Aspetto di ogni blocco | `src/blocks/` — un componente per blocco, con lo stesso nome |
| Intestazione, piè di pagina, menu | `src/layouts/Site.astro` |
| Colori, caratteri, spaziature | `src/styles/site.css` |

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Pannello e sito con anteprima dal vivo |
| `npm run build` | Sito statico in `dist/`, da pubblicare su qualsiasi hosting |
| `npm run start` | Pannello e sito in produzione: ogni pubblicazione ricostruisce il sito |

Contenuti e immagini restano in `.materialize/`: fanne un backup.
