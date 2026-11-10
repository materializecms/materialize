/**
 * The language of the people who use Materialize: the panel, the server's messages, the emails to
 * the team, the terminal. Not the language of the site, which belongs to its content (see i18n.ts).
 *
 * Italian is the source: every text is written in Italian in the code and is its own key; English
 * comes from a dictionary. A text not translated yet shows in Italian rather than disappearing.
 *
 * Who decides the language changes with the place: the panel sets it from the profile, the server
 * from each request (several people at once), the terminal from the system. So each host gives a
 * source with `setLangSource`, and the texts of every package ask it when they are written.
 */
export type Lang = 'it' | 'en'

export const LANGS: Lang[] = ['it', 'en']

export const isLang = (value: unknown): value is Lang => value === 'it' || value === 'en'

let source: () => Lang = () => 'it'
let scoped: () => Lang | undefined = () => undefined

/** Where the current language comes from: set once by the panel or the CLI. */
export function setLangSource(get: () => Lang) {
  source = get
}

/**
 * A language that wins inside a piece of work, such as one request on the server; when it gives
 * none, the source above decides.
 */
export function setScopedLang(get: () => Lang | undefined) {
  scoped = get
}

/** The language for the text being written right now. */
export const currentLang = (): Lang => scoped() ?? source()

/** The Intl locale for dates and numbers in that language. */
export const intlLocaleOf = (lang: Lang) => (lang === 'it' ? 'it' : 'en-GB')

export type Vars = Record<string, string | number | null | undefined>

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (all, k: string) => (k in vars ? String(vars[k] ?? '') : all)) : text

export type Translate = {
  /** A text in the current language: `t('Uscirà {when}', { when })`. */
  (text: string, vars?: Vars): string
  /** One form or the other by number: `t.n(n, 'un documento', '{n} documenti')`. */
  n: (n: number, one: string, many: string, vars?: Vars) => string
  /** The same text in a given language, whatever the current one is (an email to someone else). */
  in: (lang: Lang, text: string, vars?: Vars) => string
}

/** A translator over one package's English dictionary. */
export function translator(en: Record<string, string>): Translate {
  const pick = (lang: Lang, text: string) => (lang === 'it' ? text : (en[text] ?? text))
  const t = ((text: string, vars?: Vars) => fill(pick(currentLang(), text), vars)) as Translate
  t.n = (n, one, many, vars) => t(n === 1 ? one : many, { n, ...vars })
  t.in = (lang, text, vars) => fill(pick(lang, text), vars)
  return t
}
