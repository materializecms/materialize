#!/usr/bin/env node
import { watch } from 'node:fs'
import { relative } from 'node:path'
import { styleText } from 'node:util'
import type { MaterializeConfig } from '@materialize/core'
import { createAuthStore, createContentStore } from '@materialize/db'
import { createMediaFiles, startServer, VERSION } from '@materialize/server'
import { findConfig, loadConfig } from './load-config.ts'
import { buildSite, exportMedia, type Handler, hasSite, ProductionSite, startDevSite } from './site.ts'

const dim = (s: string) => styleText('dim', s)
const accent = (s: string) => styleText(['bold', 'blue'], s)
const ok = (s: string) => styleText('green', s)
const fail = (s: string) => styleText('red', s)

const HELP = `
${accent('materialize')} ${dim(VERSION)}

  materialize dev      Avvia CMS e sito, ricarica lo schema a ogni salvataggio
  materialize build    Genera il sito statico in dist/client, immagini comprese
  materialize start    Avvia CMS e sito in produzione (il sito si rigenera a ogni pubblicazione)
  materialize --help   Mostra questo aiuto

Opzioni
  --port <numero>      Porta del server (predefinita: quella del config, 4321)
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
  const server = await startServer(config, {
    port,
    site: withSite ? (req, res) => siteHandler(req, res) : undefined,
    onPublish: () => void production?.rebuild(),
  })
  let closeSite: (() => Promise<void>) | undefined
  if (withSite) {
    const { setRuntime } = await import('@materialize/astro/runtime')
    setRuntime({
      config: () => current,
      content: createContentStore(server.database.db),
      auth: createAuthStore(server.database.db),
    })
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

const [command = 'help', ...args] = process.argv.slice(2)
if (command === 'dev' || command === 'start' || command === 'build') {
  await run(command, args)
} else if (command === '--version' || command === '-v') {
  console.log(VERSION)
} else {
  console.log(HELP)
  if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
}
