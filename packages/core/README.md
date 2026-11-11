<img src="https://raw.githubusercontent.com/materializecms/materialize/main/docs/assets/logo-icon.svg" alt="Materialize" width="48" height="48">

# @materializecms/core

Materialize's content model: collections, fields, validation, section library, SEO.

This is where the site's schema is defined in `materialize.config.ts`, with `defineConfig`, `defineCollection` and the `f.*` fields. It also has the shared types, the page builder's section library, SEO and animations.

```ts
import { defineCollection, defineConfig, f } from '@materializecms/core'
```

## Materialize

An open-source CMS with a visual editor: pages are designed on a canvas, and the site is made of fast static files. The panel speaks English and Italian. For a new site (Node 24 or later):

```bash
npm create materialize@latest
```

Documentation and code: https://github.com/materializecms/materialize ([guide](https://github.com/materializecms/materialize/blob/main/docs/guide/README.md), [guida in italiano](https://github.com/materializecms/materialize/blob/main/docs/guida/README.md)) · MIT license.
