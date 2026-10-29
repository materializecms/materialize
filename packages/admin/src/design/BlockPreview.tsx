import type { Link, Media, RichText } from '@materializecms/core'
import { ImageIcon } from 'lucide-react'
import { type ElementType, type ReactNode, useLayoutEffect, useRef } from 'react'
import { cx } from '../components/ui.tsx'
import type { BlockDef } from '../fields/BlockLibrary.tsx'
import { useDocumentTitles } from '../fields/RelationInput.tsx'
import type { FieldDescription } from '../lib/api.ts'

type Value = Record<string, unknown>

/**
 * Plain text edited in place on the canvas. The DOM owns the text while typing,
 * so React never moves the caret; external changes (undo) are written back.
 */
export function Editable({
  value,
  onChange,
  placeholder,
  className,
  as: Tag = 'span',
  multiline,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  as?: ElementType
  multiline?: boolean
}) {
  const ref = useRef<HTMLElement>(null)
  const emitted = useRef(value)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    if (el.textContent !== value && (document.activeElement !== el || value !== emitted.current)) {
      el.textContent = value
      emitted.current = value
    }
  }, [value])
  return (
    <Tag
      ref={ref}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder}
      data-editable=""
      onInput={(e: { currentTarget: HTMLElement }) => {
        const text = e.currentTarget.textContent ?? ''
        emitted.current = text
        onChange(text)
      }}
      onKeyDown={(e: { key: string; preventDefault: () => void; currentTarget: HTMLElement }) => {
        if (e.key === 'Escape' || (e.key === 'Enter' && !multiline)) {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      className={cx(
        'cursor-text rounded-[3px] outline-none hover:outline-1 hover:outline-offset-2 hover:outline-dashed hover:outline-current/30 focus:outline-2 focus:outline-offset-2 focus:outline-solid focus:outline-[#3d5afe]',
        'empty:before:pointer-events-none empty:before:opacity-35 empty:before:content-[attr(data-placeholder)]',
        multiline && 'whitespace-pre-wrap',
        className,
      )}
    />
  )
}

// ---------- field roles ----------

interface Roles {
  eyebrow?: FieldDescription
  heading?: FieldDescription
  texts: FieldDescription[]
  rich: FieldDescription[]
  image?: FieldDescription
  gallery?: FieldDescription
  links: FieldDescription[]
  relation?: FieldDescription
  variant?: string
}

function roles(fields: FieldDescription[], value: Value): Roles {
  const text = fields.filter((f) => f.kind === 'text')
  const eyebrow = text.find((f) => /eyebrow|kicker|overline|tag|label/i.test(f.name) && !f.options.multiline)
  const heading =
    text.find((f) => /^(title|heading|headline|titolo)$/i.test(f.name)) ??
    text.find((f) => f !== eyebrow && !f.options.multiline)
  const variantField = fields.find((f) => f.kind === 'select' && /variant|layout|style|align/i.test(f.name))
  return {
    eyebrow,
    heading,
    texts: text.filter((f) => f !== eyebrow && f !== heading),
    rich: fields.filter((f) => f.kind === 'richText'),
    image: fields.find((f) => f.kind === 'media'),
    gallery: fields.find((f) => f.kind === 'array' && f.item?.kind === 'media'),
    links: fields.filter((f) => f.kind === 'link'),
    relation: fields.find((f) => f.kind === 'relation'),
    variant: variantField ? (value[variantField.name] as string | undefined) : undefined,
  }
}

// ---------- renderer ----------

export interface PreviewProps {
  def: BlockDef
  value: Value
  index: number
  selected: boolean
  onField: (name: string, value: unknown) => void
}

/**
 * Generic rendering of any block from its fields. It shows structure and real content
 * on the canvas until the site's own components (Astro renderer) take over.
 */
export function BlockPreview({ def, value, index, selected, onField }: PreviewProps) {
  const r = roles(def.fields, value)
  const str = (f?: FieldDescription) => (f && typeof value[f.name] === 'string' ? (value[f.name] as string) : '')
  const media = r.image ? (value[r.image.name] as Media | undefined) : undefined

  const edit = (f: FieldDescription | undefined, className: string, as: ElementType = 'span', placeholder?: string) => {
    if (!f) return null
    const v = str(f)
    if (!v && !selected && !f.required) return null
    return (
      <Editable
        as={as}
        value={v}
        multiline={!!f.options.multiline}
        placeholder={placeholder ?? f.label}
        onChange={(t) => onField(f.name, t)}
        className={className}
      />
    )
  }

  const links = r.links
    .map((f) => ({ f, link: value[f.name] as Link | undefined }))
    .filter((l) => l.link?.href || selected)
  const buttons = (dark: boolean) =>
    links.length > 0 && (
      <div className="mt-8 flex flex-wrap gap-3">
        {links.map(({ f, link }, i) => (
          <span
            key={f.name}
            className={cx(
              'inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium',
              i === 0
                ? dark
                  ? 'bg-white text-neutral-950'
                  : 'bg-neutral-950 text-white'
                : dark
                  ? 'border border-white/40'
                  : 'border border-neutral-300',
              !link?.href && 'opacity-40',
            )}
          >
            {link?.label || (link?.href ? link.href : `${f.label}: imposta nel pannello`)}
          </span>
        ))}
      </div>
    )

  const texts = (className: string) => r.texts.map((f) => <div key={f.name}>{edit(f, className, 'p', f.label)}</div>)

  const isHero = /hero|header|banner/i.test(def.name) || (index === 0 && !!r.image && !!r.heading)

  // Hero with a background image
  if (isHero && r.variant === 'cover') {
    return (
      <section className="relative flex min-h-[620px] items-end overflow-hidden bg-neutral-900 text-white">
        {media?.src && <Img media={media} className="absolute inset-0 size-full" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        <div className="relative mx-auto w-full max-w-6xl px-6 pb-16 @3xl:px-12 @3xl:pb-20">
          {edit(r.eyebrow, 'mb-4 block text-[13px] font-medium tracking-[0.18em] text-white/75 uppercase')}
          {edit(
            r.heading,
            'block max-w-4xl text-[40px] leading-[1.02] font-semibold tracking-[-0.035em] @3xl:text-[76px]',
            'h1',
          )}
          {texts('mt-5 max-w-xl text-[17px] leading-relaxed text-white/80 @3xl:text-[19px]')}
          {buttons(true)}
        </div>
      </section>
    )
  }

  // Hero, split or centered
  if (isHero) {
    const center = r.variant === 'center'
    return (
      <section className="bg-white px-6 py-16 @3xl:px-12 @3xl:py-24">
        <div
          className={cx(
            'mx-auto grid max-w-6xl items-center gap-10',
            !center && '@3xl:grid-cols-[1.05fr_1fr] @3xl:gap-16',
          )}
        >
          <div className={cx(center && 'mx-auto max-w-3xl text-center')}>
            {edit(r.eyebrow, 'mb-5 block text-[13px] font-medium tracking-[0.18em] text-neutral-500 uppercase')}
            {edit(
              r.heading,
              'block text-[40px] leading-[1.03] font-semibold tracking-[-0.035em] text-neutral-950 @3xl:text-[64px]',
              'h1',
            )}
            {texts(
              cx('mt-6 text-[17px] leading-relaxed text-neutral-600 @3xl:text-[19px]', center && 'mx-auto max-w-xl'),
            )}
            <div className={cx(center && 'flex justify-center')}>{buttons(false)}</div>
          </div>
          {r.image && (
            <Img media={media} className={cx('w-full rounded-2xl', center ? 'mt-4 aspect-[21/9]' : 'aspect-[4/5]')} />
          )}
        </div>
      </section>
    )
  }

  // Grid of related documents
  if (r.relation) {
    const ids =
      (r.relation.options.many
        ? (value[r.relation.name] as string[] | undefined)
        : [value[r.relation.name] as string]) ?? []
    return (
      <section className="bg-white px-6 py-16 @3xl:px-12 @3xl:py-24">
        <div className="mx-auto max-w-6xl">
          {edit(r.eyebrow, 'mb-3 block text-[13px] font-medium tracking-[0.18em] text-neutral-500 uppercase')}
          {edit(
            r.heading,
            'block text-[30px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950 @3xl:text-[44px]',
            'h2',
          )}
          {texts('mt-4 max-w-2xl text-[17px] leading-relaxed text-neutral-600')}
          <RelatedGrid ids={ids.filter(Boolean)} label={r.relation.label} />
        </div>
      </section>
    )
  }

  // Gallery
  if (r.gallery) {
    const items = (value[r.gallery.name] as Media[] | undefined) ?? []
    return (
      <section className="bg-white px-6 py-16 @3xl:px-12">
        <div className="mx-auto max-w-6xl">
          {edit(r.heading, 'mb-8 block text-[30px] font-semibold tracking-[-0.025em] text-neutral-950', 'h2')}
          <div className="grid grid-cols-2 gap-3 @3xl:grid-cols-3">
            {(items.length ? items : [undefined, undefined, undefined]).map((m, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: preview only
              <Img key={i} media={m} className="aspect-[4/3] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // Call to action band
  if (links.length && !r.image && !r.rich.length) {
    return (
      <section className="bg-neutral-950 px-6 py-20 text-white @3xl:px-12 @3xl:py-28">
        <div className="mx-auto max-w-3xl text-center">
          {edit(r.eyebrow, 'mb-4 block text-[13px] font-medium tracking-[0.18em] text-white/60 uppercase')}
          {edit(r.heading, 'block text-[32px] leading-tight font-semibold tracking-[-0.03em] @3xl:text-[52px]', 'h2')}
          {texts('mx-auto mt-5 max-w-xl text-[17px] leading-relaxed text-white/70')}
          <div className="flex justify-center">{buttons(true)}</div>
        </div>
      </section>
    )
  }

  // Text section (default)
  return (
    <section className="bg-white px-6 py-14 @3xl:px-12 @3xl:py-20">
      <div className="mx-auto max-w-3xl">
        {edit(r.eyebrow, 'mb-3 block text-[13px] font-medium tracking-[0.18em] text-neutral-500 uppercase')}
        {edit(
          r.heading,
          'mb-6 block text-[28px] leading-tight font-semibold tracking-[-0.025em] text-neutral-950 @3xl:text-[40px]',
          'h2',
        )}
        {texts('mb-4 text-[18px] leading-relaxed text-neutral-600')}
        {r.rich.map((f) => (
          <Prose
            key={f.name}
            value={value[f.name] as RichText | undefined}
            placeholder={selected ? `${f.label}: scrivi nel pannello a destra` : ''}
          />
        ))}
        {r.image && media?.src && <Img media={media} className="mt-10 aspect-[16/9] w-full rounded-xl" />}
        {buttons(false)}
      </div>
    </section>
  )
}

function Img({ media, className }: { media: Media | undefined; className?: string }) {
  if (!media?.src) {
    return (
      <div className={cx('flex items-center justify-center bg-neutral-100 text-neutral-400', className)}>
        <ImageIcon className="size-8" strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <img
      src={media.src}
      alt={media.alt}
      draggable={false}
      className={cx('object-cover', className)}
      style={{ objectPosition: media.focal ? `${media.focal.x}% ${media.focal.y}%` : undefined }}
    />
  )
}

// biome-ignore-start lint/suspicious/noArrayIndexKey: rich text blocks and runs have no identity of their own
function Prose({ value, placeholder }: { value: RichText | undefined; placeholder: string }) {
  if (!value?.length) return placeholder ? <p className="text-[17px] text-neutral-400">{placeholder}</p> : null
  const runs = (b: RichText[number]) =>
    b.children.map((r, i) => {
      let node: ReactNode = r.text
      if (r.bold) node = <strong>{node}</strong>
      if (r.italic) node = <em>{node}</em>
      if (r.href) node = <span className="underline underline-offset-2">{node}</span>
      return <span key={i}>{node}</span>
    })
  const out: ReactNode[] = []
  let list: ReactNode[] = []
  value.forEach((b, i) => {
    if (b.type === 'listItem') {
      list.push(<li key={i}>{runs(b)}</li>)
      return
    }
    if (list.length) {
      out.push(
        <ul key={`ul${i}`} className="list-disc space-y-1 pl-6">
          {list}
        </ul>,
      )
      list = []
    }
    if (b.type === 'heading')
      out.push(
        <h3
          key={i}
          className={cx(
            'pt-3 font-semibold tracking-tight text-neutral-950',
            b.level === 2 ? 'text-[26px]' : 'text-[21px]',
          )}
        >
          {runs(b)}
        </h3>,
      )
    else if (b.type === 'quote')
      out.push(
        <blockquote key={i} className="border-l-2 border-neutral-300 pl-5 text-[21px] text-neutral-800 italic">
          {runs(b)}
        </blockquote>,
      )
    else out.push(<p key={i}>{runs(b)}</p>)
  })
  if (list.length)
    out.push(
      <ul key="ul-end" className="list-disc space-y-1 pl-6">
        {list}
      </ul>,
    )
  return <div className="space-y-4 text-[17px] leading-[1.7] text-neutral-700">{out}</div>
}

// biome-ignore-end lint/suspicious/noArrayIndexKey: end of Prose

function firstMedia(data: Value | undefined): Media | undefined {
  for (const v of Object.values(data ?? {})) {
    if (v && typeof v === 'object' && typeof (v as Media).src === 'string') return v as Media
  }
  return undefined
}

function RelatedGrid({ ids, label }: { ids: string[]; label: string }) {
  const docs = useDocumentTitles(ids)
  if (!ids.length) {
    return (
      <div className="mt-10 rounded-2xl border border-dashed border-neutral-300 px-6 py-12 text-center text-[15px] text-neutral-400">
        Scegli i contenuti da mostrare in “{label}” nel pannello a destra
      </div>
    )
  }
  return (
    <div className="mt-10 grid gap-x-6 gap-y-10 @2xl:grid-cols-2 @4xl:grid-cols-3">
      {docs.map((q, i) => {
        const doc = q.data
        const data = doc?.data
        const meta = Object.entries(data ?? {}).find(
          ([k, v]) =>
            typeof v === 'string' && v.length < 40 && !/title|slug|name|titolo/i.test(k) && !v.startsWith('http'),
        )?.[1] as string | undefined
        return (
          <article key={ids[i]}>
            <Img media={firstMedia(data)} className="aspect-[4/3] w-full rounded-xl" />
            <h3 className="mt-4 text-[18px] font-semibold tracking-tight text-neutral-950">{doc?.title ?? '…'}</h3>
            {meta && <p className="mt-1 text-[14px] text-neutral-500">{meta}</p>}
          </article>
        )
      })}
    </div>
  )
}
