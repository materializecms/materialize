/**
 * Moves every package to a new version at once, with the packages that depend on each other and
 * the lockfile, and dates the coming section of both changelogs (CHANGELOG.md, CHANGELOG.it.md).
 *
 *   node scripts/bump.ts 0.2.0          an exact version
 *   node scripts/bump.ts patch|minor|major
 *
 * It changes files only: committing, tagging and publishing stay separate steps.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHANGELOGS, nextVersion, stampChangelog } from './changelog.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

type Json = Record<string, unknown>

async function manifests(): Promise<string[]> {
  const dirs = (await readdir(join(ROOT, 'packages'))).map((d) => join(ROOT, 'packages', d))
  const files: string[] = []
  for (const dir of dirs) {
    const file = join(dir, 'package.json')
    if (await readFile(file).catch(() => null)) files.push(file)
  }
  return files
}

async function main() {
  const arg = process.argv[2]
  if (!arg) throw new Error('Indica la versione: 0.2.0, oppure patch, minor o major')
  const core = JSON.parse(await readFile(join(ROOT, 'packages/core/package.json'), 'utf8')) as Json
  const current = String(core.version)
  const version = nextVersion(current, arg)

  // Both languages, checked before anything is written: one without notes stops the bump.
  const date = new Date().toLocaleDateString('sv')
  const changelogs = await Promise.all(
    CHANGELOGS.map(async (c) => ({
      ...c,
      text: stampChangelog(await readFile(join(ROOT, c.file), 'utf8'), version, date, c.next),
    })),
  )

  for (const file of await manifests()) {
    const pkg = JSON.parse(await readFile(file, 'utf8')) as Json
    const own = String(pkg.name).startsWith('@materializecms/') || pkg.name === 'create-materialize'
    if (own) pkg.version = version
    for (const key of ['dependencies', 'devDependencies'] as const) {
      const deps = pkg[key] as Record<string, string> | undefined
      for (const dep of Object.keys(deps ?? {})) if (dep.startsWith('@materializecms/') && deps) deps[dep] = version
    }
    await writeFile(file, `${JSON.stringify(pkg, null, 2)}\n`)
  }
  for (const c of changelogs) await writeFile(join(ROOT, c.file), c.text)
  // The lockfile records workspace versions too. Edited here rather than by npm: npm on macOS drops
  // the optional packages only Linux installs, and npm ci then fails on GitHub.
  const lockPath = join(ROOT, 'package-lock.json')
  const lock = JSON.parse(await readFile(lockPath, 'utf8')) as { packages: Record<string, Json> }
  for (const [key, entry] of Object.entries(lock.packages)) {
    if (!key.startsWith('packages/')) continue
    entry.version = version
    const deps = entry.dependencies as Record<string, string> | undefined
    for (const dep of Object.keys(deps ?? {})) if (dep.startsWith('@materializecms/') && deps) deps[dep] = version
  }
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`)

  console.log(`› ${current} → ${version}`)
  for (const c of CHANGELOGS) console.log(`› ${c.file}: «${c.next}» ora è ${version}`)
  console.log('› Poi:')
  console.log(`    git commit -am "Versione ${version}"`)
  console.log(`    git tag v${version} && git push --follow-tags`)
}

await main().catch((error: Error) => {
  console.error(`✗ ${error.message}`)
  process.exit(1)
})
