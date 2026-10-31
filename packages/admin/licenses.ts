import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'

const LICENSE_FILE = /^(licen[cs]e|copying|notice)([.-].*)?$/i

/** The folder of the npm package a file belongs to, or null for the panel's own code. */
function packageRoot(file: string): string | null {
  const path = file.replace(/^\0/, '').replace(/[?#].*$/, '')
  const at = path.lastIndexOf('/node_modules/')
  if (at < 0) return null
  const parts = path.slice(at + '/node_modules/'.length).split('/')
  const name = parts[0]?.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  return name ? path.slice(0, at + '/node_modules/'.length) + name : null
}

/** Icon sets from Iconify ship no license file: their info.json names the author and the license. */
function iconSet(root: string): string | null {
  const path = join(root, 'info.json')
  if (!existsSync(path)) return null
  const info = JSON.parse(readFileSync(path, 'utf8')) as {
    name?: string
    author?: { name?: string; url?: string }
    license?: { title?: string; url?: string }
  }
  if (!info.license?.title) return null
  return [
    `Icone «${info.name}» di ${info.author?.name ?? 'autori vari'}${info.author?.url ? ` (${info.author.url})` : ''}.`,
    `Licenza: ${info.license.title}${info.license.url ? `, testo completo: ${info.license.url}` : ''}.`,
  ].join('\n')
}

/** For a package without the license text: who made it and where its source is. */
function fallback(
  pkg: { author?: string | { name?: string }; repository?: string | { url?: string } },
  declared: string,
): string {
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url
  return [
    `Licenza ${declared}${author ? `, copyright ${author}` : ''} (il pacchetto non contiene il testo della licenza).`,
    repo ? `Sorgente: ${repo.replace(/^git\+/, '').replace(/\.git$/, '')}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

function notice(root: string): { key: string; text: string } | null {
  const manifest = join(root, 'package.json')
  if (!existsSync(manifest)) return null
  const pkg = JSON.parse(readFileSync(manifest, 'utf8')) as {
    name: string
    version: string
    license?: unknown
    author?: string | { name?: string }
    repository?: string | { url?: string }
  }
  const declared = typeof pkg.license === 'string' ? pkg.license : 'non indicata'
  const files = readdirSync(root).filter((f) => LICENSE_FILE.test(f))
  const body = files.length
    ? files.map((f) => readFileSync(join(root, f), 'utf8').trim()).join('\n\n')
    : (iconSet(root) ?? fallback(pkg, declared))
  const key = `${pkg.name}@${pkg.version}`
  return { key, text: `${key} — ${declared}\n\n${body}` }
}

/**
 * Writes THIRD-PARTY-LICENSES.txt beside the bundle: the license of every package whose code,
 * styles or fonts end up in the panel, as their licenses ask when they are redistributed.
 */
export function thirdPartyLicenses(): Plugin {
  return {
    name: 'materialize-third-party-licenses',
    apply: 'build',
    generateBundle(_, bundle) {
      const roots = new Set<string>()
      const add = (file: string) => {
        const root = packageRoot(file)
        if (root) roots.add(root)
      }
      for (const id of this.getModuleIds()) add(id)
      // Fonts and other files referenced by the styles are assets, not modules.
      for (const out of Object.values(bundle))
        if (out.type === 'asset') for (const original of out.originalFileNames ?? []) add(original)
      const notices = new Map<string, string>()
      for (const root of roots) {
        const found = notice(root)
        if (found) notices.set(found.key, found.text)
      }
      const sorted = [...notices.keys()].sort().map((key) => notices.get(key))
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD-PARTY-LICENSES.txt',
        source:
          `Il pannello di Materialize include codice, stili e caratteri di questi ${sorted.length} pacchetti, ` +
          'ciascuno con la propria licenza.\n\n' +
          sorted.join(`\n\n${'-'.repeat(80)}\n\n`) +
          '\n',
      })
    },
  }
}
