import { z } from 'zod'
import { type Block, type Field, type Fields, type InferFields, objectShape } from './fields.ts'
import { slugify } from './slug.ts'

const NAME = /^[a-z][a-z0-9-]*$/

export interface Collection<N extends string = string, F extends Fields = Fields> {
  readonly name: N
  readonly label: string
  readonly fields: F
  /** Field used as the document title in lists. */
  readonly titleField: string
  /** Slug field that builds public URLs, if any. */
  readonly slugField?: string
  /** Public path of a document, e.g. (doc) => `/blog/${doc.slug}`. Method syntax keeps typed collections assignable to Collection. */
  url?(doc: InferFields<F>): string
  readonly localized: boolean
  readonly singleton: boolean
}

export interface CollectionInput<N extends string, F extends Fields> {
  name: N
  label?: string
  fields: F
  titleField?: Extract<keyof F, string>
  url?: (doc: InferFields<F>) => string
  localized?: boolean
  /** A single document, e.g. site settings. */
  singleton?: boolean
}

export function defineCollection<const N extends string, const F extends Fields>(
  input: CollectionInput<N, F>,
): Collection<N, F> {
  const entries = Object.entries(input.fields)
  const slugField = entries.find(([, def]) => def.kind === 'slug')?.[0]
  const titleField = input.titleField ?? entries.find(([, def]) => def.kind === 'text')?.[0] ?? entries[0]?.[0] ?? 'id'
  return {
    name: input.name,
    label: input.label ?? capitalize(input.name),
    fields: input.fields,
    titleField,
    slugField,
    url: input.url,
    localized: input.localized ?? false,
    singleton: input.singleton ?? false,
  }
}

export function defineBlock<const N extends string, const F extends Fields>(input: {
  name: N
  label?: string
  description?: string
  fields: F
}): Block<N, F> {
  return {
    name: input.name,
    label: input.label ?? capitalize(input.name),
    description: input.description,
    fields: input.fields,
  }
}

export interface Locales {
  default: string
  available: string[]
}

export interface MaterializeConfig {
  site: { name: string; url?: string }
  collections: Collection[]
  locales: Locales
  database: { url: string; authToken?: string }
  /** Where uploaded files are kept. */
  media: { dir: string }
  /**
   * `trustProxy`: the site runs behind a proxy (Cloudflare, Nginx, the host's load balancer) that
   * sets X-Forwarded-For; only then is that header used to know who is connecting.
   */
  server: { port: number; trustProxy: boolean }
}

export interface ConfigInput {
  site: { name: string; url?: string }
  collections: Collection[]
  locales?: Partial<Locales>
  database?: { url?: string; authToken?: string }
  media?: { dir?: string }
  server?: { port?: number; trustProxy?: boolean }
}

export class MaterializeConfigError extends Error {
  readonly problems: string[]
  constructor(problems: string[]) {
    super(`Invalid Materialize config:\n${problems.map((p) => `  • ${p}`).join('\n')}`)
    this.name = 'MaterializeConfigError'
    this.problems = problems
  }
}

/** Checks the config and fills in defaults. Throws a readable error listing every problem. */
export function defineConfig(input: ConfigInput): MaterializeConfig {
  const problems: string[] = []
  const seen = new Set<string>()
  const locales: Locales = {
    default: input.locales?.default ?? 'it',
    available: input.locales?.available ?? [input.locales?.default ?? 'it'],
  }
  if (!locales.available.includes(locales.default)) {
    problems.push(`locales.available must include the default locale "${locales.default}"`)
  }
  for (const c of input.collections) {
    if (!NAME.test(c.name)) problems.push(`collection "${c.name}": names use lowercase letters, numbers and hyphens`)
    if (seen.has(c.name)) problems.push(`collection "${c.name}" is defined twice`)
    seen.add(c.name)
    for (const [name, def] of Object.entries(c.fields)) {
      if (name.startsWith('_')) problems.push(`collection "${c.name}": field "${name}" cannot start with "_"`)
      checkField(`${c.name}.${name}`, def, c.fields, problems)
    }
    for (const def of Object.values(c.fields)) {
      if (def.kind === 'relation' && !input.collections.some((x) => x.name === def.options.to)) {
        problems.push(`collection "${c.name}": relation points to unknown collection "${String(def.options.to)}"`)
      }
    }
  }
  if (problems.length) throw new MaterializeConfigError(problems)
  return {
    site: input.site,
    collections: input.collections,
    locales,
    database: { url: input.database?.url ?? 'file:.materialize/content.db', authToken: input.database?.authToken },
    media: { dir: input.media?.dir ?? '.materialize/media' },
    server: { port: input.server?.port ?? 4321, trustProxy: input.server?.trustProxy ?? false },
  }
}

function checkField(path: string, def: Field, siblings: Fields, problems: string[]): void {
  if (def.kind === 'slug' && typeof def.options.from === 'string' && !(def.options.from in siblings)) {
    problems.push(`${path}: slug source field "${def.options.from}" does not exist`)
  }
  for (const [name, child] of Object.entries(def.children ?? {}))
    checkField(`${path}.${name}`, child, def.children ?? {}, problems)
  if (def.item) checkField(`${path}[]`, def.item, {}, problems)
  const names = new Set<string>()
  for (const block of def.blocks ?? []) {
    if (names.has(block.name)) problems.push(`${path}: block "${block.name}" is listed twice`)
    names.add(block.name)
    for (const [name, child] of Object.entries(block.fields))
      checkField(`${path}.${block.name}.${name}`, child, block.fields, problems)
  }
}

// ---------- validation ----------

export interface ValidationIssue {
  path: string
  message: string
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; issues: ValidationIssue[] }

/** Validates document data against a collection. Unknown keys are dropped. */
export function validate<N extends string, F extends Fields>(
  collection: Collection<N, F>,
  data: unknown,
): ValidationResult<InferFields<F>> {
  const result = z.object(objectShape(collection.fields)).safeParse(data, { error: message })
  if (result.success) return { ok: true, data: result.data as InferFields<F> }
  return {
    ok: false,
    issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  }
}

/** Messages for editors, in plain Italian. Messages set on a field (e.g. a regex hint) win. */
function message(issue: z.core.$ZodRawIssue): string | undefined {
  const i = issue as z.core.$ZodRawIssue & { minimum?: number | bigint; maximum?: number | bigint; origin?: string }
  switch (i.code) {
    case 'invalid_type':
      return i.input === undefined || i.input === null ? 'Campo obbligatorio' : 'Valore non valido'
    case 'too_small':
      if (i.origin === 'string') return Number(i.minimum) <= 1 ? 'Campo obbligatorio' : `Almeno ${i.minimum} caratteri`
      if (i.origin === 'array')
        return `Aggiungi almeno ${i.minimum} ${Number(i.minimum) === 1 ? 'elemento' : 'elementi'}`
      return `Il valore minimo è ${i.minimum}`
    case 'too_big':
      if (i.origin === 'string') return `Al massimo ${i.maximum} caratteri`
      if (i.origin === 'array') return `Al massimo ${i.maximum} elementi`
      return `Il valore massimo è ${i.maximum}`
    case 'invalid_value':
      return 'Scegli una delle opzioni disponibili'
    case 'invalid_format':
      return 'Formato non valido'
    case 'invalid_union':
      return 'Valore non valido'
    default:
      return undefined
  }
}

/** Fills in an empty slug from its source field, so editors never have to type one. */
export function prepare(collection: Collection, data: Record<string, unknown>): Record<string, unknown> {
  const out = { ...data }
  for (const [name, def] of Object.entries(collection.fields)) {
    if (def.kind !== 'slug' || (typeof out[name] === 'string' && out[name] !== '')) continue
    const source = typeof def.options.from === 'string' ? out[def.options.from] : undefined
    if (typeof source === 'string' && source.trim()) out[name] = slugify(source)
  }
  return out
}

/** Readable title of a document for lists and breadcrumbs. */
export function titleOf(collection: Collection, data: Record<string, unknown>): string {
  const value = data[collection.titleField]
  return typeof value === 'string' && value.trim() ? value : 'Senza titolo'
}

// ---------- description for the admin ----------

export interface FieldDescription {
  name: string
  kind: Field['kind']
  label: string
  required: boolean
  localized: boolean
  description?: string
  options: Record<string, unknown>
  fields?: FieldDescription[]
  item?: FieldDescription
  blocks?: { name: string; label: string; description?: string; fields: FieldDescription[] }[]
}

export interface CollectionDescription {
  name: string
  label: string
  titleField: string
  slugField?: string
  localized: boolean
  singleton: boolean
  fields: FieldDescription[]
}

/** JSON-safe description of a collection: what the admin needs to build its forms. */
export function describeCollection(collection: Collection): CollectionDescription {
  return {
    name: collection.name,
    label: collection.label,
    titleField: collection.titleField,
    slugField: collection.slugField,
    localized: collection.localized,
    singleton: collection.singleton,
    fields: describeFields(collection.fields),
  }
}

function describeFields(fields: Fields): FieldDescription[] {
  return Object.entries(fields).map(([name, def]) => describeField(name, def))
}

function describeField(name: string, def: Field): FieldDescription {
  return {
    name,
    kind: def.kind,
    label: def.label ?? capitalize(name),
    required: def.required,
    localized: def.localized,
    description: def.description,
    options: Object.fromEntries(
      Object.entries(def.options).filter(([, v]) => v !== undefined && typeof v !== 'function'),
    ),
    fields: def.children ? describeFields(def.children) : undefined,
    item: def.item ? describeField('item', def.item) : undefined,
    blocks: def.blocks?.map((b) => ({
      name: b.name,
      label: b.label,
      description: b.description,
      fields: describeFields(b.fields),
    })),
  }
}

function capitalize(s: string): string {
  const spaced = s.replace(/[-_]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export type InferCollection<C> = C extends Collection<string, infer F> ? InferFields<F> : never
