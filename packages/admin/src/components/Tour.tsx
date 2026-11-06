import { useEffect, useRef, useState } from 'react'

export interface TourStep<T = string> {
  part: string
  title: string
  text: string
  /** The area to light up (a CSS selector); none: a card in the middle. */
  target?: string
  /** Left out when its area is not on screen. */
  optional?: boolean
  /** What the page should open first (a tab, a panel). */
  tab?: T
}

/** The bounding box of every element a selector matches, or null when none is on screen. */
function boxOf(selector: string): DOMRect | null {
  const rects = [...document.querySelectorAll<HTMLElement>(selector)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
  if (!rects.length) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

const CARD_W = 340
const GAP = 12
const PAD = 6

/** Where the card goes: beside the lit area where there is room, kept inside the window. */
function cardPlace(box: DOMRect | null, height: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.max(GAP, Math.min(vw - CARD_W - GAP, x))
  const clampY = (y: number) => Math.max(GAP, Math.min(vh - height - GAP, y))
  if (!box) return { left: (vw - CARD_W) / 2, top: Math.max(GAP, (vh - height) / 2) }
  // A tall area (a side panel): beside it. A short one (a toolbar button): below it.
  if (box.height > vh * 0.5) {
    if (box.right + GAP + CARD_W < vw) return { left: box.right + GAP, top: clampY(box.top + 60) }
    if (box.left - GAP - CARD_W > 0) return { left: box.left - GAP - CARD_W, top: clampY(box.top + 60) }
    return { left: clampX(box.left + (box.width - CARD_W) / 2), top: clampY(box.top + box.height / 3) }
  }
  // Something in the left column (a sidebar entry): beside it, so the card does not cover the menu.
  if (box.left < 80 && box.width < 360 && box.right + GAP + CARD_W < vw)
    return { left: box.right + GAP, top: clampY(box.top - 8) }
  const below = box.bottom + GAP
  const top = below + height < vh ? below : box.top - GAP - height
  return { left: clampX(box.left + box.width / 2 - CARD_W / 2), top: clampY(top) }
}

/**
 * A guided tour: each step dims the window except the area it talks about. Steps marked
 * optional are left out when their area is not on screen (a feature that is off, an empty list).
 */
export function GuidedTour<T>({
  steps: all,
  label,
  onDone,
  onStep,
}: {
  steps: TourStep<T>[]
  label: string
  onDone: () => void
  /** Before a step shows: open the tab or the menu it talks about. */
  onStep?: (step: TourStep<T>) => void
}) {
  // Optional steps whose area is missing are dropped once, when the tour starts.
  const [steps] = useState(() => all.filter((s) => !s.optional || !s.target || document.querySelector(s.target)))
  const [i, setI] = useState(0)
  const [box, setBox] = useState<DOMRect | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(200)
  const step = steps[i]

  // biome-ignore lint/correctness/useExhaustiveDependencies: onStep changes identity on every render
  useEffect(() => {
    if (!step) return
    onStep?.(step)
    let frame = 0
    const measure = () => {
      setBox(step.target ? boxOf(step.target) : null)
      if (card.current) setHeight(card.current.offsetHeight)
    }
    // After the tab has opened and the layout settled.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(measure)
    })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setI((n) => (n + 1 < steps.length ? n + 1 : n))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onDone, steps.length])

  if (!step) return null
  const last = i + 1 === steps.length
  const place = cardPlace(box, height)
  return (
    <div className="fixed inset-0 z-[60]">
      {/* The window dims except the area being explained; clicks outside the card do nothing. */}
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent transition-all duration-300 ease-out"
          style={{
            left: box.left - PAD,
            top: box.top - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
      )}
      <div
        ref={card}
        role="dialog"
        aria-label={label}
        aria-live="polite"
        className="absolute rounded-xl border border-line bg-panel p-4 shadow-pop transition-all duration-300 ease-out"
        style={{ width: CARD_W, left: place.left, top: place.top }}
      >
        <div className="flex items-center justify-between text-[11.5px] font-medium">
          <span className="text-accent">{step.part}</span>
          <span className="text-fg3 tabular-nums">
            {i + 1} di {steps.length}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-seg">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((i + 1) / steps.length) * 100}%` }}
          />
        </div>
        <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-fg2">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button type="button" onClick={onDone} className="mr-auto text-[12.5px] text-fg3 hover:text-fg">
              Salta il tour
            </button>
          )}
          {last && <span className="mr-auto" />}
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="h-7 rounded-md px-2.5 text-[12.5px] font-medium text-fg2 hover:bg-hover hover:text-fg"
            >
              Indietro
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onDone() : setI(i + 1))}
            className="h-7 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:brightness-110"
          >
            {i === 0 ? 'Iniziamo' : last ? 'Inizia a lavorare' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}
