import { fileURLToPath } from 'node:url'

/** Folder with the built admin (`npm run build -w @materialize/admin`), served by the server at /admin. */
export const ADMIN_DIST = fileURLToPath(new URL('../dist', import.meta.url))
