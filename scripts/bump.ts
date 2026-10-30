/**
 * Moves every package to a new version at once, with the packages that depend on each other and
 * the example site, and dates the "Prossima versione" section of CHANGELOG.md.
 *
 *   node scripts/bump.ts 0.2.0          an exact version
 *   node scripts/bump.ts patch|minor|major
 *
 * It changes files only: committing, tagging and publishing stay separate steps.
 */
import { execFileSync } from 'node:child_process'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NEXT, nextVersion, stampChangelog } from './changelog.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

type Json = Record<string, unknown>

async function manifests(): Promise<string[]> {
  const dirs = [
    ...(await readdir(join(ROOT, 'packages'))).map((d) => join(ROOT, 'packages', d)),
    ...(await readdir(join(ROOT, 'examples'))).map((d) => join(ROOT, 'examples', d)),
  ]
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

  const changelogPath = join(ROOT, 'CHANGELOG.md')
  const changelog = stampChangelog(
    await readFile(changelogPath, 'utf8'),
    version,
    new Date().toISOString().slice(0, 10),
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
  await writeFile(changelogPath, changelog)
  // The lockfile records workspace versions too.
  execFileSync('npm', ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: ROOT,
    stdio: 'ignore',
  })

  console.log(`› ${current} → ${version}`)
  console.log(`› CHANGELOG.md: «${NEXT}» ora è ${version}`)
  console.log('› Poi:')
  console.log(`    git commit -am "Versione ${version}"`)
  console.log(`    git tag v${version} && git push --follow-tags`)
}

await main().catch((error: Error) => {
  console.error(`✗ ${error.message}`)
  process.exit(1)
})
