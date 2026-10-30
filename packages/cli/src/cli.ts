#!/usr/bin/env node
import { watch } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { styleText } from 'node:util'
import type { MaterializeConfig } from '@materializecms/core'
import { type Redirect, resolveRedirect } from '@materializecms/core/seo'
import { createAuthStore, createContentStore, createSettingsStore } from '@materializecms/db'
import { apiCaller, createFonts, createMcpServer, createMediaFiles, startServer, VERSION } from '@materializecms/server'
import { findConfig, loadConfig } from './load-config.ts'
import { buildSite, exportFonts, exportMedia, type Handler, hasSite, ProductionSite, startDevSite } from './site.ts'

const dim = (s: string) => styleText('dim', s)
const accent = (s: string) => styleText(['bold', 'blue'], s)
const ok = (s: string) => styleText('green', s)
const fail = (s: string) => styleText('red', s)

const HELP = `
${accent('materialize')} ${dim(VERSION)}

  materialize dev      Avvia CMS e sito, ricarica lo schema a ogni salvataggio
  materialize build    Genera il sito statico in dist/client, immagini comprese
  materialize start    Avvia CMS e sito in produzione (il sito si rigenera a ogni pubblicazione)
  materialize mcp      Server MCP su stdio per i client AI locali (serve il CMS avviato)
  materialize --help   Mostra questo aiuto

Opzioni
  --port <numero>      Porta del server (predefinita: quella del config, 4321)
  --url <indirizzo>    Con mcp: il CMS a cui collegarsi (predefinito: http://localhost:<porta>)

Il server MCP usa un token personale (Impostazioni → AI e MCP) in MATERIALIZE_TOKEN.
`

function summary(config: MaterializeConfig): string {
  return config.collections.map((c) => c.name).join(', ')
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function run(mode: 'dev' | 'start' | 'build', args: string[]): Promise<void> {
  const cwd = process.cwd()
  const path = findConfig(cwd)
  if (!path) {
    console.error(fail('Non trovo materialize.config.ts in questa cartella.'))
    console.error(dim('Crea un nuovo progetto con: npm create materialize@latest'))
    process.exit(1)
  }

  let config: MaterializeConfig
  try {
    config = await loadConfig(path)
  } catch (error) {
    console.error(fail(describeError(error)))
    process.exit(1)
  }

  const withSite = hasSite(cwd)
  if (mode === 'build') {
    if (!withSite) {
      console.error(fail('Non c’è un sito da generare: manca astro.config.ts in questa cartella.'))
      process.exit(1)
    }
    const started = performance.now()
    await buildSite(cwd, `${cwd}/dist`)
    const images = await exportMedia(`${cwd}/dist/client`, createMediaFiles(config.media.dir))
    await exportFonts(`${cwd}/dist/client`, createFonts(join(dirname(resolve(config.media.dir)), 'fonts')))
    const elapsed = Math.round(performance.now() - started)
    console.log(`  ${ok('✓')} Sito generato in dist/client ${dim(`(${images} immagini, ${elapsed} ms)`)}`)
    process.exit(0)
  }

  const portFlag = args.indexOf('--port')
  const port = portFlag >= 0 ? Number(args[portFlag + 1]) : config.server.port
  let current = config
  // The site handler is swapped in once Astro is ready; until then visitors get a short wait page.
  let siteHandler: Handler = (_req, res) => {
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '1' })
    res.end('<meta http-equiv="refresh" content="1">Il sito si sta avviando…')
  }
  let production: ProductionSite | undefined
  let contentChanged = () => {}
  let redirectOf: (path: string) => Promise<string | null> = async () => null
  const server = await startServer(config, {
    port,
    site: withSite
      ? async (req, res) => {
          // Old addresses (moved pages, Impostazioni → SEO) answer with a permanent redirect.
          if (req.method === 'GET' || req.method === 'HEAD') {
            const url = new URL(req.url ?? '/', 'http://site')
            const to = await redirectOf(url.pathname)
            if (to) {
              res.writeHead(301, { location: to + url.search })
              res.end()
              return
            }
          }
          return siteHandler(req, res)
        }
      : undefined,
    onPublish: () => {
      void production?.rebuild()
      contentChanged()
    },
  })
  let closeSite: (() => Promise<void>) | undefined
  if (withSite) {
    const runtime = await import('@materializecms/astro/runtime')
    contentChanged = runtime.contentChanged
    const { setRuntime } = runtime
    const settings = createSettingsStore(server.database.db)
    setRuntime({
      config: () => current,
      content: createContentStore(server.database.db),
      auth: createAuthStore(server.database.db),
      settings,
    })
    redirectOf = async (path) => {
      if (/\.[a-z0-9]+$/i.test(path) && !path.endsWith('.html')) return null
      return resolveRedirect((await settings.get<Redirect[]>('redirects')) ?? [], path)
    }
    if (mode === 'dev') {
      const site = await startDevSite(cwd, port + 1)
      siteHandler = site.handle
      closeSite = site.close
    } else {
      production = new ProductionSite(cwd, (message, success) =>
        console.log(`  ${success ? ok('✓') : fail('✗')} ${message}`),
      )
      siteHandler = production.handle
      void production.rebuild()
    }
  }

  console.log()
  console.log(`  ${accent('Materialize')} ${dim(VERSION)}  ${config.site.name}`)
  console.log()
  console.log(`  ${dim((withSite ? 'Sito' : 'Locale').padEnd(12))}${server.url}`)
  console.log(`  ${dim('Pannello')}    ${server.url}/admin`)
  console.log(`  ${dim('API')}         ${server.url}/api/schema`)
  console.log(`  ${dim('Database')}    ${config.database.url}`)
  console.log(`  ${dim('Collezioni')}  ${summary(config)}`)
  console.log()

  if (mode === 'dev') {
    let timer: NodeJS.Timeout | undefined
    console.log(dim(`  In ascolto delle modifiche a ${relative(cwd, path)}…`))
    watch(path, () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          const next = await loadConfig(path)
          server.reload(next)
          current = next
          console.log(`  ${ok('✓')} Schema ricaricato ${dim(`(${summary(next)})`)}`)
        } catch (error) {
          console.log(`  ${fail('✗')} Lo schema ha un problema, resto sulla versione precedente:`)
          console.log(dim(describeError(error).replace(/^/gm, '    ')))
        }
      }, 120)
    })
  }

  const stop = async () => {
    await closeSite?.()
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

/**
 * MCP over stdio, for AI clients that start a local process: the same tools as /mcp, sent to a
 * running CMS with a personal access token. Nothing but the protocol may go to stdout.
 */
async function mcp(args: string[]): Promise<void> {
  const token = process.env.MATERIALIZE_TOKEN?.trim()
  if (!token) {
    console.error('Manca MATERIALIZE_TOKEN: crea un token in Impostazioni → AI e MCP e passalo al client.')
    process.exit(1)
  }
  const flag = args.indexOf('--url')
  let url = flag >= 0 ? args[flag + 1] : process.env.MATERIALIZE_URL
  if (!url) {
    const path = findConfig(process.cwd())
    const port = path ? (await loadConfig(path)).server.port : 4321
    url = `http://localhost:${port}`
  }
  const base = url.replace(/\/+$/, '')
  const health = await fetch(`${base}/api/health`).catch(() => null)
  if (!health?.ok) {
    console.error(`Il CMS non risponde su ${base}: avvialo con materialize dev (o start), oppure indica --url.`)
    process.exit(1)
  }
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  const server = createMcpServer(apiCaller(fetch, { authorization: `Bearer ${token}` }, base), VERSION)
  await server.connect(new StdioServerTransport())
}

const [command = 'help', ...args] = process.argv.slice(2)
if (command === 'dev' || command === 'start' || command === 'build') {
  await run(command, args)
} else if (command === 'mcp') {
  await mcp(args)
} else if (command === '--version' || command === '-v') {
  console.log(VERSION)
} else {
  console.log(HELP)
  if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
}
