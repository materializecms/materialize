#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, realpathSync } from 'node:fs'
import { cp, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { parseArgs, styleText } from 'node:util'

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template')
/** Materialize packages move together: a new site uses the version of this starter. */
const VERSION: string = createRequire(import.meta.url)('../package.json').version
// npm drops dotfiles named .gitignore when publishing, so the template ships them without the dot.
const RENAMES: Record<string, string> = { gitignore: '.gitignore' }
const TEXT_FILES = ['package.json', 'materialize.config.ts', 'README.md', 'src/layouts/Site.astro']

export async function createProject(target: string, siteName?: string): Promise<string> {
  const dir = resolve(target)
  if (existsSync(dir) && (await readdir(dir)).length > 0) {
    throw new Error(`La cartella ${dir} esiste e non è vuota`)
  }
  await cp(TEMPLATE, dir, { recursive: true })
  for (const [from, to] of Object.entries(RENAMES)) {
    if (existsSync(join(dir, from))) await rename(join(dir, from), join(dir, to))
  }
  const slug =
    basename(dir)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'materialize-site'
  const name =
    siteName ??
    basename(dir)
      .replace(/[-_]+/g, ' ')
      .replace(/^\w/, (c) => c.toUpperCase())
  for (const file of TEXT_FILES) {
    const path = join(dir, file)
    if (!existsSync(path)) continue
    const text = await readFile(path, 'utf8')
    await writeFile(
      path,
      text
        .replaceAll('__PACKAGE_NAME__', slug)
        // Inside TypeScript and Astro strings.
        .replaceAll('__SITE_NAME__', file === 'README.md' ? name : name.replaceAll("'", "\\'"))
        .replaceAll('__VERSION__', VERSION),
    )
  }
  return dir
}

/** The package manager that ran us (npm create, pnpm create, …), so the site installs with the same one. */
function packageManager(): string {
  const agent = process.env.npm_config_user_agent ?? ''
  return ['pnpm', 'yarn', 'bun'].find((pm) => agent.startsWith(`${pm}/`)) ?? 'npm'
}

function install(dir: string, pm: string): Promise<boolean> {
  return new Promise((done) => {
    const child = spawn(pm, ['install'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('close', (code) => done(code === 0))
    child.on('error', () => done(false))
  })
}

async function ask(question: string, fallback: string): Promise<string> {
  if (!process.stdin.isTTY) return fallback
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return (await rl.question(`  ${question} ${styleText('dim', `(${fallback})`)} `)).trim() || fallback
  } finally {
    rl.close()
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'no-install': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
  })
  if (values.help) {
    console.log('\n  npm create materialize@latest [cartella] [--no-install]\n')
    return
  }
  console.log()
  console.log(`  ${styleText(['bold', 'blue'], 'Materialize')} ${styleText('dim', VERSION)}`)
  console.log()
  const target = positionals[0] ?? (await ask('Dove creo il sito?', 'il-mio-sito'))
  const dir = await createProject(target)
  const rel = relative(process.cwd(), dir) || '.'
  console.log(`  ${styleText('green', '✓')} Progetto creato in ${rel}`)

  const pm = packageManager()
  let installed = false
  if (!values['no-install']) {
    console.log(`  ${styleText('dim', `Installo le dipendenze con ${pm}…`)}`)
    console.log()
    installed = await install(dir, pm)
    console.log()
    if (!installed) console.log(`  ${styleText('yellow', '!')} Installazione non riuscita: riprova a mano.`)
  }

  const run = pm === 'npm' ? 'npm run' : pm
  console.log('  Per iniziare:')
  console.log()
  if (rel !== '.') console.log(`    cd ${rel}`)
  if (!installed) console.log(`    ${pm} install`)
  console.log(`    ${run} dev`)
  console.log()
  console.log(`  Poi apri ${styleText('blue', 'http://localhost:4321/admin')} e crea il tuo account.`)
  console.log()
}

// Run as a command (through the bin symlink npm creates), not when imported by tests.
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await main()
  } catch (error) {
    console.error(`  ${styleText('red', error instanceof Error ? error.message : String(error))}`)
    process.exit(1)
  }
}
