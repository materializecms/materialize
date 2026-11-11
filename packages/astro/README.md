<img src="https://raw.githubusercontent.com/materializecms/materialize/main/docs/assets/logo-icon.svg" alt="Materialize" width="48" height="48">

# @materializecms/astro

Materialize's Astro integration: the site from published content, and draft previews on the canvas.

Add it in `astro.config.ts`:

```ts
import materialize from '@materializecms/astro'

export default defineConfig({ integrations: [materialize()] })
```

It also has the components for blocks, formatted text, images and visitor comments, and the functions to read content in pages.

## Materialize

An open-source CMS with a visual editor: pages are designed on a canvas, and the site is made of fast static files. The panel speaks English and Italian. For a new site (Node 24 or later):

```bash
npm create materialize@latest
```

Documentation and code: https://github.com/materializecms/materialize ([guide](https://github.com/materializecms/materialize/blob/main/docs/guide/README.md), [guida in italiano](https://github.com/materializecms/materialize/blob/main/docs/guida/README.md)) · MIT license.
