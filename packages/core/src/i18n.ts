import type { Fields } from './fields.ts'
import { CONTENT_ONLY_KEYS, type PageNode } from './page.ts'
import type { Locales } from './schema.ts'

/**
 * A site in several languages: the languages chosen in Impostazioni → Lingue (over the ones in
 * materialize.config.ts), translations of a page kept in step with the original, and the texts a
 * translation has to change.
 */

const LOCALE = /^[a-z]{2,3}(-[A-Z]{2})?$/

/** The site's languages: the ones saved in the panel when valid, else the config's. */
export function withLocales<T extends { locales: Locales }>(config: T, saved: unknown): T {
  const s = saved as Partial<Locales> | null | undefined
  if (!s || typeof s.default !== 'string' || !Array.isArray(s.available)) return config
  const available = [...new Set(s.available.filter((l): l is string => typeof l === 'string' && LOCALE.test(l)))]
  if (!available.includes(s.default)) return config
  return { ...config, locales: { default: s.default, available } }
}

export const isLocaleCode = (code: string) => LOCALE.test(code)

/** Node properties a translation changes: the words, the links, the pictures. */
export const TRANSLATED_KEYS: readonly string[] = CONTENT_ONLY_KEYS

/**
 * The original's structure and design with a translation's words: what a translated header or
 * footer shows, and how a translated page catches up with a changed original. Elements the
 * translation does not have keep the original's words.
 */
export function mergeTranslation(original: PageNode[], translation: PageNode[]): PageNode[] {
  const byId = new Map<string, PageNode>()
  const index = (list: PageNode[]) => {
    for (const n of list) {
      byId.set(n.id, n)
      if (n.children) index(n.children)
    }
  }
  index(translation)
  const merge = (list: PageNode[]): PageNode[] =>
    list.map((n) => {
      const t = byId.get(n.id)
      const out: Record<string, unknown> = { ...n }
      if (t)
        for (const k of TRANSLATED_KEYS) {
          if (k in t) out[k] = (t as unknown as Record<string, unknown>)[k]
          else delete out[k]
        }
      if (n.children) out.children = merge(n.children)
      return out as unknown as PageNode
    })
  return merge(original)
}

/** Ids of the elements in `original` the translation does not have yet. */
export function untranslatedIds(original: PageNode[], translation: PageNode[]): string[] {
  const have = new Set<string>()
  const index = (list: PageNode[]) => {
    for (const n of list) {
      have.add(n.id)
      if (n.children) index(n.children)
    }
  }
  index(translation)
  const out: string[] = []
  const walk = (list: PageNode[]) => {
    for (const n of list) {
      if (!have.has(n.id)) out.push(n.id)
      if (n.children) walk(n.children)
    }
  }
  walk(original)
  return out
}

// ---------- the texts to translate ----------

/** One text of a document, as sent to the translator, and where its translation goes. */
export interface TextSlot {
  text: string
  set: (value: string) => void
}

type Mark = { b?: boolean; i?: boolean; href?: string }

/**
 * Formatted text as one string, with <b>, <i> and <a1>… marks the translator keeps: a sentence
 * is translated whole, not word group by word group.
 */
function encodeRuns(runs: (Mark & { t: string })[]): { text: string; links: string[] } {
  const links: string[] = []
  const text = runs
    .map((r) => {
      let h = r.t
      if (r.i) h = `<i>${h}</i>`
      if (r.b) h = `<b>${h}</b>`
      if (r.href) {
        links.push(r.href)
        h = `<a${links.length}>${h}</a${links.length}>`
      }
      return h
    })
    .join('')
  return { text, links }
}

function decodeRuns(text: string, links: string[]): (Mark & { t: string })[] | null {
  const out: (Mark & { t: string })[] = []
  const state: Mark = {}
  const open: string[] = []
  for (const part of text.split(/(<\/?(?:b|i|a\d+)>)/)) {
    const tag = /^<(\/?)(b|i|a(\d+))>$/.exec(part)
    if (!tag) {
      if (part) out.push({ t: part, ...state })
      continue
    }
    const [, close, name, n] = tag
    if (close) {
      if (open.pop() !== name) return null
      if (name === 'b') delete state.b
      else if (name === 'i') delete state.i
      else delete state.href
    } else {
      open.push(name as string)
      if (name === 'b') state.b = true
      else if (name === 'i') state.i = true
      else {
        const href = links[Number(n) - 1]
        if (!href) return null
        state.href = href
      }
    }
  }
  return open.length ? null : out
}

/** The texts of a canvas page: words, formatted sentences, alternative texts, field options. */
export function nodeSlots(nodes: PageNode[]): TextSlot[] {
  const slots: TextSlot[] = []
  const visit = (n: PageNode) => {
    const p = n as PageNode & Record<string, unknown>
    if (p.runs?.length) {
      const runs = p.runs as (Mark & { t: string })[]
      const { text, links } = encodeRuns(runs)
      if (text.trim())
        slots.push({
          text,
          set: (v) => {
            const decoded = decodeRuns(v, links)
            if (decoded) p.runs = decoded as never
            else {
              p.runs = null
              p.text = v.replace(/<[^>]+>/g, '')
              return
            }
            p.text = decoded.map((r) => r.t).join('')
          },
        })
    } else if (
      !p.langs &&
      typeof p.text === 'string' &&
      p.text.trim() &&
      !/^[\s\d.,:;+\-–—%°€$#*/|·•→←↗]+$/.test(p.text)
    )
      slots.push({ text: p.text, set: (v) => (p.text = v) })
    for (const k of ['alt', 'placeholder'] as const)
      if (typeof p[k] === 'string' && (p[k] as string).trim())
        slots.push({ text: p[k] as string, set: (v) => (p[k] = v) })
    if (Array.isArray(p.options))
      (p.options as unknown[]).forEach((o, i) => {
        if (typeof o === 'string' && o.trim()) slots.push({ text: o, set: (v) => ((p.options as string[])[i] = v) })
      })
    if (p.bgImage && typeof p.bgImage === 'object') {
      const img = p.bgImage as { alt?: string }
      if (img.alt?.trim()) slots.push({ text: img.alt, set: (v) => (img.alt = v) })
    }
    for (const c of n.children ?? []) visit(c)
  }
  for (const n of nodes) visit(n)
  return slots
}

type RichBlock = {
  type?: string
  children?: { text?: string; bold?: boolean; italic?: boolean; href?: string }[]
  image?: { alt?: string }
}

function richSlots(blocks: RichBlock[]): TextSlot[] {
  const slots: TextSlot[] = []
  for (const b of blocks) {
    const image = b.image
    if (b.type === 'image') {
      if (image?.alt?.trim()) slots.push({ text: image.alt, set: (v) => (image.alt = v) })
      continue
    }
    const runs = (b.children ?? []).map((r) => ({ t: r.text ?? '', b: r.bold, i: r.italic, href: r.href }))
    const { text, links } = encodeRuns(runs)
    if (!text.trim()) continue
    slots.push({
      text,
      set: (v) => {
        const decoded = decodeRuns(v, links) ?? [{ t: v.replace(/<[^>]+>/g, '') }]
        b.children = decoded.map((r) => ({
          text: r.t,
          ...(r.b ? { bold: true } : {}),
          ...(r.i ? { italic: true } : {}),
          ...(r.href ? { href: r.href } : {}),
        }))
      },
    })
  }
  return slots
}

/**
 * Every text of a document that a translation changes, read from its fields: texts, rich text,
 * link labels, alternative texts, SEO, canvas pages, blocks, groups and lists. `data` is changed
 * in place by the slots, so pass a copy.
 */
export function documentSlots(fields: Fields, data: Record<string, unknown>): TextSlot[] {
  const slots: TextSlot[] = []
  const str = (obj: Record<string, unknown>, key: string) => {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) slots.push({ text: v, set: (t) => (obj[key] = t) })
  }
  const visit = (defs: Fields, obj: Record<string, unknown>) => {
    for (const [name, f] of Object.entries(defs)) {
      const v = obj[name]
      if (v == null) continue
      switch (f.kind) {
        case 'text':
          str(obj, name)
          break
        case 'richText':
          if (Array.isArray(v)) slots.push(...richSlots(v as RichBlock[]))
          break
        case 'link':
          if (typeof v === 'object') str(v as Record<string, unknown>, 'label')
          break
        case 'media':
          if (typeof v === 'object') str(v as Record<string, unknown>, 'alt')
          break
        case 'seo': {
          const seo = v as Record<string, unknown>
          for (const k of ['title', 'description', 'socialTitle', 'socialDescription']) str(seo, k)
          if (seo.image && typeof seo.image === 'object') str(seo.image as Record<string, unknown>, 'alt')
          if (Array.isArray(seo.faq))
            for (const q of seo.faq as Record<string, unknown>[]) {
              str(q, 'q')
              str(q, 'a')
            }
          break
        }
        case 'page':
          if (Array.isArray(v)) slots.push(...nodeSlots(v as PageNode[]))
          break
        case 'group':
          if (f.children && typeof v === 'object') visit(f.children, v as Record<string, unknown>)
          break
        case 'array':
          if (f.item && Array.isArray(v)) {
            const list = v as unknown[]
            list.forEach((_, i) => {
              // Items may be plain values: the slot writes back into the list.
              const holder = {}
              Object.defineProperty(holder, 'item', {
                get: () => list[i],
                set: (x) => {
                  list[i] = x
                },
                enumerable: true,
              })
              visit({ item: f.item as never }, holder as Record<string, unknown>)
            })
          }
          break
        case 'blocks':
          if (Array.isArray(v))
            for (const b of v as Record<string, unknown>[]) {
              const def = f.blocks?.find((x) => x.name === b._type)
              if (def) visit(def.fields, b)
            }
          break
      }
    }
  }
  visit(fields, data)
  return slots
}

/**
 * Internal links pointing at pages of the main language, sent to the same pages in this
 * language where they are translated: "/contatti#form" becomes "/en/contact#form".
 */
export function localizeLinks(nodes: PageNode[], urls: Record<string, string>): PageNode[] {
  const swap = (href: unknown) => {
    if (typeof href !== 'string' || !href.startsWith('/')) return href
    const [, path = '', rest = ''] = /^([^?#]*)(.*)$/.exec(href) ?? []
    const to = urls[path.replace(/\/+$/, '') || '/']
    return to ? to + rest : href
  }
  const visit = (list: PageNode[]): PageNode[] =>
    list.map((n) => {
      const out = { ...n }
      if (out.href) out.href = swap(out.href) as string
      if (out.runs) out.runs = out.runs.map((r) => (r.href ? { ...r, href: swap(r.href) as string } : r))
      if (out.children) out.children = visit(out.children)
      return out
    })
  return visit(nodes)
}
