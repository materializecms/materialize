import { serve } from '@hono/node-server'
import { ADMIN_DIST } from '@materialize/admin'
import type { MaterializeConfig } from '@materialize/core'
import { openDatabase } from '@materialize/db'
import { createApp } from './app.ts'

export { createApp, type ServerContext, VERSION } from './app.ts'
export { hashPassword, verifyPassword } from './password.ts'

export interface RunningServer {
  url: string
  /** Swap the schema without restarting: used by `materialize dev` when the config changes. */
  reload: (config: MaterializeConfig) => void
  close: () => Promise<void>
}

export async function startServer(initial: MaterializeConfig, options: { port?: number } = {}): Promise<RunningServer> {
  let config = initial
  const database = await openDatabase(config.database)
  const app = createApp({ config: () => config, database, adminDir: ADMIN_DIST })
  const port = options.port ?? config.server.port
  const server = serve({ fetch: app.fetch, port })
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve)
    server.once('error', reject)
  })
  return {
    url: `http://localhost:${port}`,
    reload: (next) => {
      config = next
    },
    close: () =>
      new Promise((resolve) => {
        server.close(() => {
          database.close()
          resolve()
        })
      }),
  }
}
