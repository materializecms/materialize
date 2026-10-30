/**
 * Updates from the panel. The server only exposes them: the work (asking the registry, installing
 * beside the site, restarting) belongs to whoever started it, `materialize start`, which passes an
 * `Updates` in. Without one the panel explains how to update by hand.
 */

export interface ReleaseNotes {
  version: string
  date?: string
  notes: string
}

export interface UpdateStatus {
  current: string
  latest: string | null
  /** Releases newer than the running one, newest first. */
  notes: ReleaseNotes[]
  checkedAt: string | null
  checkError?: string
  /** Why the panel cannot install here (the panel then shows how to do it by hand). */
  unavailable?: string
  /** The version kept for going back, if any. */
  previous: string | null
  job: {
    state: 'idle' | 'working' | 'restarting' | 'failed'
    /** What it is doing now, in words: "Backup", "Scarico la 0.2.0"… */
    step?: string
    message?: string
    /** The end of the package manager's output, when something failed. */
    log?: string
  }
  /** How the last swap went, read after the restart. */
  last: { ok: boolean; kind: 'install' | 'rollback'; from: string; to: string; at: string; message?: string } | null
}

export interface Updates {
  status(): Promise<UpdateStatus>
  /** Asks the registry for the latest version. */
  check(): Promise<UpdateStatus>
  /** Starts installing `version`: `backup` runs first; the server restarts at the end. */
  install(version: string, backup: () => Promise<void>): Promise<void>
  /** Goes back to the previous version (restarts the server). */
  rollback(): Promise<void>
}

export interface UpdateSettings {
  /** Installs fixes (same major and minor version) by itself. */
  auto: boolean
}

export const DEFAULT_UPDATES: UpdateSettings = { auto: false }

const parts = (v: string) => v.split('.').map(Number)

/** True when `a` is a newer version than `b` (plain x.y.z). */
export function newer(a: string, b: string): boolean {
  const [x, y] = [parts(a), parts(b)]
  for (let i = 0; i < 3; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0)
  return false
}

/** A fix release: same major and minor, higher patch. These install by themselves when allowed. */
export function isPatch(next: string, current: string): boolean {
  const [x, y] = [parts(next), parts(current)]
  return x[0] === y[0] && x[1] === y[1] && newer(next, current)
}
