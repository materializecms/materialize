import {
  type BoundEntry,
  type Breakpoint,
  librarySrcset,
  type PageNode,
  renderPage,
  type Theme,
} from '@materializecms/core/page'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { EMBED_FRAME } from '../lib/frames.ts'

const LABEL: Record<Breakpoint, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' }

/**
 * The page on every device at once, side by side and scaled to fit: a check of the whole design.
 * A click on an element opens it on that device in the editor.
 */
export function DevicesView({
  nodes,
  theme,
  widths,
  data,
  entry,
  onPick,
}: {
  nodes: PageNode[]
  theme: Theme
  widths: Record<Breakpoint, number>
  data?: Record<string, BoundEntry[]>
  entry?: BoundEntry
  onPick: (device: Breakpoint, id: string | null) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [available, setAvailable] = useState(1000)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setAvailable(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // One render serves every width: the page's own container queries do the rest.
  const { locale, schema } = useSession()
  const { html, css } = useMemo(
    () =>
      renderPage(nodes, theme, {
        editor: true,
        animations: 'none',
        srcset: librarySrcset,
        data,
        entry,
        frame: EMBED_FRAME,
        locale,
        alternates: schema.locales.available.map((l) => ({ locale: l, url: '#' })),
      }),
    [nodes, theme, data, entry, locale, schema.locales.available],
  )
  const devices = ['desktop', 'tablet', 'mobile'] as const
  const gap = 32
  const scale = Math.min(0.6, (available - 96 - gap * 2) / (widths.desktop + widths.tablet + widths.mobile))

  return (
    <div
      ref={host}
      className="min-h-0 flex-1 overflow-auto bg-canvas bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:18px_18px] px-12 py-8"
    >
      <style>{css}</style>
      <div className="flex items-start justify-center" style={{ gap }}>
        {devices.map((d) => (
          <div key={d} style={{ width: widths[d] * scale }} className="shrink-0">
            <div className="mb-2 flex items-center justify-between text-[11.5px] text-fg3">
              <span className="font-medium text-fg2">{LABEL[d]}</span>
              <span className="font-mono">{widths[d]} px</span>
            </div>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: a preview to point at; keyboard editing is in the canvas */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: see above */}
            <div
              className="overflow-hidden rounded-[3px] shadow-[0_0_0_1px_rgb(10_10_11/0.08),0_12px_32px_rgb(10_10_11/0.08)]"
              onClick={(e) => {
                e.preventDefault()
                const id = (e.target as HTMLElement).closest<HTMLElement>('[data-mz-id]')?.dataset.mzId ?? null
                onPick(d, id)
              }}
            >
              <div
                className="pointer-events-auto cursor-pointer select-none"
                // zoom (not transform) also shrinks the height, so the columns end where the page does.
                style={{ width: widths[d], zoom: scale }}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML from our own renderer
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
