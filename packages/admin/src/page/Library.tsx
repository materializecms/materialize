import { buildSection, LIBRARY } from '@materializecms/core/library'
import { type Component, type PageNode, pageRootStyle, renderSections, type Theme } from '@materializecms/core/page'
import {
  Code,
  Image as ImageIcon,
  Languages,
  MousePointerClick,
  Pencil,
  Rows3,
  Search,
  Shapes,
  Sparkles,
  TextCursorInput,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { cx, Kbd } from '../components/ui.tsx'
import { DRAG_ELEMENT, DRAG_SECTION } from './Canvas.tsx'

export type ElementKind =
  | 'frame'
  | 'text'
  | 'image'
  | 'button'
  | 'video'
  | 'embed'
  | 'scene'
  | 'icon'
  | 'input'
  | 'langs'

const ELEMENTS: { kind: ElementKind; label: string; key: string; icon: React.ReactNode }[] = [
  { kind: 'frame', label: 'Contenitore', key: 'F', icon: <Rows3 /> },
  { kind: 'text', label: 'Testo', key: 'T', icon: <Type /> },
  { kind: 'image', label: 'Immagine', key: 'I', icon: <ImageIcon /> },
  { kind: 'button', label: 'Pulsante', key: 'B', icon: <MousePointerClick /> },
  { kind: 'video', label: 'Video', key: 'V', icon: <Video /> },
  { kind: 'embed', label: 'Codice', key: 'C', icon: <Code /> },
  { kind: 'scene', label: 'WebGL', key: 'G', icon: <Sparkles /> },
  { kind: 'icon', label: 'Icona', key: 'O', icon: <Shapes /> },
  { kind: 'input', label: 'Campo', key: 'K', icon: <TextCursorInput /> },
  { kind: 'langs', label: 'Lingue', key: 'L', icon: <Languages /> },
]

const TILE_W = 1280

/** Elements to add inside the selection, and the section library with real previews. */
export function Library({
  theme,
  brand,
  onAddElement,
  onAddSection,
  globals,
  globalUsage,
  usedHere,
  onAddGlobal,
  onRenameGlobal,
  onRemoveGlobal,
  components,
  onAddComponent,
  onRemoveComponent,
}: {
  theme: Theme
  brand: string
  globals: Record<string, PageNode>
  /** Titles of the pages using each global section, as the server last counted them. */
  globalUsage: Record<string, string[]>
  /** Global sections on the page being edited (it may not be saved yet). */
  usedHere: Set<string>
  onAddGlobal: (id: string) => void
  onRenameGlobal: (id: string, name: string) => void
  /** Deletes a global section no page uses. */
  onRemoveGlobal: (id: string) => void
  components: Record<string, Component>
  onAddComponent: (id: string) => void
  /** Takes a component out of the library; copies already on pages stay as they are. */
  onRemoveComponent: (id: string) => void
  onAddElement: (kind: ElementKind) => void
  onAddSection: (key: string) => void
}) {
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  // Without accents and across every category: "pie" finds "Piè", a search ignores the chosen chip.
  const fold = (t: string) =>
    t
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const q = fold(query.trim())
  const groups = LIBRARY.filter((c) => q || cat === 'all' || c.key === cat)
    .map((c) => ({
      ...c,
      variants: c.variants.filter(
        (v) => !q || q.split(/\s+/).every((w) => fold(`${c.label} ${v.label} ${v.keywords}`).includes(w)),
      ),
    }))
    .filter((c) => c.variants.length)

  // One render of every section, shared by all the tiles.
  const previews = useMemo(() => {
    const out: Record<string, { html: string; css: string }> = {}
    for (const c of LIBRARY)
      for (const v of c.variants)
        out[v.key] = renderSections([buildSection(v.key, brand)], theme, {
          animations: 'none',
          base: v.key === 'nav.classic',
        })
    return out
  }, [theme, brand])
  const globalPreviews = useMemo(
    () =>
      Object.entries(globals).map(([id, node]) => ({
        id,
        label: node.name || 'Sezione globale',
        ...renderSections([node], theme, { animations: 'none', base: false }),
      })),
    [globals, theme],
  )
  const componentPreviews = useMemo(
    () =>
      Object.values(components).flatMap((c) => {
        const node = c.variants[0]?.node
        if (!node || c.archived) return []
        const out = renderSections([node], theme, { animations: 'none', base: false })
        return [
          {
            id: c.id,
            name: c.name,
            label: `${c.name} · ${c.variants.length === 1 ? '1 variante' : `${c.variants.length} varianti`}`,
            ...out,
          },
        ]
      }),
    [components, theme],
  )
  const css = useMemo(
    () =>
      Object.values(previews)
        .map((p) => p.css)
        .join('\n'),
    [previews],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-3 border-b border-line p-3">
        {/* Elements as a compact row of icons: the sections below get the room. */}
        <div className="grid grid-cols-5 gap-1">
          {ELEMENTS.map((e) => (
            <button
              key={e.kind}
              type="button"
              title={`${e.label} · ${e.key}`}
              draggable
              onDragStart={(ev) => {
                ev.dataTransfer.setData(DRAG_ELEMENT, e.kind)
                ev.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAddElement(e.kind)}
              aria-label={`Aggiungi ${e.label}`}
              className="flex h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-line bg-panel text-[9.5px] font-medium text-fg2 transition-colors hover:border-line2 hover:text-fg [&_svg]:size-4 [&_svg]:shrink-0"
            >
              {e.icon}
              <span className="max-w-full truncate px-0.5">{e.label}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca sezioni"
            aria-label="Cerca sezioni"
            className="h-8 w-full rounded-md border border-line2 bg-input pr-2 pl-8 text-[12.5px] outline-none focus:border-accent"
          />
        </div>
        {/* One scrolling row of categories instead of seven wrapped lines. */}
        <div className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 [scrollbar-width:thin]">
          {[{ key: 'all', label: 'Tutte' }, ...LIBRARY].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={cx(
                'h-6 shrink-0 rounded-full px-2.5 text-[11.5px] font-medium whitespace-nowrap transition-colors',
                cat === c.key ? 'bg-fg text-bg' : 'bg-seg text-fg2 hover:text-fg',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      <style>{css}</style>
      <style>{globalPreviews.map((g) => g.css).join('\n')}</style>
      <style>{componentPreviews.map((g) => g.css).join('\n')}</style>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        {componentPreviews.length > 0 && !q && cat === 'all' && (
          <section>
            <h3 className="mb-2 flex items-center justify-between text-[12px] font-semibold">
              Componenti
              <span className="font-normal text-fg3">riutilizzabili, con varianti</span>
            </h3>
            <div className="space-y-2.5">
              {componentPreviews.map((g) => (
                <div key={g.id} className="group/c relative">
                  <Tile
                    id={`component:${g.id}`}
                    label={g.label}
                    html={g.html}
                    root={pageRootStyle(theme)}
                    onAdd={() => onAddComponent(g.id)}
                  />
                  <button
                    type="button"
                    title="Togli dalla libreria"
                    aria-label={`Togli “${g.name}” dalla libreria`}
                    onClick={() => {
                      if (confirm(`Togliere “${g.name}” dalla libreria? Le copie già nelle pagine restano com’erano.`))
                        onRemoveComponent(g.id)
                    }}
                    className="absolute right-1.5 bottom-1 flex size-6 items-center justify-center rounded-md text-fg3 opacity-0 group-hover/c:opacity-100 hover:bg-hover hover:text-danger focus:opacity-100 [&_svg]:size-3.5"
                  >
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {globalPreviews.length > 0 && !q && cat === 'all' && (
          <section>
            <h3 className="mb-2 flex items-center justify-between text-[12px] font-semibold">
              Sezioni globali
              <span className="font-normal text-fg3">condivise da tutte le pagine</span>
            </h3>
            <div className="space-y-2.5">
              {globalPreviews.map((g) => {
                const pages = globalUsage[g.id] ?? []
                const used = pages.length > 0 || usedHere.has(g.id)
                const where = usedHere.has(g.id) ? 'in questa pagina' : `in ${pages.map((t) => `“${t}”`).join(', ')}`
                return (
                  <div key={g.id} className="group/c relative">
                    <Tile
                      id={`global:${g.id}`}
                      label={`${g.label} · ${used ? (pages.length > 1 ? `${pages.length} pagine` : 'in uso') : 'non usata'}`}
                      html={g.html}
                      root={pageRootStyle(theme)}
                      onAdd={() => onAddGlobal(g.id)}
                    />
                    <div className="absolute right-1.5 bottom-1 flex gap-0.5 opacity-0 group-hover/c:opacity-100 focus-within:opacity-100">
                      <button
                        type="button"
                        title="Rinomina"
                        aria-label={`Rinomina “${g.label}”`}
                        onClick={() => {
                          const name = prompt('Nome della sezione globale', g.label)?.trim()
                          if (name && name !== g.label) onRenameGlobal(g.id, name)
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-fg3 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
                      >
                        <Pencil />
                      </button>
                      <button
                        type="button"
                        title={used ? `Usata ${where}: toglila prima dalle pagine` : 'Elimina la sezione globale'}
                        aria-label={`Elimina “${g.label}”`}
                        disabled={used}
                        onClick={() => {
                          if (confirm(`Eliminare “${g.label}”? Nessuna pagina la usa.`)) onRemoveGlobal(g.id)
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-fg3 hover:bg-hover hover:text-danger disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg3 [&_svg]:size-3.5"
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
        {groups.map((c) => (
          <section key={c.key}>
            <h3 className="mb-2 flex items-center justify-between text-[12px] font-semibold">
              {c.label}
              <span className="font-normal text-fg3">{c.variants.length}</span>
            </h3>
            <div className="space-y-2.5">
              {c.variants.map((v) => (
                <Tile
                  key={v.key}
                  id={v.key}
                  label={v.label}
                  html={previews[v.key]?.html ?? ''}
                  root={pageRootStyle(theme)}
                  onAdd={() => onAddSection(v.key)}
                />
              ))}
            </div>
          </section>
        ))}
        {!groups.length && <p className="py-8 text-center text-[12.5px] text-fg3">Nessuna sezione per “{query}”.</p>}
        <p className="flex items-center justify-center gap-1.5 pt-2 text-[11.5px] text-fg3">
          Scorciatoie: <Kbd>F</Kbd> <Kbd>T</Kbd> <Kbd>I</Kbd> <Kbd>B</Kbd>
        </p>
      </div>
    </div>
  )
}

/** A section drawn at desktop width and scaled into the tile; drawn only once it scrolls into view. */
const Tile = memo(function Tile({
  id,
  label,
  html,
  root,
  onAdd,
}: {
  id: string
  label: string
  html: string
  root: string
  onAdd: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(0)
  const [visible, setVisible] = useState(false)
  const [h, setH] = useState(0)
  const inner = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: '200px' })
    io.observe(el)
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    return () => {
      io.disconnect()
      ro.disconnect()
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: measure again when the content or width changes
  useEffect(() => {
    if (visible && inner.current) setH(inner.current.scrollHeight)
  }, [visible, html, w])

  const scale = w / TILE_W
  const content = h * scale
  const height = Math.min(Math.max(content, 64), 200)
  const bg = /background:([^;]+)/.exec(root)?.[1]

  // The preview is a picture of the section: its own buttons and links stay out of reach (inert), and
  // a transparent button on top adds it, so no control sits inside another.
  return (
    <div
      ref={box}
      className="group relative block w-full overflow-hidden rounded-lg border border-line bg-panel text-left shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-[border-color,box-shadow] hover:border-accent hover:shadow-[0_0_0_1px_var(--accent)]"
    >
      <div className="relative overflow-hidden bg-panel2" style={{ height: visible ? height : 120, background: bg }}>
        {visible && (
          <div
            ref={inner}
            aria-hidden="true"
            inert
            className="mz-page pointer-events-none absolute left-0"
            style={{
              width: TILE_W,
              top: Math.max(0, (height - content) / 2),
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
              ...styleOf(root),
            }}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from our own renderer, text escaped
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-accent/0 opacity-0 transition group-hover:bg-accent/10 group-hover:opacity-100">
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-white shadow-sm">
            Aggiungi
          </span>
        </span>
      </div>
      <div className="border-t border-line px-2.5 py-1.5 text-[12px] font-medium text-fg2 group-hover:text-fg">
        {label}
      </div>
      <button
        type="button"
        title={`Aggiungi “${label}”: clicca o trascina sulla pagina`}
        aria-label={`Aggiungi “${label}”`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_SECTION, id)
          e.dataTransfer.effectAllowed = 'copy'
        }}
        onClick={onAdd}
        className="absolute inset-0 rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
      />
    </div>
  )
})

function styleOf(css: string): React.CSSProperties {
  const out: Record<string, string> = {}
  for (const part of css.split(';')) {
    const i = part.indexOf(':')
    if (i > 0)
      out[
        part
          .slice(0, i)
          .trim()
          .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
      ] = part.slice(i + 1).trim()
  }
  return out
}
