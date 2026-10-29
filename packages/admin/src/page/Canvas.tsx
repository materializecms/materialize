import { layoutSticky, startMotion } from '@materializecms/core/motion'
import {
  type BoundEntry,
  type Breakpoint,
  DEVICE_WIDTH,
  findNode,
  librarySrcset,
  type NodeProps,
  type PageNode,
  type Run,
  renderPage,
  resolveNode,
  type Theme,
} from '@materializecms/core/page'
import { startScenes } from '@materializecms/core/scene'
import { Bold, ImagePlus, Italic, Link2, Link2Off } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cx } from '../components/ui.tsx'
import { domToRuns } from './runs.ts'

export type Mode = 'design' | 'content'

interface Box {
  id: string
  x: number
  y: number
  w: number
  h: number
}

const DEVICE_LABEL: Record<Breakpoint, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }

export type DropTarget = { id: string; where: 'before' | 'after' | 'inside' }
type Indicator = { x: number; y: number; w: number; h: number; inside: boolean }
/** A snapping line, in stage pixels: vertical (x) or horizontal (y). */
type Guide = { axis: 'x' | 'y'; at: number; from: number; to: number }
/** A measured distance between two boxes, in stage pixels, with its value in page pixels. */
type Gap = { x1: number; y1: number; x2: number; y2: number; label: number }

/** How close, in page pixels, an edge or center has to come to snap. */
const SNAP = 6

/**
 * Distances from the selected box to another: the gaps between them on each axis, or, when one is
 * inside the other, from each side of the inner one to the outer one.
 */
function gapsBetween(a: Box, b: Box, scale: number): Gap[] {
  const out: Gap[] = []
  const v = (n: number) => Math.round(n / scale)
  const inside = (o: Box, i: Box) =>
    i.x >= o.x - 0.5 && i.y >= o.y - 0.5 && i.x + i.w <= o.x + o.w + 0.5 && i.y + i.h <= o.y + o.h + 0.5
  if (inside(b, a) || inside(a, b)) {
    const [o, i] = inside(b, a) ? [b, a] : [a, b]
    const cy = i.y + i.h / 2
    const cx = i.x + i.w / 2
    out.push(
      { x1: o.x, y1: cy, x2: i.x, y2: cy, label: v(i.x - o.x) },
      { x1: i.x + i.w, y1: cy, x2: o.x + o.w, y2: cy, label: v(o.x + o.w - i.x - i.w) },
      { x1: cx, y1: o.y, x2: cx, y2: i.y, label: v(i.y - o.y) },
      { x1: cx, y1: i.y + i.h, x2: cx, y2: o.y + o.h, label: v(o.y + o.h - i.y - i.h) },
    )
    return out.filter((g) => g.label > 0)
  }
  // Side by side: the horizontal gap, at the height they share (or between their centers).
  const top = Math.max(a.y, b.y)
  const bottom = Math.min(a.y + a.h, b.y + b.h)
  const midY = top < bottom ? (top + bottom) / 2 : a.y + a.h / 2
  if (a.x + a.w <= b.x) out.push({ x1: a.x + a.w, y1: midY, x2: b.x, y2: midY, label: v(b.x - a.x - a.w) })
  else if (b.x + b.w <= a.x) out.push({ x1: b.x + b.w, y1: midY, x2: a.x, y2: midY, label: v(a.x - b.x - b.w) })
  const left = Math.max(a.x, b.x)
  const right = Math.min(a.x + a.w, b.x + b.w)
  const midX = left < right ? (left + right) / 2 : a.x + a.w / 2
  if (a.y + a.h <= b.y) out.push({ x1: midX, y1: a.y + a.h, x2: midX, y2: b.y, label: v(b.y - a.y - a.h) })
  else if (b.y + b.h <= a.y) out.push({ x1: midX, y1: b.y + b.h, x2: midX, y2: a.y, label: v(a.y - b.y - b.h) })
  return out
}
type Handle = 'left' | 'right' | 'bottom' | 'corner' | 'section'

/** Section heights the renderer knows (desktop padding), from smallest to largest. */
const SECTION_SIZES: [NonNullable<NodeProps['size']>, number][] = [
  ['xs', 20],
  ['s', 56],
  ['m', 104],
  ['l', 140],
]
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)

/** MIME types for dragging from the library onto the page. */
export const DRAG_SECTION = 'application/x-mz-section'
export const DRAG_ELEMENT = 'application/x-mz-element'

/**
 * The page drawn by the same renderer as the site, at the device's width and scaled to fit.
 * Clicks select elements, a double click (or a click in Contenuto) edits text in place.
 */
export function Canvas({
  nodes,
  theme,
  device,
  zoom,
  mode,
  selected,
  selection = [],
  editing,
  playing,
  onSelect,
  onEdit,
  onCommitText,
  onPickImage,
  onFitZoom,
  onResize,
  onMove,
  onMoveMany,
  onPatch,
  onSelectMany,
  rulers = false,
  typeAhead,
  onDropNew,
  preview = false,
  data,
}: {
  nodes: PageNode[]
  theme: Theme
  device: Breakpoint
  zoom: 'fit' | number
  mode: Mode
  selected: string | null
  /** Every selected element (shift adds); `selected` is the last one picked. */
  selection?: string[]
  editing: string | null
  playing: number
  onSelect: (id: string | null, add?: boolean) => void
  onEdit: (id: string | null) => void
  onCommitText: (id: string, value: { runs?: Run[]; text?: string }) => void
  onPickImage: (id: string) => void
  onFitZoom: (z: number) => void
  /** Sizes changed with the handles. */
  onResize: (id: string, patch: Partial<NodeProps>) => void
  /** An element or section dragged to a new place. */
  onMove: (id: string, target: DropTarget) => void
  /** Several selected elements dragged together to a new place. */
  onMoveMany: (ids: string[], target: DropTarget) => void
  /** Changes to several elements in one step (free elements moved together). */
  onPatch: (patches: [string, Partial<NodeProps>][]) => void
  /** The elements inside a selection box. */
  onSelectMany: (ids: string[]) => void
  /** Rulers along the top and left edges, in page pixels. */
  rulers?: boolean
  /** Characters typed on a selected text before editing began, inserted once it starts. */
  typeAhead?: React.RefObject<string>
  /** A section or element dragged in from the library. */
  onDropNew: (item: { section?: string; element?: string }, target: DropTarget | null, sectionIndex: number) => void
  /** Interactive preview: the page behaves as on the site, nothing is selectable. */
  preview?: boolean
  /** Entries for lists bound to a collection. */
  data?: Record<string, BoundEntry[]>
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [boxes, setBoxes] = useState<{ sel: Box | null; hover: Box | null; others: Box[] }>({
    sel: null,
    hover: null,
    others: [],
  })
  const [guides, setGuides] = useState<Guide[]>([])
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  // Holding ⌥ shows the distances from the selection to the element under the pointer.
  const [measuring, setMeasuring] = useState(false)
  useEffect(() => {
    const on = (e: KeyboardEvent) => setMeasuring(e.altKey)
    const off = () => setMeasuring(false)
    window.addEventListener('keydown', on)
    window.addEventListener('keyup', on)
    window.addEventListener('blur', off)
    return () => {
      window.removeEventListener('keydown', on)
      window.removeEventListener('keyup', on)
      window.removeEventListener('blur', off)
    }
  }, [])
  const [height, setHeight] = useState(800)
  const [available, setAvailable] = useState(1000)
  const width = DEVICE_WIDTH[device]
  const fit = Math.max(0.2, Math.min(1, (available - 96) / width))
  const scale = zoom === 'fit' ? fit : zoom
  const editingRef = useRef(editing)
  editingRef.current = editing
  const [indicator, setIndicator] = useState<Indicator | null>(null)
  const [badge, setBadge] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => onFitZoom(Math.round(fit * 100) / 100), [fit, onFitZoom])

  const rendered = useMemo(
    () =>
      renderPage(nodes, theme, {
        editor: true,
        animations: preview ? 'site' : playing ? 'replay' : 'none',
        srcset: librarySrcset,
        data,
      }),
    [nodes, theme, playing, preview, data],
  )

  // The page is plain HTML from the renderer; while a text is being edited in place, it is left alone.
  useLayoutEffect(() => {
    if (!root.current || editingRef.current) return
    root.current.innerHTML = rendered.html
    // A fixed menu over the next section needs its height, known only once on the page.
    requestAnimationFrame(() => root.current && layoutSticky(root.current))
  }, [rendered.html])

  const measure = useCallback(() => {
    const host = stage.current
    const page = root.current
    if (!host || !page) return
    const base = host.getBoundingClientRect()
    const boxOf = (id: string | null): Box | null => {
      if (!id) return null
      const el = page.querySelector<HTMLElement>(`[data-mz-id="${CSS.escape(id)}"]`)
      if (!el || el.offsetParent === null) return null
      const r = el.getBoundingClientRect()
      return { id, x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height }
    }
    setBoxes({
      sel: boxOf(selected),
      hover: hover !== selected ? boxOf(hover) : null,
      others: selection.flatMap((id) => (id === selected ? [] : (boxOf(id) ?? []))),
    })
    setHeight(page.scrollHeight)
  }, [selected, hover, selection])

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-measure whenever the page or its scale changes
  useLayoutEffect(() => {
    measure()
    const t = setTimeout(measure, 120)
    return () => clearTimeout(t)
  }, [measure, rendered.html, rendered.css, scale, device])

  useEffect(() => {
    const page = root.current
    const el = scroller.current
    if (!page || !el) return
    const ro = new ResizeObserver(() => {
      setAvailable(el.clientWidth)
      measure()
    })
    ro.observe(page)
    ro.observe(el)
    // Images arrive after the HTML: their size moves everything below.
    const onLoad = () => measure()
    page.addEventListener('load', onLoad, true)
    return () => {
      ro.disconnect()
      page.removeEventListener('load', onLoad, true)
    }
  }, [measure])

  // Editing in place: the element itself becomes editable, its content is read back on the way out.
  // Only when editing starts or stops: the tree changes on commit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    const page = root.current
    if (!page || !editing) return
    const el = page.querySelector<HTMLElement>(`[data-mz-id="${CSS.escape(editing)}"]`)
    const info = findNode(nodes, editing)
    if (!el || !info) return
    const isButton = info.node.type === 'button'
    el.contentEditable = isButton ? 'plaintext-only' : 'true'
    el.spellcheck = true
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    // Typing on a selected text starts editing it: the letters go at the end, nothing is replaced.
    const seed = typeAhead?.current ?? ''
    if (mode === 'content' || seed) range.collapse(false)
    const sel = getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
    if (seed && typeAhead) {
      typeAhead.current = ''
      document.execCommand('insertText', false, seed)
    }

    const commit = () => {
      el.contentEditable = 'false'
      if (isButton) onCommitText(editing, { text: (el.textContent ?? '').replace(/\s+/g, ' ').trim() })
      else onCommitText(editing, { runs: domToRuns(el) })
      onEdit(null)
    }
    const onKey = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        el.blur()
      } else if (e.key === 'Enter' && e.shiftKey && !isButton) {
        e.preventDefault()
        document.execCommand('insertLineBreak')
      } else if ((e.metaKey || e.ctrlKey) && /^[biu]$/i.test(e.key) && isButton) e.preventDefault()
    }
    const onBlur = (e: FocusEvent) => {
      if ((e.relatedTarget as HTMLElement | null)?.closest?.('[data-mz-toolbar]')) return
      commit()
    }
    const onPaste = (e: ClipboardEvent) => {
      e.preventDefault()
      const text = e.clipboardData?.getData('text/plain') ?? ''
      document.execCommand('insertText', false, isButton ? text.replace(/\n/g, ' ') : text)
    }
    el.addEventListener('keydown', onKey)
    el.addEventListener('blur', onBlur)
    el.addEventListener('paste', onPaste)
    return () => {
      el.removeEventListener('keydown', onKey)
      el.removeEventListener('blur', onBlur)
      el.removeEventListener('paste', onPaste)
    }
  }, [editing])

  const idAt = (target: EventTarget | null) =>
    (target as HTMLElement | null)?.closest?.<HTMLElement>('[data-mz-id]')?.dataset.mzId ?? null

  const elOf = (id: string) => root.current?.querySelector<HTMLElement>(`[data-mz-id="${CSS.escape(id)}"]`) ?? null

  /**
   * Where a drop at (x, y) would land: sections go between sections; elements go next to the
   * element under the pointer, or into the frame under it, never at the top level.
   */
  const targetAt = (x: number, y: number, section: boolean, exclude: string[] = []) => {
    const page = root.current
    const host = stage.current
    if (!page || !host) return null
    const base = host.getBoundingClientRect()
    const rel = (r: DOMRect) => ({ x: r.left - base.left, y: r.top - base.top, w: r.width, h: r.height })
    const ex = exclude.flatMap((id) => elOf(id) ?? [])
    let el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-mz-id]') ?? null
    if (el && !page.contains(el)) el = null
    while (el && ex.some((x) => x.contains(el))) el = el.parentElement?.closest<HTMLElement>('[data-mz-id]') ?? null

    if (section) {
      const sections = [...page.querySelectorAll<HTMLElement>('.mz-page > [data-mz-id]')].filter((s) => !ex.includes(s))
      if (!sections.length) return null
      let ref = sections[sections.length - 1] as HTMLElement
      for (const s of sections) {
        const r = s.getBoundingClientRect()
        if (y < r.bottom) {
          ref = s
          break
        }
      }
      const r = ref.getBoundingClientRect()
      const where: DropTarget['where'] = y < r.top + r.height / 2 ? 'before' : 'after'
      const b = rel(r)
      return {
        target: { id: ref.dataset.mzId as string, where },
        box: { x: b.x, y: (where === 'before' ? b.y : b.y + b.h) - 2, w: b.w, h: 4, inside: false },
      }
    }

    if (!el) return null
    const info = findNode(nodes, el.dataset.mzId)
    if (!info) return null
    let container: PageNode | null
    let candidates: PageNode[]
    if (info.node.type === 'frame') {
      const kids = (info.node.children ?? []).filter((c) => !exclude.includes(c.id))
      if (!kids.length) {
        const b = rel(el.getBoundingClientRect())
        return { target: { id: info.node.id, where: 'inside' as const }, box: { ...b, inside: true } }
      }
      container = info.node
      candidates = kids
    } else {
      container = info.parent
      candidates = [info.node]
    }
    const axis = container?.layout === 'row' || container?.layout === 'grid' ? 'x' : 'y'
    let best: { n: PageNode; r: DOMRect; d: number } | null = null
    for (const n of candidates) {
      const r = elOf(n.id)?.getBoundingClientRect()
      if (!r) continue
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2))
      if (!best || d < best.d) best = { n, r, d }
    }
    if (!best) return null
    const { r } = best
    const before = axis === 'x' ? x < r.left + r.width / 2 : y < r.top + r.height / 2
    const b = rel(r)
    const box =
      axis === 'x'
        ? { x: (before ? b.x : b.x + b.w) - 2, y: b.y, w: 4, h: b.h, inside: false }
        : { x: b.x, y: (before ? b.y : b.y + b.h) - 2, w: b.w, h: 4, inside: false }
    return { target: { id: best.n.id, where: before ? ('before' as const) : ('after' as const) }, box }
  }

  /** Keeps the pointer's spot visible while dragging near the edges. */
  const autoScroll = (y: number) => {
    const el = scroller.current
    if (!el) return
    const r = el.getBoundingClientRect()
    if (y < r.top + 48) el.scrollTop -= 14
    else if (y > r.bottom - 48) el.scrollTop += 14
  }

  /**
   * A selection box: everything entirely inside it is selected (the outermost elements, not their
   * insides). It starts on the empty canvas, on a section's background, or anywhere with ⇧ (which
   * adds to the selection).
   */
  const startMarquee = (e: React.PointerEvent, additive: boolean) => {
    const host = stage.current
    const page = root.current
    if (!host || !page) return
    const b0 = host.getBoundingClientRect()
    const from = { x: e.clientX - b0.left, y: e.clientY - b0.top }
    const before = additive ? selection : []
    let active = false
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 5) return
        active = true
      }
      autoScroll(ev.clientY)
      const b = host.getBoundingClientRect()
      const to = { x: ev.clientX - b.left, y: ev.clientY - b.top }
      const box = {
        x: Math.min(from.x, to.x),
        y: Math.min(from.y, to.y),
        w: Math.abs(to.x - from.x),
        h: Math.abs(to.y - from.y),
      }
      setMarquee(box)
      const inside = [...page.querySelectorAll<HTMLElement>('[data-mz-id]')].filter((el) => {
        if (el.offsetParent === null) return false
        const r = el.getBoundingClientRect()
        const x = r.left - b.left
        const y = r.top - b.top
        return r.width > 0 && x >= box.x && y >= box.y && x + r.width <= box.x + box.w && y + r.height <= box.y + box.h
      })
      const outer = inside.filter((el) => !inside.some((o) => o !== el && o.contains(el)))
      const ids = outer.flatMap((el) => (el.dataset.mzId && findNode(nodes, el.dataset.mzId) ? [el.dataset.mzId] : []))
      onSelectMany([...before.filter((id) => !ids.includes(id)), ...ids])
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setMarquee(null)
      if (active) suppressClick.current = true
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Moving elements: press on an element (or on any of the selected ones) and drag; a short press
  // stays a click.
  const onPointerDown = (e: React.PointerEvent) => {
    if (preview || mode !== 'design' || editing || e.button !== 0 || e.metaKey || e.ctrlKey) return
    const under = idAt(e.target)
    if (!under) return
    const underInfo = findNode(nodes, under)
    // ⇧ or a section's own background (when it is not selected): a selection box.
    if (e.shiftKey || (underInfo?.depth === 0 && !selection.includes(under))) {
      startMarquee(e, e.shiftKey)
      return
    }
    // The selected element the press is in (the innermost), else the element under the pointer.
    const inSel = selection
      .filter((sid) => elOf(sid)?.contains(e.target as Node))
      .sort((a, b) => (elOf(a)?.contains(elOf(b)) ? 1 : -1))[0]
    const id = inSel ?? under
    // Dragging one of several selected elements moves all of them (not those inside another).
    const group =
      inSel && selection.length > 1
        ? selection.filter((sid) => !selection.some((o) => o !== sid && elOf(o)?.contains(elOf(sid) as Node)))
        : [id]
    const infos = group.flatMap((gid) => findNode(nodes, gid) ?? [])
    if (!infos.length) return
    const section = infos.every((f) => f.depth === 0)
    if (!section && infos.some((f) => f.depth === 0)) return
    const start = { x: e.clientX, y: e.clientY }
    // Freely placed elements move where they are dropped instead of changing order.
    const els = group.map((gid) => elOf(gid))
    const host = els[0]?.offsetParent as HTMLElement | null
    const free =
      !section &&
      infos.every((f) => resolveNode(f.node, device).pos === 'absolute') &&
      els.every((el) => el && el.offsetParent === host)
    if (free && host) {
      const items = (els as HTMLElement[]).map((el, i) => ({
        id: group[i] as string,
        el,
        left0: el.offsetLeft,
        top0: el.offsetTop,
      }))
      // The box around them all moves and snaps as one.
      const ux = Math.min(...items.map((it) => it.left0))
      const uy = Math.min(...items.map((it) => it.top0))
      const w = Math.max(...items.map((it) => it.left0 + it.el.offsetWidth)) - ux
      const h = Math.max(...items.map((it) => it.top0 + it.el.offsetHeight)) - uy
      // What it can snap to, in the container's pixels: its edges and center, and the edges and
      // centers of the other elements in it.
      const hostW = host.clientWidth
      const hostH = host.clientHeight
      const xs = [0, hostW / 2, hostW]
      const ys = [0, hostH / 2, hostH]
      for (const sib of [...host.children]) {
        if (!(sib instanceof HTMLElement) || items.some((it) => it.el === sib)) continue
        if (!sib.dataset.mzId || sib.offsetParent !== host) continue
        xs.push(sib.offsetLeft, sib.offsetLeft + sib.offsetWidth / 2, sib.offsetLeft + sib.offsetWidth)
        ys.push(sib.offsetTop, sib.offsetTop + sib.offsetHeight / 2, sib.offsetTop + sib.offsetHeight)
      }
      /** The nearest line to any of the given points: how far to move, and where the line is. */
      const snap = (points: number[], lines: number[]) => {
        let best: { d: number; at: number } | null = null
        for (const pt of points)
          for (const line of lines) {
            const d = line - pt
            if (Math.abs(d) <= SNAP / Math.min(1, scale) && (!best || Math.abs(d) < Math.abs(best.d)))
              best = { d, at: line }
          }
        return best
      }
      let moved = false
      let dx = 0
      let dy = 0
      const move = (ev: PointerEvent) => {
        dx = (ev.clientX - start.x) / scale
        dy = (ev.clientY - start.y) / scale
        if (!moved && Math.hypot(dx, dy) < 4) return
        moved = true
        const found: Guide[] = []
        // ⌘ or Ctrl: no snapping, for fine placement.
        if (!ev.metaKey && !ev.ctrlKey) {
          const left = ux + dx
          const top = uy + dy
          const sx = snap([left, left + w / 2, left + w], xs)
          const sy = snap([top, top + h / 2, top + h], ys)
          const base = stage.current?.getBoundingClientRect()
          const hr = host.getBoundingClientRect()
          const ox = base ? hr.left - base.left + host.clientLeft * scale : 0
          const oy = base ? hr.top - base.top + host.clientTop * scale : 0
          if (sx) {
            dx += sx.d
            found.push({ axis: 'x', at: ox + sx.at * scale, from: oy, to: oy + hostH * scale })
          }
          if (sy) {
            dy += sy.d
            found.push({ axis: 'y', at: oy + sy.at * scale, from: ox, to: ox + hostW * scale })
          }
        }
        dx = Math.round(dx)
        dy = Math.round(dy)
        setGuides(found)
        for (const it of items) {
          it.el.style.left = `${it.left0 + dx}px`
          it.el.style.top = `${it.top0 + dy}px`
          it.el.style.right = it.el.style.bottom = 'auto'
        }
        setBadge(`${ux + dx} , ${uy + dy}`)
        measure()
      }
      const up = () => {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        setGuides([])
        setBadge(null)
        if (!moved) return
        suppressClick.current = true
        for (const it of items) it.el.removeAttribute('style')
        if (items.length === 1) onSelect(id)
        onPatch(items.map((it) => [it.id, { left: it.left0 + dx, top: it.top0 + dy, right: null, bottom: null }]))
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      return
    }
    let active = false
    let last: { target: DropTarget } | null = null
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 5) return
        active = true
        setDragging(id)
        if (group.length === 1) onSelect(id)
      }
      autoScroll(ev.clientY)
      const t = targetAt(ev.clientX, ev.clientY, section, group)
      last = t
      setIndicator(t?.box ?? null)
    }
    const up = (ev?: Event) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (!active) return
      suppressClick.current = true
      if (ev?.type === 'pointercancel') last = null
      setDragging(null)
      setIndicator(null)
      if (!last) return
      if (group.length > 1) onMoveMany(group, last.target)
      else onMove(id, last.target)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // Resizing with the handles: the page follows live, the value is saved on release.
  const startResize = (handle: Handle, e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const id = selected
    const el = id ? elOf(id) : null
    const node = findNode(nodes, id)?.node
    if (!id || !el || !node) return
    const r = el.getBoundingClientRect()
    const parentW = (el.parentElement?.getBoundingClientRect().width ?? r.width) / scale
    const startW = r.width / scale
    const startH = r.height / scale
    const startPad = Number.parseFloat(getComputedStyle(el).paddingTop) || 0
    const sx = e.clientX
    const sy = e.clientY
    let patch: Partial<NodeProps> = {}
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / scale
      const dy = (ev.clientY - sy) / scale
      if (handle === 'section') {
        const pad = Math.max(8, startPad + dy / 2)
        el.style.paddingTop = el.style.paddingBottom = `${pad}px`
        const size = SECTION_SIZES.reduce((a, b) => (Math.abs(b[1] - pad) < Math.abs(a[1] - pad) ? b : a))[0]
        patch = { size }
        setBadge(`Spazio ${size.toUpperCase()}`)
      } else {
        let w = startW
        if (handle === 'right' || handle === 'corner') w = startW + dx
        if (handle === 'left') w = startW - dx
        w = Math.round(Math.max(24, Math.min(parentW, w)))
        let h = startH
        if (handle === 'bottom' || handle === 'corner') h = Math.round(Math.max(24, startH + dy))
        if (handle !== 'bottom') {
          el.style.width = `${w}px`
          el.style.flex = '0 0 auto'
          el.style.maxWidth = 'none'
          patch = w >= parentW - 1 ? { width: 'fill', maxW: null } : { width: 'fixed', fixedW: w, maxW: null }
        }
        if (node.type === 'image' && (handle === 'bottom' || handle === 'corner')) {
          const W = handle === 'bottom' ? Math.round(startW) : w
          const g = gcd(W, h) || 1
          el.style.aspectRatio = `${W} / ${h}`
          patch = { ...patch, ratio: `${W / g}/${h / g}` }
        }
        setBadge(`${handle === 'bottom' ? Math.round(startW) : w} × ${h}`)
      }
      measure()
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setBadge(null)
      el.removeAttribute('style')
      if (Object.keys(patch).length) onResize(id, patch)
      else measure()
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  // Dragging from the library's tiles onto the page.
  const dragKind = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(DRAG_SECTION)
      ? 'section'
      : e.dataTransfer.types.includes(DRAG_ELEMENT)
        ? 'element'
        : null
  const sectionIndexAt = (y: number) => {
    const sections = [...(root.current?.querySelectorAll<HTMLElement>('.mz-page > [data-mz-id]') ?? [])]
    const i = sections.findIndex((s) => {
      const r = s.getBoundingClientRect()
      return y < r.top + r.height / 2
    })
    return i < 0 ? sections.length : i
  }
  const onDragOver = (e: React.DragEvent) => {
    const kind = dragKind(e)
    if (!kind) return
    e.preventDefault()
    autoScroll(e.clientY)
    const t = targetAt(e.clientX, e.clientY, kind === 'section')
    setIndicator(t?.box ?? null)
  }
  const onDrop = (e: React.DragEvent) => {
    const kind = dragKind(e)
    if (!kind) return
    e.preventDefault()
    setIndicator(null)
    const t = targetAt(e.clientX, e.clientY, kind === 'section')
    onDropNew(
      kind === 'section'
        ? { section: e.dataTransfer.getData(DRAG_SECTION) }
        : { element: e.dataTransfer.getData(DRAG_ELEMENT) },
      t?.target ?? null,
      sectionIndexAt(e.clientY),
    )
  }

  // The timeline's playhead shows a moment of an animation on the element, without saving anything.
  useEffect(() => {
    const onScrub = (e: Event) => {
      const { id, style } = (e as CustomEvent<{ id: string; style: Record<string, string> | null }>).detail
      const el = root.current?.querySelector<HTMLElement>(`[data-mz-id="${CSS.escape(id)}"]`)
      if (!el) return
      for (const k of ['transform', 'opacity', 'filter', 'clipPath'] as const)
        el.style[k] = style ? (style[k] ?? '') : ''
      measure()
    }
    window.addEventListener('mz-scrub', onScrub)
    return () => window.removeEventListener('mz-scrub', onScrub)
  }, [measure])

  // WebGL scenes run on the canvas while editing too, so their look can be tuned live.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart after every render of the page
  useEffect(() => {
    if (!root.current || !scroller.current) return
    return startScenes(root.current, { scroller: scroller.current })
  }, [rendered.html])

  // In the preview, the motion runtime plays scroll, mouse and click interactions on the canvas itself.
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart after every render of the page
  useEffect(() => {
    if (!preview || !root.current || !scroller.current) return
    const stop = startMotion(root.current, { scroller: scroller.current })
    return stop
  }, [preview, rendered.html])

  const onClick = (e: React.MouseEvent) => {
    if (preview) {
      if ((e.target as HTMLElement).closest('a')) e.preventDefault()
      return
    }
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    // Links inside the page never navigate while editing.
    if ((e.target as HTMLElement).closest('a')) e.preventDefault()
    const id = idAt(e.target)
    if (editing && id === editing) return
    if (!id) {
      onSelect(null)
      return
    }
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      onSelect(id, true)
      return
    }
    onSelect(id)
    if (mode === 'content') {
      const node = findNode(nodes, id)?.node
      if (node?.type === 'text' || node?.type === 'button') onEdit(id)
      else if (node?.type === 'image') onPickImage(id)
    }
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    const id = idAt(e.target)
    const node = findNode(nodes, id)?.node
    if (!id || !node) return
    if (node.type === 'text' || node.type === 'button') onEdit(id)
    if (node.type === 'image') onPickImage(id)
  }

  const selectedNode = findNode(nodes, selected)?.node
  const hoverNode = boxes.hover ? findNode(nodes, boxes.hover.id)?.node : null
  const chip =
    boxes.sel && selectedNode
      ? selection.length > 1
        ? `${selection.length} elementi`
        : selectedNode.name || typeLabel(selectedNode)
      : null

  /** The empty canvas around the page: a click clears the selection, a drag draws a selection box. */
  const isBackground = (e: React.SyntheticEvent) =>
    e.target === e.currentTarget || (e.target as HTMLElement).dataset.mzBg !== undefined

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {rulers && !preview && (
        <Rulers scroller={scroller} stage={stage} scale={scale} marks={[boxes.sel, ...boxes.others]} />
      )}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: clicking the empty canvas clears the selection */}
      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto bg-canvas bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:18px_18px]"
        onClick={(e) => {
          if (suppressClick.current) {
            suppressClick.current = false
            return
          }
          if (isBackground(e)) onSelect(null)
        }}
        onPointerDown={(e) => {
          if (!preview && mode === 'design' && e.button === 0 && isBackground(e)) startMarquee(e, e.shiftKey)
        }}
        onKeyDown={undefined}
        role="presentation"
      >
        <div
          data-mz-bg
          className={cx('flex min-h-full flex-col items-center px-12 pb-24', rulers && !preview ? 'pt-10' : 'pt-8')}
        >
          <div className="mb-2 flex w-full items-center gap-2 text-[11.5px] text-fg3" style={{ width: width * scale }}>
            <span className="font-medium text-fg2">{DEVICE_LABEL[device]}</span>
            <span className="font-mono">{width} px</span>
            <span className="ml-auto font-mono">{Math.round(scale * 100)}%</span>
          </div>
          <div ref={stage} className="relative" style={{ width: width * scale, height: height * scale }}>
            <div
              className="absolute top-0 left-0 overflow-hidden shadow-[0_0_0_1px_rgb(10_10_11/0.06),0_12px_32px_rgb(10_10_11/0.08)]"
              style={{ width, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            >
              <style>{rendered.css}</style>
              <style>{`[data-mz-id]{cursor:${mode === 'design' ? 'default' : 'text'}}[data-mz-type=image],[data-mz-type=frame]{cursor:${mode === 'design' ? 'default' : 'pointer'}}[contenteditable=true],[contenteditable=plaintext-only]{outline:none;cursor:text;user-select:text}`}</style>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard selection happens in the layers */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: the page is a canvas to point at */}
              <div
                ref={root}
                data-mz-canvas
                className={cx(mode === 'design' && 'select-none')}
                onClick={onClick}
                onDoubleClick={onDoubleClick}
                onPointerMove={(e) => {
                  if (preview) return
                  const id = idAt(e.target)
                  if (id !== hover) setHover(id)
                }}
                onPointerLeave={() => setHover(null)}
                onPointerDown={onPointerDown}
                onDragStart={(e) => e.preventDefault()}
                onDragOver={onDragOver}
                onDragLeave={(e) => e.currentTarget === e.target && setIndicator(null)}
                onDrop={onDrop}
              />
            </div>

            {/* Selection and hover, drawn above the page in screen pixels. */}
            <div className={cx('pointer-events-none absolute inset-0', preview && 'hidden')}>
              {boxes.hover && (
                <div
                  className="absolute rounded-[2px] border border-accent/70"
                  style={{ left: boxes.hover.x, top: boxes.hover.y, width: boxes.hover.w, height: boxes.hover.h }}
                />
              )}
              {/* What a click would select, named before clicking (small texts sit close together). */}
              {boxes.hover && hoverNode && !dragging && !measuring && mode === 'design' && (
                <div
                  className="absolute rounded-[3px] bg-accent/85 px-1 font-mono text-[10px] whitespace-nowrap text-white"
                  style={{ left: boxes.hover.x, top: boxes.hover.y + boxes.hover.h + 2 }}
                >
                  {hoverNode.name || typeLabel(hoverNode)}
                </div>
              )}
              {boxes.others.map((b) => (
                <div
                  key={b.id}
                  className="absolute rounded-[2px] border-2 border-accent"
                  style={{ left: b.x - 1, top: b.y - 1, width: b.w + 2, height: b.h + 2 }}
                />
              ))}
              {guides.map((g) => (
                <div
                  key={`${g.axis}${g.at}`}
                  className="absolute bg-[#f43f5e]"
                  style={
                    g.axis === 'x'
                      ? { left: g.at - 0.5, top: g.from, width: 1, height: g.to - g.from }
                      : { top: g.at - 0.5, left: g.from, height: 1, width: g.to - g.from }
                  }
                />
              ))}
              {measuring &&
                boxes.sel &&
                boxes.hover &&
                gapsBetween(boxes.sel, boxes.hover, scale).map((g) => (
                  <div key={`${g.x1},${g.y1},${g.x2},${g.y2}`}>
                    <div
                      className="absolute bg-[#f43f5e]"
                      style={{
                        left: Math.min(g.x1, g.x2),
                        top: Math.min(g.y1, g.y2),
                        width: Math.max(1, Math.abs(g.x2 - g.x1)),
                        height: Math.max(1, Math.abs(g.y2 - g.y1)),
                      }}
                    />
                    <span
                      className="absolute -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-[#f43f5e] px-1 font-mono text-[10.5px] text-white"
                      style={{ left: (g.x1 + g.x2) / 2, top: (g.y1 + g.y2) / 2 }}
                    >
                      {g.label}
                    </span>
                  </div>
                ))}
              {boxes.sel && (
                <>
                  <div
                    className={cx(
                      'absolute rounded-[2px] border-2',
                      editing === boxes.sel.id ? 'border-accent/60' : 'border-accent',
                    )}
                    style={{
                      left: boxes.sel.x - 1,
                      top: boxes.sel.y - 1,
                      width: boxes.sel.w + 2,
                      height: boxes.sel.h + 2,
                    }}
                  />
                  {chip && !editing && !measuring && (
                    <div
                      className="absolute rounded-[4px] bg-accent px-1.5 py-px font-mono text-[11px] whitespace-nowrap text-white"
                      style={{ left: boxes.sel.x - 1, top: Math.max(0, boxes.sel.y - 20) }}
                    >
                      {chip}
                    </div>
                  )}
                </>
              )}
            </div>

            {indicator && (
              <div
                className={cx(
                  'pointer-events-none absolute rounded-full',
                  indicator.inside
                    ? 'rounded-[3px] border-2 border-dashed border-accent bg-accent/8'
                    : 'bg-accent shadow-[0_0_0_2px_white]',
                )}
                style={{ left: indicator.x, top: indicator.y, width: indicator.w, height: indicator.h }}
              />
            )}
            {mode === 'design' &&
              !preview &&
              boxes.sel &&
              !editing &&
              !dragging &&
              selectedNode &&
              selection.length < 2 && (
                <Handles
                  box={boxes.sel}
                  node={selectedNode}
                  section={findNode(nodes, selected)?.depth === 0}
                  onStart={startResize}
                />
              )}
            {badge && boxes.sel && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 rounded-[4px] bg-accent px-1.5 py-px font-mono text-[11px] whitespace-nowrap text-white"
                style={{ left: boxes.sel.x + boxes.sel.w / 2, top: boxes.sel.y + boxes.sel.h + 8 }}
              >
                {badge}
              </div>
            )}
            {editing && boxes.sel && selectedNode?.type === 'text' && <FormatBar x={boxes.sel.x} y={boxes.sel.y} />}
            {mode === 'content' && boxes.hover && findNode(nodes, boxes.hover.id)?.node.type === 'image' && (
              <div
                className="pointer-events-none absolute flex items-center justify-center"
                style={{ left: boxes.hover.x, top: boxes.hover.y, width: boxes.hover.w, height: boxes.hover.h }}
              >
                <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[12px] font-medium text-white">
                  <ImagePlus className="size-3.5" /> Cambia immagine
                </span>
              </div>
            )}
            {marquee && (
              <div
                className="pointer-events-none absolute rounded-[2px] border border-accent bg-accent/10"
                style={{ left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Steps between labelled ticks, in page pixels: the first that leaves room for a label. */
const RULER_STEPS = [5, 10, 25, 50, 100, 250, 500, 1000]

/**
 * Rulers in page pixels along the top and the left of the canvas, following scroll and zoom; the
 * selection shows as a band on both.
 */
function Rulers({
  scroller,
  stage,
  scale,
  marks,
}: {
  scroller: React.RefObject<HTMLDivElement | null>
  stage: React.RefObject<HTMLDivElement | null>
  scale: number
  marks: (Box | null)[]
}) {
  const top = useRef<HTMLCanvasElement>(null)
  const left = useRef<HTMLCanvasElement>(null)

  const draw = useCallback(() => {
    const host = stage.current
    if (!host) return
    const s = host.getBoundingClientRect()
    const step = RULER_STEPS.find((st) => st * scale >= 56) ?? 1000
    const minor = step / 5
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#3d5afe'
    for (const [canvas, horizontal] of [
      [top.current, true],
      [left.current, false],
    ] as const) {
      if (!canvas) continue
      const r = canvas.getBoundingClientRect()
      const dpr = devicePixelRatio || 1
      const length = horizontal ? r.width : r.height
      canvas.width = Math.round(r.width * dpr)
      canvas.height = Math.round(r.height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) continue
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, r.width, r.height)
      // Where page pixel 0 falls on this ruler.
      const origin = horizontal ? s.left - r.left : s.top - r.top
      ctx.fillStyle = `color-mix(in srgb, ${accent} 22%, transparent)`
      for (const m of marks) {
        if (!m) continue
        if (horizontal) ctx.fillRect(origin + m.x, 0, m.w, 20)
        else ctx.fillRect(0, origin + m.y, 20, m.h)
      }
      const color = getComputedStyle(canvas).color
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.lineWidth = 1
      const first = Math.floor(-origin / scale / minor) * minor
      const last = (length - origin) / scale
      ctx.beginPath()
      for (let v = first; v <= last; v += minor) {
        const at = Math.round(origin + v * scale) + 0.5
        const major = Math.abs(v % step) < 0.001
        const tick = major ? 20 : 5
        if (horizontal) {
          ctx.moveTo(at, 20 - tick)
          ctx.lineTo(at, 20)
        } else {
          ctx.moveTo(20 - tick, at)
          ctx.lineTo(20, at)
        }
        if (major) {
          if (horizontal) ctx.fillText(String(Math.round(v)), at + 3, 9)
          else {
            ctx.save()
            ctx.translate(9, at - 3)
            ctx.rotate(-Math.PI / 2)
            ctx.fillText(String(Math.round(v)), 0, 0)
            ctx.restore()
          }
        }
      }
      ctx.stroke()
    }
  }, [stage, scale, marks])

  useEffect(() => {
    draw()
    const el = scroller.current
    el?.addEventListener('scroll', draw, { passive: true })
    const ro = new ResizeObserver(draw)
    if (el) ro.observe(el)
    if (stage.current) ro.observe(stage.current)
    return () => {
      el?.removeEventListener('scroll', draw)
      ro.disconnect()
    }
  }, [draw, scroller, stage])

  return (
    <>
      <canvas
        ref={top}
        className="pointer-events-none absolute top-0 left-5 z-10 h-5 w-[calc(100%-20px)] border-b border-line bg-panel text-fg3"
      />
      <canvas
        ref={left}
        className="pointer-events-none absolute top-5 left-0 z-10 h-[calc(100%-20px)] w-5 border-r border-line bg-panel text-fg3"
      />
      <div className="pointer-events-none absolute top-0 left-0 z-10 size-5 border-r border-b border-line bg-panel" />
    </>
  )
}

/** Square handles on the selection: sides change the width, the bottom an image's proportions or a section's height. */
function Handles({
  box,
  node,
  section,
  onStart,
}: {
  box: Box
  node: PageNode
  section: boolean
  onStart: (handle: Handle, e: React.PointerEvent) => void
}) {
  // A 9 px square inside a 20 px target, easy to grab.
  const dot =
    'absolute flex size-5 items-center justify-center touch-none [&>i]:size-[9px] [&>i]:rounded-[2px] [&>i]:border-[1.5px] [&>i]:border-accent [&>i]:bg-white [&>i]:shadow-[0_1px_3px_rgba(0,0,0,.25)] [&>i]:transition-transform hover:[&>i]:scale-125'
  const list: { h: Handle; x: number; y: number; cursor: string; title: string }[] = []
  if (section)
    list.push({
      h: 'section',
      x: box.x + box.w / 2,
      y: box.y + box.h,
      cursor: 'ns-resize',
      title: 'Trascina per cambiare lo spazio della sezione',
    })
  else {
    list.push(
      { h: 'left', x: box.x, y: box.y + box.h / 2, cursor: 'ew-resize', title: 'Trascina per cambiare la larghezza' },
      {
        h: 'right',
        x: box.x + box.w,
        y: box.y + box.h / 2,
        cursor: 'ew-resize',
        title: 'Trascina per cambiare la larghezza',
      },
    )
    if (node.type === 'image')
      list.push(
        {
          h: 'bottom',
          x: box.x + box.w / 2,
          y: box.y + box.h,
          cursor: 'ns-resize',
          title: 'Trascina per cambiare le proporzioni',
        },
        {
          h: 'corner',
          x: box.x + box.w,
          y: box.y + box.h,
          cursor: 'nwse-resize',
          title: 'Trascina per cambiare dimensioni e proporzioni',
        },
      )
  }
  return (
    <>
      {list.map((d) => (
        <span
          key={d.h}
          role="presentation"
          title={d.title}
          onPointerDown={(e) => onStart(d.h, e)}
          className={dot}
          style={{ left: d.x - 10, top: d.y - 10, cursor: d.cursor }}
        >
          <i />
        </span>
      ))}
    </>
  )
}

export function typeLabel(n: PageNode): string {
  if (n.type === 'frame') return 'Contenitore'
  if (n.type === 'text') return 'Testo'
  if (n.type === 'image') return 'Immagine'
  if (n.type === 'video') return 'Video'
  if (n.type === 'embed') return 'Codice'
  if (n.type === 'scene') return 'Scena WebGL'
  return 'Pulsante'
}

/** Bold, italic and links for the text being edited; buttons keep the focus in the text. */
function FormatBar({ x, y }: { x: number; y: number }) {
  const [, force] = useState(0)
  const [link, setLink] = useState<string | null>(null)
  const saved = useRef<Range | null>(null)

  useEffect(() => {
    const onChange = () => force((n) => n + 1)
    document.addEventListener('selectionchange', onChange)
    return () => document.removeEventListener('selectionchange', onChange)
  }, [])

  const state = (cmd: string) => {
    try {
      return document.queryCommandState(cmd)
    } catch {
      return false
    }
  }
  const inLink = !!getSelection()?.anchorNode?.parentElement?.closest('a')
  const btn = (on: boolean) =>
    cx(
      'flex size-7 items-center justify-center rounded-md [&_svg]:size-3.5',
      on ? 'bg-accent text-white' : 'text-[#ededef] hover:bg-white/12',
    )
  const keep = (e: React.MouseEvent) => e.preventDefault()
  /** Back into the text being edited, with the selection it had. */
  const restore = () => {
    const range = saved.current
    const host = range?.startContainer.parentElement?.closest<HTMLElement>('[contenteditable]')
    host?.focus()
    if (range) {
      const s = getSelection()
      s?.removeAllRanges()
      s?.addRange(range)
    }
  }

  return (
    <div
      data-mz-toolbar
      className="absolute z-10 flex items-center gap-0.5 rounded-lg bg-[#121214] p-1 shadow-pop"
      style={{ left: x, top: Math.max(0, y - 44) }}
    >
      {link === null ? (
        <>
          <button
            type="button"
            title="Grassetto · ⌘B"
            aria-label="Grassetto"
            onMouseDown={keep}
            onClick={() => document.execCommand('bold')}
            className={btn(state('bold'))}
          >
            <Bold />
          </button>
          <button
            type="button"
            title="Corsivo · ⌘I"
            aria-label="Corsivo"
            onMouseDown={keep}
            onClick={() => document.execCommand('italic')}
            className={btn(state('italic'))}
          >
            <Italic />
          </button>
          {inLink ? (
            <button
              type="button"
              title="Rimuovi collegamento"
              aria-label="Rimuovi collegamento"
              onMouseDown={keep}
              onClick={() => document.execCommand('unlink')}
              className={btn(true)}
            >
              <Link2Off />
            </button>
          ) : (
            <button
              type="button"
              title="Collegamento · ⌘K"
              aria-label="Collegamento"
              onMouseDown={keep}
              onClick={() => {
                const s = getSelection()
                saved.current = s?.rangeCount ? s.getRangeAt(0).cloneRange() : null
                setLink('')
              }}
              className={btn(false)}
            >
              <Link2 />
            </button>
          )}
        </>
      ) : (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            restore()
            if (link.trim()) document.execCommand('createLink', false, link.trim())
            setLink(null)
          }}
        >
          <input
            autoFocus
            aria-label="Indirizzo del collegamento"
            placeholder="/contatti o https://…"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setLink(null)
                restore()
              }
            }}
            onBlur={(e) => {
              if ((e.relatedTarget as HTMLElement | null)?.closest?.('[data-mz-toolbar]')) return
              setLink(null)
              restore()
            }}
            className="h-7 w-48 rounded-md bg-white/10 px-2 font-mono text-[12px] text-white outline-none placeholder:text-white/50"
          />
        </form>
      )}
    </div>
  )
}
