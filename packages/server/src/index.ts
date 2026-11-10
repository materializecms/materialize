import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { ADMIN_DIST } from '@materializecms/admin'
import type { MaterializeConfig } from '@materializecms/core'
import type { Updates } from '@materializecms/core/updates'
import { type Database, openDatabase } from '@materializecms/db'
import { createApp } from './app.ts'
import { t } from './t.ts'

export {
  isPatch,
  newer,
  type ReleaseNotes,
  type UpdateSettings,
  type UpdateStatus,
  type Updates,
} from '@materializecms/core/updates'
export { createApp, type ServerContext, VERSION } from './app.ts'
export { extractTarGz } from './archive.ts'
export { restoreMedia } from './backups.ts'
export { createFonts, type FontInfo, type Fonts } from './fonts.ts'
export { createMcpServer, registerTools } from './mcp.ts'
export { createMediaFiles, type MediaFiles } from './media.ts'
export { decryptTree, type OffsiteSettings, parseRecoveryKey } from './offsite.ts'
export { hashPassword, verifyPassword } from './password.ts'
export { apiCaller, siteTools } from './tools.ts'

/** Serves the public site: every request outside /api, /admin and /media goes here. */
export type SiteHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>

export interface RunningServer {
  url: string
  database: Database
  /** Swap the schema without restarting: used by `materialize dev` when the config changes. */
  reload: (config: MaterializeConfig) => void
  close: () => Promise<void>
}

export interface ServerOptions {
  port?: number
  /** The address to listen on: every interface when missing, 127.0.0.1 behind a proxy on the same machine. */
  host?: string
  /** The site renderer. Without one, "/" shows a status page. */
  site?: SiteHandler
  onPublish?: () => void
  updates?: Updates
  /** Required by the installation in the browser while there is no account yet. */
  setupToken?: string
}

const OWN = /^\/(api|admin|media|fonts|mcp)(\/|\?|$)/

/** This computer: browsers may refuse HSTS over plain http, and it would stick to localhost for months. */
const isLocalHost = (hostname: string) =>
  hostname === 'localhost' ||
  hostname.endsWith('.localhost') ||
  /^127\.\d+\.\d+\.\d+$/.test(hostname) ||
  hostname === '[::1]'

/**
 * Whether the visitor reached the site over HTTPS: directly, through a proxy the config trusts, or at
 * a site whose address is https (not on this computer). The same rule as the session cookie in app.ts.
 */
export function secureSiteRequest(req: IncomingMessage, config: MaterializeConfig): boolean {
  if ((req.socket as { encrypted?: boolean }).encrypted) return true
  const proto = req.headers['x-forwarded-proto']
  if (
    config.server.trustProxy &&
    String(proto ?? '')
      .split(',')[0]
      ?.trim() === 'https'
  )
    return true
  let hostname = 'localhost'
  try {
    hostname = new URL(`http://${req.headers.host ?? 'localhost'}`).hostname
  } catch {}
  return !isLocalHost(hostname) && !!config.site.url?.startsWith('https:')
}

/**
 * The security headers of every page of the public site, in dev and production (pages, 404, feeds,
 * static files, redirects): the site skips Hono, so its secureHeaders never sees these requests.
 * Set before the renderer runs, so the headers it writes (x-robots-tag on share links) add to these.
 * Framing stays allowed from the same origin, where the editor previews the site; no script rules,
 * since sites run their own code and tracking scripts.
 */
export function setSiteHeaders(req: IncomingMessage, res: ServerResponse, config: MaterializeConfig): void {
  res.setHeader('x-content-type-options', 'nosniff')
  res.setHeader('referrer-policy', 'strict-origin-when-cross-origin')
  res.setHeader('x-frame-options', 'SAMEORIGIN')
  res.setHeader('content-security-policy', "frame-ancestors 'self'")
  if (secureSiteRequest(req, config)) res.setHeader('strict-transport-security', 'max-age=15552000')
}

export async function startServer(initial: MaterializeConfig, options: ServerOptions = {}): Promise<RunningServer> {
  let config = initial
  const database = await openDatabase(config.database)
  const app = createApp({
    config: () => config,
    database,
    adminDir: ADMIN_DIST,
    preview: !!options.site,
    onPublish: options.onPublish,
    updates: options.updates,
    setupToken: options.setupToken,
  })
  const api = getRequestListener(app.fetch)
  const site = options.site
  const server = createServer((req, res) => {
    if (site && !OWN.test(req.url ?? '/')) {
      setSiteHeaders(req, res, config)
      Promise.resolve()
        .then(() => site(req, res))
        .catch((error) => {
          // A malformed address (/%E0%A4%A) is the visitor's mistake, not the site's.
          if (error instanceof URIError) {
            if (!res.headersSent) res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Bad request')
            return
          }
          console.error(error)
          if (!res.headersSent) res.writeHead(500).end(t('Errore del sito'))
        })
      return
    }
    void api(req, res)
  })
  const port = options.port ?? config.server.port
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, options.host, resolve)
  })
  return {
    url: `http://localhost:${port}`,
    database,
    reload: (next) => {
      config = next
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          database.close()
          resolve()
        })
        server.closeAllConnections()
      }),
  }
}
