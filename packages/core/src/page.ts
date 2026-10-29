/**
 * Pages made of elements: sections hold frames, text, images and buttons, edited on the canvas
 * like a design tool and rendered to plain HTML and CSS, the same in the editor and on the site.
 *
 * Responsive changes live in `over.tablet` / `over.mobile` and become container queries, so a page
 * renders correctly at any width: in the editor's device frames, in thumbnails and on the site.
 */

export type Breakpoint = 'desktop' | 'tablet' | 'mobile'
export type ColorToken =
  | 'bg'
  | 'surface'
  | 'text'
  | 'muted'
  | 'accent'
  | 'onAccent'
  | 'inverse'
  | 'onInverse'
  | 'border'
  | 'line'
export type Scheme = 'default' | 'surface' | 'inverse' | 'accent'
export type TextStyle = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'eyebrow' | 'logo' | 'button'
export type Animation =
  | 'none'
  | 'fade'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'zoom'
  | 'zoomout'
  | 'blur'
  | 'reveal'
  | 'tilt'
  | 'pop'

export interface Run {
  t: string
  b?: boolean
  i?: boolean
  href?: string
}

export interface NodeProps {
  name?: string
  hidden?: boolean
  width?: 'fill' | 'hug' | 'fixed'
  fixedW?: number
  maxW?: number | null
  padX?: number
  padY?: number
  radius?: number | 'btn' | 'card'
  border?: boolean
  divider?: boolean
  topline?: boolean
  shadow?: 'none' | 'sm' | 'lg'
  bg?: ColorToken | null
  anim?: Animation
  animDur?: 's' | 'm' | 'l'
  animDelay?: 0 | 1 | 2 | 3
  animTrig?: 'load' | 'scroll'
  hover?: 'none' | 'lift' | 'grow' | 'dim' | 'zoomimg'
  // frame
  layout?: 'col' | 'row' | 'grid'
  gap?: number
  align?: 'start' | 'center' | 'end' | 'stretch'
  justify?: 'start' | 'center' | 'end' | 'between'
  wrap?: boolean
  cols?: number
  scheme?: Scheme | null
  stagger?: boolean
  /** Vertical padding of a section. */
  size?: 'xs' | 's' | 'm' | 'l'
  bgImage?: { src: string; alt?: string } | null
  bgDim?: number
  // text and button
  text?: string
  runs?: Run[] | null
  style?: TextStyle
  color?: ColorToken
  talign?: 'left' | 'center' | 'right'
  fontSize?: number | null
  weight?: number | null
  // image
  src?: string | null
  alt?: string
  ratio?: string
  fit?: 'cover' | 'contain'
  focal?: { x: number; y: number } | null
  tone?: 1 | 2 | 3
  // button
  href?: string
  newTab?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
}

export interface PageNode extends NodeProps {
  id: string
  type: 'frame' | 'text' | 'image' | 'button'
  /** Library origin of a section ("hero.split"), shown in the layers. */
  section?: string
  children?: PageNode[]
  over?: { tablet?: Partial<NodeProps>; mobile?: Partial<NodeProps> }
}

export interface ThemeColors {
  bg: string
  surface: string
  text: string
  muted: string
  accent: string
  onAccent: string
  inverse: string
  onInverse: string
}

export interface Theme {
  mode: 'light' | 'dark'
  colors: { light: ThemeColors; dark: ThemeColors }
  /** Font families: any Google Font, by name. */
  display: string
  body: string
  /** Google Fonts category of each family (serif, sans-serif, display, handwriting, monospace): the fallback. */
  displayCategory?: string
  bodyCategory?: string
  scale: number
  btnRadius: number
  cardRadius: number
}

export const DEFAULT_THEME: Theme = {
  mode: 'light',
  colors: {
    light: {
      bg: '#ffffff',
      surface: '#f5f3ee',
      text: '#121212',
      muted: '#5c5c63',
      accent: '#a8502a',
      onAccent: '#ffffff',
      inverse: '#141414',
      onInverse: '#f4f2ee',
    },
    dark: {
      bg: '#101010',
      surface: '#1a1a19',
      text: '#f2f1ee',
      muted: '#a6a6ad',
      accent: '#e0865c',
      onAccent: '#141414',
      inverse: '#f4f2ee',
      onInverse: '#141414',
    },
  },
  display: 'Instrument Serif',
  body: 'Geist',
  scale: 1,
  btnRadius: 999,
  cardRadius: 14,
}

export const FONTS: Record<string, string> = {
  'Instrument Serif': "'Instrument Serif', Georgia, serif",
  Fraunces: "'Fraunces Variable', 'Fraunces', Georgia, serif",
  Geist: "'Geist Variable', 'Geist', system-ui, sans-serif",
  Inter: "'Inter Variable', 'Inter', system-ui, sans-serif",
}
const MONO = "'Geist Mono Variable', 'Geist Mono', ui-monospace, monospace"

const FALLBACKS: Record<string, string> = {
  serif: 'Georgia, serif',
  monospace: 'ui-monospace, monospace',
  handwriting: 'cursive',
}

/** A font-family value for any family: bundled ones use their packaged names. */
export function fontStack(family: string, category?: string): string {
  return (
    FONTS[family] ?? `'${family.replace(/['\\<>;{}]/g, '')}', ${FALLBACKS[category ?? ''] ?? 'system-ui, sans-serif'}`
  )
}

/** Fontsource id of a family: "Playfair Display" → "playfair-display". */
export const fontId = (family: string) =>
  family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Stylesheets for the theme's fonts that are not bundled with the site, served by Materialize
 * itself at /fonts/<id>.css (self-hosted Google Fonts).
 */
export function fontLinks(theme: Theme): string[] {
  return [...new Set([theme.display, theme.body])].filter((f) => !FONTS[f]).map((f) => `/fonts/${fontId(f)}.css`)
}

export const TEXT_STYLES: Record<
  TextStyle,
  { label: string; f: 'd' | 'b' | 'mono'; d: number; m: number; w: number; lh: number; ls: string; tt: string }
> = {
  display: { label: 'Display', f: 'd', d: 92, m: 48, w: 400, lh: 0.98, ls: '-0.025em', tt: 'none' },
  h1: { label: 'Titolo 1', f: 'd', d: 64, m: 40, w: 400, lh: 1.02, ls: '-0.02em', tt: 'none' },
  h2: { label: 'Titolo 2', f: 'd', d: 46, m: 32, w: 400, lh: 1.08, ls: '-0.015em', tt: 'none' },
  h3: { label: 'Titolo 3', f: 'b', d: 19, m: 18, w: 600, lh: 1.3, ls: '-0.005em', tt: 'none' },
  body: { label: 'Testo', f: 'b', d: 17, m: 16, w: 400, lh: 1.6, ls: '0em', tt: 'none' },
  small: { label: 'Piccolo', f: 'b', d: 14.5, m: 14, w: 400, lh: 1.5, ls: '0em', tt: 'none' },
  eyebrow: { label: 'Etichetta', f: 'mono', d: 12, m: 11, w: 500, lh: 1.3, ls: '0.08em', tt: 'uppercase' },
  logo: { label: 'Logo', f: 'd', d: 26, m: 22, w: 400, lh: 1, ls: '-0.01em', tt: 'none' },
  button: { label: 'Pulsante', f: 'b', d: 15, m: 15, w: 500, lh: 1, ls: '0em', tt: 'none' },
}

export const ANIMATIONS: { value: Animation; label: string }[] = [
  { value: 'none', label: 'Nessuna' },
  { value: 'fade', label: 'Dissolvi' },
  { value: 'up', label: 'Dal basso' },
  { value: 'down', label: 'Dall’alto' },
  { value: 'left', label: 'Da sinistra' },
  { value: 'right', label: 'Da destra' },
  { value: 'zoom', label: 'Ingrandisci' },
  { value: 'zoomout', label: 'Riduci' },
  { value: 'blur', label: 'Sfocatura' },
  { value: 'reveal', label: 'Svela' },
  { value: 'tilt', label: 'Prospettiva' },
  { value: 'pop', label: 'Rimbalzo' },
]

/** Container widths: tablet up to 1023 px, mobile up to 639 px. */
export const BREAKPOINTS = { tablet: 1023, mobile: 639 } as const
export const DEVICE_WIDTH: Record<Breakpoint, number> = { desktop: 1280, tablet: 768, mobile: 390 }

// ---------- tree helpers ----------

/** The node's properties as they apply at a breakpoint. */
export function resolveNode(n: PageNode, bp: Breakpoint): PageNode {
  if (bp === 'desktop' || !n.over) return n
  const t = n.over.tablet ?? {}
  const m = n.over.mobile ?? {}
  return bp === 'tablet' ? { ...n, ...t } : { ...n, ...t, ...m }
}

export function hasOverride(n: PageNode, bp: Breakpoint): boolean {
  if (bp === 'desktop') return false
  const o = n.over?.[bp]
  return !!o && Object.keys(o).length > 0
}

export function walk(nodes: PageNode[], fn: (node: PageNode, parent: PageNode | null, depth: number) => void) {
  const go = (list: PageNode[], parent: PageNode | null, depth: number) => {
    for (const n of list) {
      fn(n, parent, depth)
      if (n.children?.length) go(n.children, n, depth + 1)
    }
  }
  go(nodes, null, 0)
}

export interface Found {
  node: PageNode
  parent: PageNode | null
  index: number
  depth: number
  root: PageNode
  siblings: PageNode[]
}

export function findNode(nodes: PageNode[], id: string | null | undefined): Found | null {
  if (!id) return null
  const go = (list: PageNode[], parent: PageNode | null, depth: number, root: PageNode | null): Found | null => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i] as PageNode
      const r = root ?? n
      if (n.id === id) return { node: n, parent, index: i, depth, root: r, siblings: list }
      if (n.children?.length) {
        const f = go(n.children, n, depth + 1, r)
        if (f) return f
      }
    }
    return null
  }
  return go(nodes, null, 0, null)
}

/** Returns a new tree where `fn` replaced the node with this id. */
export function updateNode(nodes: PageNode[], id: string, fn: (n: PageNode) => PageNode): PageNode[] {
  return nodes.map((n) => {
    if (n.id === id) return fn(n)
    if (n.children?.length) {
      const children = updateNode(n.children, id, fn)
      return children === n.children ? n : { ...n, children }
    }
    return n
  })
}

export function removeNode(nodes: PageNode[], id: string): PageNode[] {
  return nodes
    .filter((n) => n.id !== id)
    .map((n) => (n.children?.length ? { ...n, children: removeNode(n.children, id) } : n))
}

/** Inserts `node` into `parentId` (null: the page) at `index`. */
export function insertNode(nodes: PageNode[], parentId: string | null, index: number, node: PageNode): PageNode[] {
  if (!parentId) {
    const next = [...nodes]
    next.splice(Math.max(0, Math.min(index, next.length)), 0, node)
    return next
  }
  return updateNode(nodes, parentId, (p) => {
    const children = [...(p.children ?? [])]
    children.splice(Math.max(0, Math.min(index, children.length)), 0, node)
    return { ...p, children }
  })
}

let seq = 0
export function newId(): string {
  seq = (seq + 1) % 1_000_000
  return `n${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 5)}`
}

/** A deep copy with fresh ids (duplicate, paste, insert from the library). */
export function cloneNode(n: PageNode): PageNode {
  return { ...structuredClone(n), id: newId(), children: n.children?.map(cloneNode) }
}

export function plainText(n: Pick<PageNode, 'text' | 'runs'>): string {
  return n.runs?.length ? n.runs.map((r) => r.t).join('') : (n.text ?? '')
}

// ---------- colors ----------

function rgba(hex: string, a: number): string {
  let h = String(hex || '#000000').replace('#', '')
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('')
  const n = Number.parseInt(h.slice(0, 6), 16)
  if (Number.isNaN(n)) return `rgba(0,0,0,${a})`
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

export type Palette = Record<string, string>

export function palette(theme: Theme): Palette {
  const c = theme.colors[theme.mode]
  const dark = theme.mode === 'dark'
  return {
    ...c,
    border: rgba(c.text, 0.12),
    borderInv: rgba(c.onInverse, 0.18),
    borderAcc: rgba(c.onAccent, 0.32),
    line: rgba(c.text, 0.28),
    lineInv: rgba(c.onInverse, 0.4),
    lineAcc: rgba(c.onAccent, 0.55),
    onInverseMuted: rgba(c.onInverse, 0.72),
    onAccentMuted: rgba(c.onAccent, 0.86),
    inverseSurface: rgba(c.onInverse, 0.08),
    accentSurface: rgba(c.onAccent, 0.12),
    photoBase: '#1b1a18',
    photoText: '#ffffff',
    photoMuted: 'rgba(255,255,255,.84)',
    photoBorder: 'rgba(255,255,255,.28)',
    photoLine: 'rgba(255,255,255,.6)',
    photoSurface: 'rgba(255,255,255,.12)',
    photoDark: '#141414',
    tone1: dark ? '#29261f' : '#e6e1d7',
    tone2: dark ? '#22282b' : '#d6dbdc',
    tone3: dark ? '#202020' : '#ebe6de',
  }
}

const SCHEME_MAPS: Record<string, Record<string, string>> = {
  surface: { bg: 'surface', surface: 'bg' },
  inverse: {
    bg: 'inverse',
    text: 'onInverse',
    muted: 'onInverseMuted',
    inverse: 'bg',
    onInverse: 'text',
    border: 'borderInv',
    line: 'lineInv',
    surface: 'inverseSurface',
  },
  photo: {
    bg: 'photoBase',
    text: 'photoText',
    muted: 'photoMuted',
    inverse: 'photoText',
    onInverse: 'photoDark',
    border: 'photoBorder',
    line: 'photoLine',
    surface: 'photoSurface',
  },
  accent: {
    bg: 'accent',
    text: 'onAccent',
    muted: 'onAccentMuted',
    accent: 'onAccent',
    onAccent: 'accent',
    border: 'borderAcc',
    line: 'lineAcc',
    surface: 'accentSurface',
  },
}

function color(C: Palette, token: string, scheme: string): string {
  const k = SCHEME_MAPS[scheme]?.[token] ?? token
  return C[k] ?? token
}

// ---------- rendering ----------

export interface RenderOptions {
  /**
   * `site`: load and scroll animations as published. `replay`: every animation plays once on load
   * (the editor's preview button). `none`: no motion (editing).
   */
  animations?: 'site' | 'replay' | 'none'
  /** Adds data-mz-id to every element, for the editor. */
  editor?: boolean
  /** Turns an image src into srcset candidates (library images have resized copies). */
  srcset?: (src: string) => string | undefined
  /** Leave out the shared base styles (when several renders share one stylesheet). */
  base?: boolean
}

type Style = Record<string, string>

const KEYFRAMES: Record<string, string> = {
  fade: 'mzFade',
  up: 'mzUp',
  down: 'mzDown',
  left: 'mzLeft',
  right: 'mzRight',
  zoom: 'mzZoom',
  zoomout: 'mzZoomOut',
  blur: 'mzBlur',
  reveal: 'mzReveal',
  tilt: 'mzTilt',
  pop: 'mzPop',
}

const BASE_CSS = `
.mz-page{container:mzpage/inline-size;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.mz-page *,.mz-page *::before,.mz-page *::after{box-sizing:border-box;margin:0}
.mz-page img{display:block;max-width:100%}
.mz-page a{color:inherit}
.mz-page .mz-n a{text-decoration:underline;text-underline-offset:.18em}
.mz-page .mz-ph{display:flex;align-items:center;justify-content:center}
.mz-page .mz-ph svg{width:28px;height:28px;opacity:.45}
.mz-page .mz-bgimg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0}
.mz-page .mz-bgdim{position:absolute;inset:0;z-index:0}
.mz-page [data-hover]{transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s,opacity .35s}
.mz-page [data-hover="lift"]:hover{transform:translateY(-6px);box-shadow:0 18px 40px rgba(0,0,0,.14)}
.mz-page [data-hover="grow"]:hover{transform:scale(1.03)}
.mz-page [data-hover="dim"]:hover{opacity:.72}
.mz-page [data-hover="zoomimg"] img{transition:transform .7s cubic-bezier(.2,.8,.2,1)}
.mz-page [data-hover="zoomimg"]:hover img{transform:scale(1.07)}
@keyframes mzFade{from{opacity:0}to{opacity:1}}
@keyframes mzUp{from{opacity:0;transform:translateY(28px)}to{opacity:1;transform:none}}
@keyframes mzDown{from{opacity:0;transform:translateY(-28px)}to{opacity:1;transform:none}}
@keyframes mzLeft{from{opacity:0;transform:translateX(-36px)}to{opacity:1;transform:none}}
@keyframes mzRight{from{opacity:0;transform:translateX(36px)}to{opacity:1;transform:none}}
@keyframes mzZoom{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes mzZoomOut{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:none}}
@keyframes mzBlur{from{opacity:0;filter:blur(14px)}to{opacity:1;filter:none}}
@keyframes mzReveal{from{clip-path:inset(0 0 100% 0)}to{clip-path:inset(0 0 0 0)}}
@keyframes mzTilt{from{opacity:0;transform:perspective(800px) rotateX(14deg) translateY(20px)}to{opacity:1;transform:none}}
@keyframes mzPop{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:none}}
`

const PLACEHOLDER_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Only web addresses, site paths, anchors, email and phone links. */
function safeHref(href: string | undefined): string {
  const h = (href ?? '').trim()
  if (!h) return '#'
  if (/^(https?:|mailto:|tel:|\/|#|\?)/i.test(h)) return h
  if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return '#'
  return h
}

const kebab = (k: string) => k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
const decl = (s: Style) =>
  Object.entries(s)
    .map(([k, v]) => `${kebab(k)}:${v}`)
    .join(';')

function textStyle(theme: Theme, style: TextStyle, bp: Breakpoint) {
  const s = TEXT_STYLES[style] ?? TEXT_STYLES.body
  let size = bp === 'desktop' ? s.d : bp === 'mobile' ? s.m : (s.d + s.m) / 2
  if (s.f !== 'mono') size *= theme.scale
  let w = s.w
  let ls = s.ls
  if (s.f === 'd' && theme.displayCategory === 'sans-serif' && !['Geist', 'Inter'].includes(theme.display)) {
    w = Math.max(w, 600)
    ls = style === 'logo' ? '-0.02em' : '-0.03em'
  }
  if (s.f === 'd' && theme.display === 'Geist') {
    w = 600
    ls = style === 'logo' ? '-0.02em' : '-0.035em'
  }
  if (s.f === 'd' && theme.display === 'Inter') {
    w = 600
    ls = style === 'logo' ? '-0.02em' : '-0.03em'
  }
  if (s.f === 'd' && theme.display === 'Fraunces') w = style === 'logo' ? 500 : 380
  const family =
    s.f === 'mono'
      ? MONO
      : s.f === 'd'
        ? fontStack(theme.display, theme.displayCategory)
        : fontStack(theme.body, theme.bodyCategory)
  return { family, size: Math.round(size * 10) / 10, w, lh: s.lh, ls, tt: s.tt }
}

interface Ctx {
  bp: Breakpoint
  depth: number
  scheme: string
  parent: { layout: string; wrap: boolean } | null
  inherit: { anim: Animation; dur?: string; delay?: number; trig?: string } | null
  idx: number
}

/** The CSS of one node at one breakpoint. */
function nodeStyle(
  n: PageNode,
  c: Ctx,
  theme: Theme,
  C: Palette,
): { style: Style; scheme: string; anim: Style | null } {
  const bp = c.bp
  const p = resolveNode(n, bp)
  const isF = n.type === 'frame'
  const isT = n.type === 'text'
  const isI = n.type === 'image'
  const isB = n.type === 'button'
  const isSec = c.depth === 0
  const own = isF && p.bgImage?.src ? 'photo' : isF && p.scheme && p.scheme !== 'default' ? p.scheme : null
  const scheme = own ?? (isSec ? 'default' : c.scheme)
  const changed = isSec || (!!own && own !== c.scheme)
  const col = (t: string) => color(C, t, scheme)
  const pl = c.parent?.layout ?? 'col'
  const s: Style = {}

  // size
  if (isSec) s.width = '100%'
  else if (pl === 'row') {
    s.flex = p.width === 'fill' || p.width === undefined ? (c.parent?.wrap ? '1 1 240px' : '1 1 0px') : '0 0 auto'
    s.width = p.width === 'fixed' ? `${p.fixedW ?? 240}px` : 'auto'
    s.minWidth = '0'
  } else if (pl === 'grid')
    s.width = p.width === 'fixed' ? `${p.fixedW ?? 240}px` : p.width === 'hug' ? 'fit-content' : 'auto'
  else s.width = p.width === 'fixed' ? `${p.fixedW ?? 240}px` : p.width === 'hug' ? 'fit-content' : '100%'
  s.maxWidth = p.maxW ? `${p.maxW}px` : p.width === 'fixed' ? '100%' : 'none'
  if (pl === 'col' && !isSec && p.width === 'hug') s.alignSelf = 'auto'

  // padding
  if (isSec) {
    const sizes = { xs: [20, 16], s: [56, 40], m: [104, 64], l: [140, 80] }
    const sz = sizes[p.size ?? 'm'] ?? sizes.m
    const py = bp === 'desktop' ? sz[0] : bp === 'mobile' ? sz[1] : Math.round(((sz[0] ?? 0) + (sz[1] ?? 0)) / 2)
    const gx = bp === 'desktop' ? 'max(56px, calc((100% - 1168px) / 2))' : bp === 'tablet' ? '40px' : '20px'
    s.padding = `${py}px ${gx}`
  } else if (isB) s.padding = `${p.padY ?? 14}px ${p.padX ?? 24}px`
  else s.padding = `${p.padY ?? 0}px ${p.padX ?? 0}px`

  // colors
  let bg = 'transparent'
  let fg = 'inherit'
  let border = 'none'
  if (changed) {
    bg = col('bg')
    fg = col('text')
  }
  if ((isF || isT) && p.bg) bg = col(p.bg)
  if (isT) fg = col(p.color ?? 'text')
  if (isI) bg = C[`tone${p.tone ?? 1}`] ?? C.tone1 ?? '#e6e1d7'
  if (isB) {
    if (p.variant === 'primary') {
      bg = col('accent')
      fg = col('onAccent')
    } else if (p.variant === 'secondary') {
      bg = col('inverse')
      fg = col('onInverse')
    } else {
      fg = col('text')
      border = `1px solid ${col('line')}`
    }
  }
  if (p.border) border = `1px solid ${col('border')}`
  s.background = bg
  s.color = isI ? col('muted') : fg
  s.border = border
  const sh: string[] = []
  if (p.divider) sh.push(`inset 0 -1px 0 ${col('border')}`)
  if (p.topline) sh.push(`inset 0 1px 0 ${col('border')}`)
  if (p.shadow === 'sm') sh.push('0 1px 2px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.08)')
  if (p.shadow === 'lg') sh.push('0 2px 6px rgba(0,0,0,.06), 0 24px 56px rgba(0,0,0,.16)')
  s.boxShadow = sh.length ? sh.join(', ') : 'none'
  const rad = (r: PageNode['radius']) =>
    r === 'btn' ? theme.btnRadius : r === 'card' ? theme.cardRadius : Number(r) || 0
  s.borderRadius = isSec ? '0' : `${rad(p.radius ?? (isI ? 'card' : isB ? 'btn' : 0))}px`

  // layout
  if (p.hidden) s.display = 'none'
  else if (isF) {
    s.display = p.layout === 'grid' ? 'grid' : 'flex'
    s.position = 'relative'
    if (p.layout === 'grid') s.gridTemplateColumns = `repeat(${p.cols ?? 3}, minmax(0, 1fr))`
    else {
      s.flexDirection = p.layout === 'row' ? 'row' : 'column'
      s.flexWrap = p.wrap ? 'wrap' : 'nowrap'
    }
    let gap = p.gap ?? 16
    const gapOver =
      bp !== 'desktop' && (n.over?.tablet?.gap !== undefined || (bp === 'mobile' && n.over?.mobile?.gap !== undefined))
    if (!gapOver && gap >= 32)
      gap = bp === 'mobile' ? Math.round(gap * 0.62) : bp === 'tablet' ? Math.round(gap * 0.8) : gap
    s.gap = `${gap}px`
    const al = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
    const jm = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }
    s.alignItems = al[p.align ?? 'start'] ?? 'flex-start'
    s.justifyContent = jm[p.justify ?? 'start'] ?? 'flex-start'
    if (p.bgImage?.src) s.overflow = 'hidden'
  } else if (isI) {
    s.display = 'block'
    s.aspectRatio = (p.ratio ?? '4/3').replace('/', ' / ')
    s.objectFit = p.fit ?? 'cover'
    s.objectPosition = p.focal ? `${p.focal.x}% ${p.focal.y}%` : '50% 50%'
    s.overflow = 'hidden'
    s.height = 'auto'
  } else if (isB) {
    s.display = 'inline-flex'
    s.alignItems = 'center'
    s.justifyContent = 'center'
    s.textDecoration = 'none'
    s.whiteSpace = 'nowrap'
    s.transition = 'filter .2s, transform .2s'
  } else s.display = 'block'

  // type
  if (isT || isB) {
    const st = textStyle(theme, p.style ?? (isB ? 'button' : 'body'), bp)
    s.fontFamily = st.family
    s.fontSize = `${p.fontSize ?? st.size}px`
    s.fontWeight = String(p.weight ?? st.w)
    s.lineHeight = String(st.lh)
    s.letterSpacing = st.ls
    s.textTransform = st.tt
    s.textAlign = isT ? (p.talign ?? 'left') : 'center'
    if (isT) {
      s.whiteSpace = 'pre-wrap'
      s.textWrap = (p.style ?? 'body').match(/^(display|h1|h2|h3)$/) ? 'balance' : 'pretty'
    }
  }

  // motion
  let A: Animation = p.anim ?? 'none'
  let D = p.animDur ?? 'm'
  let DL = p.animDelay ?? 0
  let TR = p.animTrig ?? 'load'
  let extra = 0
  if (c.inherit && A === 'none') {
    A = c.inherit.anim
    D = (c.inherit.dur as typeof D) ?? 'm'
    DL = (c.inherit.delay as typeof DL) ?? 0
    TR = (c.inherit.trig as typeof TR) ?? 'load'
    extra = c.idx * 0.09
  }
  if (isF && p.stagger) A = 'none'
  let anim: Style | null = null
  const kf = KEYFRAMES[A]
  if (kf) {
    const dur = { s: 0.5, m: 0.9, l: 1.4 }[D] ?? 0.9
    const delay = ([0, 0.15, 0.3, 0.6][DL] ?? 0) + extra
    const ease = A === 'pop' ? 'cubic-bezier(.34,1.56,.64,1)' : 'cubic-bezier(.2,.8,.2,1)'
    anim = { kf, dur: `${dur}s`, delay: `${delay.toFixed(2)}s`, ease, trig: TR }
  }
  return { style: s, scheme, anim }
}

function diff(base: Style, next: Style): Style {
  const out: Style = {}
  for (const [k, v] of Object.entries(next)) if (base[k] !== v) out[k] = v
  for (const k of Object.keys(base)) if (!(k in next)) out[k] = 'initial'
  return out
}

const TAGS: Record<string, string> = { display: 'h1', h1: 'h1', h2: 'h2', h3: 'h3' }

/**
 * Renders sections to HTML and the CSS that styles them. Wrap the HTML in an element with the
 * `mz-page` class (`renderPage` does it), so the container queries and base styles apply.
 */
export function renderSections(
  sections: PageNode[],
  theme: Theme = DEFAULT_THEME,
  options: RenderOptions = {},
): { html: string; css: string } {
  const C = palette(theme)
  const mode = options.animations ?? 'site'
  const desktop: string[] = []
  const tablet: string[] = []
  const mobile: string[] = []
  const motion: string[] = []
  const scroll: string[] = []
  let h1Used = false

  const render = (n: PageNode, c: Omit<Ctx, 'bp'>): string => {
    const at = (bp: Breakpoint) => nodeStyle(n, { ...c, bp }, theme, C)
    const d = at('desktop')
    const t = at('tablet')
    const m = at('mobile')
    const cls = `n-${n.id.replace(/[^\w-]/g, '')}`
    desktop.push(`.mz-page .${cls}{${decl(d.style)}}`)
    const td = diff(d.style, t.style)
    if (Object.keys(td).length) tablet.push(`.mz-page .${cls}{${decl(td)}}`)
    const md = diff(t.style, m.style)
    if (Object.keys(md).length) mobile.push(`.mz-page .${cls}{${decl(md)}}`)
    if (d.anim && mode !== 'none') {
      const a = d.anim
      const timed = `${a.kf} ${a.dur} ${a.ease} ${a.delay} both`
      if (mode === 'site' && a.trig === 'scroll')
        scroll.push(
          `.mz-page .${cls}{animation:${a.kf} linear both;animation-timeline:view();animation-range:entry 5% cover 30%}`,
        )
      else motion.push(`.mz-page .${cls}{animation:${timed}}`)
    }

    const p = n
    const attrs = [`class="mz-n ${cls}"`]
    if (options.editor) attrs.push(`data-mz-id="${esc(n.id)}"`, `data-mz-type="${n.type}"`)
    if (p.hover && p.hover !== 'none') attrs.push(`data-hover="${p.hover}"`)

    if (n.type === 'frame') {
      const scheme = d.scheme
      const isSec = c.depth === 0
      const tag = isSec
        ? p.section?.startsWith('nav')
          ? 'header'
          : p.section?.startsWith('footer')
            ? 'footer'
            : 'section'
        : 'div'
      const inherit =
        p.stagger && p.anim && p.anim !== 'none'
          ? { anim: p.anim, dur: p.animDur, delay: p.animDelay, trig: p.animTrig }
          : null
      const bgImg = p.bgImage?.src
        ? `<img class="mz-bgimg" src="${esc(p.bgImage.src)}" alt=""${srcsetAttr(p.bgImage.src, options)} sizes="100vw"><div class="mz-bgdim" style="background:rgba(0,0,0,${p.bgDim ?? 0.45})"></div>`
        : ''
      const kids = (n.children ?? [])
        .map((ch, i) =>
          render(ch, {
            depth: c.depth + 1,
            scheme,
            parent: { layout: p.layout ?? 'col', wrap: !!p.wrap },
            inherit,
            idx: i,
          }),
        )
        .join('')
      const content = bgImg ? `${bgImg}<div style="display:contents">${kids}</div>` : kids
      // Children above the background photo.
      if (bgImg) desktop.push(`.mz-page .${cls}>.mz-n,.mz-page .${cls}>div>.mz-n{position:relative;z-index:1}`)
      return `<${tag} ${attrs.join(' ')}>${content}</${tag}>`
    }
    if (n.type === 'text') {
      const style = p.style ?? 'body'
      let tag = TAGS[style] ?? 'p'
      if (tag === 'h1') {
        if (h1Used) tag = 'h2'
        h1Used = true
      }
      return `<${tag} ${attrs.join(' ')}>${runsHtml(p)}</${tag}>`
    }
    if (n.type === 'button') {
      const target = p.newTab ? ' target="_blank" rel="noopener"' : ''
      return `<a ${attrs.join(' ')} href="${esc(safeHref(p.href))}"${target}>${esc(p.text ?? '')}</a>`
    }
    // image
    if (!p.src) {
      return `<div ${attrs.join(' ').replace('class="mz-n ', 'class="mz-n mz-ph ')} role="img" aria-label="${esc(p.alt || p.name || 'Immagine')}">${PLACEHOLDER_ICON}</div>`
    }
    return `<img ${attrs.join(' ')} src="${esc(p.src)}" alt="${esc(p.alt ?? '')}"${srcsetAttr(p.src, options)} loading="lazy" decoding="async">`
  }

  const html = sections
    .map((s, i) => render(s, { depth: 0, scheme: 'default', parent: null, inherit: null, idx: i }))
    .join('')
  const reduced = (rules: string[]) =>
    rules.length ? `@media (prefers-reduced-motion:no-preference){${rules.join('')}}` : ''
  const css = [
    options.base === false ? '' : BASE_CSS,
    desktop.join(''),
    tablet.length ? `@container mzpage (max-width:${BREAKPOINTS.tablet}px){${tablet.join('')}}` : '',
    mobile.length ? `@container mzpage (max-width:${BREAKPOINTS.mobile}px){${mobile.join('')}}` : '',
    reduced(motion),
    scroll.length ? reduced([`@supports (animation-timeline:view()){${scroll.join('')}}`]) : '',
  ].join('\n')
  return { html, css }
}

function srcsetAttr(src: string, options: RenderOptions): string {
  const set = options.srcset?.(src)
  return set ? ` srcset="${esc(set)}"` : ''
}

function runsHtml(p: PageNode): string {
  const runs = p.runs?.length ? p.runs : [{ t: p.text ?? '' }]
  return runs
    .map((r) => {
      let h = esc(r.t).replace(/\n/g, '<br>')
      if (r.b) h = `<strong>${h}</strong>`
      if (r.i) h = `<em>${h}</em>`
      if (r.href) h = `<a href="${esc(safeHref(r.href))}">${h}</a>`
      return h
    })
    .join('')
}

/** Resized copies of library images (`/media/…`), as the server prepares them. */
export function librarySrcset(src: string): string | undefined {
  if (!src.startsWith('/media/') || /\.(gif|svg)$/i.test(src)) return undefined
  return [320, 640, 960, 1280, 1920].map((w) => `${src}@${w}.webp ${w}w`).join(', ')
}

/** The page's root styles: background, text color and body font. */
export function pageRootStyle(theme: Theme = DEFAULT_THEME): string {
  const C = palette(theme)
  return `background:${C.bg};color:${C.text};font-family:${fontStack(theme.body, theme.bodyCategory)}`
}

/** A complete page fragment: root element, HTML and CSS. */
export function renderPage(sections: PageNode[], theme: Theme = DEFAULT_THEME, options: RenderOptions = {}) {
  const { html, css } = renderSections(sections, theme, options)
  return { html: `<div class="mz-page" style="${pageRootStyle(theme)}">${html}</div>`, css }
}

/** Fills theme fields missing from stored data (older versions, partial edits). */
export function normalizeTheme(value: unknown): Theme {
  const t = (value && typeof value === 'object' ? value : {}) as Partial<Theme>
  return {
    ...DEFAULT_THEME,
    ...t,
    colors: {
      light: { ...DEFAULT_THEME.colors.light, ...(t.colors?.light ?? {}) },
      dark: { ...DEFAULT_THEME.colors.dark, ...(t.colors?.dark ?? {}) },
    },
  }
}
