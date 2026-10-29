const rtf = new Intl.RelativeTimeFormat('it', { numeric: 'auto' })
const full = new Intl.DateTimeFormat('it', { dateStyle: 'medium', timeStyle: 'short' })

/** "2 minuti fa", "ieri", or a date for anything older than a week. */
export function relativeTime(value: string | Date): string {
  const date = new Date(value)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return 'adesso'
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
  if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day')
  return new Intl.DateTimeFormat('it', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

export const fullDate = (value: string | Date) => full.format(new Date(value))
