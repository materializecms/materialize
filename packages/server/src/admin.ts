import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import type { Context } from 'hono'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

async function isFile(path: string): Promise<boolean> {
  return (await stat(path).catch(() => null))?.isFile() ?? false
}

/**
 * Serves the built admin app from `dir`. Hashed files under assets/ are cached forever;
 * any other path without an extension falls back to index.html (client-side routing).
 */
export async function serveAdmin(c: Context, dir: string | undefined): Promise<Response> {
  const index = dir ? join(dir, 'index.html') : ''
  if (!dir || !(await isFile(index))) {
    return c.html(
      '<!doctype html><meta charset="utf-8"><title>Materialize</title><body style="font:15px system-ui;padding:40px">' +
        '<h1 style="font-size:20px">Il pannello non è ancora compilato</h1>' +
        '<p>Esegui <code>npm run build</code> nella cartella di Materialize, poi ricarica la pagina.</p>',
      503,
    )
  }
  const relative = decodeURIComponent(c.req.path.replace(/^\/admin\/?/, ''))
  const file = normalize(join(dir, relative))
  if (relative && file.startsWith(dir + sep) && (await isFile(file))) {
    const immutable = relative.startsWith('assets/')
    return c.body(await readFile(file), 200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
  }
  if (extname(relative)) return c.text('Not found', 404)
  return c.body(await readFile(index), 200, { 'content-type': TYPES['.html'] as string, 'cache-control': 'no-cache' })
}
