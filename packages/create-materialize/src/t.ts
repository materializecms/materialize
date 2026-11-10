import { en } from './en/index.ts'

/**
 * The starter's texts in the system's language: Italian on an Italian computer, English otherwise;
 * MATERIALIZE_LANG=it|en chooses by hand. The same rule as the materialize command
 * (cli/src/lang.ts), repeated here because `npm create` runs this package alone, with no
 * dependencies. Italian is the source and the key; English comes from en/.
 */
export function systemLang(env = process.env): 'it' | 'en' {
  if (env.MATERIALIZE_LANG === 'it' || env.MATERIALIZE_LANG === 'en') return env.MATERIALIZE_LANG
  const tag = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || ''
  return /^it\b|^it[_-]/i.test(tag) ? 'it' : 'en'
}

const lang = systemLang()

/** A text in the system's language, with its {placeholders} filled in. */
export function t(text: string, vars?: Record<string, string | number>): string {
  const chosen = lang === 'it' ? text : (en[text] ?? text)
  return vars ? chosen.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all)) : chosen
}
