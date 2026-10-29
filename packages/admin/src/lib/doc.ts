import type { FieldDescription, ValidationIssue } from '@materialize/core'

export type Path = (string | number)[]

export function getIn(value: unknown, path: Path): unknown {
  let current = value
  for (const key of path) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string | number, unknown>)[key]
  }
  return current
}

/** Immutable set: returns a copy of `value` with `next` at `path`, creating objects and arrays as needed. */
export function setIn<T>(value: T, path: Path, next: unknown): T {
  if (!path.length) return next as T
  const [key, ...rest] = path as [string | number, ...Path]
  const base: unknown = value ?? (typeof key === 'number' ? [] : {})
  const child = (base as Record<string | number, unknown>)[key]
  const updated = setIn(child, rest, next)
  if (Array.isArray(base)) {
    const copy = [...base]
    copy[key as number] = updated
    return copy as T
  }
  const copy: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  if (updated === undefined) delete copy[key as string]
  else copy[key as string] = updated
  return copy as T
}

export const pathKey = (path: Path) => path.join('.')

export function newKey(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Initial value for a freshly added block, array item or field. */
export function emptyValue(field: FieldDescription): unknown {
  switch (field.kind) {
    case 'boolean':
      return false
    case 'blocks':
    case 'array':
      return []
    case 'richText':
      return []
    case 'group': {
      const out: Record<string, unknown> = {}
      for (const child of field.fields ?? []) {
        const v = emptyValue(child)
        if (v !== undefined) out[child.name] = v
      }
      return out
    }
    case 'select':
      return field.required ? optionValues(field)[0] : undefined
    case 'relation':
      return field.options.many ? [] : undefined
    default:
      return undefined
  }
}

export function newBlock(type: string, fields: FieldDescription[]): Record<string, unknown> {
  const block: Record<string, unknown> = { _type: type, _key: newKey() }
  for (const f of fields) {
    const v = emptyValue(f)
    if (v !== undefined) block[f.name] = v
  }
  return block
}

export function optionValues(field: FieldDescription): string[] {
  const options = (field.options.options ?? []) as (string | { value: string; label: string })[]
  return options.map((o) => (typeof o === 'string' ? o : o.value))
}

export function optionList(field: FieldDescription): { value: string; label: string }[] {
  const options = (field.options.options ?? []) as (string | { value: string; label: string })[]
  return options.map((o) => (typeof o === 'string' ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1) } : o))
}

const isBlank = (v: unknown) => v === undefined || v === null || v === '' || (typeof v === 'number' && Number.isNaN(v))

/**
 * Removes values the editor leaves behind but the schema would reject:
 * empty optional strings, images without a file, links without an address.
 */
export function clean(fields: FieldDescription[], data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const field = fields.find((f) => f.name === key)
    if (!field) {
      if (key.startsWith('_')) out[key] = value
      continue
    }
    const v = cleanValue(field, value)
    if (v !== undefined) out[key] = v
  }
  return out
}

function cleanValue(field: FieldDescription, value: unknown): unknown {
  if (isBlank(value)) return field.kind === 'text' && field.required ? '' : undefined
  switch (field.kind) {
    case 'media': {
      const m = value as { src?: string }
      return m.src ? value : undefined
    }
    case 'link': {
      const l = value as { href?: string; label?: string; newTab?: boolean }
      if (!l.href) return undefined
      return { href: l.href, ...(l.label ? { label: l.label } : {}), ...(l.newTab ? { newTab: true } : {}) }
    }
    case 'seo': {
      const s = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(s)) {
        if (isBlank(v) || v === false) continue
        if (k === 'image' && !(v as { src?: string }).src) continue
        out[k] = v
      }
      return Object.keys(out).length ? out : undefined
    }
    case 'group':
      return clean(field.fields ?? [], value as Record<string, unknown>)
    case 'array':
      return (value as unknown[])
        .map((item) => (field.item ? cleanValue(field.item, item) : item))
        .filter((item) => item !== undefined)
    case 'blocks':
      return (value as Record<string, unknown>[]).map((block) => {
        const def = field.blocks?.find((b) => b.name === block._type)
        return def ? clean(def.fields, block) : block
      })
    case 'richText': {
      const blocks = value as { children: { text: string }[] }[]
      return blocks.some((b) => b.children.some((r) => r.text.trim())) ? value : field.required ? [] : undefined
    }
    default:
      return value
  }
}

/** Groups validation issues by field path; "blocks.0.title" also counts toward "blocks.0" and "blocks". */
export function issuesByPath(issues: ValidationIssue[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const issue of issues) {
    const list = map.get(issue.path) ?? []
    list.push(issue.message)
    map.set(issue.path, list)
  }
  return map
}

export function countIssuesUnder(issues: ValidationIssue[], prefix: string): number {
  return issues.filter((i) => i.path === prefix || i.path.startsWith(`${prefix}.`)).length
}

/** Readable title of an arbitrary record: first non-empty short text. */
export function blockTitle(fields: FieldDescription[], value: Record<string, unknown>): string | undefined {
  for (const f of fields) {
    if (f.kind !== 'text') continue
    const v = value[f.name]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list
  const copy = [...list]
  const [item] = copy.splice(from, 1)
  copy.splice(to, 0, item as T)
  return copy
}
