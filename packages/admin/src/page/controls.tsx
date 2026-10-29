import { RotateCcw } from 'lucide-react'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { cx, Switch } from '../components/ui.tsx'

/** A titled group of the inspector. */
export function Section({
  title,
  action,
  children,
  overridden,
  onReset,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  /** Some values here differ on the device being edited. */
  overridden?: boolean
  onReset?: () => void
}) {
  return (
    <section className="space-y-2.5 border-b border-line px-3.5 pt-3 pb-3.5">
      <h3 className="flex min-h-5 items-center justify-between gap-2 text-[12px] font-semibold">
        <span className="flex items-center gap-1.5">
          {title}
          {overridden && (
            <span title="Ha modifiche per questo dispositivo" className="size-1.5 rounded-full bg-accent" />
          )}
        </span>
        <span className="flex items-center gap-1">
          {overridden && onReset && (
            <button
              type="button"
              title="Torna ai valori del desktop"
              aria-label="Torna ai valori del desktop"
              onClick={onReset}
              className="flex size-6 items-center justify-center rounded text-fg3 hover:bg-hover hover:text-fg"
            >
              <RotateCcw className="size-3.5" />
            </button>
          )}
          {action}
        </span>
      </h3>
      {children}
    </section>
  )
}

export function Row({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2" title={hint}>
      <span className="truncate text-[11.5px] font-medium text-fg2">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">{children}</div>
    </div>
  )
}

/** Compact segmented control; options may be icons with a title. */
export function Seg<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" className="flex min-w-0 flex-1 gap-0.5 rounded-md bg-seg p-0.5">
      {options.map((o) => (
        // biome-ignore lint/a11y/useSemanticElements: segmented control buttons act as radios
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          title={o.title}
          aria-label={o.title}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex h-6 min-w-0 flex-1 items-center justify-center rounded-[5px] px-1.5 text-[11.5px] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
            value === o.value ? 'bg-panel text-fg shadow-sm' : 'text-fg2 hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** A number with a unit; drag the label sideways to scrub, like design tools. */
export function NumField({
  value,
  onChange,
  unit = 'px',
  min = 0,
  max = 4000,
  step = 1,
  label,
  placeholder,
}: {
  value: number | null | undefined
  onChange: (value: number | null) => void
  unit?: string
  min?: number
  max?: number
  step?: number
  label?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value == null ? '' : String(value))
  const drag = useRef<{ x: number; start: number } | null>(null)
  useEffect(() => setText(value == null ? '' : String(value)), [value])
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n / step) * step))
  const commit = () => {
    if (text.trim() === '') return onChange(null)
    const n = Number(text.replace(',', '.'))
    if (Number.isFinite(n)) onChange(clamp(n))
    else setText(value == null ? '' : String(value))
  }
  return (
    <div className="flex h-7 min-w-0 flex-1 items-center rounded-md border border-line2 bg-input pr-2 focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/15">
      {label && (
        <span
          className="cursor-ew-resize pl-2 font-mono text-[10.5px] text-fg3 select-none"
          onPointerDown={(e) => {
            drag.current = { x: e.clientX, start: value ?? 0 }
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
            onChange(clamp(drag.current.start + Math.round((e.clientX - drag.current.x) / 2) * step))
          }}
          onPointerUp={() => {
            drag.current = null
          }}
        >
          {label}
        </span>
      )}
      <input
        value={text}
        placeholder={placeholder}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const delta = (e.key === 'ArrowUp' ? 1 : -1) * step * (e.shiftKey ? 10 : 1)
            onChange(clamp((value ?? 0) + delta))
          }
        }}
        className="h-full w-full min-w-0 bg-transparent px-2 font-mono text-[12px] text-fg outline-none placeholder:text-fg3"
      />
      <span className="font-mono text-[10.5px] text-fg3">{unit}</span>
    </div>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[12px] text-fg2">{label}</span>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  )
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  label: string
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-1.5 text-[12px] text-fg outline-none focus:border-accent"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

/** Chips that wrap, for longer lists of choices (animations). */
export function Chips<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-[26px] rounded-md border px-2 text-[11.5px] font-medium transition-colors',
            value === o.value
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-line2 text-fg2 hover:border-fg3/50 hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
