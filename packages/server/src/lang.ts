import { AsyncLocalStorage } from 'node:async_hooks'
import { isLang, type Lang, setScopedLang } from '@materializecms/core/lang'
import type { MiddlewareHandler } from 'hono'

/**
 * The language of each request: several people use the server at once, each in their own language.
 * The panel says it in the `x-mz-lang` header; otherwise it comes from the profile of whoever is
 * signed in, and otherwise from the host (the terminal's language, Italian by default). Work started
 * by the server itself (schedules, emails to someone else) picks its language with `withLang`.
 */
type Store = { lang?: Lang; chosen: boolean }
const store = new AsyncLocalStorage<Store>()

setScopedLang(() => store.getStore()?.lang)

export const requestLang: MiddlewareHandler = (c, next) => {
  // A download link can't send headers: it says the language in the address (?lang=en).
  const header = c.req.header('x-mz-lang') ?? c.req.query('lang')
  return store.run(isLang(header) ? { lang: header, chosen: true } : { chosen: false }, next)
}

/** The profile's language, when the request did not say one. */
export function useProfileLang(locale: unknown) {
  const s = store.getStore()
  if (s && !s.chosen && isLang(locale)) s.lang = locale
}

/** Runs some work in a given language: an email to someone else, a scheduled job. */
export const withLang = <T>(lang: Lang, work: () => T): T => store.run({ lang, chosen: true }, work)
