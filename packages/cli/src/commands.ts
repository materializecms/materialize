import './lang.ts'
import { randomBytes } from 'node:crypto'
import { existsSync, watch } from 'node:fs'
import { copyFile, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { styleText } from 'node:util'
import type { MaterializeConfig } from '@materializecms/core'
import { type Redirect, resolveRedirect } from '@materializecms/core/seo'
import {
  createActivityStore,
  createAuthStore,
  createContentStore,
  createPreviewLinkStore,
  createSettingsStore,
  openDatabase,
} from '@materializecms/db'
import {
  apiCaller,
  applyArchive,
  createFonts,
  createMcpServer,
  createMediaFiles,
  decryptTree,
  movePending,
  type OffsiteSettings,
  parseRecoveryKey,
  pendingRestore,
  type RestoreResult,
  type Restorer,
  restoreMedia,
  startServer,
  VERSION,
} from '@materializecms/server'
import { listenHost, onlyThisComputer } from './host.ts'
import { findConfig, loadConfig } from './load-config.ts'
import { buildSite, exportFonts, exportMedia, type Handler, hasSite, ProductionSite, startDevSite } from './site.ts'
import { RESTART } from './supervisor.ts'
import { t } from './t.ts'
import { createUpdates } from './updates.ts'

const dim = (s: string) => styleText('dim', s)
const accent = (s: string) => styleText(['bold', 'blue'], s)
const ok = (s: string) => styleText('green', s)
const fail = (s: string) => styleText('red', s)

/** Wraps a description at the help's width, aligned under its column. */
function wrap(text: string, width = 78): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && line.length + word.length + 1 > width) {
      lines.push(line)
      line = word
    } else line = line ? `${line} ${word}` : word
  }
  return [...lines, line]
}

/** One entry of the help: the command (on its own line when long), then its description. */
function row(command: string, text: string): string {
  const pad = ' '.repeat(23)
  const [first = '', ...rest] = wrap(text)
  const head = command.length > 19 ? `  ${command}\n${pad}${first}` : `  ${command.padEnd(21)}${first}`
  return [head, ...rest.map((l) => pad + l)].join('\n')
}

function help(): string {
  return [
    '',
    `${accent('materialize')} ${dim(VERSION)}`,
    '',
    row('materialize dev', t('Avvia CMS e sito, ricarica lo schema a ogni salvataggio')),
    row('materialize build', t('Genera il sito statico in dist/client, immagini comprese')),
    row(
      'materialize start',
      t(
        'Avvia CMS e sito in produzione (il sito si rigenera a ogni pubblicazione); un supervisore lo tiene acceso e applica gli aggiornamenti dal pannello',
      ),
    ),
    row('materialize mcp', t('Server MCP su stdio per i client AI locali (serve il CMS avviato)')),
    row(
      'materialize restore <file>',
      t('Rimette un backup (content-….db, o l’archivio completo materialize-….tar.gz); il server va fermato'),
    ),
    row(
      'materialize reset-password <email>',
      t(
        'Un link per una nuova password, valido un’ora: per chi non può riceverlo per email (per esempio l’unico amministratore, senza email configurata)',
      ),
    ),
    row(
      `materialize decrypt <${t('cartella o file')}> [--key <${t('chiave')}>]`,
      t(
        'Decifra i backup scaricati dallo spazio esterno (S3, WebDAV); la chiave di ripristino si può dare anche con MATERIALIZE_BACKUP_KEY',
      ),
    ),
    row('materialize --help', t('Mostra questo aiuto')),
    '',
    t('Opzioni'),
    row(`--port <${t('numero')}>`, t('Porta del server (predefinita: quella del config, 4321)')),
    row(
      `--host <${t('indirizzo')}>`,
      t(
        'Indirizzo su cui ascoltare. Con dev: solo questo computer (0.0.0.0 per provarlo dal telefono sulla stessa rete). Con start: tutti (127.0.0.1 dietro un proxy)',
      ),
    ),
    row(`--url <${t('indirizzo')}>`, t('Con mcp: il CMS a cui collegarsi (predefinito: http://localhost:<porta>)')),
    row('--no-supervisor', t('Con start: senza supervisore (se il server lo tiene acceso un altro programma)')),
    '',
    t('Il server MCP usa un token personale (Impostazioni → AI e MCP) in MATERIALIZE_TOKEN.'),
    '',
  ].join('\n')
}

/** Kept until the installation is done, so a restart (or the VPS installer, which reads it) keeps the same link. */
const INSTALL_CODE = '.materialize/install-code'

async function installCode(site: string): Promise<string> {
  const path = join(site, INSTALL_CODE)
  const kept = await readFile(path, 'utf8').catch(() => '')
  if (/^[\w-]{12,}$/.test(kept.trim())) return kept.trim()
  const code = randomBytes(9).toString('base64url')
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, code, { mode: 0o600 })
  return code
}

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
    console.error(fail(t('Non trovo materialize.config.ts in questa cartella.')))
    console.error(dim(t('Crea un nuovo progetto con: npm create materialize@latest')))
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
      console.error(fail(t('Non c’è un sito da generare: manca astro.config.ts in questa cartella.')))
      process.exit(1)
    }
    const started = performance.now()
    await buildSite(cwd, `${cwd}/dist`)
    const images = await exportMedia(`${cwd}/dist/client`, createMediaFiles(config.media.dir))
    await exportFonts(`${cwd}/dist/client`, createFonts(join(dirname(resolve(config.media.dir)), 'fonts')))
    const elapsed = Math.round(performance.now() - started)
    console.log(
      `  ${ok('✓')} ${t('Sito generato in dist/client')} ${dim(`(${t.n(images, 'un’immagine', '{n} immagini')}, ${elapsed} ms)`)}`,
    )
    process.exit(0)
  }

  const flag = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined)
  const port = Number(flag('--port') ?? config.server.port)
  const host = listenHost(mode, flag('--host'), process.env.MATERIALIZE_HOST)
  let current = config
  // The site handler is swapped in once Astro is ready; until then visitors get a short wait page.
  let siteHandler: Handler = (_req, res) => {
    res.writeHead(503, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '1' })
    res.end('<meta http-equiv="refresh" content="1">Il sito si sta avviando…')
  }
  let production: ProductionSite | undefined
  let contentChanged = () => {}
  let redirectOf: (path: string) => Promise<string | null> = async () => null
  let closeSite: (() => Promise<void>) | undefined
  // The supervisor (supervisor.ts) starts the server again: with a new version, or a restored archive.
  const restartServer = async () => {
    await closeSite?.()
    await server.close()
    process.exit(RESTART)
  }
  const updates = createUpdates({ site: cwd, mode, restart: restartServer })
  // An archive uploaded from the panel waits for the restart, then goes in before the database opens.
  const pending = pendingRestore(dirname(resolve(config.media.dir)))
  if (mode === 'start') await applyPendingRestore(config)
  const restorer: Restorer = {
    unavailable: () =>
      mode === 'dev'
        ? t('In sviluppo (materialize dev) il ripristino si fa da terminale, con materialize restore.')
        : process.env.MATERIALIZE_SUPERVISED
          ? undefined
          : t(
              'Il server è avviato senza il suo supervisore: ripristina da terminale con materialize restore, oppure avvialo con materialize start.',
            ),
    schedule: async (file) => {
      await rm(pending.result, { force: true })
      await movePending(file, pending.file)
      await restartServer()
    },
    result: async () => JSON.parse(await readFile(pending.result, 'utf8').catch(() => 'null')) as RestoreResult | null,
  }
  // In production the first account needs the link printed below: a fresh server online cannot be
  // claimed by whoever finds it first.
  const setupToken = mode === 'start' ? await installCode(cwd) : undefined
  const server = await startServer(config, {
    updates,
    restore: restorer,
    setupToken,
    port,
    host,
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
      previews: createPreviewLinkStore(server.database.db),
    })
    redirectOf = async (path) => {
      if (/\.[a-z0-9]+$/i.test(path) && !path.endsWith('.html')) return null
      return resolveRedirect((await settings.get<Redirect[]>('redirects')) ?? [], path)
    }
    if (mode === 'dev') {
      const site = await startDevSite(cwd, port + 1, host)
      siteHandler = site.handle
      closeSite = site.close
    } else {
      let built = false
      production = new ProductionSite(cwd, (message, success) => {
        built = success
        console.log(`  ${success ? ok('✓') : fail('✗')} ${message}`)
      })
      siteHandler = production.handle
      // Under the supervisor: ready once the site is built, so a new version that cannot build it is undone.
      void production.rebuild().then(async () => {
        if (built) await updates.ready()
        process.send?.(built ? 'ready' : 'failed')
      })
    }
  }

  if (!production) await updates.ready().then(() => process.send?.('ready'))
  console.log()
  console.log(`  ${accent('Materialize')} ${dim(VERSION)}  ${config.site.name}`)
  console.log()
  // Online (Docker, a VPS) the public address is the one to open; the local one only answers inside.
  const publicUrl = mode === 'start' ? config.site.url?.replace(/\/+$/, '') : undefined
  const base = publicUrl ?? server.url
  const rows: [string, string][] = [
    [withSite ? t('Sito') : t('Locale'), base],
    [t('Pannello'), `${base}/admin`],
    ['API', `${base}/api/schema`],
    ...(publicUrl ? [[t('In ascolto su'), server.url] as [string, string]] : []),
    ['Database', config.database.url],
    [t('Collezioni'), summary(config)],
  ]
  const width = Math.max(12, ...rows.map(([label]) => label.length + 2))
  for (const [label, value] of rows) console.log(`  ${dim(label.padEnd(width))}${value}`)
  console.log()
  if (mode === 'dev' && onlyThisComputer(host)) {
    console.log(dim(`  ${t('Raggiungibile solo da questo computer. Per provarlo dal telefono: --host 0.0.0.0')}`))
    console.log()
  }
  if ((await createAuthStore(server.database.db).countUsers()) > 0) {
    if (setupToken) await rm(join(cwd, INSTALL_CODE), { force: true })
  } else {
    const path = `/admin/${setupToken ? `?installa=${setupToken}` : ''}`
    const site = publicUrl
    const label = t('Installazione')
    console.log(`  ${accent(label)}  ${t('apri {url}', { url: `${site ?? server.url}${path}` })}`)
    if (setupToken && !site)
      console.log(
        dim(
          `${' '.repeat(label.length + 5)}(${t('online: lo stesso indirizzo dal tuo dominio, {url}', { url: `https://…${path}` })})`,
        ),
      )
    console.log()
  }

  if (mode === 'dev') {
    let timer: NodeJS.Timeout | undefined
    console.log(dim(`  ${t('In ascolto delle modifiche a {file}…', { file: relative(cwd, path) })}`))
    watch(path, () => {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        try {
          const next = await loadConfig(path)
          server.reload(next)
          current = next
          console.log(`  ${ok('✓')} ${t('Schema ricaricato')} ${dim(`(${summary(next)})`)}`)
        } catch (error) {
          console.log(`  ${fail('✗')} ${t('Lo schema ha un problema, resto sulla versione precedente:')}`)
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
    console.error(t('Manca MATERIALIZE_TOKEN: crea un token in Impostazioni → AI e MCP e passalo al client.'))
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
    console.error(
      t('Il CMS non risponde su {url}: avvialo con materialize dev (o start), oppure indica --url.', { url: base }),
    )
    process.exit(1)
  }
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js')
  const server = createMcpServer(apiCaller(fetch, { authorization: `Bearer ${token}` }, base), VERSION)
  await server.connect(new StdioServerTransport())
}

/**
 * An archive uploaded from the panel (Impostazioni → Backup, or the installation) waits in
 * .materialize/restore: it goes in here, before the database opens. Whatever happens, the server
 * starts; the outcome is kept for the panel to show.
 */
export async function applyPendingRestore(config: MaterializeConfig): Promise<void> {
  const pending = pendingRestore(dirname(resolve(config.media.dir)))
  const save = (result: RestoreResult) => writeFile(pending.result, JSON.stringify(result))
  // Left from a start that stopped while applying it (no memory, no disk): never tried again.
  if (existsSync(pending.applying)) {
    await rm(pending.applying, { force: true })
    await save({ ok: false, at: new Date().toISOString(), error: t('Il ripristino si è interrotto a metà.') })
  }
  if (!existsSync(pending.file)) return
  await rename(pending.file, pending.applying)
  console.log(`  ${t('Ripristino l’archivio caricato dal pannello…')}`)
  try {
    const { written } = await applyArchive({
      file: pending.applying,
      database: config.database,
      mediaDir: config.media.dir,
    })
    await save({ ok: true, at: new Date().toISOString(), media: written.filter((n) => n.startsWith('media/')).length })
    console.log(`  ${ok('✓')} ${t('Archivio ripristinato')}`)
  } catch (error) {
    // The details stay here, in the server's log; the panel says only that it did not work.
    console.error(fail(`  ${t('Il ripristino non è riuscito: {error}', { error: (error as Error).message })}`))
    await save({ ok: false, at: new Date().toISOString(), error: (error as Error).message })
  }
  await rm(pending.applying, { force: true })
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
          ? t('Indica il file del backup: materialize restore <file>')
          : t('Non trovo materialize.config.ts in questa cartella.'),
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
    console.error(fail(t('Non trovo il file {file}', { file })))
    process.exit(1)
  }
  // A SQLite file starts with "SQLite format 3", a .tar.gz with the gzip signature.
  const archive = head[0] === 0x1f && head[1] === 0x8b
  if (!archive && head.toString('latin1') !== 'SQLite format 3\0') {
    console.error(fail(t('{file} non è un backup: serve un content-….db o un materialize-….tar.gz.', { file })))
    process.exit(1)
  }
  const local = config.database.url.startsWith('file:')
  if (!local && !archive) {
    console.error(fail(t('Il database è ospitato da un fornitore: ripristina il backup dal suo pannello.')))
    process.exit(1)
  }
  const running = await fetch(`http://localhost:${config.server.port}/api/setup`, { signal: AbortSignal.timeout(1500) })
    .then(() => true)
    .catch(() => false)
  if (running) {
    console.error(
      fail(t('Il server è acceso sulla porta {port}: fermalo, poi ripeti il comando.', { port: config.server.port })),
    )
    process.exit(1)
  }

  const mediaDir = resolve(config.media.dir)
  const db = local ? resolve(config.database.url.slice('file:'.length)) : null
  let kept: string | null = null
  if (archive) {
    // Only what belongs where it says: the database, flat media names, fonts without "..".
    const done = await applyArchive({ file: resolve(file), database: config.database, mediaDir: config.media.dir })
    kept = done.kept
    const { written } = done
    const media = written.filter((n) => n.startsWith('media/')).length
    const uploads = written.filter((n) => n.startsWith('uploads/')).length
    const withDb = written.includes('content.db')
    const fonts = written.length - media - uploads - (withDb ? 1 : 0)
    console.log(`  ${ok('✓')} ${t('Archivio ripristinato: {file}', { file: relative(process.cwd(), resolve(file)) })}`)
    const parts = [
      ...(withDb ? ['Database'] : []),
      t.n(media, 'un file dei media', '{n} file dei media'),
      t.n(fonts, 'un file dei caratteri', '{n} file dei caratteri'),
      t.n(uploads, 'un allegato dei moduli', '{n} allegati dei moduli'),
    ]
    console.log(dim(`  ${parts.join(', ')}.`))
  } else if (db) {
    const backups = join(dirname(db), 'backups')
    await mkdir(backups, { recursive: true })
    const p = (n: number) => String(n).padStart(2, '0')
    const d = new Date()
    kept = join(
      backups,
      `content-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-prima-del-ripristino.db`,
    )
    // Made by SQLite, which also reads what is still in the write-ahead file; the images the
    // backup uses are read before it replaces the database (one connection, opened once).
    const current = await openDatabase(config.database)
    await current.client.execute({ sql: 'VACUUM INTO ?', args: [kept] })
    await current.client.execute({ sql: 'ATTACH DATABASE ? AS restored', args: [resolve(file)] })
    const keys = (await current.client.execute('SELECT key FROM restored.media')).rows.map((r) => String(r.key))
    await current.client.execute('DETACH DATABASE restored')
    current.close()
    // The write-ahead files belong to the old database.
    await rm(`${db}-wal`, { force: true })
    await rm(`${db}-shm`, { force: true })
    await copyFile(resolve(file), db)
    // The images this database uses that are no longer in the library come back from the media copy.
    const back = await restoreMedia(db, mediaDir, keys)
    console.log(`  ${ok('✓')} ${t('Backup ripristinato: {file}', { file: relative(process.cwd(), resolve(file)) })}`)
    if (back)
      console.log(
        dim(
          `  ${t.n(back, 'Un’immagine è tornata dalla copia dei media.', '{n} immagini sono tornate dalla copia dei media.')}`,
        ),
      )
  }
  if (kept)
    console.log(
      dim(
        `  ${t('Il database di prima è in {file}, se servisse tornare indietro.', { file: relative(process.cwd(), kept) })}`,
      ),
    )
}

/**
 * A one-time link for a new password, printed here: the way back in for someone who cannot get it
 * by email, such as the only administrator of a site without email. Only who can run commands on
 * the server can ask for it. The server may be running.
 */
async function resetPassword(args: string[]): Promise<void> {
  const email = args
    .find((a) => !a.startsWith('--'))
    ?.trim()
    .toLowerCase()
  const path = findConfig(process.cwd())
  if (!email || !path) {
    console.error(
      fail(
        !email
          ? t('Indica l’email: materialize reset-password <email>')
          : t('Non trovo materialize.config.ts in questa cartella: lancia il comando dalla cartella del sito.'),
      ),
    )
    process.exit(1)
  }
  const config = await loadConfig(path)
  const database = await openDatabase(config.database)
  try {
    const auth = createAuthStore(database.db)
    const user = await auth.findForLogin(email)
    if (!user) {
      console.error(fail(t('Nessun account con l’email {email}.', { email })))
      process.exitCode = 1
      return
    }
    const { token } = await auth.createInvite({
      kind: 'reset',
      email: user.email,
      name: user.name,
      role: user.role,
      userId: user.id,
      ttlMs: 60 * 60 * 1000,
    })
    await createActivityStore(database.db).record({
      userId: null,
      userName: '',
      action: 'password.reset_cli',
      target: user.email,
      detail: null,
      ip: 'server',
    })
    const base = config.site.url?.replace(/\/+$/, '') ?? `http://localhost:${config.server.port}`
    console.log(
      `  ${ok('✓')} ${t('Link per una nuova password di {name} ({email}), valido un’ora:', { name: user.name, email: user.email })}`,
    )
    console.log()
    console.log(`    ${accent(`${base}/admin/_invite/${token}`)}`)
    console.log()
    console.log(dim(`  ${t('Chi lo apre sceglie la password. La verifica in due passaggi, se attiva, resta.')}`))
  } finally {
    database.close()
  }
}

/**
 * The backups sent outside the server, downloaded with any tool, made readable again: every .mzb
 * file is decrypted next to itself. The key comes from --key, MATERIALIZE_BACKUP_KEY or, in the
 * folder of a site that still has its database, from its settings.
 */
async function decrypt(args: string[]): Promise<void> {
  const flag = args.indexOf('--key')
  const source = args.find((a, i) => !a.startsWith('--') && (flag < 0 || i !== flag + 1))
  if (!source) {
    console.error(fail(t('Indica la cartella (o il file) da decifrare: materialize decrypt <cartella> --key <chiave>')))
    process.exit(1)
  }
  let text = flag >= 0 ? args[flag + 1] : process.env.MATERIALIZE_BACKUP_KEY
  if (!text) {
    const path = findConfig(process.cwd())
    if (path) {
      const database = await openDatabase((await loadConfig(path)).database).catch(() => null)
      if (database) {
        text = (await createSettingsStore(database.db).get<OffsiteSettings>('offsite'))?.key
        database.close()
      }
    }
  }
  if (!text) {
    console.error(fail(t('Manca la chiave di ripristino: --key mzk1-… oppure MATERIALIZE_BACKUP_KEY.')))
    process.exit(1)
  }
  let key: Buffer
  try {
    key = parseRecoveryKey(text)
  } catch (error) {
    console.error(fail(describeError(error)))
    process.exit(1)
  }
  try {
    const done = await decryptTree(resolve(source), key)
    console.log(
      `  ${ok('✓')} ${t.n(done.length, 'Un file decifrato, accanto all’originale.', '{n} file decifrati, accanto agli originali.')}`,
    )
    const db = done
      .filter((f) => /content-[^/\\]+\.db$/.test(f))
      .sort()
      .at(-1)
    if (db)
      // The shorter of the two ways to write the path.
      console.log(
        dim(
          `  ${t('Per rimettere il database (a server fermo): {command}', { command: `npx materialize restore ${[relative(process.cwd(), db), db].sort((x, y) => x.length - y.length)[0]}` })}`,
        ),
      )
  } catch (error) {
    console.error(fail(describeError(error)))
    process.exit(1)
  }
}

const [command = 'help', ...args] = process.argv.slice(2)
if (command === 'dev' || command === 'start' || command === 'build') {
  await run(command, args)
} else if (command === 'mcp') {
  await mcp(args)
} else if (command === 'decrypt') {
  await decrypt(args)
} else if (command === 'reset-password') {
  await resetPassword(args)
} else if (command === 'restore') {
  await restore(args)
} else if (command === '--version' || command === '-v') {
  console.log(VERSION)
} else {
  console.log(help())
  if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
}
