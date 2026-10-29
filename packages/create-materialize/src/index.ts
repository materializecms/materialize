#!/usr/bin/env node
import { existsSync } from 'node:fs'
import { cp, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { styleText } from 'node:util'

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), '..', 'template')
// npm drops dotfiles named .gitignore when publishing, so the template ships them without the dot.
const RENAMES: Record<string, string> = { gitignore: '.gitignore' }
const TEXT_FILES = ['package.json', 'materialize.config.ts', 'README.md']

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
    await writeFile(path, text.replaceAll('__PACKAGE_NAME__', slug).replaceAll('__SITE_NAME__', name))
  }
  return dir
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2] ?? 'il-mio-sito'
  try {
    const dir = await createProject(target)
    const rel = relative(process.cwd(), dir) || '.'
    console.log()
    console.log(`  ${styleText(['bold', 'blue'], 'Materialize')} · progetto creato in ${rel}`)
    console.log()
    console.log(`  cd ${rel}`)
    console.log('  npm install')
    console.log('  npm run dev')
    console.log()
  } catch (error) {
    console.error(styleText('red', error instanceof Error ? error.message : String(error)))
    process.exit(1)
  }
}
