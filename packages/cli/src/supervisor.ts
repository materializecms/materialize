/**
 * `materialize start` runs the server as a child of this small process, which keeps it alive:
 * it restarts the server if it stops unexpectedly, and swaps the installed version when the
 * panel asks for an update (or to go back to the previous one).
 *
 * The swap: an update is installed beside the site in .materialize/updates/next, then the server
 * exits with RESTART. Here the current node_modules moves to .materialize/updates/previous, the
 * new one takes its place, and the server starts again. If it does not report ready in time,
 * the old version comes back.
 *
 * Only Node's own modules here: this code stays loaded while the packages under it change.
 */
import { type ChildProcess, fork } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Exit code with which the server asks to be started again (and to apply a pending swap). */
export const RESTART = 75
/** How long a freshly swapped version has to report ready before it is rolled back. */
const READY_TIMEOUT = 180_000

export const updatesDir = (site: string) => join(site, '.materialize', 'updates')

/** Written by the server before it exits with RESTART. */
export interface Pending {
  kind: 'install' | 'rollback'
  from: string
  to: string
  at: string
}

/** What the last swap did, read by the panel after the restart. */
export interface SwapResult {
  ok: boolean
  kind: Pending['kind']
  from: string
  to: string
  at: string
  message?: string
}

const FILES = ['package.json', 'package-lock.json']

/** Exchanges node_modules and the package files of the site with those kept in `other`. */
export async function exchange(site: string, other: string): Promise<void> {
  const tmp = join(updatesDir(site), 'swap')
  await rm(tmp, { recursive: true, force: true })
  await mkdir(tmp, { recursive: true })
  // site → tmp, other → site, tmp → other: each step is a rename on the same disk.
  for (const name of ['node_modules', ...FILES]) {
    if (existsSync(join(site, name))) await rename(join(site, name), join(tmp, name))
  }
  for (const name of ['node_modules', ...FILES]) {
    if (existsSync(join(other, name))) await rename(join(other, name), join(site, name))
  }
  await rm(other, { recursive: true, force: true })
  await rename(tmp, other)
}

/**
 * Applies a pending swap. An install moves the new version in and keeps the current one as
 * "previous"; a rollback exchanges current and previous, so it can itself be undone.
 */
export async function applyPending(site: string, pending: Pending): Promise<void> {
  const dir = updatesDir(site)
  if (pending.kind === 'install') {
    const next = join(dir, 'next')
    if (!existsSync(join(next, 'node_modules'))) throw new Error('La nuova versione non è stata scaricata')
    await exchange(site, next)
    await rm(join(dir, 'previous'), { recursive: true, force: true })
    await rename(next, join(dir, 'previous'))
  } else {
    const previous = join(dir, 'previous')
    if (!existsSync(join(previous, 'node_modules'))) throw new Error('Non c’è una versione precedente')
    await exchange(site, previous)
  }
}

/** Undoes `applyPending` after a failed start. */
export async function revertPending(site: string, pending: Pending): Promise<void> {
  const dir = updatesDir(site)
  // Either way the version that was running before sits in "previous" now.
  await exchange(site, join(dir, 'previous'))
  // A failed new version is not one to go back to.
  if (pending.kind === 'install') await rm(join(dir, 'previous'), { recursive: true, force: true })
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T
  } catch {
    return null
  }
}

export async function supervise(script: string, args: string[], site = process.cwd()): Promise<never> {
  const dir = updatesDir(site)
  let child: ChildProcess | null = null
  let stopping = false
  let failures = 0

  /** Starts the server; resolves with its exit code, and calls `onReady` when it reports ready. */
  const start = (onReady?: () => void, onFailed?: () => void, update?: Pending) =>
    new Promise<number>((resolve) => {
      const proc = fork(script, ['start', ...args], {
        stdio: 'inherit',
        // A server started for an update says so in the panel until it is ready, then records the result.
        env: { ...process.env, MATERIALIZE_SUPERVISED: '1', MATERIALIZE_UPDATE: update ? JSON.stringify(update) : '' },
      })
      child = proc
      proc.on('message', (message) => {
        if (message === 'ready') onReady?.()
        else if (message === 'failed') onFailed?.()
      })
      proc.on('exit', (code, signal) => {
        child = null
        resolve(code ?? (signal ? 1 : 0))
      })
    })

  const stop = (signal: NodeJS.Signals) => {
    stopping = true
    if (child) child.kill(signal)
    else process.exit(0)
  }
  process.on('SIGINT', () => stop('SIGINT'))
  process.on('SIGTERM', () => stop('SIGTERM'))

  for (;;) {
    const pendingFile = join(dir, 'pending.json')
    const pending = await readJson<Pending>(pendingFile)
    let code: number
    if (pending) {
      await rm(pendingFile, { force: true })
      const result: SwapResult = { ok: false, kind: pending.kind, from: pending.from, to: pending.to, at: pending.at }
      try {
        await applyPending(site, pending)
      } catch (error) {
        result.message = error instanceof Error ? error.message : String(error)
        await writeFile(join(dir, 'result.json'), JSON.stringify(result))
        continue
      }
      console.log(`  Materialize ${pending.from} → ${pending.to}: avvio la nuova versione…`)
      // The new version must report ready in time; otherwise the old one comes back.
      let ready = false
      let timer: NodeJS.Timeout | undefined
      const running = start(
        () => {
          ready = true
          clearTimeout(timer)
        },
        () => {
          result.message = 'Con la nuova versione il sito non si compila'
          child?.kill('SIGTERM')
        },
        pending,
      )
      timer = setTimeout(() => {
        result.message = 'La nuova versione non è partita in tempo'
        child?.kill('SIGTERM')
      }, READY_TIMEOUT)
      code = await running
      clearTimeout(timer)
      if (!ready && !stopping) {
        result.message ??= `La nuova versione si è fermata all’avvio (codice ${code})`
        await revertPending(site, pending)
        await writeFile(join(dir, 'result.json'), JSON.stringify(result))
        console.log(`  ✗ ${result.message}: torno alla ${pending.from}`)
        continue
      }
    } else {
      const started = Date.now()
      code = await start(() => {
        failures = 0
      })
      if (Date.now() - started > 60_000) failures = 0
    }
    if (stopping || code === 0) process.exit(code)
    if (code === RESTART) continue
    // An unexpected stop: start again, waiting a little longer each time (up to half a minute).
    failures++
    const wait = Math.min(30, 2 ** Math.min(failures, 5))
    console.log(`  ✗ Il server si è fermato (codice ${code}): riparto tra ${wait} s`)
    await new Promise((r) => setTimeout(r, wait * 1000))
  }
}
