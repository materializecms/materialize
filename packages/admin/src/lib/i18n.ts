import { setLangSource } from '@materializecms/core/lang'
import { createElement, Fragment, type ReactNode, useSyncExternalStore } from 'react'
import { en } from '../i18n/en/index.ts'

/**
 * The panel's languages. Italian is the source: every text is written in Italian in the code
 * and is its own key; English comes from a dictionary. A text not translated yet shows in
 * Italian rather than disappearing.
 */
export type Lang = 'it' | 'en'

export const LANGS: { value: Lang; label: string }[] = [
  { value: 'it', label: 'Italiano' },
  { value: 'en', label: 'English' },
]

const KEY = 'mz-lang'

/**
 * Before anyone chooses (in the profile or on the sign-in page), the panel follows the browser:
 * Italian for an Italian browser, English for everyone else.
 */
const browserLang = (): Lang => {
  try {
    return /^it\b/i.test(navigator.language) ? 'it' : 'en'
  } catch {
    return 'it'
  }
}
const DEFAULT: Lang = typeof navigator === 'undefined' ? 'it' : browserLang()

function initial(): Lang {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'it' || saved === 'en') return saved
  } catch {}
  return DEFAULT
}

let current: Lang = initial()
const listeners = new Set<() => void>()
if (typeof document !== 'undefined') document.documentElement.lang = current

export const lang = (): Lang => current

// The core's texts (checks, library, labels) follow the panel's language.
setLangSource(() => current)

/** Sets the language (null: the browser's) and redraws the panel. */
export function setLang(next: Lang | null) {
  try {
    if (next) localStorage.setItem(KEY, next)
    else localStorage.removeItem(KEY)
  } catch {}
  const value = next ?? DEFAULT
  if (value === current) return
  current = value
  if (typeof document !== 'undefined') document.documentElement.lang = value
  for (const l of listeners) l()
}

/** The language, as state: the panel is drawn again when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => listeners.delete(fn)
    },
    () => current,
  )
}

type Vars = Record<string, string | number | null | undefined>

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k] ?? '') : all)) : text

/**
 * A text in the panel's language: `t('Pubblica')`, with values in braces:
 * `t('Uscirà {when}', { when })`.
 */
export function t(text: string, vars?: Vars): string {
  return fill(current === 'it' ? text : (en[text] ?? text), vars)
}

/** One form or the other by number: `tn(n, 'un documento', '{n} documenti')`. */
export function tn(n: number, one: string, many: string, vars?: Vars): string {
  return t(n === 1 ? one : many, { n, ...vars })
}

/**
 * A text with pieces of the page inside it, such as bold words or a link:
 * `tx('Se {email} ha un account…', { email: <strong>{email}</strong> })`.
 */
export function tx(text: string, parts: Record<string, ReactNode>): ReactNode {
  const out: ReactNode[] = []
  const translated = current === 'it' ? text : (en[text] ?? text)
  let last = 0
  for (const m of translated.matchAll(/\{(\w+)\}/g)) {
    out.push(translated.slice(last, m.index))
    out.push(m[1] && m[1] in parts ? parts[m[1]] : m[0])
    last = (m.index ?? 0) + m[0].length
  }
  out.push(translated.slice(last))
  return createElement(Fragment, null, ...out)
}

/** The Intl locale for dates and numbers. */
export const intlLocale = () => (current === 'it' ? 'it' : 'en-GB')
