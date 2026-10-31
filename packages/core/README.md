# @materializecms/core

Il modello dei contenuti di Materialize: raccolte, campi, validazione, libreria di sezioni, SEO.

Qui si definisce lo schema del sito in `materialize.config.ts`, con `defineConfig`, `defineCollection` e i campi `f.*`. Contiene anche i tipi condivisi, la libreria di sezioni del costruttore di pagine, la SEO e le animazioni.

```ts
import { defineCollection, defineConfig, f } from '@materializecms/core'
```

## Materialize

CMS open source con editor visuale: le pagine si disegnano sulla tela, il sito è fatto di file statici veloci. Per un nuovo sito (serve Node 24):

```bash
npm create materialize@latest
```

Documentazione e codice: https://github.com/materializecms/materialize · Licenza MIT.
