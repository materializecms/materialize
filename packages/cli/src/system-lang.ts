/**
 * The terminal speaks the system's language: Italian on an Italian computer, English otherwise.
 * MATERIALIZE_LANG=it|en chooses by hand. Only Node here: the supervisor uses it too, and must
 * not load any Materialize package (see supervisor.ts).
 */
export type SystemLang = 'it' | 'en'

export function systemLang(env: Record<string, string | undefined> = process.env): SystemLang {
  const chosen = env.MATERIALIZE_LANG
  if (chosen === 'it' || chosen === 'en') return chosen
  const tag = env.LC_ALL || env.LC_MESSAGES || env.LANG || Intl.DateTimeFormat().resolvedOptions().locale || ''
  return /^it\b|^it[_-]/i.test(tag) ? 'it' : 'en'
}
