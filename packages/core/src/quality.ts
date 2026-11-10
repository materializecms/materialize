/**
 * Accessibility and performance checks of a canvas page, shown in the editor and before
 * publishing. Pure functions: the colours a text really has are measured by the editor on the
 * rendered page and checked here with the WCAG contrast formula.
 */

import { currentLang } from './lang.ts'
import { type PageNode, type Theme, textTag } from './page.ts'
import type { CheckLevel, SeoCheck } from './seo.ts'
import { t } from './t.ts'

export type QualityCheck = SeoCheck

/** A decimal number written the way the reader's language writes it (a comma in Italian). */
const dec = (v: string) => (currentLang() === 'it' ? v.replace('.', ',') : v)

const HEADING: Record<string, number> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 }

/** Link texts that say nothing out of context: a screen reader lists links by their words. */
const VAGUE = new Set([
  'clicca qui',
  'qui',
  'clicca',
  'leggi',
  'leggi di più',
  'leggi tutto',
  'scopri di più',
  'di più',
  'altro',
  'link',
  'vai',
  'click here',
  'here',
  'read more',
  'more',
  'learn more',
])

const _textOf = (n: PageNode) => (n.runs?.map((r) => r.t).join('') ?? n.text ?? '').trim()

const sorted = (out: QualityCheck[]) => {
  const order: Record<CheckLevel, number> = { error: 0, warning: 1, ok: 2 }
  return out.sort((a, b) => order[a.level] - order[b.level])
}

/** What a page lacks for people who use a screen reader, a keyboard or see less well. */
export function accessibilityChecks(nodes: PageNode[]): QualityCheck[] {
  const out: QualityCheck[] = []
  const add = (id: string, level: CheckLevel, label: string, detail?: string, nodeId?: string) =>
    out.push({ id, level, label, detail, nodeId })
  let images = 0
  let missingAlt = 0
  let lastLevel = 0
  let skipped: PageNode | null = null
  const visit = (list: PageNode[]) => {
    for (const n of list) {
      if (n.hidden) continue
      if (n.type === 'image' && n.src) {
        images++
        if (!n.alt?.trim()) {
          missingAlt++
          add(
            `alt:${n.id}`,
            'warning',
            t('Immagine senza descrizione: {name}', { name: n.name || t('immagine') }),
            t('Chi usa un lettore di schermo non sa cosa mostra; serve anche a Google Immagini.'),
            n.id,
          )
        }
      }
      if (n.type === 'text') {
        const level = HEADING[textTag(n)] ?? 0
        if (level) {
          if (lastLevel && level > lastLevel + 1 && !skipped) skipped = n
          lastLevel = level
        }
        for (const r of n.runs ?? [])
          if (r.href && VAGUE.has(r.t.trim().toLowerCase()))
            add(
              `vague:${n.id}:${r.t}`,
              'warning',
              t('Link poco chiaro: «{text}»', { text: r.t.trim() }),
              t('Scrivi dove porta, per esempio «Leggi il caso Nova Bank».'),
              n.id,
            )
      }
      if (n.type === 'button') {
        const text = n.text?.trim() ?? ''
        if (!text && !n.alt?.trim())
          add(`btn:${n.id}`, 'error', t('Pulsante senza testo'), t('Un lettore di schermo non sa dire cosa fa.'), n.id)
        else if (n.href && VAGUE.has(text.toLowerCase()))
          add(
            `vague:${n.id}`,
            'warning',
            t('Pulsante poco chiaro: «{text}»', { text }),
            t('Scrivi dove porta, per esempio «Scopri i servizi».'),
            n.id,
          )
      }
      if (n.type === 'icon' && n.href && !n.alt?.trim())
        add(
          `icon:${n.id}`,
          'error',
          t('Icona cliccabile senza nome'),
          t('Scrivi nel testo alternativo dove porta (per esempio «Instagram»).'),
          n.id,
        )
      if (n.type === 'input' && !n.text?.trim())
        add(
          `label:${n.id}`,
          'error',
          t('Campo del modulo senza etichetta'),
          t('Senza etichetta, chi non vede il campo non sa cosa scrivere.'),
          n.id,
        )
      if (n.type === 'video' && n.src && !n.controls)
        add(
          `motion:${n.id}`,
          'warning',
          t('Video che si muove da solo, senza pausa'),
          t('Attiva «Comandi» se dura più di 5 secondi: c’è chi deve poterlo fermare.'),
          n.id,
        )
      if (n.children) visit(n.children)
    }
  }
  visit(nodes)
  const skip = skipped as PageNode | null
  if (skip)
    add(
      'levels',
      'warning',
      t('Livelli dei titoli saltati'),
      t('Per esempio da Titolo 1 a Titolo 3 senza un Titolo 2: chi naviga per titoli si perde.'),
      skip.id,
    )
  if (images && !missingAlt) add('alt', 'ok', t('Tutte le immagini hanno una descrizione'))
  return sorted(out)
}

// ---------- contrast ----------

export type Rgba = [number, number, number, number]

/** A CSS colour as computed by the browser ("rgb(…)", "rgba(…)", "#rrggbb"), or null. */
export function parseColor(value: string): Rgba | null {
  const v = value.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v)?.[1]
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
    const n = (i: number) => Number.parseInt(full.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1]
  }
  const m = /^rgba?\(([^)]+)\)$/.exec(v)?.[1]
  if (!m) return null
  const parts = m.split(/[\s,/]+/).filter(Boolean)
  const [r, g, b] = parts.slice(0, 3).map(Number)
  const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? Number.parseFloat(parts[3]) / 100 : Number(parts[3])
  if ([r, g, b, a].some((x) => x === undefined || Number.isNaN(x))) return null
  return [r as number, g as number, b as number, a]
}

/** A colour seen over another: what the eye gets from a half-transparent text or layer. */
export function over(top: Rgba, below: Rgba): Rgba {
  const a = top[3]
  return [top[0] * a + below[0] * (1 - a), top[1] * a + below[1] * (1 - a), top[2] * a + below[2] * (1 - a), 1]
}

const luminance = ([r, g, b]: Rgba) => {
  const ch = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
}

/** WCAG contrast ratio, from 1 (none) to 21 (black on white). */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

/** A text on the page as the editor measured it. */
export interface MeasuredText {
  nodeId: string
  /** Its first words, to recognise it. */
  sample: string
  color: Rgba
  /** The solid colour behind it; null over a photo, a gradient or a 3D scene. */
  background: Rgba | null
  fontSize: number
  fontWeight: number
}

/** Texts too light or too dark for their background (WCAG AA: 4.5:1, 3:1 for large text). */
export function contrastChecks(texts: MeasuredText[]): QualityCheck[] {
  const out: QualityCheck[] = []
  let measured = 0
  const seen = new Set<string>()
  for (const m of texts) {
    if (!m.background || seen.has(m.nodeId) || !m.sample) continue
    seen.add(m.nodeId)
    measured++
    const large = m.fontSize >= 24 || (m.fontSize >= 18.66 && m.fontWeight >= 700)
    const needed = large ? 3 : 4.5
    const ratio = contrastRatio(over(m.color, m.background), m.background)
    if (ratio >= needed) continue
    out.push({
      id: `contrast:${m.nodeId}`,
      level: ratio < 3 ? 'error' : 'warning',
      label: t('Testo poco leggibile: «{text}»', { text: m.sample }),
      detail: t('Contrasto {ratio}:1, ne serve almeno {needed}:1. Scurisci o schiarisci il testo o lo sfondo.', {
        ratio: dec(ratio.toFixed(1)),
        needed: dec(String(needed)),
      }),
      nodeId: m.nodeId,
    })
  }
  if (measured && !out.length)
    out.push({ id: 'contrast', level: 'ok', label: t('Testi ben leggibili sul loro sfondo') })
  return sorted(out)
}

// ---------- performance ----------

/** What the editor knows of a file of the library, by its address. */
export interface MediaInfo {
  size: number
  mime: string
}

const MB = 1024 * 1024
const mb = (bytes: number) => `${dec((bytes / MB).toFixed(1))} MB`

/**
 * What makes a page slow to open, above all on a phone: files not served by the library, heavy
 * videos and GIFs, many 3D scenes, custom code from other sites, many fonts, a huge page.
 */
export function performanceChecks(
  nodes: PageNode[],
  options: { media?: Record<string, MediaInfo>; theme?: Theme } = {},
): QualityCheck[] {
  const out: QualityCheck[] = []
  const add = (id: string, level: CheckLevel, label: string, detail?: string, nodeId?: string) =>
    out.push({ id, level, label, detail, nodeId })
  const media = options.media ?? {}
  let count = 0
  let scenes: PageNode[] = []
  let scripts = 0
  let firstScript: PageNode | null = null
  const families = new Set(options.theme ? [options.theme.display, options.theme.body] : [])
  const visit = (list: PageNode[]) => {
    for (const n of list) {
      if (n.hidden) continue
      count++
      if (n.font?.family) families.add(n.font.family)
      if (n.type === 'scene' || n.scene) scenes = [...scenes, n]
      const src = n.type === 'image' || n.type === 'video' ? n.src : null
      if (src && /^https?:\/\//.test(src))
        add(
          `external:${n.id}`,
          'warning',
          n.type === 'video'
            ? t('Video da un altro sito: {name}', { name: n.name || src.split('/').pop() })
            : t('Immagine da un altro sito: {name}', { name: n.name || src.split('/').pop() }),
          t('Non viene ridimensionata né convertita: caricala nella libreria media.'),
          n.id,
        )
      const info = src ? media[src] : undefined
      if (n.type === 'image' && info && info.mime === 'image/gif' && info.size > 1 * MB)
        add(
          `gif:${n.id}`,
          'warning',
          t('GIF pesante ({size})', { size: mb(info.size) }),
          t('Un video MP4 corto pesa un decimo e si vede meglio.'),
          n.id,
        )
      if (n.type === 'video' && info && info.size > 15 * MB)
        add(
          `video:${n.id}`,
          'warning',
          t('Video pesante ({size})', { size: mb(info.size) }),
          t('Su un telefono si scarica piano: comprimilo sotto i 10 MB, per esempio con HandBrake.'),
          n.id,
        )
      if (n.type === 'video' && n.src && !n.poster)
        add(
          `poster:${n.id}`,
          'warning',
          t('Video senza immagine di copertina'),
          t('Finché il video non si carica, al suo posto c’è un vuoto: aggiungi la copertina.'),
          n.id,
        )
      if (n.type === 'embed' && /<script[^>]+src=/i.test(n.html ?? '')) {
        scripts++
        firstScript ??= n
      }
      if (n.children) visit(n.children)
    }
  }
  visit(nodes)
  if (scenes.length > 2)
    add(
      'scenes',
      'warning',
      t('{n} scene animate 3D o WebGL', { n: scenes.length }),
      t('Ognuna lavora sulla scheda grafica: sui telefoni meno recenti la pagina può scattare. Ne bastano una o due.'),
      scenes[2]?.id,
    )
  if (scripts)
    add(
      'scripts',
      'warning',
      t.n(
        scripts,
        'Codice personalizzato che carica uno script esterno',
        '{n} script esterni nel codice personalizzato',
      ),
      t('Ogni script di un altro sito rallenta l’apertura: tieni solo quelli che servono.'),
      (firstScript as PageNode | null)?.id,
    )
  if (families.size > 3)
    add(
      'fonts',
      'warning',
      t('{n} caratteri diversi', { n: families.size }),
      t('Ogni carattere è un file da scaricare: due o tre bastano e rendono la pagina più coerente.'),
    )
  if (count > 1500)
    add(
      'size',
      'warning',
      t('Pagina molto grande ({n} elementi)', { n: count }),
      t('Dividila in più pagine, o usa un elenco con «Mostra altri».'),
    )
  if (!out.length) add('perf', 'ok', t('Nessun peso inutile trovato'))
  return sorted(out)
}
