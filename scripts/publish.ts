/**
 * Publishes the packages prepared by `npm run release`, dependencies first. Versions already on
 * the registry are skipped, so a failed run can simply be run again.
 *
 *   node scripts/publish.ts                          to npmjs.com (needs a logged-in npm)
 *   node scripts/publish.ts --registry <url>         to another registry, e.g. a local Verdaccio
 *   node scripts/publish.ts --tag v0.2.0 --provenance  from CI: the tag must match the version
 */
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { parseChangelog } from './changelog.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = ['core', 'db', 'admin', 'server', 'astro', 'cli', 'create-materialize']

const { values } = parseArgs({
  options: { registry: { type: 'string' }, tag: { type: 'string' }, provenance: { type: 'boolean' } },
})
const registry = values.registry ? ['--registry', values.registry] : []

function published(name: string, version: string): boolean {
  try {
    return (
      execFileSync('npm', ['view', `${name}@${version}`, 'version', ...registry], {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim() === version
    )
  } catch {
    return false
  }
}

async function main() {
  const manifests = await Promise.all(
    PACKAGES.map(async (p) => {
      const file = join(ROOT, '.release', p, 'package.json')
      const text = await readFile(file, 'utf8').catch(() => {
        throw new Error('Mancano i pacchetti: prima npm run release')
      })
      return { dir: join(ROOT, '.release', p), ...(JSON.parse(text) as { name: string; version: string }) }
    }),
  )
  const version = manifests[0]?.version ?? ''
  if (manifests.some((m) => m.version !== version)) throw new Error('I pacchetti non hanno tutti la stessa versione')
  if (values.tag && values.tag !== `v${version}`) throw new Error(`Il tag ${values.tag} non corrisponde a ${version}`)
  if (!parseChangelog(await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')).some((r) => r.version === version))
    throw new Error(`Il CHANGELOG non ha la ${version}: lancia npm run bump`)

  for (const m of manifests) {
    if (published(m.name, m.version)) {
      console.log(`› ${m.name}@${m.version} c’è già`)
      continue
    }
    console.log(`› Pubblico ${m.name}@${m.version}`)
    execFileSync('npm', ['publish', ...registry, ...(values.provenance ? ['--provenance'] : [])], {
      cwd: m.dir,
      stdio: 'inherit',
    })
  }
  console.log(`› Materialize ${version} pubblicato`)
}

await main().catch((error: Error) => {
  console.error(`✗ ${error.message}`)
  process.exit(1)
})
