import type { NodeProps, PageNode, Run } from '@materializecms/core/page'
import { Globe, ImagePlus, Link2, ListTree } from 'lucide-react'
import { type ReactNode, useEffect, useRef } from 'react'
import { cx } from '../components/ui.tsx'
import { domToRuns, simplify } from './runs.ts'

const STYLE_LABEL: Record<string, string> = {
  display: 'Titolo grande',
  h1: 'Titolo',
  h2: 'Sottotitolo',
  h3: 'Titoletto',
  eyebrow: 'Occhiello',
  small: 'Nota',
  logo: 'Logo',
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/** Formatted text as editable HTML: bold, italic, links and line breaks, as on the canvas. */
function runsToHtml(n: PageNode): string {
  const runs: Run[] = n.runs ?? [{ t: n.text ?? '' }]
  return runs
    .map((r) => {
      let h = esc(r.t).replace(/\n/g, '<br>')
      if (r.b) h = `<b>${h}</b>`
      if (r.i) h = `<i>${h}</i>`
      if (r.href) h = `<a href="${esc(r.href)}">${h}</a>`
      return h
    })
    .join('')
}

const plain = (n: PageNode) => (n.runs ? n.runs.map((r) => r.t).join('') : (n.text ?? ''))

/** A section's name for people: its own name, else its first heading, else its place. */
export function sectionLabel(n: PageNode, i: number): string {
  if (n.name) return n.name
  let found = ''
  const walk = (list: PageNode[]) => {
    for (const c of list) {
      if (found) return
      if (c.type === 'text' && c.style && /^(display|h1|h2|h3)$/.test(c.style)) found = plain(c)
      if (c.children) walk(c.children)
    }
  }
  walk(n.children ?? [])
  return found ? found.slice(0, 48) : `Sezione ${i + 1}`
}

/** The sections of the page, in order: a click shows one on the canvas. */
export function SectionsIndex({
  nodes,
  current,
  onSelect,
}: {
  nodes: PageNode[]
  /** The section holding the selection. */
  current: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
      <div className="px-2 pt-1.5 pb-2 text-[11px] font-medium tracking-wide text-fg3 uppercase">Sezioni</div>
      <ol className="space-y-0.5">
        {nodes.map((n, i) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onSelect(n.id)}
              className={cx(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px]',
                current === n.id ? 'bg-accent/10 text-accent' : 'text-fg2 hover:bg-hover hover:text-fg',
                n.hidden && 'opacity-50',
              )}
            >
              <span className="w-4 shrink-0 text-right font-mono text-[10.5px] text-fg3">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{sectionLabel(n, i)}</span>
              {n.global && <Globe className="size-3 shrink-0 text-fg3" aria-label="Condivisa con le altre pagine" />}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Text with bold, italic and links, edited like on the canvas but in the panel. */
function RunsField({ node, label, onCommit }: { node: PageNode; label: string; onCommit: (runs: Run[]) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const html = runsToHtml(node)
  // Changes from elsewhere (the canvas, undo) show up, but never while typing here.
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement !== el && el.innerHTML !== html) el.innerHTML = html
  }, [html])
  const heading = node.style && /^(display|h1|h2|h3)$/.test(node.style)
  return (
    // biome-ignore lint/a11y/useSemanticElements: formatted text (bold, italic, links) needs contenteditable
    <div
      ref={ref}
      role="textbox"
      aria-label={label}
      aria-multiline
      tabIndex={0}
      contentEditable="true"
      suppressContentEditableWarning
      onBlur={(e) => {
        const runs = domToRuns(e.currentTarget)
        if (JSON.stringify(simplify(runs)) !== JSON.stringify(simplify(node.runs ?? [{ t: node.text ?? '' }])))
          onCommit(runs)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.currentTarget.blur()
        // Bold and italic, as on the canvas.
        if ((e.metaKey || e.ctrlKey) && (e.key === 'b' || e.key === 'i')) {
          e.preventDefault()
          document.execCommand(e.key === 'b' ? 'bold' : 'italic')
        }
      }}
      className={cx(
        'min-h-8 w-full rounded-md border border-line2 bg-input px-2.5 py-1.5 leading-snug whitespace-pre-wrap outline-none focus:border-accent [&_a]:text-accent [&_a]:underline',
        heading ? 'text-[14px] font-semibold' : 'text-[13px]',
      )}
    />
  )
}

const input =
  'h-7 w-full min-w-0 rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent'

interface Item {
  node: PageNode
  /** Filled from a collection or a list: not written here. */
  bound?: string
}

/** The contents of a section in reading order: texts, buttons, images. */
function itemsOf(section: PageNode): Item[] {
  const out: Item[] = []
  const walk = (list: PageNode[], bound?: string) => {
    for (const n of list) {
      if (n.hidden) continue
      const from = n.field ? `dal campo “${n.field}”` : bound
      if (n.type === 'text' || n.type === 'button' || n.type === 'image') out.push({ node: n, bound: from })
      // A list fed by a collection: its first child is a template, the entries fill it.
      if (n.children) walk(n.bind ? n.children.slice(0, 1) : n.children, n.bind ? 'da una raccolta' : from)
    }
  }
  walk(section.children ?? [])
  return out
}

/**
 * Content mode: every text, button and image of the page, section by section, in reading order.
 * Writing here changes the canvas, and selecting either highlights the other.
 */
export function ContentPanel({
  nodes,
  selected,
  onSelect,
  onText,
  onContent,
  onPickImage,
  footer,
}: {
  nodes: PageNode[]
  selected: string | null
  onSelect: (id: string) => void
  onText: (id: string, runs: Run[]) => void
  onContent: (id: string, patch: Partial<NodeProps>, group?: string) => void
  onPickImage: (id: string) => void
  /** The page's own fields (title, address…), under the contents. */
  footer?: ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  // The element chosen on the canvas comes into view here.
  useEffect(() => {
    if (!selected || box.current?.contains(document.activeElement)) return
    box.current
      ?.querySelector(`[data-content-id="${CSS.escape(selected)}"]`)
      ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selected])

  return (
    <div ref={box}>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-3">
        <ListTree className="size-4 text-fg3" />
        <div>
          <div className="text-[13px] font-semibold">Contenuti della pagina</div>
          <div className="text-[11.5px] text-fg3">In ordine di lettura. Il layout resta com’è.</div>
        </div>
      </div>
      {nodes.map((section, i) => {
        const items = itemsOf(section)
        if (!items.length || section.hidden) return null
        return (
          <section key={section.id} className="border-b border-line px-3.5 py-3">
            <button
              type="button"
              onClick={() => onSelect(section.id)}
              className="mb-2 flex w-full items-center gap-1.5 text-left text-[11px] font-semibold tracking-wide text-fg3 uppercase hover:text-fg"
            >
              <span className="font-mono">{i + 1}</span>
              <span className="truncate">{sectionLabel(section, i)}</span>
              {section.global && (
                <span className="ml-auto shrink-0 font-normal tracking-normal normal-case">su tutte le pagine</span>
              )}
            </button>
            <div className="space-y-3">
              {items.map(({ node: n, bound }) => (
                <div
                  key={n.id}
                  data-content-id={n.id}
                  onFocusCapture={() => selected !== n.id && onSelect(n.id)}
                  className={cx(
                    'space-y-1 rounded-md transition-shadow',
                    selected === n.id && 'ring-2 ring-accent/40 ring-offset-4 ring-offset-panel',
                  )}
                >
                  <div className="text-[11px] text-fg3">
                    {n.type === 'image'
                      ? 'Immagine'
                      : n.type === 'button'
                        ? 'Pulsante'
                        : (STYLE_LABEL[n.style ?? ''] ?? 'Testo')}
                    {bound && <span> · {bound}</span>}
                  </div>
                  {bound ? (
                    <p className="truncate text-[12.5px] text-fg3 italic">
                      {n.type === 'image' ? 'Immagine della voce' : plain(n) || '—'}
                    </p>
                  ) : n.type === 'text' ? (
                    <RunsField
                      node={n}
                      label={STYLE_LABEL[n.style ?? ''] ?? 'Testo'}
                      onCommit={(r) => onText(n.id, r)}
                    />
                  ) : n.type === 'button' ? (
                    <div className="space-y-1">
                      <input
                        aria-label="Testo del pulsante"
                        value={n.text ?? ''}
                        onChange={(e) => onContent(n.id, { text: e.target.value }, `text:${n.id}`)}
                        className={cx(input, 'h-8 text-[13px] font-medium')}
                      />
                      {!n.submit && (
                        <div className="flex items-center gap-1.5">
                          <Link2 className="size-3.5 shrink-0 text-fg3" />
                          <input
                            aria-label="Collegamento del pulsante"
                            value={n.href ?? ''}
                            placeholder="/contatti o https://…"
                            onChange={(e) => onContent(n.id, { href: e.target.value }, `href:${n.id}`)}
                            className={cx(input, 'font-mono')}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onPickImage(n.id)}
                        className="group relative size-16 shrink-0 overflow-hidden rounded-md border border-line2 bg-panel2"
                        aria-label="Cambia immagine"
                      >
                        {n.src && <img src={n.src} alt="" className="size-full object-cover" />}
                        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <ImagePlus className="size-4" />
                        </span>
                      </button>
                      <textarea
                        aria-label="Descrizione dell’immagine"
                        value={n.alt ?? ''}
                        placeholder="Descrizione per chi non vede e per Google"
                        onChange={(e) => onContent(n.id, { alt: e.target.value }, `alt:${n.id}`)}
                        className="h-16 min-w-0 flex-1 resize-none rounded-md border border-line2 bg-input px-2 py-1 text-[12px] leading-snug outline-none focus:border-accent"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      })}
      {footer && <div className="px-3.5 py-4">{footer}</div>}
    </div>
  )
}
