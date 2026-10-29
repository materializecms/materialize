import { buildSection, LIBRARY } from '@materializecms/core/library'
import { type Component, type PageNode, pageRootStyle, renderSections, type Theme } from '@materializecms/core/page'
import { Code, Image as ImageIcon, MousePointerClick, Rows3, Search, Sparkles, Type, Video } from 'lucide-react'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { cx, Kbd } from '../components/ui.tsx'
import { DRAG_ELEMENT, DRAG_SECTION } from './Canvas.tsx'

export type ElementKind = 'frame' | 'text' | 'image' | 'button' | 'video' | 'embed' | 'scene'

const ELEMENTS: { kind: ElementKind; label: string; key: string; icon: React.ReactNode }[] = [
  { kind: 'frame', label: 'Contenitore', key: 'F', icon: <Rows3 /> },
  { kind: 'text', label: 'Testo', key: 'T', icon: <Type /> },
  { kind: 'image', label: 'Immagine', key: 'I', icon: <ImageIcon /> },
  { kind: 'button', label: 'Pulsante', key: 'B', icon: <MousePointerClick /> },
  { kind: 'video', label: 'Video', key: 'V', icon: <Video /> },
  { kind: 'embed', label: 'Codice', key: 'C', icon: <Code /> },
  { kind: 'scene', label: 'WebGL', key: 'G', icon: <Sparkles /> },
]

const TILE_W = 1280

/** Elements to add inside the selection, and the section library with real previews. */
export function Library({
  theme,
  brand,
  onAddElement,
  onAddSection,
  globals,
  onAddGlobal,
  components,
  onAddComponent,
}: {
  theme: Theme
  brand: string
  globals: Record<string, PageNode>
  onAddGlobal: (id: string) => void
  components: Record<string, Component>
  onAddComponent: (id: string) => void
  onAddElement: (kind: ElementKind) => void
  onAddSection: (key: string) => void
}) {
  const [cat, setCat] = useState('all')
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const groups = LIBRARY.filter((c) => cat === 'all' || c.key === cat)
    .map((c) => ({
      ...c,
      variants: c.variants.filter((v) => !q || `${c.label} ${v.label} ${v.keywords}`.toLowerCase().includes(q)),
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
        if (!node) return []
        const out = renderSections([node], theme, { animations: 'none', base: false })
        return [
          {
            id: c.id,
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
        <div className="grid grid-cols-2 gap-1.5">
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
              className="flex h-9 min-w-0 items-center gap-2 rounded-lg border border-line bg-panel px-2.5 text-[12px] font-medium text-fg2 transition-colors hover:border-line2 hover:text-fg [&_svg]:size-4 [&_svg]:shrink-0"
            >
              {e.icon}
              <span className="truncate">{e.label}</span>
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
        <div className="-mx-1 flex flex-wrap gap-1">
          {[{ key: 'all', label: 'Tutte' }, ...LIBRARY].map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCat(c.key)}
              className={cx(
                'h-6 rounded-full px-2.5 text-[11.5px] font-medium transition-colors',
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
                <Tile
                  key={g.id}
                  id={`component:${g.id}`}
                  label={g.label}
                  html={g.html}
                  root={pageRootStyle(theme)}
                  onAdd={() => onAddComponent(g.id)}
                />
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
              {globalPreviews.map((g) => (
                <Tile
                  key={g.id}
                  id={`global:${g.id}`}
                  label={g.label}
                  html={g.html}
                  root={pageRootStyle(theme)}
                  onAdd={() => onAddGlobal(g.id)}
                />
              ))}
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
  const box = useRef<HTMLButtonElement>(null)
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

  return (
    <button
      ref={box}
      type="button"
      title={`Aggiungi “${label}”: clicca o trascina sulla pagina`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_SECTION, id)
        e.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={onAdd}
      className="group block w-full overflow-hidden rounded-lg border border-line bg-panel text-left shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-[border-color,box-shadow] hover:border-accent hover:shadow-[0_0_0_1px_var(--accent)]"
    >
      <div className="relative overflow-hidden bg-panel2" style={{ height: visible ? height : 120, background: bg }}>
        {visible && (
          <div
            ref={inner}
            aria-hidden="true"
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
        <span className="absolute inset-0 flex items-center justify-center bg-accent/0 opacity-0 transition group-hover:bg-accent/10 group-hover:opacity-100">
          <span className="rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-white shadow-sm">
            Aggiungi
          </span>
        </span>
      </div>
      <div className="border-t border-line px-2.5 py-1.5 text-[12px] font-medium text-fg2 group-hover:text-fg">
        {label}
      </div>
    </button>
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
