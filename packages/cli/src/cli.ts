#!/usr/bin/env node
import { watch } from 'node:fs'
import { copyFile, mkdir, open, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { styleText } from 'node:util'
import type { MaterializeConfig } from '@materializecms/core'
import { type Redirect, resolveRedirect } from '@materializecms/core/seo'
import { createAuthStore, createContentStore, createSettingsStore, openDatabase } from '@materializecms/db'
import {
  apiCaller,
  createFonts,
  createMcpServer,
  createMediaFiles,
  extractTarGz,
  restoreMedia,
  startServer,
  VERSION,
} from '@materializecms/server'
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
  materialize restore <file>
                       Rimette un backup (content-….db, o l'archivio completo materialize-….tar.gz);
                       il server va fermato
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

/**
 * Puts a backup back: a database copy (content-….db), whose missing images come back from the
 * media copy beside the backups, or a whole archive (materialize-….tar.gz: database, media and
 * fonts). The current database is kept as a backup first, so a restore can itself be undone.
 * The server must be stopped: it holds the database open.
 */
async function restore(args: string[]): Promise<void> {
  const file = args.find((a) => !a.startsWith('--'))
  const path = findConfig(process.cwd())
  if (!file || !path) {
    console.error(
      fail(
        !file
          ? 'Indica il file del backup: materialize restore <file>'
          : 'Non trovo materialize.config.ts in questa cartella.',
      ),
    )
    process.exit(1)
  }
  const config = await loadConfig(path)
  const head = Buffer.alloc(16)
  try {
    const handle = await open(resolve(file), 'r')
    await handle.read(head, 0, 16, 0)
    await handle.close()
  } catch {
    console.error(fail(`Non trovo il file ${file}`))
    process.exit(1)
  }
  // A SQLite file starts with "SQLite format 3", a .tar.gz with the gzip signature.
  const archive = head[0] === 0x1f && head[1] === 0x8b
  if (!archive && head.toString('latin1') !== 'SQLite format 3\0') {
    console.error(fail(`${file} non è un backup: serve un content-….db o un materialize-….tar.gz.`))
    process.exit(1)
  }
  const local = config.database.url.startsWith('file:')
  if (!local && !archive) {
    console.error(fail('Il database è ospitato da un fornitore: ripristina il backup dal suo pannello.'))
    process.exit(1)
  }
  const running = await fetch(`http://localhost:${config.server.port}/api/setup`, { signal: AbortSignal.timeout(1500) })
    .then(() => true)
    .catch(() => false)
  if (running) {
    console.error(fail(`Il server è acceso sulla porta ${config.server.port}: fermalo, poi ripeti il comando.`))
    process.exit(1)
  }

  const mediaDir = resolve(config.media.dir)
  const fontsDir = join(dirname(mediaDir), 'fonts')
  const db = local ? resolve(config.database.url.slice('file:'.length)) : null
  let kept: string | null = null
  // The images the backup uses, read before it replaces the database (one connection, opened once).
  let keys: string[] = []
  if (db) {
    const backups = join(dirname(db), 'backups')
    await mkdir(backups, { recursive: true })
    const p = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    kept = join(
      backups,
      `content-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-prima-del-ripristino.db`,
    )
    // Made by SQLite, which also reads what is still in the write-ahead file.
    const current = await openDatabase(config.database)
    await current.client.execute({ sql: 'VACUUM INTO ?', args: [kept] })
    if (!archive) {
      await current.client.execute({ sql: 'ATTACH DATABASE ? AS restored', args: [resolve(file)] })
      keys = (await current.client.execute('SELECT key FROM restored.media')).rows.map((r) => String(r.key))
      await current.client.execute('DETACH DATABASE restored')
    }
    current.close()
    // The write-ahead files belong to the old database.
    await rm(`${db}-wal`, { force: true })
    await rm(`${db}-shm`, { force: true })
  }

  if (archive) {
    // Only what belongs where it says: the database, flat media names, fonts without "..".
    const written = await extractTarGz(resolve(file), (name) => {
      if (name === 'content.db') return db
      const media = /^media\/([^/\\]+)$/.exec(name)?.[1]
      if (media && !media.startsWith('.')) return join(mediaDir, media)
      const font = /^fonts\/(.+)$/.exec(name)?.[1]
      if (font && !font.split('/').some((part) => part === '..' || part.startsWith('.'))) return join(fontsDir, font)
      return null
    })
    const media = written.filter((n) => n.startsWith('media/')).length
    console.log(`  ${ok('✓')} Archivio ripristinato: ${relative(process.cwd(), resolve(file))}`)
    console.log(
      dim(
        `  ${written.includes('content.db') ? 'Database, ' : ''}${media} file dei media, ${written.length - media - (written.includes('content.db') ? 1 : 0)} file dei caratteri.`,
      ),
    )
  } else if (db) {
    await copyFile(resolve(file), db)
    // The images this database uses that are no longer in the library come back from the media copy.
    const back = await restoreMedia(db, mediaDir, keys)
    console.log(`  ${ok('✓')} Backup ripristinato: ${relative(process.cwd(), resolve(file))}`)
    if (back)
      console.log(dim(`  ${back} ${back === 1 ? 'immagine tornata' : 'immagini tornate'} dalla copia dei media.`))
  }
  if (kept)
    console.log(dim(`  Il database di prima è in ${relative(process.cwd(), kept)}, se servisse tornare indietro.`))
}

const [command = 'help', ...args] = process.argv.slice(2)
if (command === 'dev' || command === 'start' || command === 'build') {
  await run(command, args)
} else if (command === 'mcp') {
  await mcp(args)
} else if (command === 'restore') {
  await restore(args)
} else if (command === '--version' || command === '-v') {
  console.log(VERSION)
} else {
  console.log(HELP)
  if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
}
