import { createHash } from 'node:crypto'
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
 * The panel's Content Security Policy: scripts only from the panel itself (plus the small inline
 * script that applies the theme, allowed by its hash), data sent only to this server, no plugins,
 * and the panel cannot be framed by other sites. Styles and pictures stay open: pages on the
 * canvas carry inline styles and images from anywhere.
 */
function policy(inlineScripts: string[]): string {
  const hashes = inlineScripts.map((s) => `'sha256-${createHash('sha256').update(s).digest('base64')}'`)
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline'",
    'img-src * data: blob:',
    'media-src * data: blob:',
    "font-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self' https: blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join('; ')
}

/**
 * Where previews run code the panel's policy would block (custom code, the site's own scripts):
 * an empty page, same origin, with no policy of its own. The panel fills it: the site preview is
 * written in, custom code goes into a sandboxed frame inside it.
 */
export const FRAME_PATH = '/admin/frame.html'
const FRAME_HTML =
  '<!doctype html><html data-mz-blank style="height:100%"><meta charset="utf-8"><title></title><body style="margin:0;height:100%"></body></html>'

let cachedIndex: { path: string; html: string; csp: string } | null = null
async function indexOf(path: string) {
  const html = await readFile(path, 'utf8')
  if (cachedIndex?.path === path && cachedIndex.html === html) return cachedIndex
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1] as string)
  cachedIndex = { path, html, csp: policy(inline) }
  return cachedIndex
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
  if (c.req.path === FRAME_PATH)
    return c.body(FRAME_HTML, 200, {
      'content-type': TYPES['.html'] as string,
      'cache-control': 'no-cache',
      'content-security-policy': "frame-ancestors 'self'",
    })
  const relative = decodeURIComponent(c.req.path.replace(/^\/admin\/?/, ''))
  const file = normalize(join(dir, relative))
  if (relative && relative !== 'index.html' && file.startsWith(dir + sep) && (await isFile(file))) {
    const immutable = relative.startsWith('assets/')
    return c.body(await readFile(file), 200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    })
  }
  if (extname(relative)) return c.text('Not found', 404)
  const page = await indexOf(index)
  return c.body(page.html, 200, {
    'content-type': TYPES['.html'] as string,
    'cache-control': 'no-cache',
    'content-security-policy': page.csp,
  })
}
