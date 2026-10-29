import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Google Fonts served by the site itself. The catalog and the files come from Fontsource once,
 * then from a local cache: visitors never contact a third party for fonts.
 */

const API = 'https://api.fontsource.org/v1/fonts'
const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts'
const WEEK = 7 * 24 * 60 * 60 * 1000
/** Enough for Italian and the other Latin-script languages. */
const SUBSETS = ['latin', 'latin-ext']

export interface FontInfo {
  id: string
  family: string
  category: string
  weights: number[]
  styles: string[]
  variable: boolean
}

interface FontDetail extends FontInfo {
  subsets: string[]
  unicodeRange: Record<string, string>
}

export const FONT_ID = /^[a-z0-9][a-z0-9-]{0,80}$/
export const FONT_FILE = /^[a-z0-9-]+-(\d{3})-(normal|italic)\.woff2$/

/** Fonts bundled with the panel and the starter site, listed even when the catalog cannot be reached. */
const BUNDLED: FontInfo[] = [
  {
    id: 'geist',
    family: 'Geist',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    styles: ['normal'],
    variable: true,
  },
  {
    id: 'inter',
    family: 'Inter',
    category: 'sans-serif',
    weights: [400, 500, 600, 700],
    styles: ['normal', 'italic'],
    variable: true,
  },
  {
    id: 'instrument-serif',
    family: 'Instrument Serif',
    category: 'serif',
    weights: [400],
    styles: ['normal', 'italic'],
    variable: false,
  },
  {
    id: 'fraunces',
    family: 'Fraunces',
    category: 'serif',
    weights: [400, 500, 600, 700],
    styles: ['normal', 'italic'],
    variable: true,
  },
]

export function createFonts(dir: string) {
  let catalog: FontInfo[] | null = null

  async function cached<T>(name: string, maxAge: number, load: () => Promise<T>): Promise<T> {
    const path = join(dir, name)
    const info = await stat(path).catch(() => null)
    if (info && Date.now() - info.mtimeMs < maxAge) return JSON.parse(await readFile(path, 'utf8')) as T
    try {
      const value = await load()
      await mkdir(dir, { recursive: true })
      await writeFile(`${path}.tmp`, JSON.stringify(value))
      await rename(`${path}.tmp`, path)
      return value
    } catch (error) {
      // Offline: an old copy is better than nothing.
      if (info) return JSON.parse(await readFile(path, 'utf8')) as T
      throw error
    }
  }

  async function fetchJson(url: string): Promise<unknown> {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) throw new Error(`${url}: ${res.status}`)
    return res.json()
  }

  async function detail(id: string): Promise<FontDetail> {
    return cached(`${id}.json`, 30 * 24 * 60 * 60 * 1000, async () => {
      const d = (await fetchJson(`${API}/${id}`)) as FontDetail
      return {
        id: d.id,
        family: d.family,
        category: d.category,
        weights: d.weights,
        styles: d.styles,
        variable: d.variable,
        subsets: d.subsets,
        unicodeRange: d.unicodeRange,
      }
    })
  }

  return {
    /** Every Google Font, by family name. */
    async list(): Promise<FontInfo[]> {
      if (catalog) return catalog
      try {
        const all = await cached('catalog.json', WEEK, async () => {
          const list = (await fetchJson(`${API}?type=google`)) as (FontInfo & { subsets: string[] })[]
          return list
            .filter((f) => f.subsets.includes('latin'))
            .map((f) => ({
              id: f.id,
              family: f.family,
              category: f.category,
              weights: f.weights,
              styles: f.styles,
              variable: f.variable,
            }))
            .sort((a, b) => a.family.localeCompare(b.family))
        })
        catalog = all
        return all
      } catch {
        return BUNDLED
      }
    },

    /** @font-face rules pointing at /fonts/<id>/…, for the Latin subsets and every weight. */
    async css(id: string): Promise<string> {
      const d = await detail(id)
      const rules: string[] = []
      for (const subset of SUBSETS.filter((s) => d.subsets.includes(s))) {
        for (const style of d.styles.filter((s) => s === 'normal' || s === 'italic')) {
          for (const weight of d.weights) {
            if (style === 'italic' && weight !== 400) continue
            rules.push(
              `@font-face{font-family:'${d.family.replace(/'/g, '')}';font-style:${style};font-display:swap;font-weight:${weight};` +
                `src:url(/fonts/${id}/${subset}-${weight}-${style}.woff2) format('woff2');unicode-range:${d.unicodeRange[subset] ?? 'U+0000-00FF'}}`,
            )
          }
        }
      }
      return rules.join('\n')
    },

    /** A font file: from the cache, or fetched once from the CDN. */
    async file(id: string, name: string): Promise<Buffer> {
      const path = join(dir, id, name)
      const local = await readFile(path).catch(() => null)
      if (local) return local
      const res = await fetch(`${CDN}/${id}@latest/${name}`, { signal: AbortSignal.timeout(15_000) })
      if (!res.ok) throw new Error(`font ${id}/${name}: ${res.status}`)
      const data = Buffer.from(await res.arrayBuffer())
      await mkdir(join(dir, id), { recursive: true })
      await writeFile(`${path}.tmp`, data)
      await rename(`${path}.tmp`, path)
      return data
    },
  }
}

export type Fonts = ReturnType<typeof createFonts>
