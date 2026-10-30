/**
 * CHANGELOG.md, written for the people who use Materialize: one "## <version> — <date>" section
 * per release, newest first, and a "## Prossima versione" section that collects what is coming.
 */

export const NEXT = 'Prossima versione'

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

/** "0.1.3" + "minor" → "0.2.0"; an exact version must be newer than the current one. */
export function nextVersion(current: string, arg: string): string {
  const now = SEMVER.exec(current)
  if (!now) throw new Error(`Versione attuale non valida: ${current}`)
  const [major, minor, patch] = now.slice(1).map(Number) as [number, number, number]
  if (arg === 'patch') return `${major}.${minor}.${patch + 1}`
  if (arg === 'minor') return `${major}.${minor + 1}.0`
  if (arg === 'major') return `${major + 1}.0.0`
  const next = SEMVER.exec(arg)
  if (!next) throw new Error(`«${arg}» non è una versione: usa 1.2.3, patch, minor o major`)
  // Each part counts only when the ones before it are equal: 0.10.0 is newer than 0.9.9.
  const score = (parts: number[]) => parts.reduce((sum, n) => sum * 1e6 + n, 0)
  if (score(next.slice(1).map(Number)) <= score([major, minor, patch]))
    throw new Error(`${arg} non è più recente di ${current}`)
  return arg
}

/** Every release in the file, newest first, with its notes as written. */
export function parseChangelog(text: string): { version: string; date?: string; notes: string }[] {
  const out: { version: string; date?: string; notes: string }[] = []
  for (const part of text.split(/^## /m).slice(1)) {
    const [heading = '', ...body] = part.split('\n')
    const match = /^(\d+\.\d+\.\d+)(?:\s+—\s+(\d{4}-\d{2}-\d{2}))?\s*$/.exec(heading.trim())
    if (match?.[1]) out.push({ version: match[1], date: match[2], notes: body.join('\n').trim() })
  }
  return out
}

/** Renames "## Prossima versione" to the new version and opens an empty one above it. */
export function stampChangelog(text: string, version: string, date: string): string {
  const heading = new RegExp(`^## ${NEXT}[ \\t]*$`, 'm')
  const match = heading.exec(text)
  if (!match) throw new Error(`CHANGELOG.md non ha la sezione «## ${NEXT}»`)
  const body = text.slice(match.index + match[0].length).split(/^## /m)[0] ?? ''
  if (!body.trim()) throw new Error(`La sezione «${NEXT}» del CHANGELOG è vuota: scrivi cosa cambia`)
  if (parseChangelog(text).some((r) => r.version === version)) throw new Error(`Il CHANGELOG ha già la ${version}`)
  return text.replace(heading, `## ${NEXT}\n\n## ${version} — ${date}`)
}
