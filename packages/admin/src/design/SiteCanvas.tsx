import { Loader2, TriangleAlert } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Data } from '../lib/api.ts'
import { EMBED_FRAME, writeFrame } from '../lib/frames.ts'

/**
 * The page rendered by the site itself (its layout and block components), inside an iframe.
 * Edits are sent to /_materialize/preview and only the blocks whose HTML changed are swapped,
 * so the canvas keeps its scroll position and images do not flash.
 */
export interface SiteCanvasProps {
  collection: string
  locale: string
  data: Data
  width: number
  selected: string | null
  errors: Set<string>
  labels: Record<string, string>
  onSelect: (key: string | null) => void
  onField: (blockKey: string, field: string, text: string) => void
  /** Reorders blocks dragged on the canvas. */
  onMove: (from: number, to: number) => void
  /** Plays the selected block's entrance animation again. */
  replay?: { key: string; n: number } | null
}

const EDITOR_CSS = `
[data-mz-block]{position:relative}
[data-mz-block]:hover{outline:2px solid rgb(61 90 254 / .45);outline-offset:-2px}
[data-mz-block][data-mz-error]{outline:2px solid rgb(196 50 10 / .7);outline-offset:-2px}
[data-mz-block][data-mz-selected]{outline:2px solid #3d5afe;outline-offset:-2px}
[data-mz-block][data-mz-selected]::before,[data-mz-block][data-mz-error]::before{content:attr(data-mz-label);position:absolute;z-index:2147483647;top:0;left:0;padding:4px 8px;background:#3d5afe;color:#fff;font:500 11px/1 system-ui,sans-serif;border-bottom-right-radius:6px;pointer-events:none}
[data-mz-block][data-mz-error]::before{background:#c4320a}
[data-mz-selected] [data-mz-field]{cursor:text}
[data-mz-selected] [data-mz-field]:hover{outline:1px dashed currentColor;outline-offset:4px}
[data-mz-field][contenteditable]{outline:2px solid #3d5afe!important;outline-offset:4px;border-radius:2px;cursor:text}
.reveal{animation:none!important}
[data-mz-handle]{position:absolute;top:8px;right:8px;z-index:2147483647;display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:7px;background:#3d5afe;color:#fff;font:500 11.5px/1 system-ui,sans-serif;cursor:grab;user-select:none;box-shadow:0 2px 10px rgb(0 0 0 / .25)}
[data-mz-handle]:active{cursor:grabbing}
[data-mz-dragging]{opacity:.35}
[data-mz-drop]{position:absolute;left:0;right:0;height:4px;margin-top:-2px;background:#3d5afe;border-radius:2px;z-index:2147483647;pointer-events:none;box-shadow:0 0 0 3px rgb(61 90 254 / .25)}
html.mz-drag,html.mz-drag *{cursor:grabbing!important;user-select:none!important}
`

const REPLAY: Record<string, Keyframe> = {
  fade: { opacity: 0 },
  rise: { opacity: 0, transform: 'translateY(48px)' },
  zoom: { opacity: 0, transform: 'scale(.94)' },
  slide: { opacity: 0, transform: 'translateX(-56px)' },
}

export function SiteCanvas(props: SiteCanvasProps) {
  const { collection, locale, data, width, selected, errors, labels, onSelect, onField, onMove, replay } = props
  const frame = useRef<HTMLIFrameElement>(null)
  const outer = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ scale: 1, height: 800 })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Latest callbacks for listeners attached inside the iframe.
  const handlers = useRef({ onSelect, onField, onMove, selected, errors, labels })
  handlers.current = { onSelect, onField, onMove, selected, errors, labels }
  const state = useRef({
    html: '',
    loaded: false,
    pending: null as string | null,
    blocks: new Map<string, string>(),
    // The click that ends a drag must not change the selection.
    dragged: false,
  })

  // Fit the device width into the available space; the frame height acts as the device viewport.
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const fit = () => {
      const scale = Math.min(1, (el.clientWidth - 64) / width)
      setSize({ scale, height: Math.max(400, (el.clientHeight - 48) / scale) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])

  const input = useRef({ collection, locale, data })
  input.current = { collection, locale, data }
  const request = useRef<AbortController | null>(null)

  /** Asks the site to render the latest editor data, then shows it. */
  async function render() {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    try {
      const res = await fetch('/_materialize/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input.current),
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(res.status === 401 ? 'Sessione scaduta' : `Errore ${res.status} dal sito`)
      const html = await res.text()
      setError(null)
      apply(html)
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError((err as Error).message)
    }
  }

  // Render on every change, debounced while typing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: render() reads the inputs from a ref
  useEffect(() => {
    const t = setTimeout(render, state.current.loaded ? 180 : 0)
    return () => clearTimeout(t)
  }, [collection, locale, data])

  useEffect(() => () => request.current?.abort(), [])

  function apply(html: string) {
    const s = state.current
    const iframe = frame.current
    if (!iframe) return
    const doc = iframe.contentDocument
    if (!s.loaded || !doc?.body) {
      s.html = html
      // Written into the empty frame page once it is there (see onLoad).
      if (doc?.documentElement.hasAttribute('data-mz-blank')) writeFrame(doc, html)
      return
    }
    // Keep the text someone is typing on the canvas: finish the swap when they leave the field.
    const editing = doc.activeElement?.closest('[data-mz-block]')
    s.pending = editing ? html : null
    patch(doc, html, editing?.getAttribute('data-mz-block') ?? null)
  }

  function patch(doc: Document, html: string, skip: string | null) {
    const s = state.current
    const next = new DOMParser().parseFromString(html, 'text/html')
    // New block types bring their styles with them.
    for (const el of next.head.querySelectorAll('style, link[rel="stylesheet"]')) {
      const key = el.outerHTML
      if (![...doc.head.querySelectorAll('style, link[rel="stylesheet"]')].some((x) => x.outerHTML === key)) {
        doc.head.append(doc.importNode(el, true))
      }
    }
    const incoming = [...next.querySelectorAll<HTMLElement>('[data-mz-block]')]
    const current = new Map(
      [...doc.querySelectorAll<HTMLElement>('[data-mz-block]')].map((el) => [el.dataset.mzBlock, el]),
    )
    const anchorParent = doc.querySelector('[data-mz-block]')?.parentElement ?? doc.querySelector('main')
    if (!anchorParent) {
      doc.body.innerHTML = next.body.innerHTML
      return decorate()
    }
    // Insert, replace and reorder blocks to match the new render.
    let previous: Element | null = null
    for (const el of incoming) {
      const key = el.dataset.mzBlock as string
      const markup = el.outerHTML
      let node = current.get(key)
      if (!node) {
        node = doc.importNode(el, true)
      } else if (key !== skip && s.blocks.get(key) !== markup) {
        const fresh = doc.importNode(el, true)
        node.replaceWith(fresh)
        node = fresh
      }
      s.blocks.set(key, markup)
      current.delete(key)
      const expected: ChildNode | null = previous ? previous.nextSibling : anchorParent.firstChild
      if (node !== expected) anchorParent.insertBefore(node, expected)
      previous = node
    }
    for (const [, el] of current) el.remove()
    decorate()
  }

  // Selection, errors and labels live on the block wrappers inside the iframe.
  function decorate() {
    const doc = frame.current?.contentDocument
    if (!doc) return
    const { selected, errors, labels } = handlers.current
    for (const el of doc.querySelectorAll<HTMLElement>('[data-mz-block]')) {
      const key = el.dataset.mzBlock as string
      el.toggleAttribute('data-mz-selected', key === selected)
      el.toggleAttribute('data-mz-error', errors.has(key) && key !== selected)
      el.dataset.mzLabel = labels[key] ?? el.dataset.mzType ?? ''
      // A handle on the selected block lets it be dragged to a new position.
      const handle = el.querySelector(':scope > [data-mz-handle]')
      if (key === selected && !handle) {
        const h = doc.createElement('div')
        h.dataset.mzHandle = ''
        h.textContent = '⠿ Trascina per spostare'
        el.append(h)
      } else if (key !== selected) handle?.remove()
    }
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: decorate reads the latest props
  useEffect(decorate, [selected, errors, labels])

  // Plays the block's entrance once more, the same motion the site runs on scroll (blocks.css).
  useEffect(() => {
    const doc = frame.current?.contentDocument
    const el = replay ? doc?.querySelector<HTMLElement>(`[data-mz-block="${replay.key}"]`) : null
    const from = REPLAY[el?.dataset.anim ?? '']
    if (!el || !from) return
    for (const child of el.children) {
      if (child.hasAttribute('data-mz-handle')) continue
      child.animate([from, { opacity: 1, transform: 'none' }], { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)' })
    }
  }, [replay])

  // Scroll the selected block into view inside the device viewport.
  useEffect(() => {
    const doc = frame.current?.contentDocument
    const el = selected ? doc?.querySelector(`[data-mz-block="${selected}"]`) : null
    if (!el || !doc?.defaultView) return
    const r = el.getBoundingClientRect()
    const vh = doc.defaultView.innerHeight
    if (r.bottom < 80 || r.top > vh - 80) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected])

  function onLoad() {
    const iframe = frame.current
    const doc = iframe?.contentDocument
    if (!doc) return
    const s = state.current
    // The empty frame page: the render goes in when it has arrived (also after a reload).
    if (doc.documentElement.hasAttribute('data-mz-blank')) {
      if (s.html) writeFrame(doc, s.html)
      return
    }
    if (!s.html) return
    // A later load is a reload (the site's code changed): it shows the first render again, so refresh it.
    const reloaded = s.loaded
    s.loaded = true
    s.blocks = new Map(
      [...doc.querySelectorAll<HTMLElement>('[data-mz-block]')].map((el) => [
        el.dataset.mzBlock as string,
        el.outerHTML,
      ]),
    )
    setLoading(false)
    const style = doc.createElement('style')
    style.textContent = EDITOR_CSS
    doc.head.append(style)

    doc.addEventListener(
      'click',
      (e) => {
        if (state.current.dragged) {
          state.current.dragged = false
          e.preventDefault()
          e.stopPropagation()
          return
        }
        const target = e.target as HTMLElement
        // The canvas is for editing: links and buttons do not navigate.
        if (target.closest('a, button, form')) e.preventDefault()
        const block = target.closest<HTMLElement>('[data-mz-block]')
        const key = block?.dataset.mzBlock ?? null
        const fieldEl = target.closest<HTMLElement>('[data-mz-field]')
        if (key && fieldEl && (block?.hasAttribute('data-mz-selected') || e.detail > 1)) startEditing(fieldEl, key)
        handlers.current.onSelect(key)
      },
      true,
    )
    doc.addEventListener('submit', (e) => e.preventDefault(), true)
    doc.addEventListener('pointerdown', (e) => {
      const handle = (e.target as HTMLElement).closest('[data-mz-handle]')
      const block = handle?.closest<HTMLElement>('[data-mz-block]')
      if (handle && block) startDrag(doc, block, e)
    })
    // Shortcuts (undo, save, delete…) belong to the admin, not to the page inside the canvas.
    // Text shortcuts (select all, copy, paste) stay native.
    doc.addEventListener('keydown', (e) => {
      const editing = (e.target as HTMLElement).isContentEditable
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      const forward = mod
        ? ['z', 'y', 's', 'k'].includes(key) || (!editing && key === 'd')
        : !editing && ['Backspace', 'Delete', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key)
      if (!forward) return
      e.preventDefault()
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: e.key,
          code: e.code,
          metaKey: e.metaKey,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          bubbles: true,
          cancelable: true,
        }),
      )
    })
    decorate()
    if (reloaded) void render()
  }

  /** Drag a block by its handle: a line shows where it will land; dropping reorders the page. */
  function startDrag(doc: Document, block: HTMLElement, down: PointerEvent) {
    down.preventDefault()
    const win = doc.defaultView
    if (!win) return
    const blocks = () => [...doc.querySelectorAll<HTMLElement>('[data-mz-block]')]
    const from = blocks().indexOf(block)
    const line = doc.createElement('div')
    line.dataset.mzDrop = ''
    let target = from
    let moved = false
    let scroll = 0
    let frameId = 0

    const place = (y: number) => {
      const list = blocks()
      target = list.length
      for (let i = 0; i < list.length; i++) {
        const r = (list[i] as HTMLElement).getBoundingClientRect()
        if (y < r.top + r.height / 2) {
          target = i
          break
        }
      }
      const ref = list[target] ?? list[list.length - 1]
      if (!ref) return
      const r = ref.getBoundingClientRect()
      line.style.top = `${(target < list.length ? r.top : r.bottom) + win.scrollY}px`
    }
    // Near the top or bottom edge the page scrolls, so blocks can travel far.
    const tick = () => {
      if (scroll) win.scrollBy(0, scroll)
      frameId = win.requestAnimationFrame(tick)
    }
    const move = (e: PointerEvent) => {
      if (!moved && Math.abs(e.clientY - down.clientY) < 4) return
      if (!moved) {
        moved = true
        block.setAttribute('data-mz-dragging', '')
        doc.documentElement.classList.add('mz-drag')
        doc.body.append(line)
        frameId = win.requestAnimationFrame(tick)
      }
      const edge = 70
      scroll = e.clientY < edge ? -14 : e.clientY > win.innerHeight - edge ? 14 : 0
      place(e.clientY)
    }
    const up = () => {
      doc.removeEventListener('pointermove', move)
      doc.removeEventListener('pointerup', up)
      win.cancelAnimationFrame(frameId)
      block.removeAttribute('data-mz-dragging')
      doc.documentElement.classList.remove('mz-drag')
      line.remove()
      if (!moved) return
      state.current.dragged = true
      setTimeout(() => {
        state.current.dragged = false
      }, 0)
      const to = target > from ? target - 1 : target
      if (to !== from) handlers.current.onMove(from, to)
    }
    doc.addEventListener('pointermove', move)
    doc.addEventListener('pointerup', up)
  }

  function startEditing(el: HTMLElement, key: string) {
    if (el.isContentEditable) return
    const field = el.dataset.mzField as string
    el.contentEditable = 'plaintext-only'
    el.focus()
    const finish = () => {
      el.removeAttribute('contenteditable')
      el.removeEventListener('input', input)
      el.removeEventListener('keydown', keys)
      const pending = state.current.pending
      const doc = frame.current?.contentDocument
      if (pending && doc) {
        state.current.pending = null
        patch(doc, pending, null)
      }
    }
    const input = () => handlers.current.onField(key, field, el.textContent ?? '')
    const keys = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
        e.preventDefault()
        el.blur()
      }
    }
    el.addEventListener('input', input)
    el.addEventListener('keydown', keys)
    el.addEventListener('blur', finish, { once: true })
  }

  return (
    <div ref={outer} className="mz-dots relative min-h-0 flex-1 overflow-hidden">
      <div className="flex h-full justify-center px-8 pt-6">
        <iframe
          ref={frame}
          src={EMBED_FRAME}
          title="Anteprima della pagina"
          onLoad={onLoad}
          className="shrink-0 rounded-md bg-white shadow-[0_0_0_1px_rgba(0,0,0,.06),0_8px_40px_rgba(0,0,0,.08)] transition-[width] duration-200"
          style={{ width, height: size.height, zoom: size.scale }}
        />
      </div>
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-fg3" />
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 top-4 flex justify-center">
          <div className="flex items-center gap-2 rounded-lg bg-panel px-3 py-2 text-[12.5px] text-warn shadow-pop">
            <TriangleAlert className="size-4" /> Anteprima non aggiornata: {error}
          </div>
        </div>
      )}
    </div>
  )
}
