import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { MenuItem, MenuSeparator } from '../components/ui.tsx'

export type MenuEntry =
  | { label: string; hint?: string; onClick: () => void; danger?: boolean; disabled?: boolean }
  | 'separator'

/** A right-click menu at the pointer: closes on a choice, a click elsewhere, Esc or scrolling. */
export function ContextMenu({
  at,
  items,
  onClose,
}: {
  at: { x: number; y: number } | null
  items: MenuEntry[]
  onClose: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState(at)

  // Kept inside the window: near the right or bottom edge it opens the other way.
  useLayoutEffect(() => {
    if (!at || !box.current) return setPos(at)
    const r = box.current.getBoundingClientRect()
    setPos({
      x: Math.min(at.x, innerWidth - r.width - 8),
      y: at.y + r.height > innerHeight - 8 ? Math.max(8, at.y - r.height) : at.y,
    })
  }, [at])

  useEffect(() => {
    if (!at) return
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return
      if (e.type === 'pointerdown' && box.current?.contains(e.target as Node)) return
      onClose()
    }
    window.addEventListener('pointerdown', close, true)
    window.addEventListener('keydown', close, true)
    window.addEventListener('wheel', close, { passive: true, capture: true })
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('pointerdown', close, true)
      window.removeEventListener('keydown', close, true)
      window.removeEventListener('wheel', close, true)
      window.removeEventListener('blur', close)
    }
  }, [at, onClose])

  if (!at) return null
  // Separators only between groups: none at the ends, never two in a row.
  const shown = items.filter(
    (it, i, all) => it !== 'separator' || (i > 0 && i < all.length - 1 && all[i - 1] !== 'separator'),
  )
  return createPortal(
    <div
      ref={box}
      role="menu"
      className="fixed z-[60] w-60 rounded-lg border border-line bg-panel p-1 shadow-pop"
      style={{ left: pos?.x ?? at.x, top: pos?.y ?? at.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {shown.map((it, i) =>
        it === 'separator' ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: separators have no identity
          <MenuSeparator key={`s${i}`} />
        ) : (
          <MenuItem
            key={it.label}
            danger={it.danger}
            disabled={it.disabled}
            hint={it.hint}
            onClick={() => {
              onClose()
              it.onClick()
            }}
          >
            {it.label}
          </MenuItem>
        ),
      )}
    </div>,
    document.body,
  )
}
