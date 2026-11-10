import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

const literal = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|` + '`(?:[^`\\\\]|\\\\.)*`'
const unquote = (raw: string) => {
  const q = raw[0]
  const body = raw.slice(1, -1)
  return q === '`' ? body : body.replace(/\\(.)/g, '$1')
}

/**
 * Every text given to t(), t.n() and t.in() in a package's sources: `t('…')`, `t.n(count, '…', '…')`,
 * `t.in(lang, '…')`. The first argument of t.n and t.in must not contain parentheses.
 */
export function texts(src: string): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = []
  const call = new RegExp(String.raw`\bt(\.n|\.in)?\(\s*(?:[^,()]+,\s*)?(${literal})(?:\s*,\s*(${literal}))?`, 'g')
  for (const file of files(src)) {
    // The dictionaries, and the examples in the comments of the translator itself.
    if (file.includes(join(src, 'en')) || file.endsWith(join('core', 'src', 'lang.ts'))) continue
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(call)) {
      const where = `${file.slice(src.length + 1)}:${source.slice(0, m.index).split('\n').length}`
      const raws = m[1] === '.n' ? [m[2], m[3]] : [m[2]]
      for (const raw of raws) if (raw) out.push({ text: unquote(raw), where })
    }
  }
  return out
}

/** The checks every package with its own English dictionary runs. */
export function langChecks(src: string, en: Record<string, string>) {
  const all = texts(src)

  it('has every text in the English dictionary', () => {
    expect(all.filter((x) => !(x.text in en)).map((x) => `${x.where}  ${x.text}`)).toEqual([])
  })

  it('writes texts as fixed strings, with values in braces', () => {
    expect(all.filter((x) => x.text.includes('${')).map((x) => `${x.where}  ${x.text}`)).toEqual([])
  })

  it('keeps the same {placeholders} in the translation', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    expect(
      Object.entries(en)
        .filter(([it, tr]) => names(it).join() !== names(tr).join())
        .map(([it]) => it),
    ).toEqual([])
  })

  it('has no translation left without its text', () => {
    const used = new Set(all.map((x) => x.text))
    expect(Object.keys(en).filter((k) => !used.has(k))).toEqual([])
  })
}
