import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The admin is served by the Materialize server at /admin. In `npm run dev:admin`
// Vite proxies the API to a running `materialize dev` on port 4321.
const api = process.env.MATERIALIZE_API ?? 'http://localhost:4321'

export default defineConfig({
  base: '/admin/',
  plugins: [react(), tailwindcss()],
  build: { outDir: 'dist', emptyOutDir: true, chunkSizeWarningLimit: 1200 },
  server: {
    port: 5173,
    proxy: {
      // The API checks Origin against its own host (CSRF), so the proxy presents itself as that host.
      '/api': { target: api, changeOrigin: true, headers: { origin: api } },
    },
  },
})
