import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextVersion, parseChangelog, stampChangelog } from './changelog.ts'

describe('versions', () => {
  it('step patch, minor and major', () => {
    expect(nextVersion('0.1.3', 'patch')).toBe('0.1.4')
    expect(nextVersion('0.1.3', 'minor')).toBe('0.2.0')
    expect(nextVersion('0.1.3', 'major')).toBe('1.0.0')
    expect(nextVersion('0.1.3', '0.10.0')).toBe('0.10.0')
  })

  it('refuse older or malformed versions', () => {
    expect(() => nextVersion('0.2.0', '0.1.9')).toThrow(/non è più recente/)
    expect(() => nextVersion('0.2.0', '0.2.0')).toThrow(/non è più recente/)
    expect(() => nextVersion('0.2.0', 'v0.3')).toThrow(/non è una versione/)
  })
})

describe('changelog', () => {
  const text = '# Novità\n\n## Prossima versione\n\n- Novità uno\n\n## 0.1.0 — 2026-10-30\n\nPrima.\n'

  it('dates the coming section and opens a new one', () => {
    const out = stampChangelog(text, '0.2.0', '2026-11-05')
    expect(out).toContain('## Prossima versione\n\n## 0.2.0 — 2026-11-05\n\n- Novità uno')
    expect(parseChangelog(out).map((r) => r.version)).toEqual(['0.2.0', '0.1.0'])
    expect(parseChangelog(out)[0]?.notes).toBe('- Novità uno')
  })

  it('refuses a release with nothing written for it', () => {
    expect(() => stampChangelog(stampChangelog(text, '0.2.0', '2026-11-05'), '0.3.0', 'x')).toThrow(/vuota/)
  })

  it('has the current version in the real file', () => {
    const version = JSON.parse(readFileSync('packages/core/package.json', 'utf8')).version
    expect(parseChangelog(readFileSync('CHANGELOG.md', 'utf8')).some((r) => r.version === version)).toBe(true)
  })
})
