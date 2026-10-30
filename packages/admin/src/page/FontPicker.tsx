import { fontStack } from '@materializecms/core/page'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cx, Popover, Spinner } from '../components/ui.tsx'
import { api, type FontInfo } from '../lib/api.ts'
import { loadFont } from './fonts.ts'

const CATEGORIES = [
  { value: 'all', label: 'Tutti' },
  { value: 'serif', label: 'Graziati' },
  { value: 'sans-serif', label: 'Bastoni' },
  { value: 'display', label: 'Decorativi' },
  { value: 'handwriting', label: 'Calligrafici' },
  { value: 'monospace', label: 'Monospazio' },
]
const SHOWN = 120

/** Every Google Font, searchable, each name shown in its own typeface. */
export function FontPicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (font: Pick<FontInfo, 'family' | 'category'>) => void
  label: string
}) {
  useEffect(() => {
    if (value !== 'Del tema') loadFont(value)
  }, [value])
  return (
    <Popover
      width={300}
      align="end"
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          aria-label={label}
          onClick={toggle}
          className="flex h-7 min-w-0 flex-1 items-center gap-1 rounded-md border border-line2 bg-input px-2 text-left text-[13px] hover:border-fg3/50"
        >
          <span className="min-w-0 flex-1 truncate" style={{ fontFamily: fontStack(value) }}>
            {value}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-fg3" />
        </button>
      )}
    >
      {(close) => (
        <FontList
          value={value}
          onPick={(f) => {
            onChange(f)
            close()
          }}
        />
      )}
    </Popover>
  )
}

function FontList({ value, onPick }: { value: string; onPick: (f: FontInfo) => void }) {
  const fonts = useQuery({ queryKey: ['fonts'], queryFn: api.fonts, staleTime: Infinity })
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const q = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      (fonts.data?.items ?? []).filter(
        (f) => (category === 'all' || f.category === category) && (!q || f.family.toLowerCase().includes(q)),
      ),
    [fonts.data, category, q],
  )

  return (
    <div className="flex max-h-[420px] flex-col">
      <div className="space-y-2 border-b border-line p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={fonts.data ? `Cerca tra ${fonts.data.items.length} caratteri` : 'Cerca'}
            aria-label="Cerca un carattere"
            className="h-8 w-full rounded-md border border-line2 bg-input pr-2 pl-8 text-[13px] outline-none focus:border-accent"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={cx(
                'h-6 rounded-full px-2 text-[11.5px] font-medium',
                category === c.value ? 'bg-fg text-bg' : 'bg-seg text-fg2 hover:text-fg',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-1">
        {fonts.isPending ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : (
          <>
            {matches.slice(0, SHOWN).map((f) => (
              <FontRow key={f.id} font={f} selected={f.family === value} onPick={() => onPick(f)} />
            ))}
            {matches.length > SHOWN && (
              <p className="px-2 py-2 text-[12px] text-fg3">
                Altri {matches.length - SHOWN} caratteri: scrivi il nome per trovarli.
              </p>
            )}
            {!matches.length && (
              <p className="px-2 py-4 text-center text-[12.5px] text-fg3">Nessun carattere trovato.</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/** A font's name in its own face, loaded only once the row scrolls into view. */
function FontRow({ font, selected, onPick }: { font: FontInfo; selected: boolean; onPick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) {
        loadFont(font.family)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [font.family])
  return (
    <button
      ref={ref}
      type="button"
      onClick={onPick}
      className={cx(
        'flex h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover',
        selected && 'bg-accent/10',
      )}
    >
      <span
        className="min-w-0 flex-1 truncate text-[16px]"
        style={{ fontFamily: fontStack(font.family, font.category) }}
      >
        {font.family}
      </span>
      <span className="shrink-0 text-[11px] text-fg3">
        {font.variable ? 'variabile' : `${font.weights.length} pesi`}
      </span>
      {selected && <Check className="size-3.5 shrink-0 text-accent" />}
    </button>
  )
}
