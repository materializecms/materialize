import { z } from 'zod'
import type { PageNode } from './page.ts'
import { SLUG_PATTERN } from './slug.ts'
import { ANCHOR_PATTERN, BLOCK_STYLE, type BlockStyle } from './style.ts'

const blockStyleSchema = z.object({
  background: z.enum(BLOCK_STYLE.background).optional(),
  spacing: z.enum(BLOCK_STYLE.spacing).optional(),
  animation: z.enum(BLOCK_STYLE.animation).optional(),
  anchor: z.string().max(60).regex(ANCHOR_PATTERN, 'Usa lettere minuscole, numeri e trattini').optional(),
})

export type FieldKind =
  | 'text'
  | 'richText'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'slug'
  | 'media'
  | 'link'
  | 'relation'
  | 'blocks'
  | 'page'
  | 'group'
  | 'array'
  | 'seo'
  | 'color'
  | 'json'

/**
 * A field definition. `V` is the stored value type and `R` whether the field is required;
 * both exist only at the type level so documents can be typed straight from the schema.
 */
export interface Field<V = unknown, R extends boolean = boolean> {
  readonly kind: FieldKind
  readonly required: R
  readonly label?: string
  readonly description?: string
  readonly localized: boolean
  readonly options: Readonly<Record<string, unknown>>
  /** Validator for a present value; optionality is applied by the collection. */
  readonly schema: () => z.ZodType
  readonly children?: Fields
  readonly item?: Field
  readonly blocks?: readonly Block[]
  readonly __value?: V
}

export type Fields = Record<string, Field>

export interface Block<N extends string = string, F extends Fields = Fields> {
  readonly name: N
  readonly label: string
  readonly description?: string
  readonly fields: F
}

interface Common<R extends boolean> {
  label?: string
  description?: string
  required?: R
  /** Store a separate value per locale. Defaults to true for text-like fields in localized collections. */
  localized?: boolean
}

type Req<O> = O extends { required: true } ? true : false

// Returns Field<never, never>, which is assignable to the precise Field<V, R> each builder declares.
function field(
  kind: FieldKind,
  common: Common<boolean> | undefined,
  options: Record<string, unknown>,
  schema: () => z.ZodType,
  extra: Partial<Pick<Field, 'children' | 'item' | 'blocks'>> = {},
): Field<never, never> {
  return {
    kind,
    required: (common?.required ?? false) as never,
    label: common?.label,
    description: common?.description,
    localized: common?.localized ?? ['text', 'richText', 'slug', 'seo', 'link'].includes(kind),
    options,
    schema,
    ...extra,
  }
}

// ---------- value types ----------

export interface Media {
  src: string
  alt: string
  width?: number
  height?: number
  /** Focal point in percent, kept visible whatever the crop. */
  focal?: { x: number; y: number }
}

export interface Link {
  href: string
  label?: string
  newTab?: boolean
}

export interface Seo {
  title?: string
  description?: string
  image?: Media
  noindex?: boolean
  /** Search engines index the page but do not follow its links. */
  nofollow?: boolean
  /** Title and description when shared (Facebook, LinkedIn, WhatsApp, X), if different. */
  socialTitle?: string
  socialDescription?: string
  /** The address search engines should consider the original, when this page repeats another. */
  canonical?: string
  /** Structured data: what kind of page this is (see SCHEMA_TYPES in seo.ts). */
  schema?: 'article' | 'project' | 'service' | 'event' | 'faq'
  faq?: { q: string; a: string }[]
  event?: { start?: string; end?: string; place?: string; address?: string; online?: boolean; price?: string }
}

/** Inline text with formatting marks. */
export interface RichTextRun {
  text: string
  bold?: boolean
  italic?: boolean
  href?: string
}

export interface RichTextBlock {
  type: 'paragraph' | 'heading' | 'quote' | 'listItem'
  level?: 2 | 3 | 4
  children: RichTextRun[]
}

export type RichText = RichTextBlock[]

// ---------- shared validators ----------

const mediaSchema = z.object({
  src: z.string().min(1),
  alt: z.string(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  focal: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).optional(),
})

const linkSchema = z.object({
  href: z.string().min(1),
  label: z.string().optional(),
  newTab: z.boolean().optional(),
})

const runSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  href: z.string().optional(),
})

const richTextSchema = z.array(
  z.object({
    type: z.enum(['paragraph', 'heading', 'quote', 'listItem']),
    level: z.union([z.literal(2), z.literal(3), z.literal(4)]).optional(),
    children: z.array(runSchema),
  }),
)

// ---------- builders ----------

interface TextOptions<R extends boolean> extends Common<R> {
  min?: number
  max?: number
  multiline?: boolean
  placeholder?: string
}

function text<const O extends TextOptions<boolean>>(o?: O): Field<string, Req<O>> {
  const { min, max, multiline, placeholder } = o ?? {}
  return field('text', o, { min, max, multiline, placeholder }, () => {
    let s = z.string().trim()
    if (o?.required) s = s.min(Math.max(1, min ?? 1))
    else if (min) s = s.min(min)
    if (max) s = s.max(max)
    return s
  })
}

function richText<const O extends Common<boolean>>(o?: O): Field<RichText, Req<O>> {
  return field('richText', o, {}, () => (o?.required ? richTextSchema.min(1) : richTextSchema))
}

interface NumberOptions<R extends boolean> extends Common<R> {
  min?: number
  max?: number
  integer?: boolean
}

function number<const O extends NumberOptions<boolean>>(o?: O): Field<number, Req<O>> {
  const { min, max, integer } = o ?? {}
  return field('number', o, { min, max, integer }, () => {
    let s = z.number()
    if (integer) s = s.int()
    if (min !== undefined) s = s.min(min)
    if (max !== undefined) s = s.max(max)
    return s
  })
}

function boolean<const O extends Common<boolean>>(o?: O): Field<boolean, Req<O>> {
  return field('boolean', o, {}, () => z.boolean())
}

function date<const O extends Common<boolean>>(o?: O): Field<string, Req<O>> {
  return field('date', o, {}, () => z.union([z.iso.date(), z.iso.datetime({ offset: true })]))
}

type SelectOption = string | { value: string; label: string }
type OptionValue<T> = T extends { value: infer V extends string } ? V : T extends string ? T : never

interface SelectOptions<R extends boolean, T extends readonly SelectOption[]> extends Common<R> {
  options: T
}

function select<const T extends readonly SelectOption[], const O extends SelectOptions<boolean, T>>(
  o: O & { options: T },
): Field<OptionValue<T[number]>, Req<O>> {
  const values = o.options.map((x) => (typeof x === 'string' ? x : x.value))
  if (!values.length) throw new Error('f.select() needs at least one option')
  return field('select', o, { options: o.options }, () => z.enum(values as [string, ...string[]]))
}

interface SlugOptions<R extends boolean> extends Common<R> {
  /** Field to generate the slug from when it is left empty. */
  from?: string
}

function slug<const O extends SlugOptions<boolean>>(o?: O): Field<string, Req<O>> {
  return field('slug', o, { from: o?.from }, () =>
    z.string().max(96).regex(SLUG_PATTERN, 'Usa lettere minuscole, numeri e trattini singoli'),
  )
}

interface MediaOptions<R extends boolean> extends Common<R> {
  accept?: string
  focalPoint?: boolean
}

function media<const O extends MediaOptions<boolean>>(o?: O): Field<Media, Req<O>> {
  return field('media', o, { accept: o?.accept ?? 'image/*', focalPoint: o?.focalPoint ?? true }, () => mediaSchema)
}

function link<const O extends Common<boolean>>(o?: O): Field<Link, Req<O>> {
  return field('link', o, {}, () => linkSchema)
}

interface RelationOptions<R extends boolean, M extends boolean> extends Common<R> {
  to: string
  many?: M
}

function relation<const O extends RelationOptions<boolean, boolean>>(
  o: O,
): Field<O extends { many: true } ? string[] : string, Req<O>> {
  return field('relation', o, { to: o.to, many: o.many ?? false }, () =>
    o.many ? z.array(z.string().min(1)) : z.string().min(1),
  )
}

export type BlockValue<B extends Block> =
  B extends Block<infer N, infer F>
    ? { _type: N; _key: string; _label?: string; _style?: BlockStyle } & InferFields<F>
    : never

interface BlocksOptions<R extends boolean> extends Common<R> {
  min?: number
  max?: number
}

function blocks<const B extends readonly Block[], const O extends BlocksOptions<boolean>>(
  defs: B,
  o?: O,
): Field<BlockValue<B[number]>[], Req<O>> {
  if (!defs.length) throw new Error('f.blocks() needs at least one block')
  return field(
    'blocks',
    o,
    { min: o?.min, max: o?.max },
    () => {
      const variants = defs.map((b) =>
        z.object({
          _type: z.literal(b.name),
          _key: z.string().min(1),
          // A name chosen in the editor's layers, for people only: the site ignores it.
          _label: z.string().max(80).optional(),
          _style: blockStyleSchema.optional(),
          ...objectShape(b.fields),
        }),
      )
      const item =
        variants.length === 1
          ? (variants[0] as z.ZodType)
          : z.discriminatedUnion('_type', variants as unknown as [z.ZodObject, z.ZodObject, ...z.ZodObject[]])
      let s = z.array(item)
      if (o?.min !== undefined) s = s.min(o.min)
      if (o?.max !== undefined) s = s.max(o.max)
      return s
    },
    { blocks: defs },
  )
}

function group<const F extends Fields, const O extends Common<boolean>>(
  fields: F,
  o?: O,
): Field<InferFields<F>, Req<O>> {
  return field('group', o, {}, () => z.object(objectShape(fields)), { children: fields })
}

interface ArrayOptions<R extends boolean> extends Common<R> {
  min?: number
  max?: number
}

function array<const I extends Field, const O extends ArrayOptions<boolean>>(
  item: I,
  o?: O,
): Field<NonNullable<I['__value']>[], Req<O>> {
  return field(
    'array',
    o,
    { min: o?.min, max: o?.max },
    () => {
      let s = z.array(item.schema())
      if (o?.min !== undefined) s = s.min(o.min)
      if (o?.max !== undefined) s = s.max(o.max)
      return s
    },
    { item },
  )
}

function seo<const O extends Common<boolean>>(o?: O): Field<Seo, Req<O>> {
  return field('seo', o, {}, () =>
    z.object({
      title: z.string().max(70).optional(),
      description: z.string().max(170).optional(),
      image: mediaSchema.optional(),
      noindex: z.boolean().optional(),
      nofollow: z.boolean().optional(),
      socialTitle: z.string().max(90).optional(),
      socialDescription: z.string().max(200).optional(),
      canonical: z.string().max(500).optional(),
      schema: z.enum(['article', 'project', 'service', 'event', 'faq']).optional(),
      faq: z
        .array(z.object({ q: z.string().max(300), a: z.string().max(3000) }))
        .max(50)
        .optional(),
      event: z
        .object({
          start: z.string().optional(),
          end: z.string().optional(),
          place: z.string().optional(),
          address: z.string().optional(),
          online: z.boolean().optional(),
          price: z.string().optional(),
        })
        .optional(),
    }),
  )
}

function color<const O extends Common<boolean>>(o?: O): Field<string, Req<O>> {
  return field('color', o, {}, () => z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Usa un colore nel formato #rrggbb'))
}

const pageNodeSchema: z.ZodType<PageNode> = z.lazy(() =>
  z
    .object({
      id: z.string().min(1),
      type: z.enum(['frame', 'text', 'image', 'button', 'video', 'embed', 'scene', 'icon', 'input']),
      name: z.string().max(120).optional(),
      children: z.array(pageNodeSchema).optional(),
    })
    .loose(),
) as unknown as z.ZodType<PageNode>

/**
 * A page composed on the canvas: sections of frames, text, images and buttons, with their design.
 * Render it with `renderPage` from `@materializecms/core/page`, or the Astro `<Page>` component.
 */
function page<const O extends Common<boolean>>(o?: O): Field<PageNode[], Req<O>> {
  return field('page', { localized: true, ...o }, {}, () => z.array(pageNodeSchema).max(200))
}

function json<const O extends Common<boolean>>(o?: O): Field<unknown, Req<O>> {
  return field('json', o, {}, () => z.json())
}

/** Field builders: `f.text({ required: true })`, `f.blocks([hero, gallery])`, … */
export const f = {
  text,
  richText,
  number,
  boolean,
  date,
  select,
  slug,
  media,
  link,
  relation,
  blocks,
  page,
  group,
  array,
  seo,
  color,
  json,
}

// ---------- inference & object schemas ----------

type ValueOf<F> = F extends Field<infer V, boolean> ? V : never
type RequiredKeys<F extends Fields> = { [K in keyof F]: F[K] extends Field<unknown, true> ? K : never }[keyof F]
type Prettify<T> = { [K in keyof T]: T[K] } & {}

/** The document data type described by a set of fields. */
export type InferFields<F extends Fields> = Prettify<
  { [K in RequiredKeys<F>]: ValueOf<F[K]> } & { [K in Exclude<keyof F, RequiredKeys<F>>]?: ValueOf<F[K]> }
>

export function objectShape(fields: Fields): Record<string, z.ZodType> {
  const shape: Record<string, z.ZodType> = {}
  for (const [name, def] of Object.entries(fields)) {
    shape[name] = def.required ? def.schema() : def.schema().optional()
  }
  return shape
}
