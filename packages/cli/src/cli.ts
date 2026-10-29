#!/usr/bin/env node
import { watch } from 'node:fs'
import { relative } from 'node:path'
import { styleText } from 'node:util'
import type { MaterializeConfig } from '@materialize/core'
import { startServer, VERSION } from '@materialize/server'
import { findConfig, loadConfig } from './load-config.ts'

const dim = (s: string) => styleText('dim', s)
const accent = (s: string) => styleText(['bold', 'blue'], s)
const ok = (s: string) => styleText('green', s)
const fail = (s: string) => styleText('red', s)

const HELP = `
${accent('materialize')} ${dim(VERSION)}

  materialize dev      Avvia il CMS e ricarica lo schema a ogni salvataggio
  materialize start    Avvia il CMS in produzione
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

async function run(mode: 'dev' | 'start', args: string[]): Promise<void> {
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

  const portFlag = args.indexOf('--port')
  const port = portFlag >= 0 ? Number(args[portFlag + 1]) : undefined
  const server = await startServer(config, { port })

  console.log()
  console.log(`  ${accent('Materialize')} ${dim(VERSION)}  ${config.site.name}`)
  console.log()
  console.log(`  ${dim('Locale')}      ${server.url}`)
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
          console.log(`  ${ok('✓')} Schema ricaricato ${dim(`(${summary(next)})`)}`)
        } catch (error) {
          console.log(`  ${fail('✗')} Lo schema ha un problema, resto sulla versione precedente:`)
          console.log(dim(describeError(error).replace(/^/gm, '    ')))
        }
      }, 120)
    })
  }

  const stop = async () => {
    await server.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

const [command = 'help', ...args] = process.argv.slice(2)
if (command === 'dev' || command === 'start') {
  await run(command, args)
} else if (command === '--version' || command === '-v') {
  console.log(VERSION)
} else {
  console.log(HELP)
  if (command !== 'help' && command !== '--help' && command !== '-h') process.exitCode = 1
}
