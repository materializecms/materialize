import { intlLocale, t } from './i18n.ts'

/** Formatters in the panel's language, made once per language. */
const cache = new Map<string, Intl.DateTimeFormat | Intl.RelativeTimeFormat>()
const dates = (name: string, options: Intl.DateTimeFormatOptions) => {
  const key = `${intlLocale()}:${name}`
  let f = cache.get(key) as Intl.DateTimeFormat | undefined
  if (!f) {
    f = new Intl.DateTimeFormat(intlLocale(), options)
    cache.set(key, f)
  }
  return f
}
const relative = () => {
  const key = `${intlLocale()}:rtf`
  let f = cache.get(key) as Intl.RelativeTimeFormat | undefined
  if (!f) {
    f = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' })
    cache.set(key, f)
  }
  return f
}

/** "2 minuti fa", "ieri", or a date for anything older than a week. */
export function relativeTime(value: string | Date): string {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return t('adesso')
  if (abs < 3600) return relative().format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return relative().format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return relative().format(Math.round(seconds / 86400), 'day')
  return dates('short', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export const fullDate = (value: string | Date) =>
  dates('full', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))

/** A calendar day ("2026-10-30" → "30 ottobre 2026"), with no time and no shift across time zones. */
export const dayDate = (value: string) =>
  dates('day', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${value.slice(0, 10)}T00:00:00Z`),
  )

/** A moment coming up, short: "lun 10 nov, 09:00". */
export const whenDate = (value: string | Date) =>
  dates('when', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  )
