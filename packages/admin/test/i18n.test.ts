import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../src/i18n/en/index.ts'

const SRC = join(import.meta.dirname, '../src')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : /\.tsx?$/.test(name) ? [path] : []
  })
}

/** A string literal in the source, its quotes removed and its escapes read. */
const literal = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|` + '`(?:[^`\\\\]|\\\\.)*`'
const unquote = (raw: string) => {
  const q = raw[0]
  const body = raw.slice(1, -1)
  return q === '`' ? body : body.replace(/\\(.)/g, '$1')
}

/** Every text given to t() and tn() in the panel, with where it is. */
function texts(): { text: string; where: string }[] {
  const out: { text: string; where: string }[] = []
  const call = new RegExp(String.raw`\b(t|tn|tx)\(\s*(?:[^,()]+,\s*)?(${literal})(?:\s*,\s*(${literal}))?`, 'g')
  for (const file of files(SRC)) {
    // The dictionaries, and the examples in the comments of the translation functions.
    if (file.includes(join('src', 'i18n')) || file.endsWith(join('lib', 'i18n.ts'))) continue
    const source = readFileSync(file, 'utf8')
    for (const m of source.matchAll(call)) {
      const where = `${file.slice(SRC.length + 1)}:${source.slice(0, m.index).split('\n').length}`
      const fn = m[1]
      // tn(count, one, many): the first argument is the number, the next two are texts.
      const raws = fn === 'tn' ? [m[2], m[3]] : [m[2]]
      for (const raw of raws) if (raw) out.push({ text: unquote(raw), where })
    }
  }
  return out
}

describe('panel in English', () => {
  const all = texts()

  it('finds the texts to translate', () => {
    expect(all.length).toBeGreaterThan(0)
  })

  it('has every text in the English dictionary', () => {
    const missing = all.filter((x) => !(x.text in en)).map((x) => `${x.where}  ${x.text}`)
    expect(missing).toEqual([])
  })

  it('writes texts as fixed strings, with values in braces', () => {
    const dynamic = all.filter((x) => x.text.includes('${')).map((x) => `${x.where}  ${x.text}`)
    expect(dynamic).toEqual([])
  })

  it('keeps the same {placeholders} in the translation', () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
    const wrong = Object.entries(en)
      .filter(([it, tr]) => names(it).join() !== names(tr).join())
      .map(([it]) => it)
    expect(wrong).toEqual([])
  })
})
