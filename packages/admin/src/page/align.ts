import { type Breakpoint, findNode, type NodeProps, type PageNode, resolveNode } from '@materializecms/core/page'

export type AlignHow = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom' | 'hdist' | 'vdist'
type Patch = [string, Partial<NodeProps>]
type Result = { patches: Patch[] } | { error: string }

/** An element as drawn on the canvas (unscaled page pixels come from its offsets). */
const elOf = (id: string) => document.querySelector<HTMLElement>(`[data-mz-canvas] [data-mz-id="${CSS.escape(id)}"]`)

/**
 * The changes that line up the selection. Freely placed elements move to the edge or center of
 * their container (one) or of the selection (several); elements in a column, row or grid are lined
 * up by their container, as in a stack; full-width texts align their words instead.
 */
export function alignPatches(how: AlignHow, ids: string[], nodes: PageNode[], device: Breakpoint): Result {
  const found = ids.flatMap((id) => {
    const f = findNode(nodes, id)
    return f ? [f] : []
  })
  const first = found[0]
  if (!first) return { error: 'Seleziona un elemento da allineare' }
  if (found.some((f) => f.depth === 0))
    return { error: 'Le sezioni occupano tutta la pagina: seleziona gli elementi al loro interno' }
  const horizontal = how === 'left' || how === 'hcenter' || how === 'right' || how === 'hdist'
  const free = found.map((f) => resolveNode(f.node, device).pos === 'absolute')
  if (free.every(Boolean))
    return freePatches(
      how,
      found.map((f) => f.node.id),
      horizontal,
    )
  if (free.some(Boolean))
    return { error: 'Allinea insieme solo elementi liberi, oppure solo elementi in colonna o in riga' }

  const parent = first.parent
  if (!parent || found.some((f) => f.parent?.id !== parent.id))
    return { error: 'Per allineare, seleziona elementi dello stesso contenitore' }
  const layout = resolveNode(parent, device).layout ?? 'col'

  if (how === 'hdist' || how === 'vdist') {
    if (layout === 'grid') return { error: 'In una griglia gli spazi li danno le colonne' }
    if ((how === 'hdist') !== (layout === 'row'))
      return {
        error:
          layout === 'row'
            ? 'Il contenitore è in riga: distribuisci in orizzontale'
            : 'Il contenitore è in colonna: distribuisci in verticale',
      }
    return { patches: [[parent.id, { justify: 'between' }]] }
  }

  const pos = how === 'left' || how === 'top' ? 'start' : how === 'right' || how === 'bottom' ? 'end' : 'center'
  // Texts as wide as their container: what moves is the words.
  if (
    horizontal &&
    found.every((f) => f.node.type === 'text' && (resolveNode(f.node, device).width ?? 'fill') === 'fill')
  ) {
    const talign = pos === 'start' ? 'left' : pos === 'end' ? 'right' : 'center'
    return { patches: found.map((f) => [f.node.id, { talign }] as Patch) }
  }
  if (layout === 'grid') {
    if (horizontal) return { error: 'In una griglia ogni elemento riempie la sua colonna: allinea in verticale' }
    return { patches: [[parent.id, { align: pos }]] }
  }
  // In a column the cross axis is horizontal; in a row, vertical.
  const cross = horizontal === (layout === 'col')
  return { patches: [[parent.id, cross ? { align: pos } : { justify: pos }]] }
}

function freePatches(how: AlignHow, ids: string[], horizontal: boolean): Result {
  const boxes = ids.map((id) => {
    const el = elOf(id)
    return el
      ? { id, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, parent: el.offsetParent }
      : null
  })
  if (boxes.some((b) => !b)) return { error: 'Un elemento non è visibile su questo dispositivo' }
  const list = boxes as NonNullable<(typeof boxes)[number]>[]
  const host = list[0]?.parent as HTMLElement | null
  if (!host) return { error: 'Un elemento non è visibile su questo dispositivo' }
  if (list.some((b) => b.parent !== host))
    return { error: 'Per allineare, seleziona elementi dello stesso contenitore' }

  // One element: its container. Several: the box around them.
  const ref =
    list.length === 1
      ? { x: 0, y: 0, w: host.clientWidth, h: host.clientHeight }
      : (() => {
          const x = Math.min(...list.map((b) => b.x))
          const y = Math.min(...list.map((b) => b.y))
          return {
            x,
            y,
            w: Math.max(...list.map((b) => b.x + b.w)) - x,
            h: Math.max(...list.map((b) => b.y + b.h)) - y,
          }
        })()
  const place = (id: string, v: number): Patch =>
    horizontal ? [id, { left: Math.round(v), right: null }] : [id, { top: Math.round(v), bottom: null }]

  if (how === 'hdist' || how === 'vdist') {
    if (list.length < 3) return { error: 'Per distribuire servono almeno tre elementi' }
    const start = (b: (typeof list)[number]) => (horizontal ? b.x : b.y)
    const size = (b: (typeof list)[number]) => (horizontal ? b.w : b.h)
    const sorted = [...list].sort((a, b) => start(a) - start(b))
    const space = (horizontal ? ref.w : ref.h) - sorted.reduce((s, b) => s + size(b), 0)
    const gap = space / (sorted.length - 1)
    let at = horizontal ? ref.x : ref.y
    return {
      patches: sorted.map((b) => {
        const patch = place(b.id, at)
        at += size(b) + gap
        return patch
      }),
    }
  }
  return {
    patches: list.map((b) => {
      if (how === 'left') return place(b.id, ref.x)
      if (how === 'right') return place(b.id, ref.x + ref.w - b.w)
      if (how === 'hcenter') return place(b.id, ref.x + (ref.w - b.w) / 2)
      if (how === 'top') return place(b.id, ref.y)
      if (how === 'bottom') return place(b.id, ref.y + ref.h - b.h)
      return place(b.id, ref.y + (ref.h - b.h) / 2)
    }),
  }
}
