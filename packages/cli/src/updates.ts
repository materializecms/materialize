import { spawn } from 'node:child_process'
import { constants, existsSync, realpathSync } from 'node:fs'
import { access, copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { newer, type ReleaseNotes, type UpdateStatus, type Updates } from '@materializecms/server'
import { type Pending, type SwapResult, updatesDir } from './supervisor.ts'

const CURRENT: string = createRequire(import.meta.url)('../package.json').version
const CLI = '@materializecms/cli'

/** Runs the site's package manager; resolves with its output, rejects with the end of it. */
function npm(args: string[], cwd: string, timeout = 600_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd,
      env: { ...process.env, npm_config_update_notifier: 'false', npm_config_fund: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout,
    })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', (error) =>
      reject(Object.assign(new Error(`npm non si avvia: ${error.message}`), { log: out.slice(-4000) })),
    )
    child.on('close', (code) => {
      if (code === 0) resolve(out)
      else
        reject(Object.assign(new Error(`npm si è fermato con un errore (codice ${code})`), { log: out.slice(-4000) }))
    })
  })
}

const readJson = async <T>(file: string): Promise<T | null> =>
  JSON.parse(await readFile(file, 'utf8').catch(() => 'null')) as T | null

/**
 * Updates for a site run by `materialize start`: the new version is installed in
 * .materialize/updates/next while the site keeps running; then the server exits and the
 * supervisor swaps it in (see supervisor.ts).
 */
export function createUpdates(options: {
  site: string
  mode: 'dev' | 'start'
  /** Closes the server and exits with RESTART. */
  restart: () => Promise<void>
}): Updates & { ready: () => Promise<void> } {
  const { site } = options
  const dir = updatesDir(site)
  // Started by the supervisor right after a swap: not done until the site is built on it.
  let swapping = process.env.MATERIALIZE_UPDATE ? (JSON.parse(process.env.MATERIALIZE_UPDATE) as Pending) : null
  let latest: string | null = null
  let notes: ReleaseNotes[] = []
  let checkedAt: string | null = null
  let checkError: string | undefined
  let job: UpdateStatus['job'] = { state: 'idle' }

  const unavailable = async (): Promise<string | undefined> => {
    if (options.mode === 'dev')
      return 'In sviluppo (materialize dev) si aggiorna da terminale: gli aggiornamenti dal pannello funzionano con materialize start.'
    if (!process.env.MATERIALIZE_SUPERVISED)
      return 'Il server è avviato senza il suo supervisore: aggiorna da terminale, oppure avvialo con materialize start.'
    // Linked from a source checkout (like the example in the repository): git updates it.
    const here = realpathSync(fileURLToPath(import.meta.url))
    if (!here.startsWith(realpathSync(join(site, 'node_modules')) + sep))
      return 'Materialize è collegato dal codice sorgente: si aggiorna con git.'
    const pkg = await readJson<{ dependencies?: Record<string, string> }>(join(site, 'package.json'))
    if (!pkg?.dependencies?.[CLI]) return `Il package.json del sito non ha ${CLI} tra le dipendenze.`
    try {
      await access(site, constants.W_OK)
      await access(join(site, 'node_modules'), constants.W_OK)
    } catch {
      return 'Il programma non può scrivere nella cartella del sito: aggiorna da terminale, con l’utente che la possiede.'
    }
    return undefined
  }

  const previous = async () => {
    const pkg = await readJson<{ dependencies?: Record<string, string> }>(join(dir, 'previous', 'package.json'))
    return existsSync(join(dir, 'previous', 'node_modules')) ? (pkg?.dependencies?.[CLI] ?? null) : null
  }

  const status = async (): Promise<UpdateStatus> => ({
    current: CURRENT,
    latest,
    notes,
    checkedAt,
    checkError,
    unavailable: await unavailable(),
    previous: await previous(),
    job: swapping ? { state: 'restarting', step: 'Preparo il sito con la nuova versione' } : job,
    last: await readJson<SwapResult>(join(dir, 'result.json')),
  })

  const restartWith = async (pending: Pending) => {
    await writeFile(join(dir, 'pending.json'), JSON.stringify(pending))
    job = { state: 'restarting', step: 'Riavvio' }
    // A moment for the panel to hear back before the server goes away.
    setTimeout(() => void options.restart(), 300)
  }

  return {
    status,

    /** The server is up and the site built: a swap that brought it here went well. */
    async ready() {
      if (!swapping) return
      const result: SwapResult = { ok: true, ...swapping }
      await writeFile(join(dir, 'result.json'), JSON.stringify(result))
      swapping = null
    },

    async check() {
      try {
        const out = await npm(['view', `${CLI}@latest`, 'version', 'changelog', '--json'], site, 30_000)
        const info = JSON.parse(out) as { version?: string; changelog?: ReleaseNotes[] } | string
        latest = typeof info === 'string' ? info : (info.version ?? null)
        notes = (typeof info === 'string' ? [] : (info.changelog ?? [])).filter((r) => newer(r.version, CURRENT))
        checkError = undefined
      } catch (error) {
        const log = (error as { log?: string }).log ?? ''
        checkError = /E404|404 Not Found/.test(log)
          ? 'Nessuna versione pubblicata da controllare.'
          : 'Non riesco a raggiungere il registro dei pacchetti: riprova più tardi.'
      }
      checkedAt = new Date().toISOString()
      return status()
    },

    async install(version, backup) {
      const reason = await unavailable()
      if (reason) throw new Error(reason)
      if (job.state === 'working' || job.state === 'restarting') throw new Error('C’è già un aggiornamento in corso')
      if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Versione non valida')
      job = { state: 'working', step: 'Backup del database e dei media' }
      void (async () => {
        try {
          await backup()
          job = { state: 'working', step: `Scarico Materialize ${version}` }
          const next = join(dir, 'next')
          await rm(next, { recursive: true, force: true })
          await mkdir(next, { recursive: true })
          // The site's own package files, with every Materialize package at the new version.
          const pkg = JSON.parse(await readFile(join(site, 'package.json'), 'utf8'))
          for (const name of Object.keys(pkg.dependencies ?? {}))
            if (name.startsWith('@materializecms/')) pkg.dependencies[name] = version
          await writeFile(join(next, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`)
          for (const name of ['package-lock.json', '.npmrc'])
            if (existsSync(join(site, name))) await copyFile(join(site, name), join(next, name))
          await npm(['install', '--no-audit', '--no-fund'], next)

          job = { state: 'working', step: 'Controllo la nuova versione' }
          const installed = await readJson<{ version: string }>(join(next, 'node_modules', CLI, 'package.json'))
          if (installed?.version !== version)
            throw new Error(`Installata la ${installed?.version ?? '?'} invece della ${version}`)
          await restartWith({ kind: 'install', from: CURRENT, to: version, at: new Date().toISOString() })
        } catch (error) {
          job = {
            state: 'failed',
            message: error instanceof Error ? error.message : String(error),
            log: (error as { log?: string }).log,
          }
          await rm(join(dir, 'next'), { recursive: true, force: true })
        }
      })()
    },

    async rollback() {
      const reason = await unavailable()
      if (reason) throw new Error(reason)
      const to = await previous()
      if (!to) throw new Error('Non c’è una versione precedente a cui tornare')
      await restartWith({ kind: 'rollback', from: CURRENT, to, at: new Date().toISOString() })
    },
  }
}
