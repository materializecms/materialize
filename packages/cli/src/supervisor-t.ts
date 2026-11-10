import { supervisor } from './en/supervisor.ts'
import { systemLang } from './system-lang.ts'

/**
 * The supervisor's own translator: like t.ts, but with Node only, because the supervisor stays
 * loaded while the packages under it are swapped (and must work even if they are broken).
 */
const lang = systemLang()

export function t(text: string, vars?: Record<string, string | number>): string {
  const out = lang === 'it' ? text : (supervisor[text] ?? text)
  return vars ? out.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k]) : all)) : out
}
