import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import { ADMIN_DIST } from '@materializecms/admin'
import type { MaterializeConfig } from '@materializecms/core'
import type { Updates } from '@materializecms/core/updates'
import { type Database, openDatabase } from '@materializecms/db'
import { createApp } from './app.ts'

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
  /** The site renderer. Without one, "/" shows a status page. */
  site?: SiteHandler
  onPublish?: () => void
  updates?: Updates
  /** Required by the installation in the browser while there is no account yet. */
  setupToken?: string
}

const OWN = /^\/(api|admin|media|fonts|mcp)(\/|\?|$)/

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
      Promise.resolve(site(req, res)).catch((error) => {
        console.error(error)
        if (!res.headersSent) res.writeHead(500).end('Errore del sito')
      })
      return
    }
    void api(req, res)
  })
  const port = options.port ?? config.server.port
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, resolve)
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
