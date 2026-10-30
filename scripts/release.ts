/**
 * Prepares the npm packages in .release/<package>: compiled JavaScript with types, the built admin,
 * the starter template, and a package.json pointing at the compiled files. The sources stay as they are,
 * so in this repository everything keeps running straight from TypeScript.
 *
 *   node scripts/release.ts          prepare .release/
 *   node scripts/release.ts --pack   also create the tarballs in .release/tarballs
 *
 * Publishing is a separate, deliberate step: npm publish .release/<package>
 */
import { execFileSync } from 'node:child_process'
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseChangelog } from './changelog.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, '.release')
const COMPILED = join(OUT, '.compiled')
/** Published packages, dependencies first. */
const PACKAGES = ['core', 'db', 'admin', 'server', 'astro', 'cli', 'create-materialize']
/** Extra folders shipped as they are. */
const EXTRA: Record<string, string[]> = { admin: ['dist'], cli: ['install.sh'], 'create-materialize': ['template'] }

type Json = Record<string, unknown>

const run = (cmd: string, args: string[], cwd = ROOT) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

async function filesIn(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  return entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name))
}

const isSource = (file: string) => file.endsWith('.ts') && !file.endsWith('.d.ts')

async function compile() {
  const sources: string[] = []
  for (const name of PACKAGES) {
    // The admin is bundled by Vite; only its tiny entry (where the build lives) runs on Node.
    if (name === 'admin') sources.push(join(ROOT, 'packages/admin/src/index.ts'))
    else sources.push(...(await filesIn(join(ROOT, 'packages', name, 'src'))).filter(isSource))
  }
  // One program, so cross-package imports type-check; they stay bare specifiers in the output.
  // TypeScript options mirror tsconfig.json, which a file list on the command line doesn't load.
  run('npx', [
    'tsc',
    '--ignoreConfig',
    '--rootDir',
    'packages',
    '--outDir',
    COMPILED,
    '--declaration',
    '--rewriteRelativeImportExtensions',
    '--module',
    'nodenext',
    '--target',
    'es2024',
    '--types',
    'node',
    '--strict',
    '--noUncheckedIndexedAccess',
    '--noImplicitOverride',
    '--skipLibCheck',
    '--erasableSyntaxOnly',
    '--verbatimModuleSyntax',
    '--resolveJsonModule',
    ...sources.map((s) => relative(ROOT, s)),
  ])
}

/** Points exports and bins at the compiled files: ./src/x.ts → { types: ./src/x.d.ts, default: ./src/x.js }. */
function toCompiled(target: unknown): unknown {
  if (typeof target !== 'string' || !isSource(target)) return target
  const base = target.slice(0, -3)
  return { types: `${base}.d.ts`, default: `${base}.js` }
}

function releaseManifest(pkg: Json, versions: Map<string, string>): Json {
  const { scripts: _, devDependencies: __, ...manifest } = pkg
  const exports = (pkg.exports ?? {}) as Record<string, unknown>
  manifest.exports = Object.fromEntries(Object.entries(exports).map(([key, target]) => [key, toCompiled(target)]))
  if (!pkg.exports) delete manifest.exports
  if (pkg.bin) {
    manifest.bin = Object.fromEntries(
      Object.entries(pkg.bin as Record<string, string>).map(([key, file]) => [key, file.replace(/\.ts$/, '.js')]),
    )
  }
  // Workspace packages move together, so they depend on each other's exact version.
  const deps = { ...(pkg.dependencies as Record<string, string> | undefined) }
  for (const dep of Object.keys(deps)) {
    const version = versions.get(dep)
    if (version) deps[dep] = version
  }
  manifest.dependencies = deps
  // The admin is a prebuilt bundle: nothing to install at runtime.
  if (pkg.name === '@materializecms/admin') delete manifest.dependencies
  if (manifest.dependencies && !Object.keys(manifest.dependencies).length) delete manifest.dependencies
  manifest.engines = { node: '>=24' }
  if (String(pkg.name).startsWith('@')) manifest.publishConfig = { access: 'public' }
  return manifest
}

const readme = (pkg: Json) =>
  `# ${pkg.name}\n\n${pkg.description}\n\nParte di Materialize: ` +
  'il CMS open source con editor visuale e siti statici veloci.\n\n```bash\nnpm create materialize@latest\n```\n'

async function assemble(name: string, versions: Map<string, string>) {
  const src = join(ROOT, 'packages', name)
  const dest = join(OUT, name)
  const pkg = JSON.parse(await readFile(join(src, 'package.json'), 'utf8')) as Json

  if (name === 'admin') {
    await mkdir(join(dest, 'src'), { recursive: true })
    for (const ext of ['.js', '.d.ts'])
      await cp(join(COMPILED, 'admin/src', `index${ext}`), join(dest, 'src', `index${ext}`))
  } else {
    await cp(join(COMPILED, name, 'src'), join(dest, 'src'), { recursive: true })
    // Components, styles and hand-written declarations ship as they are.
    for (const file of await filesIn(join(src, 'src'))) {
      if (isSource(file)) continue
      const to = join(dest, relative(src, file))
      await mkdir(dirname(to), { recursive: true })
      let text = await readFile(file)
      if (extname(file) === '.astro') {
        text = Buffer.from(text.toString('utf8').replace(/(from\s+'\.{1,2}\/[^']+)\.ts'/g, "$1.js'"))
      }
      await writeFile(to, text)
    }
  }
  for (const extra of EXTRA[name] ?? []) await cp(join(src, extra), join(dest, extra), { recursive: true })
  // Downloadable from the registry's CDN, like install.sh, for `docker compose up`.
  if (name === 'cli') await cp(join(ROOT, 'docker', 'compose.yaml'), join(dest, 'compose.yaml'))

  const manifest = releaseManifest(pkg, versions)
  // The panel asks the registry for this field (npm view @materializecms/cli changelog) to show what is new.
  if (name === 'cli')
    manifest.changelog = parseChangelog(await readFile(join(ROOT, 'CHANGELOG.md'), 'utf8')).slice(0, 30)
  await writeFile(join(dest, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  await cp(join(ROOT, 'LICENSE'), join(dest, 'LICENSE'))
  // The panel reads what is new from here when it offers an update.
  await cp(join(ROOT, 'CHANGELOG.md'), join(dest, 'CHANGELOG.md'))
  const ownReadme = join(src, 'README.md')
  await writeFile(join(dest, 'README.md'), await readFile(ownReadme, 'utf8').catch(() => readme(pkg)))
}

async function main() {
  const pack = process.argv.includes('--pack')
  await rm(OUT, { recursive: true, force: true })

  console.log('› Compilo il pannello')
  run('npm', ['run', 'build', '-w', '@materializecms/admin'])
  console.log('› Compilo i pacchetti')
  await compile()

  const versions = new Map<string, string>()
  for (const name of PACKAGES) {
    const pkg = JSON.parse(await readFile(join(ROOT, 'packages', name, 'package.json'), 'utf8')) as Json
    versions.set(String(pkg.name), String(pkg.version))
  }
  for (const name of PACKAGES) await assemble(name, versions)
  await rm(COMPILED, { recursive: true, force: true })

  if (pack) {
    const tarballs = join(OUT, 'tarballs')
    await mkdir(tarballs, { recursive: true })
    for (const name of PACKAGES) {
      execFileSync('npm', ['pack', '--pack-destination', tarballs], { cwd: join(OUT, name), stdio: 'ignore' })
    }
    console.log(`› Archivi in ${relative(ROOT, tarballs)}`)
  }
  console.log(`› Pacchetti pronti in ${relative(ROOT, OUT)}: ${[...versions].map(([n, v]) => `${n}@${v}`).join(', ')}`)
}

await main()
