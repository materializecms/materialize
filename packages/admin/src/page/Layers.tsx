import { findNode, type PageNode } from '@materializecms/core/page'
import {
  ChevronRight,
  Code,
  Columns3,
  Component as ComponentIcon,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutGrid,
  LayoutTemplate,
  Lock,
  MousePointerClick,
  Rows3,
  Shapes,
  Sparkles,
  TextCursorInput,
  Type,
  Video,
} from 'lucide-react'
import { type DragEvent, useEffect, useState } from 'react'
import { cx } from '../components/ui.tsx'
import { typeLabel } from './Canvas.tsx'

export function nodeIcon(n: PageNode, depth: number) {
  if (n.component) return <ComponentIcon className="text-[#8b5cf6]" />
  if (n.type === 'text') return <Type />
  if (n.type === 'image') return <ImageIcon />
  if (n.type === 'button') return <MousePointerClick />
  if (n.type === 'video') return <Video />
  if (n.type === 'embed') return <Code />
  if (n.type === 'scene') return <Sparkles />
  if (n.type === 'icon') return <Shapes />
  if (n.type === 'input') return <TextCursorInput />
  if (depth === 0) return n.global ? <Globe /> : <LayoutTemplate />
  if (n.layout === 'row') return <Columns3 />
  if (n.layout === 'grid') return <LayoutGrid />
  return <Rows3 />
}

type Drop = { id: string; where: 'before' | 'after' | 'inside' }

/**
 * The page as a tree: select (shift or ⌘ to add), rename (double click or F2), hide, and drag
 * to reorder or nest.
 */
export function Layers({
  nodes,
  selected,
  selection,
  onSelect,
  onRename,
  onToggleHidden,
  onMove,
  onContextMenu,
  hiddenOf,
}: {
  nodes: PageNode[]
  selected: string | null
  /** Every selected element; `selected` is the last one picked. */
  selection: string[]
  onSelect: (id: string | null, add?: boolean) => void
  onRename: (id: string, name: string) => void
  onToggleHidden: (id: string) => void
  /** Moves `id` before, after or inside `target`. */
  onMove: (id: string, target: Drop) => void
  /** Right click on a row: the editor's menu of actions. */
  onContextMenu: (id: string, x: number, y: number) => void
  /** Whether a node is hidden on the device being edited. */
  hiddenOf: (n: PageNode) => boolean
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [renaming, setRenaming] = useState<string | null>(null)
  const [drag, setDrag] = useState<string | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)

  // Selecting on the canvas opens the way to the element.
  useEffect(() => {
    if (!selected) return
    const path: string[] = []
    const walk = (list: PageNode[], trail: string[]): boolean => {
      for (const n of list) {
        if (n.id === selected) {
          path.push(...trail)
          return true
        }
        if (n.children && walk(n.children, [...trail, n.id])) return true
      }
      return false
    }
    walk(nodes, [])
    if (path.some((id) => !open[id])) setOpen((o) => ({ ...o, ...Object.fromEntries(path.map((id) => [id, true])) }))
    requestAnimationFrame(() =>
      document.querySelector(`[data-layer="${CSS.escape(selected)}"]`)?.scrollIntoView({ block: 'nearest' }),
    )
  }, [selected, nodes, open])

  const isInside = (id: string, target: string) => {
    const info = findNode(nodes, id)
    return !!info && !!findNode(info.node.children ?? [], target)
  }

  const onDragOver = (e: DragEvent, n: PageNode, depth: number) => {
    if (!drag || drag === n.id || isInside(drag, n.id)) return
    const dragged = findNode(nodes, drag)
    // Sections stay at the top level, elements stay inside sections.
    const draggingSection = dragged?.depth === 0
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - r.top) / r.height
    let where: Drop['where'] = y < 0.5 ? 'before' : 'after'
    if (n.type === 'frame' && y > 0.25 && y < 0.75 && !draggingSection) where = 'inside'
    if (draggingSection && depth > 0) return
    if (!draggingSection && depth === 0 && where !== 'inside') return
    if (drop?.id !== n.id || drop.where !== where) setDrop({ id: n.id, where })
  }

  const rows: React.ReactNode[] = []
  const render = (list: PageNode[], depth: number) => {
    for (const n of list) {
      const kids = n.type === 'frame' && (n.children?.length ?? 0) > 0
      const expanded = open[n.id] ?? false
      const hidden = hiddenOf(n)
      const name = n.name || typeLabel(n)
      const isSel = selection.includes(n.id)
      rows.push(
        // biome-ignore lint/a11y/noStaticElementInteractions: drop target for dragged layers
        <div
          key={n.id}
          data-layer={n.id}
          className="group/layer relative"
          onDragOver={(e) => onDragOver(e, n, depth)}
          onDrop={(e) => {
            e.preventDefault()
            if (drag && drop) onMove(drag, drop)
            setDrag(null)
            setDrop(null)
          }}
        >
          {drop?.id === n.id && drop.where !== 'inside' && (
            <div
              className={cx(
                'absolute right-1 h-0.5 rounded bg-accent',
                drop.where === 'before' ? '-top-px' : '-bottom-px',
              )}
              style={{ left: 8 + depth * 14 }}
            />
          )}
          {renaming === n.id ? (
            <div className="flex h-7 items-center gap-1.5 pr-2" style={{ paddingLeft: 6 + depth * 14 + 16 }}>
              <span className="text-fg3 [&_svg]:size-3.5">{nodeIcon(n, depth)}</span>
              <input
                autoFocus
                aria-label="Nome del livello"
                defaultValue={name}
                maxLength={80}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={(e) => {
                  onRename(n.id, e.currentTarget.value.trim())
                  setRenaming(null)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(null)
                }}
                className="h-6 min-w-0 flex-1 rounded border border-accent bg-input px-1.5 text-[12.5px] outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move'
                setDrag(n.id)
              }}
              onDragEnd={() => {
                setDrag(null)
                setDrop(null)
              }}
              onClick={(e) => onSelect(n.id, e.shiftKey || e.metaKey || e.ctrlKey)}
              onContextMenu={(e) => {
                e.preventDefault()
                onContextMenu(n.id, e.clientX, e.clientY)
              }}
              onDoubleClick={() => setRenaming(n.id)}
              onKeyDown={(e) => {
                if (e.key === 'F2' || (e.key === 'Enter' && selected === n.id)) {
                  e.preventDefault()
                  setRenaming(n.id)
                }
              }}
              className={cx(
                'flex h-7 w-full items-center gap-1.5 rounded-md pr-14 text-left text-[12.5px] transition-colors',
                isSel ? 'bg-accent/10 text-fg' : 'text-fg2 hover:bg-hover hover:text-fg',
                drop?.id === n.id && drop.where === 'inside' && 'ring-2 ring-accent ring-inset',
                drag === n.id && 'opacity-40',
                hidden && 'opacity-50',
              )}
              style={{ paddingLeft: 6 + depth * 14 }}
            >
              {/* biome-ignore lint/a11y/noStaticElementInteractions: the row is the button, the chevron only toggles */}
              <span
                className={cx('flex size-4 shrink-0 items-center justify-center text-fg3', !kids && 'invisible')}
                // A plain span: the row is the button, the chevron only toggles.
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen((o) => ({ ...o, [n.id]: !expanded }))
                }}
                onKeyDown={undefined}
                role="presentation"
              >
                <ChevronRight className={cx('size-3 transition-transform', expanded && 'rotate-90')} />
              </span>
              <span
                className={cx(
                  'shrink-0 [&_svg]:size-3.5',
                  isSel ? 'text-accent' : depth === 0 ? 'text-fg2' : 'text-fg3',
                )}
              >
                {nodeIcon(n, depth)}
              </span>
              <span className={cx('truncate', depth === 0 && 'font-medium', isSel && 'font-medium')}>{name}</span>
              {n.locked && <Lock className="size-3 shrink-0 text-fg3" aria-label="Bloccato" />}
            </button>
          )}
          {renaming !== n.id && (
            <span className="absolute top-0.5 right-1 flex gap-0.5 opacity-0 group-hover/layer:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                title="Rinomina"
                aria-label={`Rinomina ${name}`}
                onClick={() => setRenaming(n.id)}
                className="flex size-6 items-center justify-center rounded text-[10px] font-semibold text-fg3 hover:bg-hover hover:text-fg"
              >
                Aa
              </button>
              <button
                type="button"
                title={hidden ? 'Mostra' : 'Nascondi su questo dispositivo'}
                aria-label={hidden ? `Mostra ${name}` : `Nascondi ${name}`}
                onClick={() => onToggleHidden(n.id)}
                className="flex size-6 items-center justify-center rounded text-fg3 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
              >
                {hidden ? <EyeOff /> : <Eye />}
              </button>
            </span>
          )}
          {hidden && renaming !== n.id && (
            <EyeOff className="absolute top-2 right-2 size-3 text-fg3 group-hover/layer:hidden" />
          )}
        </div>,
      )
      if (kids && expanded) render(n.children ?? [], depth + 1)
    }
  }
  render(nodes, 0)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: clears the drop line when dragging leaves the list
    <div className="flex-1 overflow-y-auto p-1.5" onDragLeave={(e) => e.currentTarget === e.target && setDrop(null)}>
      <button
        type="button"
        onClick={() => onSelect(null)}
        className={cx(
          'mb-0.5 flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[12.5px] [&_svg]:size-3.5',
          selected === null ? 'bg-accent/10 font-medium text-fg' : 'text-fg2 hover:bg-hover hover:text-fg',
        )}
      >
        <FileText className={selected === null ? 'text-accent' : ''} />
        Pagina
      </button>
      {rows}
      {nodes.length === 0 && (
        <p className="px-2 py-3 text-[12px] leading-relaxed text-fg3">
          La pagina è vuota. Aggiungi una sezione dalla scheda Aggiungi.
        </p>
      )}
    </div>
  )
}
