import type { Link as LinkValue, Media, RichText, Seo } from '@materializecms/core'
import { slugify } from '@materializecms/core/slug'
import { ArrowDown, ArrowUp, Plus, Trash2, Wand2 } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { Button, cx, IconButton, Input, Segmented, Switch, Textarea } from '../components/ui.tsx'
import type { FieldDescription } from '../lib/api.ts'
import { emptyValue, move, optionList, type Path, pathKey } from '../lib/doc.ts'
import { BlocksInput } from './BlocksInput.tsx'
import { useForm, useIssues } from './form-context.ts'
import { MediaInput } from './MediaInput.tsx'
import { RelationInput } from './RelationInput.tsx'
import { RichTextEditor } from './RichTextEditor.tsx'

export type Change = (value: unknown, group?: string) => void

export interface FieldProps {
  field: FieldDescription
  value: unknown
  onChange: Change
  path: Path
  /** The object holding this field: lets a slug read its source field. */
  siblings?: Record<string, unknown>
}

/** Renders every field of an object. */
export function FieldsForm({
  fields,
  value,
  onChange,
  path,
  skip,
}: {
  fields: FieldDescription[]
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>, group?: string) => void
  path: Path
  skip?: string[]
}) {
  return (
    <div className="space-y-5">
      {fields
        .filter((f) => !skip?.includes(f.name))
        .map((f) => (
          <Field
            key={f.name}
            field={f}
            value={value[f.name]}
            siblings={value}
            path={[...path, f.name]}
            onChange={(v, group) => {
              const next = { ...value }
              if (v === undefined) delete next[f.name]
              else next[f.name] = v
              onChange(next, group)
            }}
          />
        ))}
    </div>
  )
}

/** A field with its label, help text and errors. */
export function Field(props: FieldProps) {
  const { field, path } = props
  const errors = useIssues(pathKey(path))
  const inline = field.kind === 'boolean'
  const id = `f-${pathKey(path)}`

  if (field.kind === 'group' || field.kind === 'seo') {
    return (
      <fieldset data-path={pathKey(path)} className="rounded-lg border border-line p-4">
        <legend className="-ml-1 px-1 text-[12px] font-medium text-fg2">{field.label}</legend>
        {field.description && <p className="-mt-1 mb-3 text-[12px] text-fg3">{field.description}</p>}
        <FieldControl {...props} />
      </fieldset>
    )
  }

  return (
    <div data-path={pathKey(path)} className={cx(inline && 'flex items-center justify-between gap-4')}>
      <div className={cx('flex items-baseline gap-2', !inline && 'mb-1.5')}>
        <label htmlFor={id} className="text-[12px] font-medium text-fg2">
          {field.label}
          {field.required && <span className="ml-0.5 text-fg3">*</span>}
        </label>
        <Counter field={field} value={props.value} />
      </div>
      <FieldControl {...props} />
      {field.description && !inline && <p className="mt-1.5 text-[12px] text-fg3">{field.description}</p>}
      {errors.map((e) => (
        <p key={e} className="mt-1.5 text-[12px] text-danger">
          {e}
        </p>
      ))}
    </div>
  )
}

function Counter({ field, value }: { field: FieldDescription; value: unknown }) {
  const max = field.options.max
  if (field.kind !== 'text' || typeof max !== 'number') return null
  const length = typeof value === 'string' ? value.length : 0
  return (
    <span className={cx('ml-auto text-[11px] tabular-nums', length > max ? 'text-danger' : 'text-fg3')}>
      {length}/{max}
    </span>
  )
}

export function FieldControl({ field, value, onChange, path, siblings }: FieldProps) {
  const id = `f-${pathKey(path)}`
  const invalid = useIssues(pathKey(path)).length > 0
  const group = `${field.kind}:${pathKey(path)}`

  switch (field.kind) {
    case 'text': {
      const common = {
        id,
        value: typeof value === 'string' ? value : '',
        placeholder: (field.options.placeholder as string | undefined) ?? '',
        'aria-invalid': invalid || undefined,
        onChange: (e: { target: { value: string } }) => onChange(e.target.value, group),
      }
      return field.options.multiline ? <Textarea {...common} /> : <Input {...common} />
    }

    case 'richText':
      return (
        <RichTextEditor value={value as RichText | undefined} invalid={invalid} onChange={(v) => onChange(v, group)} />
      )

    case 'number':
      return (
        <Input
          id={id}
          type="number"
          className="w-40 tabular-nums"
          value={typeof value === 'number' ? value : ''}
          min={field.options.min as number | undefined}
          max={field.options.max as number | undefined}
          step={field.options.integer ? 1 : 'any'}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value), group)}
        />
      )

    case 'boolean':
      return <Switch checked={value === true} onChange={onChange} label={field.label} />

    case 'date':
      return (
        <Input
          id={id}
          type="date"
          className="w-48"
          value={typeof value === 'string' ? value.slice(0, 10) : ''}
          aria-invalid={invalid || undefined}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )

    case 'select': {
      const options = optionList(field)
      const current = typeof value === 'string' ? value : ''
      const short = options.length <= 4 && options.every((o) => o.label.length <= 14)
      if (short) {
        return (
          <Segmented
            value={current}
            onChange={(v) => onChange(v === '' ? undefined : v)}
            options={[...(field.required ? [] : [{ value: '', label: '—', title: 'Nessuno' }]), ...options]}
          />
        )
      }
      return (
        <select
          id={id}
          value={current}
          onChange={(e) => onChange(e.target.value || undefined)}
          aria-invalid={invalid || undefined}
          className="h-8 w-full rounded-md border border-line2 bg-input px-2 text-[13px] focus:border-accent focus:outline-none"
        >
          {!field.required || !current ? <option value="">—</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }

    case 'slug': {
      const from = typeof field.options.from === 'string' ? siblings?.[field.options.from] : undefined
      const suggestion = typeof from === 'string' ? slugify(from) : ''
      return (
        <div className="flex gap-1.5">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 font-mono text-[12px] text-fg3">
              /
            </span>
            <Input
              id={id}
              className="pl-5 font-mono text-[12.5px]"
              value={typeof value === 'string' ? value : ''}
              placeholder={suggestion || 'indirizzo-della-pagina'}
              aria-invalid={invalid || undefined}
              onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s+/g, '-'), group)}
              onBlur={(e) => e.target.value && onChange(slugify(e.target.value))}
            />
          </div>
          {suggestion && suggestion !== value && (
            <IconButton label="Genera dal titolo" className="size-8" onClick={() => onChange(suggestion)}>
              <Wand2 />
            </IconButton>
          )}
        </div>
      )
    }

    case 'media':
      return (
        <MediaInput
          value={value as Media | undefined}
          onChange={(v, g) => onChange(v, g && `${group}:${g}`)}
          focalPoint={field.options.focalPoint !== false}
          invalid={invalid}
        />
      )

    case 'link':
      return <LinkInput value={value as LinkValue | undefined} onChange={(v, g) => onChange(v, `${group}:${g}`)} />

    case 'relation':
      return (
        <RelationInput
          to={field.options.to as string}
          many={field.options.many === true}
          value={value as string | string[] | undefined}
          onChange={onChange}
          invalid={invalid}
        />
      )

    case 'blocks':
      return (
        <BlocksInput
          field={field}
          value={(value as Record<string, unknown>[] | undefined) ?? []}
          onChange={onChange}
          path={path}
        />
      )

    case 'group':
      return (
        <FieldsForm
          fields={field.fields ?? []}
          value={(value as Record<string, unknown> | undefined) ?? {}}
          onChange={onChange}
          path={path}
        />
      )

    case 'array':
      return <ArrayInput field={field} value={(value as unknown[] | undefined) ?? []} onChange={onChange} path={path} />

    case 'seo':
      return <SeoInput value={(value as Seo | undefined) ?? {}} onChange={onChange} path={path} />

    case 'color': {
      const hex = typeof value === 'string' ? value : ''
      return (
        <div className="flex items-center gap-2">
          <label
            className="relative size-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line2"
            style={{ background: hex || 'transparent' }}
          >
            <input
              type="color"
              value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#000000'}
              onChange={(e) => onChange(e.target.value, group)}
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label={`${field.label}: scegli colore`}
            />
          </label>
          <Input
            id={id}
            className="w-32 font-mono text-[12.5px] uppercase"
            value={hex}
            placeholder="#000000"
            maxLength={7}
            aria-invalid={invalid || undefined}
            onChange={(e) => onChange(e.target.value || undefined, group)}
          />
        </div>
      )
    }

    case 'json':
      return <JsonInput id={id} value={value} onChange={onChange} />
  }
}

// ---------- composite inputs ----------

function LinkInput({
  value,
  onChange,
}: {
  value: LinkValue | undefined
  onChange: (value: LinkValue | undefined, group: string) => void
}) {
  const v = value ?? { href: '' }
  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-[1fr_1.3fr] gap-1.5">
        <Input
          placeholder="Testo"
          value={v.label ?? ''}
          onChange={(e) => onChange({ ...v, label: e.target.value }, 'label')}
        />
        <Input
          placeholder="https://… o /pagina"
          className="font-mono text-[12.5px]"
          value={v.href}
          onChange={(e) => onChange({ ...v, href: e.target.value }, 'href')}
        />
      </div>
      <div className="flex items-center gap-2 text-[12px] text-fg2">
        <Switch
          checked={!!v.newTab}
          onChange={(newTab) => onChange({ ...v, newTab }, 'tab')}
          label="Apri in una nuova scheda"
        />
        Apri in una nuova scheda
      </div>
    </div>
  )
}

function ArrayInput({
  field,
  value,
  onChange,
  path,
}: {
  field: FieldDescription
  value: unknown[]
  onChange: Change
  path: Path
}) {
  const item = field.item
  const max = field.options.max as number | undefined
  if (!item) return null
  const update = (i: number, v: unknown, group?: string) => {
    const next = [...value]
    next[i] = v
    onChange(next, group)
  }
  return (
    <div className="space-y-2">
      {value.map((entry, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: array items have no identity of their own
        <div key={i} className="group flex items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <FieldControl field={item} value={entry} path={[...path, i]} onChange={(v, g) => update(i, v, g)} />
          </div>
          <div className="flex shrink-0 opacity-60 transition-opacity group-hover:opacity-100">
            <IconButton label="Sposta su" disabled={i === 0} onClick={() => onChange(move(value, i, i - 1))}>
              <ArrowUp />
            </IconButton>
            <IconButton
              label="Sposta giù"
              disabled={i === value.length - 1}
              onClick={() => onChange(move(value, i, i + 1))}
            >
              <ArrowDown />
            </IconButton>
            <IconButton label="Rimuovi" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              <Trash2 />
            </IconButton>
          </div>
        </div>
      ))}
      {(max === undefined || value.length < max) && (
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus className="size-3.5" />}
          onClick={() => onChange([...value, emptyValue(item) ?? (item.kind === 'text' ? '' : undefined)])}
        >
          Aggiungi
        </Button>
      )}
    </div>
  )
}

function SeoInput({ value, onChange, path }: { value: Seo; onChange: Change; path: Path }) {
  const { docTitle, docUrl, siteUrl } = useForm()
  const set = (key: keyof Seo, v: unknown, group?: string) => {
    const next: Record<string, unknown> = { ...value }
    if (v === undefined || v === '' || v === false) delete next[key]
    else next[key] = v
    onChange(next, group)
  }
  const title = value.title || docTitle || 'Titolo della pagina'
  const host = siteUrl ? siteUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'tuosito.it'
  const fields: Record<string, FieldDescription> = {
    title: {
      name: 'title',
      kind: 'text',
      label: 'Titolo per i motori di ricerca',
      required: false,
      localized: true,
      options: { max: 70, placeholder: docTitle },
    },
    description: {
      name: 'description',
      kind: 'text',
      label: 'Descrizione',
      required: false,
      localized: true,
      options: { max: 170, multiline: true, placeholder: 'Una o due frasi che invoglino a cliccare.' },
    },
    image: {
      name: 'image',
      kind: 'media',
      label: 'Immagine per la condivisione',
      required: false,
      localized: false,
      options: { focalPoint: false },
    },
    noindex: {
      name: 'noindex',
      kind: 'boolean',
      label: 'Nascondi dai motori di ricerca',
      required: false,
      localized: false,
      options: {},
    },
  }
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-panel2 px-3.5 py-3">
        <div className="truncate text-[12px] text-fg3">
          {host}
          {docUrl && docUrl !== '/'
            ? docUrl
                .split('/')
                .filter(Boolean)
                .map((s) => ` › ${s}`)
                .join('')
            : ''}
        </div>
        <div className="mt-0.5 truncate text-[16px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{title}</div>
        <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-fg2">
          {value.description ||
            'Aggiungi una descrizione: è il testo che appare sotto al titolo nei risultati di ricerca.'}
        </div>
      </div>
      {(Object.keys(fields) as (keyof Seo)[]).map((key) => (
        <Field
          key={key}
          field={fields[key] as FieldDescription}
          value={value[key]}
          path={[...path, key]}
          onChange={(v, g) => set(key, v, g)}
        />
      ))}
    </div>
  )
}

function JsonInput({ id, value, onChange }: { id: string; value: unknown; onChange: Change }): ReactNode {
  const [text, setText] = useState(() => (value === undefined ? '' : JSON.stringify(value, null, 2)))
  const [error, setError] = useState(false)
  useEffect(() => {
    setText(value === undefined ? '' : JSON.stringify(value, null, 2))
  }, [value])
  return (
    <Textarea
      id={id}
      className="font-mono text-[12px]"
      value={text}
      aria-invalid={error || undefined}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (!text.trim()) return onChange(undefined)
        try {
          onChange(JSON.parse(text))
          setError(false)
        } catch {
          setError(true)
        }
      }}
    />
  )
}
