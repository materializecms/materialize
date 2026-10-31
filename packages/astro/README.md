# @materializecms/astro

L'integrazione Astro di Materialize: il sito dai contenuti pubblicati e l'anteprima delle bozze sulla tela.

Si aggiunge in `astro.config.ts`:

```ts
import materialize from '@materializecms/astro'

export default defineConfig({ integrations: [materialize()] })
```

Contiene anche i componenti per blocchi, testo formattato e immagini, e le funzioni per leggere i contenuti nelle pagine.

## Materialize

CMS open source con editor visuale: le pagine si disegnano sulla tela, il sito è fatto di file statici veloci. Per un nuovo sito (serve Node 24):

```bash
npm create materialize@latest
```

Documentazione e codice: https://github.com/materializecms/materialize · Licenza MIT.
