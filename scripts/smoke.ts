/**
 * Tries the packages exactly as users get them, before they are published: creates a site with the
 * starter in .release/, installs the tarballs of .release/tarballs, builds the static site and
 * starts the production server. Run after `npm run release`.
 *
 *   node scripts/smoke.ts
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TARBALLS = join(ROOT, '.release/tarballs')
const PORT = 4399

const step = (text: string) => console.log(`› ${text}`)

async function main() {
  const tarballs = await readdir(TARBALLS).catch(() => {
    throw new Error('Mancano gli archivi: prima npm run release')
  })
  /** Package name → its tarball: materializecms-core-0.1.0.tgz → @materializecms/core. */
  const local: Record<string, string> = {}
  for (const file of tarballs) {
    const name = file.replace(/-\d+\.\d+\.\d+\.tgz$/, '')
    local[name.startsWith('materializecms-') ? `@materializecms/${name.slice(15)}` : name] =
      `file:${join(TARBALLS, file)}`
  }

  const work = await mkdtemp(join(tmpdir(), 'materialize-smoke-'))
  const site = join(work, 'sito')
  try {
    step('Creo un sito con create-materialize')
    execFileSync('node', [join(ROOT, '.release/create-materialize/src/index.js'), site, '--no-install'], {
      stdio: 'ignore',
    })
    // The site asks for these exact versions; here they come from the tarballs, not the registry.
    const pkgPath = join(site, 'package.json')
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
    for (const dep of Object.keys(pkg.dependencies)) if (local[dep]) pkg.dependencies[dep] = local[dep]
    pkg.overrides = Object.fromEntries(Object.entries(local).filter(([name]) => name.startsWith('@')))
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2))

    step('Installo i pacchetti')
    execFileSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: site, stdio: 'ignore' })

    step('Compilo il sito statico')
    execFileSync('npx', ['materialize', 'build'], { cwd: site, stdio: 'pipe' })
    for (const file of ['index.html', 'sitemap.xml', 'robots.txt'])
      if (!existsSync(join(site, 'dist/client', file)) && !existsSync(join(site, 'dist', file)))
        throw new Error(`Il sito compilato non ha ${file}`)

    step('Avvio il server di produzione')
    // Its own process group: npx, the supervisor and the server stop together at the end.
    const server = spawn('npx', ['materialize', 'start', '--port', String(PORT)], {
      cwd: site,
      stdio: 'pipe',
      detached: true,
    })
    let log = ''
    server.stdout.on('data', (d) => (log += d))
    server.stderr.on('data', (d) => (log += d))
    try {
      const checks: [string, number][] = [
        ['/', 200],
        ['/admin', 200],
        ['/api/setup', 200],
      ]
      for (const [path, status] of checks) {
        // Not answering yet, or 503 while the first build of the site gets ready: wait, up to a minute.
        let res: Response | null = null
        for (let i = 0; i < 120 && (!res || res.status === 503); i++) {
          if (i) await new Promise((r) => setTimeout(r, 500))
          res = await fetch(`http://localhost:${PORT}${path}`).catch(() => null)
        }
        if (res?.status !== status) throw new Error(`${path} risponde ${res?.status ?? 'niente'}\n${log}`)
      }
    } finally {
      if (server.pid) process.kill(-server.pid, 'SIGTERM')
    }
    step('Tutto a posto: i pacchetti funzionano come li riceveranno gli utenti')
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

await main().catch((error: Error & { stderr?: Buffer }) => {
  console.error(`✗ ${error.message}${error.stderr ? `\n${error.stderr}` : ''}`)
  process.exit(1)
})
