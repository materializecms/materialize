import node from '@astrojs/node'
import materialize from '@materializecms/astro'
import { defineConfig } from 'astro/config'

export default defineConfig({
  // Pages are static files; only the editor's live preview renders on demand.
  output: 'static',
  adapter: node({ mode: 'middleware' }),
  integrations: [materialize()],
})
