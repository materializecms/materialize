/// <reference lib="dom" />
/**
 * The motion runtime: plays the interactions written by the renderer in `data-mz-motion`, plus the
 * site's smooth scrolling and custom cursor. No dependencies, one animation frame loop, transforms
 * and opacity only; nothing moves for people who asked for reduced motion.
 *
 *   startMotion(document)                       // on the site
 *   const stop = startMotion(canvas, { scroller }) // in the editor's preview
 */
import type { Ease, Interaction, Keyframe, MotionProps } from './page.ts'

export const EASE: Record<Ease, (t: number) => number> = {
  linear: (t) => t,
  out: (t) => 1 - (1 - t) ** 3,
  inOut: (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2),
  expo: (t) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)),
  back: (t) => {
    const c = 1.70158
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
  },
  spring: (t) => (t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(10 * t)),
}

const IDENTITY: Required<MotionProps> = { x: 0, y: 0, scale: 1, rotate: 0, rx: 0, ry: 0, opacity: 1, blur: 0, clip: 0 }
const KEYS = Object.keys(IDENTITY) as (keyof MotionProps)[]

const mix = (a: MotionProps | undefined, b: MotionProps | undefined, t: number): Required<MotionProps> => {
  const out = { ...IDENTITY }
  for (const k of KEYS) {
    const from = a?.[k] ?? IDENTITY[k]
    const to = b?.[k] ?? IDENTITY[k]
    out[k] = from + (to - from) * t
  }
  return out
}

/** The state at a point of a timeline, between the keyframes around it. */
export function sampleKeys(keys: Keyframe[], t: number): Required<MotionProps> {
  const list = [...keys].sort((a, b) => a.at - b.at)
  const first = list[0]
  const last = list[list.length - 1]
  if (!first || !last) return { ...IDENTITY }
  if (t <= first.at) return mix(first.props, first.props, 0)
  if (t >= last.at) return mix(last.props, last.props, 0)
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1] as Keyframe
    const b = list[i] as Keyframe
    if (t <= b.at) {
      const local = (t - a.at) / Math.max(0.0001, b.at - a.at)
      return mix(a.props, b.props, EASE[b.ease ?? 'inOut'](local))
    }
  }
  return mix(last.props, last.props, 0)
}

/** The state of an interaction at a progress 0–1: its timeline, or from → to with its curve. */
export function sampleInteraction(ix: Interaction, t: number): Required<MotionProps> {
  if (ix.keys && ix.keys.length >= 2) return sampleKeys(ix.keys, t)
  const eased = ix.trigger === 'scroll' || ix.trigger === 'mouse' ? t : EASE[ix.ease ?? 'out'](t)
  return mix(ix.from, ix.to, eased)
}

/** Inline styles for a state: used by the runtime and by the editor's timeline preview. */
export function styleFor(l: Required<MotionProps>, clipSide: Interaction['clipSide'] = 'bottom') {
  const persp = l.rx || l.ry ? 'perspective(900px) ' : ''
  const c = l.clip.toFixed(2)
  return {
    transform: `${persp}translate3d(${l.x.toFixed(2)}px,${l.y.toFixed(2)}px,0) rotate(${l.rotate.toFixed(2)}deg) rotateX(${l.rx.toFixed(2)}deg) rotateY(${l.ry.toFixed(2)}deg) scale(${l.scale.toFixed(4)})`,
    opacity: l.opacity >= 0.999 ? '' : l.opacity.toFixed(3),
    filter: l.blur > 0.05 ? `blur(${l.blur.toFixed(2)}px)` : '',
    clipPath:
      l.clip <= 0.05
        ? ''
        : clipSide === 'top'
          ? `inset(${c}% 0 0 0)`
          : clipSide === 'left'
            ? `inset(0 0 0 ${c}%)`
            : clipSide === 'right'
              ? `inset(0 ${c}% 0 0)`
              : `inset(0 0 ${c}% 0)`,
  }
}

/** One animated target: an element, or a word or letter of a split text. */
interface Target {
  el: HTMLElement
  /** Current contribution of each interaction, composed every frame. */
  layers: Map<string, Required<MotionProps>>
  clipSide: Interaction['clipSide']
  dirty: boolean
}

interface Player {
  ix: Interaction
  targets: Target[]
  host: HTMLElement
  /** Progress 0–1 the player is heading to, and where it is. */
  goal: number
  value: number
  start: number
  from: number
  /** Count-up: the original text and the number inside it. */
  count?: { text: string; n: number; decimals: number }
}

/** A fixed menu that lies over the next section: pull that section up by the menu's height. */
export function layoutSticky(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLElement>('[data-mz-sticky~="overlay"]')) {
    el.style.marginBottom = `${-el.offsetHeight}px`
  }
}

/** Fixed menus: hidden while scrolling down, glass once scrolled. */
function stickyMenus(root: ParentNode, scroller?: HTMLElement): () => void {
  const menus = [...root.querySelectorAll<HTMLElement>('[data-mz-sticky]')]
  if (!menus.length) return () => {}
  layoutSticky(root)
  const source: HTMLElement | Window = scroller ?? window
  const pos = () => (scroller ? scroller.scrollTop : scrollY)
  let last = pos()
  let ticking = false
  const update = () => {
    ticking = false
    const y = pos()
    for (const m of menus) {
      m.classList.toggle('mz-scrolled', y > 8)
      if (m.dataset.mzSticky?.includes('hide')) {
        if (y > last + 4 && y > m.offsetHeight * 2) m.classList.add('mz-away')
        else if (y < last - 4) m.classList.remove('mz-away')
      }
    }
    last = y
  }
  const onScroll = () => {
    if (!ticking) {
      ticking = true
      requestAnimationFrame(update)
    }
  }
  const onResize = () => layoutSticky(root)
  source.addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', onResize)
  update()
  return () => {
    source.removeEventListener('scroll', onScroll)
    removeEventListener('resize', onResize)
    for (const m of menus) m.classList.remove('mz-away', 'mz-scrolled')
  }
}

export interface MotionOptions {
  /** The element that scrolls (the editor's canvas); the window otherwise. */
  scroller?: HTMLElement
  /** Site-wide effects (smooth scrolling, cursor): only on the real site. */
  site?: boolean
}

/** "Show more" under bound lists: each click reveals the next entries already on the page. */
function moreButtons(root: ParentNode): () => void {
  const onClick = (e: Event) => {
    const button = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-mz-more]')
    if (!button) return
    e.preventDefault()
    const list = root.querySelector<HTMLElement>(`.${CSS.escape(button.dataset.mzMore ?? '')}`)
    const waiting = [...(list?.querySelectorAll<HTMLElement>(':scope > [data-mz-later]') ?? [])]
    for (const el of waiting.slice(0, Number(button.dataset.mzStep) || 6)) el.removeAttribute('data-mz-later')
    if (waiting.length <= (Number(button.dataset.mzStep) || 6)) button.parentElement?.remove()
  }
  root.addEventListener('click', onClick)
  return () => root.removeEventListener('click', onClick)
}

export function startMotion(root: ParentNode = document, options: MotionOptions = {}): () => void {
  if (typeof window === 'undefined') return () => {}
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  const cleanups: (() => void)[] = [stickyMenus(root, options.scroller), moreButtons(root)]
  const targets = new Map<HTMLElement, Target>()
  const players: Player[] = []
  const scroller = options.scroller
  let frame = 0
  const view = () => {
    if (scroller) {
      const r = scroller.getBoundingClientRect()
      return { top: r.top, height: r.height, left: r.left, width: r.width }
    }
    return { top: 0, height: innerHeight, left: 0, width: innerWidth }
  }

  const targetOf = (el: HTMLElement, ix: Interaction): Target => {
    let t = targets.get(el)
    if (!t) {
      t = { el, layers: new Map(), clipSide: ix.clipSide, dirty: true }
      targets.set(el, t)
    }
    if (ix.clipSide) t.clipSide = ix.clipSide
    return t
  }

  /** Wraps each word or letter in a span, keeping links and emphasis around them. */
  const split = (el: HTMLElement, mode: 'words' | 'chars'): HTMLElement[] => {
    const pieces: HTMLElement[] = []
    el.dataset.mzSplit = mode
    const walk = (node: Node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === Node.TEXT_NODE) {
          const text = child.textContent ?? ''
          const parts = mode === 'words' ? text.split(/(\s+)/) : [...text]
          const frag = document.createDocumentFragment()
          for (const part of parts) {
            if (!part) continue
            if (/^\s+$/.test(part)) {
              frag.append(part)
              continue
            }
            const span = document.createElement('span')
            span.textContent = part
            pieces.push(span)
            frag.append(span)
          }
          child.replaceWith(frag)
        } else if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName !== 'BR') walk(child)
      }
    }
    walk(el)
    // Screen readers read the sentence, not the pieces.
    el.setAttribute('aria-label', el.textContent ?? '')
    for (const p of pieces) p.setAttribute('aria-hidden', 'true')
    return pieces
  }

  const els = [...root.querySelectorAll<HTMLElement>('[data-mz-motion]')]
  for (const el of els) {
    let list: Interaction[] = []
    try {
      list = JSON.parse(el.dataset.mzMotion ?? '[]') as Interaction[]
    } catch {}
    for (const ix of list) {
      if (reduced && ix.trigger !== 'click') {
        // Final state at once: what the design shows at rest.
        continue
      }
      const pieces = ix.split && ix.split !== 'none' ? split(el, ix.split) : [el]
      const player: Player = {
        ix,
        host: el,
        targets: pieces.map((p) => targetOf(p, ix)),
        goal: 0,
        value: 0,
        start: 0,
        from: 0,
      }
      if (ix.count) {
        const text = el.textContent ?? ''
        const m = /\d+(?:[.,]\d+)?/.exec(text)
        if (m)
          player.count = { text, n: Number(m[0].replace(',', '.')), decimals: (m[0].split(/[.,]/)[1] ?? '').length }
      }
      players.push(player)
      apply(player, 0)
    }
  }

  function apply(p: Player, v: number) {
    p.value = v
    const ix = p.ix
    const n = p.targets.length
    const stagger = ix.stagger ?? 0.04
    const dur = Math.max(0.05, ix.duration ?? 0.8)
    p.targets.forEach((t, i) => {
      // Each piece starts a little later; the progress is stretched so the last one still finishes.
      let local = v
      if (
        n > 1 &&
        (ix.trigger === 'load' || ix.trigger === 'view' || ix.trigger === 'hover' || ix.trigger === 'click')
      ) {
        const total = dur + stagger * (n - 1)
        local = Math.min(1, Math.max(0, (v * total - stagger * i) / dur))
      }
      t.layers.set(ix.id, sampleInteraction(ix, local))
      t.dirty = true
    })
    if (p.count) {
      const k = EASE[ix.ease ?? 'out'](Math.min(1, v))
      const value = (p.count.n * k).toFixed(p.count.decimals)
      p.host.textContent = p.count.text.replace(
        /\d+(?:[.,]\d+)?/,
        value.replace('.', p.count.text.includes(',') ? ',' : '.'),
      )
    }
  }

  function write(t: Target) {
    let x = 0
    let y = 0
    let scale = 1
    let rotate = 0
    let rx = 0
    let ry = 0
    let opacity = 1
    let blur = 0
    let clip = 0
    for (const l of t.layers.values()) {
      x += l.x
      y += l.y
      scale *= l.scale
      rotate += l.rotate
      rx += l.rx
      ry += l.ry
      opacity *= l.opacity
      blur += l.blur
      clip = Math.max(clip, l.clip)
    }
    const s = t.el.style
    const persp = rx || ry ? 'perspective(900px) ' : ''
    s.transform = `${persp}translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) rotate(${rotate.toFixed(2)}deg) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale.toFixed(4)})`
    s.opacity = opacity >= 0.999 ? '' : opacity.toFixed(3)
    s.filter = blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : ''
    if (clip > 0.05) {
      const c = clip.toFixed(2)
      const side = t.clipSide ?? 'bottom'
      s.clipPath =
        side === 'bottom'
          ? `inset(0 0 ${c}% 0)`
          : side === 'top'
            ? `inset(${c}% 0 0 0)`
            : side === 'left'
              ? `inset(0 0 0 ${c}%)`
              : `inset(0 ${c}% 0 0)`
    } else s.clipPath = ''
    s.willChange = 'transform, opacity'
    t.dirty = false
  }

  // ---------- triggers ----------

  const now = () => performance.now() / 1000
  const play = (p: Player, goal: number, delay = 0) => {
    p.goal = goal
    p.from = p.value
    p.start = now() + delay
    wake()
  }

  let pointer = { x: 0.5, y: 0.5 }
  const mouseTargets = new Map<Player, { x: number; y: number }>()

  for (const p of players) {
    const ix = p.ix
    if (ix.trigger === 'load') play(p, 1, ix.delay ?? 0)
    else if (ix.trigger === 'view') {
      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              play(p, 1, ix.delay ?? 0)
              if (ix.once !== false) io.disconnect()
            } else if (ix.once === false && e.boundingClientRect.top > 0) play(p, 0)
          }
        },
        { root: scroller ?? null, threshold: ix.from?.clip ? 0.01 : 0.15 },
      )
      // A fully clipped element counts as invisible for the browser: watch its container instead.
      io.observe(ix.from?.clip ? (p.host.parentElement ?? p.host) : p.host)
      cleanups.push(() => io.disconnect())
    } else if (ix.trigger === 'hover') {
      const enter = () => play(p, 1)
      const leave = () => play(p, 0)
      p.host.addEventListener('pointerenter', enter)
      p.host.addEventListener('pointerleave', leave)
      cleanups.push(() => {
        p.host.removeEventListener('pointerenter', enter)
        p.host.removeEventListener('pointerleave', leave)
      })
    } else if (ix.trigger === 'click') {
      const toggle = () => play(p, p.goal > 0.5 ? 0 : 1)
      p.host.addEventListener('click', toggle)
      cleanups.push(() => p.host.removeEventListener('click', toggle))
    } else if (ix.trigger === 'mouse') mouseTargets.set(p, { x: 0, y: 0 })
  }

  const onPointer = (e: PointerEvent) => {
    const v = view()
    pointer = { x: (e.clientX - v.left) / v.width, y: (e.clientY - v.top) / v.height }
    if (mouseTargets.size) wake()
  }
  addEventListener('pointermove', onPointer, { passive: true })
  cleanups.push(() => removeEventListener('pointermove', onPointer))

  const scrollPlayers = players.filter((p) => p.ix.trigger === 'scroll')
  const onScroll = () => wake()
  const scrollSource: HTMLElement | Window = scroller ?? window
  if (scrollPlayers.length) {
    scrollSource.addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    cleanups.push(() => {
      scrollSource.removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
    })
  }

  // ---------- the frame loop ----------

  function wake() {
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function tick() {
    frame = 0
    let busy = false
    const t = now()
    const v = view()

    for (const p of players) {
      const ix = p.ix
      if (ix.trigger === 'scroll') {
        const r = p.host.getBoundingClientRect()
        const raw = (v.top + v.height - r.top) / (v.height + r.height)
        const [a, b] = ix.range ?? [0, 1]
        const progress = Math.min(1, Math.max(0, (raw - a) / Math.max(0.001, b - a)))
        // A little inertia makes scrubbing feel smooth.
        const next = p.value + (progress - p.value) * 0.18
        if (Math.abs(next - p.value) > 0.0005) {
          apply(p, next)
          busy = true
        }
      } else if (ix.trigger === 'mouse') {
        const goal = { x: pointer.x * 2 - 1, y: pointer.y * 2 - 1 }
        const cur = mouseTargets.get(p) ?? { x: 0, y: 0 }
        cur.x += (goal.x - cur.x) * 0.08
        cur.y += (goal.y - cur.y) * 0.08
        mouseTargets.set(p, cur)
        const to = ix.to ?? {}
        const layer = {
          ...IDENTITY,
          x: (to.x ?? 0) * cur.x,
          y: (to.y ?? 0) * cur.y,
          rx: (to.rx ?? 0) * -cur.y,
          ry: (to.ry ?? 0) * cur.x,
          rotate: (to.rotate ?? 0) * cur.x,
        }
        for (const target of p.targets) {
          target.layers.set(ix.id, layer)
          target.dirty = true
        }
        if (Math.abs(goal.x - cur.x) > 0.001 || Math.abs(goal.y - cur.y) > 0.001) busy = true
      } else if (p.value !== p.goal || t < p.start) {
        if (t < p.start) {
          busy = true
          continue
        }
        const n = p.targets.length
        const total = (ix.duration ?? 0.8) + (n > 1 ? (ix.stagger ?? 0.04) * (n - 1) : 0)
        const k = Math.min(1, (t - p.start) / Math.max(0.05, total))
        apply(p, p.from + (p.goal - p.from) * k)
        if (k < 1) busy = true
        else p.value = p.goal
      }
    }
    for (const target of targets.values()) if (target.dirty) write(target)
    if (busy) wake()
  }
  wake()

  // ---------- site-wide: smooth scrolling and cursor ----------

  const host = root.querySelector<HTMLElement>('.mz-page')
  if (options.site && host && !reduced) {
    const coarse = matchMedia('(pointer: coarse)').matches
    if (host.dataset.mzSmooth !== undefined && !coarse) cleanups.push(smoothScroll())
    const cursor = host.dataset.mzCursor
    if (cursor && !coarse) cleanups.push(customCursor(cursor as 'dot' | 'ring'))
  }

  return () => {
    cancelAnimationFrame(frame)
    for (const c of cleanups) c()
    for (const t of targets.values()) {
      t.el.style.transform = ''
      t.el.style.opacity = ''
      t.el.style.filter = ''
      t.el.style.clipPath = ''
      t.el.style.willChange = ''
    }
  }
}

/** Inertial scrolling with the wheel; keyboard, scrollbar and anchors keep working as usual. */
function smoothScroll(): () => void {
  let target = scrollY
  let current = scrollY
  let raf = 0
  let ours = false
  const step = () => {
    current += (target - current) * 0.1
    if (Math.abs(target - current) < 0.5) current = target
    ours = true
    scrollTo(0, current)
    raf = current === target ? 0 : requestAnimationFrame(step)
  }
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || (e.target as HTMLElement).closest?.('[data-mz-native-scroll], textarea, select')) return
    e.preventDefault()
    const max = document.documentElement.scrollHeight - innerHeight
    target = Math.max(0, Math.min(max, target + e.deltaY))
    if (!raf) raf = requestAnimationFrame(step)
  }
  const onScroll = () => {
    if (ours) {
      ours = false
      return
    }
    // Scrolled another way (keys, scrollbar, anchor): follow it.
    target = current = scrollY
  }
  addEventListener('wheel', onWheel, { passive: false })
  addEventListener('scroll', onScroll, { passive: true })
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('wheel', onWheel)
    removeEventListener('scroll', onScroll)
  }
}

/** A dot or a ring that follows the pointer and grows over links and buttons. */
function customCursor(kind: 'dot' | 'ring'): () => void {
  const el = document.createElement('div')
  el.setAttribute('aria-hidden', 'true')
  const size = kind === 'ring' ? 36 : 12
  el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;margin:${-size / 2}px 0 0 ${-size / 2}px;border-radius:50%;pointer-events:none;z-index:2147483647;mix-blend-mode:difference;transition:width .25s,height .25s,margin .25s,opacity .25s;opacity:0;${kind === 'ring' ? 'border:1.5px solid #fff' : 'background:#fff'}`
  document.body.append(el)
  const style = document.createElement('style')
  style.textContent = 'html,html *{cursor:none!important}input,textarea,[contenteditable]{cursor:text!important}'
  document.head.append(style)
  let x = innerWidth / 2
  let y = innerHeight / 2
  let cx = x
  let cy = y
  let raf = 0
  const loop = () => {
    cx += (x - cx) * 0.2
    cy += (y - cy) * 0.2
    el.style.transform = `translate3d(${cx}px,${cy}px,0)`
    raf = requestAnimationFrame(loop)
  }
  const move = (e: PointerEvent) => {
    x = e.clientX
    y = e.clientY
    el.style.opacity = '1'
    const over = !!(e.target as HTMLElement).closest?.('a, button, [data-hover], [data-mz-motion]')
    const s = over ? size * 2.2 : size
    el.style.width = el.style.height = `${s}px`
    el.style.margin = `${-s / 2}px 0 0 ${-s / 2}px`
  }
  const leave = () => {
    el.style.opacity = '0'
  }
  addEventListener('pointermove', move, { passive: true })
  document.addEventListener('pointerleave', leave)
  raf = requestAnimationFrame(loop)
  return () => {
    cancelAnimationFrame(raf)
    removeEventListener('pointermove', move)
    document.removeEventListener('pointerleave', leave)
    el.remove()
    style.remove()
  }
}
