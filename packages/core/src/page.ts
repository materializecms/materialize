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

/** A length: a number of pixels, or a CSS length with its unit ("50%", "2rem", "10vw"…). */
export type Length = number | string

export const UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh', 'ch'] as const
const LENGTH = /^(-?\d*\.?\d+)(px|%|em|rem|vw|vh|svh|ch)$/

/** A Length as CSS; anything that is not a plain number with a known unit is ignored. */
export function cssLength(v: Length | null | undefined, fallback = '0px'): string {
  if (v === null || v === undefined || v === '') return fallback
  if (typeof v === 'number') return Number.isFinite(v) ? `${v}px` : fallback
  const m = LENGTH.exec(v.trim())
  if (!m) return fallback
  // Screen heights follow the visible area on phones; widths follow the page, which on the site is
  // the screen and in the editor is the device being shown.
  return m[2] === 'vh' ? `${m[1]}svh` : m[2] === 'vw' ? `${m[1]}cqw` : `${m[1]}${m[2]}`
}

/** The number and the unit of a Length, for editing. */
export function splitLength(v: Length | null | undefined): { n: number | null; unit: string } {
  if (v === null || v === undefined || v === '') return { n: null, unit: 'px' }
  if (typeof v === 'number') return { n: v, unit: 'px' }
  const m = LENGTH.exec(v.trim())
  return m ? { n: Number(m[1]), unit: m[2] === 'svh' ? 'vh' : (m[2] as string) } : { n: null, unit: 'px' }
}

export interface NodeProps {
  name?: string
  hidden?: boolean
  width?: 'fill' | 'hug' | 'fixed'
  fixedW?: Length
  maxW?: Length | null
  padX?: Length
  padY?: Length
  radius?: Length | 'btn' | 'card'
  border?: boolean
  divider?: boolean
  topline?: boolean
  shadow?: 'none' | 'sm' | 'lg'
  /** A theme color, or any CSS color. */
  bg?: ColorToken | string | null
  anim?: Animation
  animDur?: 's' | 'm' | 'l'
  animDelay?: 0 | 1 | 2 | 3
  animTrig?: 'load' | 'scroll'
  hover?: 'none' | 'lift' | 'grow' | 'dim' | 'zoomimg'
  /** Interactions played by the motion runtime (scroll, hover, click, pointer…). */
  interactions?: Interaction[] | null
  /** Stays in place while its container scrolls past (position: sticky); on a section, a fixed menu. */
  sticky?: boolean
  /** Fixed section: hides while scrolling down, comes back when scrolling up. */
  stickyHide?: boolean
  /** Fixed section: frosted glass once the page has scrolled. */
  stickyGlass?: boolean
  /** Fixed section: lies over the section below instead of pushing it down. */
  stickyOverlay?: boolean
  stickyTop?: Length
  /** Minimum height, in percent of the screen height. */
  minH?: number | null
  /** Background gradient (colors are theme tokens or CSS colors). */
  gradient?: Gradient | null
  /** Text filled with a gradient. */
  textGradient?: Gradient | null
  /** A font for this element only (otherwise the theme's). */
  font?: { family: string; category?: string } | null
  /** Letter spacing in em, line height as a multiple of the size. */
  tracking?: number | null
  leading?: number | null
  italic?: boolean
  upper?: boolean
  /** Free placement inside the container, in px from its edges. */
  pos?: 'flow' | 'absolute'
  top?: Length | null
  left?: Length | null
  right?: Length | null
  bottom?: Length | null
  z?: number | null
  /** Rotation in degrees and opacity 0–1, at rest. */
  rot?: number | null
  opa?: number | null
  blend?: 'normal' | 'multiply' | 'screen' | 'overlay' | 'difference' | 'exclusion' | 'soft-light' | null
  blurFx?: number | null
  gray?: number | null
  /** Frosted glass: blur of what is behind, in px. */
  glass?: number | null
  /** Height: px, or percent of the screen height. */
  h?: Length | null
  hUnit?: 'px' | 'vh'
  /** Columns and rows taken in a grid. */
  span?: number | null
  rowSpan?: number | null
  borderW?: Length | null
  borderColor?: ColorToken | string | null
  overflow?: 'visible' | 'hidden' | null
  // video
  poster?: string | null
  controls?: boolean
  // embed
  html?: string
  /** A WebGL scene: the element itself (type "scene") or a frame's background. */
  scene?: SceneConfig | null
  /** Section address for links within the page: #anchor. */
  anchor?: string | null
  /** A list fed by a collection: the first child is repeated for each entry. */
  bind?: { collection: string; limit?: number } | null
  /** Inside a bound list: which field of the entry fills this element ("title", "url", or a field name). */
  field?: string | null
  /** A frame whose children scroll endlessly sideways. */
  marquee?: { duration: number; reverse?: boolean } | null
  // frame
  layout?: 'col' | 'row' | 'grid'
  gap?: Length
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
  color?: ColorToken | string
  talign?: 'left' | 'center' | 'right'
  fontSize?: Length | null
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

/** A WebGL scene: a preset shader with its colors and how it reacts. */
export interface SceneConfig {
  preset:
    | 'mesh'
    | 'waves'
    | 'aurora'
    | 'marble'
    | 'particles'
    | 'liquid'
    | 'grain'
    | 'plasma'
    | 'tunnel'
    | 'ripples'
    | 'lines'
    | 'dots'
    | 'smoke'
    | 'stars'
    | 'cells'
    | 'silk'
    | 'prism'
    | 'distort'
    | 'halftone'
    | 'glitch'
    | 'pixel'
    | 'model'
    | 'shapes'
    | 'custom'
  /** Three colors: theme tokens or CSS colors. */
  colors?: [string, string, string]
  speed?: number
  intensity?: number
  /** How much the pointer and the scroll move it (0–2). */
  mouse?: number
  scroll?: number
  /** distort: the picture to bend. */
  image?: string | null
  /** custom: the body of a GLSL fragment shader (void main(){…}). */
  code?: string
  /** model: a .glb file; shapes: which generated shape. */
  model?: string | null
  shape?: 'blob' | 'knot' | 'torus' | 'cube' | 'spheres' | 'rings'
  /** 3D surfaces; "original" keeps the model's own. */
  material?: 'chrome' | 'glass' | 'clay' | 'iridescent' | 'wire' | 'original'
  /** 3D: turning speed and camera distance. */
  rotate?: number
  zoom?: number
  /** 3D: no background, the section shows through. */
  transparent?: boolean
}

export interface Gradient {
  from: string
  to: string
  angle: number
}

export interface PageNode extends NodeProps {
  id: string
  /** A copy of a reusable component: its design comes from the component, its content can be its own. */
  component?: string
  /** Which variant of the component this copy shows. */
  componentVariant?: string
  /** Content this copy changes, by the id of the element inside the component. */
  overrides?: Record<string, Partial<NodeProps>> | null
  /** A section shared by every page that uses it (menu, footer): the content lives in the site's globals. */
  global?: string
  type: 'frame' | 'text' | 'image' | 'button' | 'video' | 'embed' | 'scene'
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
  /** Site-wide experience: inertial scrolling, custom cursor, transitions between pages. */
  smoothScroll?: boolean
  cursor?: 'default' | 'dot' | 'ring'
  transition?: 'none' | 'fade' | 'slide'
}

/** What an interaction changes: offsets in px, rotations in degrees, opacity 0–1, blur in px, clip in %. */
export interface MotionProps {
  x?: number
  y?: number
  scale?: number
  rotate?: number
  rx?: number
  ry?: number
  opacity?: number
  blur?: number
  clip?: number
}

export type Ease = 'linear' | 'out' | 'inOut' | 'expo' | 'back' | 'spring'

export interface Keyframe {
  id: string
  /** Where on the timeline, 0–1. */
  at: number
  props: MotionProps
  /** The curve that leads to this keyframe from the previous one. */
  ease?: Ease
}

export interface Interaction {
  id: string
  /**
   * load: when the page opens · view: when it enters the screen · scroll: follows the scroll ·
   * hover: while the pointer is over it · click: toggles on click · mouse: follows the pointer.
   */
  trigger: 'load' | 'view' | 'scroll' | 'hover' | 'click' | 'mouse'
  from?: MotionProps
  to?: MotionProps
  /**
   * A timeline: states at points of the progress (0–1), each reached with its own curve.
   * When there are two or more, they replace from/to.
   */
  keys?: Keyframe[] | null
  /** Seconds. */
  duration?: number
  delay?: number
  ease?: Ease
  /** view: play only the first time. */
  once?: boolean
  /** scroll: the part of the element's way through the screen that drives the animation (0–1). */
  range?: [number, number]
  /** Text only: animate each word or letter, one after the other. */
  split?: 'none' | 'words' | 'chars'
  stagger?: number
  /** Counts up to the number in the text. */
  count?: boolean
  /** Where the clip reveals from. */
  clipSide?: 'bottom' | 'top' | 'left' | 'right'
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

/** Every font a page uses: the theme's and those chosen for single elements. */
export function pageFontLinks(theme: Theme, nodes: PageNode[] = []): string[] {
  const families = new Set([theme.display, theme.body])
  walk(nodes, (n) => {
    if (n.font?.family) families.add(n.font.family)
  })
  return [...families].filter((f) => !FONTS[f]).map((f) => `/fonts/${fontId(f)}.css`)
}

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

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%deg]+\)|transparent)$/i

function color(C: Palette, token: string, scheme: string): string {
  const k = SCHEME_MAPS[scheme]?.[token] ?? token
  if (C[k]) return C[k] as string
  // A color picked freely; anything else could break out of the stylesheet.
  return SAFE_COLOR.test(token.trim()) ? token.trim() : 'inherit'
}

const gradientCss = (g: Gradient, col: (t: string) => string) =>
  `linear-gradient(${Math.round(Number(g.angle) || 0)}deg, ${col(g.from)}, ${col(g.to)})`

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
  /** Entries of the collections that bound lists show, by collection name. */
  data?: Record<string, BoundEntry[]>
}

/** What a bound list needs from an entry. */
export interface BoundEntry {
  title: string
  url: string | null
  data: Record<string, unknown>
}

/** A value of an entry for a bound element: "title" and "url" first, then the entry's own fields. */
export function entryValue(entry: BoundEntry, field: string): unknown {
  if (field === 'title') return entry.title
  if (field === 'url') return entry.url
  return field
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), entry.data)
}

/** A reusable component: one or more variants of the same element, shared by every page. */
export interface Component {
  id: string
  name: string
  /** Made from a whole section: copies go between sections. */
  section?: boolean
  variants: { id: string; name: string; node: PageNode }[]
}

/** What a copy of a component keeps for itself: its content and where it sits. */
export const OVERRIDE_KEYS = ['text', 'runs', 'src', 'alt', 'href', 'newTab', 'poster', 'focal'] as const
const PLACEMENT_KEYS = [
  'pos',
  'top',
  'left',
  'right',
  'bottom',
  'z',
  'width',
  'fixedW',
  'span',
  'rowSpan',
  'hidden',
  'name',
] as const
const SEP = '~'

function mapTree(n: PageNode, fn: (n: PageNode) => PageNode): PageNode {
  const out = fn(n)
  return out.children ? { ...out, children: out.children.map((c) => mapTree(c, fn)) } : out
}

/** Puts each component's content in place of its copies (ids become "copy~element", unique on the page). */
export function expandComponents(nodes: PageNode[], components: Record<string, Component>, depth = 0): PageNode[] {
  if (depth > 4) return nodes
  return nodes.map((n) => {
    let node = n
    const def = n.component ? components[n.component] : undefined
    if (def) {
      const variant = def.variants.find((v) => v.id === n.componentVariant) ?? def.variants[0]
      if (variant) {
        const prefix = `${n.id}${SEP}`
        const tree = mapTree(structuredClone(variant.node), (c) => {
          const own = n.overrides?.[c.id]
          return { ...c, ...own, id: c.id === variant.node.id ? n.id : prefix + c.id }
        })
        const placement: Partial<PageNode> = {}
        for (const k of PLACEMENT_KEYS)
          if (n[k] !== undefined) (placement as unknown as Record<string, unknown>)[k] = n[k]
        node = {
          ...tree,
          ...placement,
          component: n.component,
          componentVariant: variant.id,
          overrides: n.overrides ?? null,
        }
      }
    }
    return node.children ? { ...node, children: expandComponents(node.children, components, depth + 1) } : node
  })
}

/**
 * The other way round: copies become references again. Content changed in a copy is kept as its
 * overrides; design and structure changes go to the component, for every copy.
 */
export function collapseComponents(
  nodes: PageNode[],
  components: Record<string, Component>,
): { nodes: PageNode[]; components: Record<string, Component> } {
  const next: Record<string, Component> = { ...components }
  const visit = (list: PageNode[]): PageNode[] =>
    list.map((raw) => {
      const n = raw.children ? { ...raw, children: visit(raw.children) } : raw
      // Each copy is compared with the component as it was: only copies that changed update it.
      const def = n.component ? components[n.component] : undefined
      if (!def) return n
      const variant = def.variants.find((v) => v.id === n.componentVariant) ?? def.variants[0]
      if (!variant) return n
      const prefix = `${n.id}${SEP}`
      const original = new Map<string, PageNode>()
      walk([variant.node], (c) => original.set(c.id, c))
      const overrides: Record<string, Partial<NodeProps>> = {}
      const tree = mapTree(n, (c) => {
        const id = c.id === n.id ? variant.node.id : c.id.startsWith(prefix) ? c.id.slice(prefix.length) : c.id
        const before = original.get(id)
        const out: PageNode = { ...c, id }
        if (before) {
          const own: Partial<NodeProps> = {}
          for (const k of OVERRIDE_KEYS) {
            if (JSON.stringify(c[k] ?? null) !== JSON.stringify(before[k] ?? null)) {
              ;(own as unknown as Record<string, unknown>)[k] = c[k] ?? null
              ;(out as unknown as Record<string, unknown>)[k] = before[k]
            }
          }
          if (Object.keys(own).length) overrides[id] = own
        }
        return out
      })
      const root: PageNode = { ...tree }
      delete root.component
      delete root.componentVariant
      delete root.overrides
      for (const k of PLACEMENT_KEYS) (root as unknown as Record<string, unknown>)[k] = variant.node[k]
      for (const k of PLACEMENT_KEYS) if (root[k] === undefined) delete root[k]
      if (JSON.stringify(root) !== JSON.stringify(variant.node)) {
        const latest = next[def.id] ?? def
        next[def.id] = {
          ...latest,
          variants: latest.variants.map((v) => (v.id === variant.id ? { ...v, node: root } : v)),
        }
      }
      const ref: PageNode = { id: n.id, type: 'frame', component: def.id, componentVariant: variant.id }
      if (Object.keys(overrides).length) ref.overrides = overrides
      for (const k of PLACEMENT_KEYS) if (n[k] !== undefined) (ref as unknown as Record<string, unknown>)[k] = n[k]
      return ref
    })
  return { nodes: visit(nodes), components: next }
}

/** Turns an element into a component; the page keeps a copy of it. */
export function makeComponent(node: PageNode, name: string): { component: Component; ref: PageNode } {
  const id = newId()
  const variant = { id: newId(), name: 'Predefinita', node: { ...structuredClone(node), id: newId() } }
  for (const k of PLACEMENT_KEYS) if (k !== 'name') delete variant.node[k]
  const ref: PageNode = { id: node.id, type: 'frame', component: id, componentVariant: variant.id, name }
  for (const k of PLACEMENT_KEYS)
    if (k !== 'name' && node[k] !== undefined) (ref as unknown as Record<string, unknown>)[k] = node[k]
  return { component: { id, name, variants: [variant] }, ref }
}

/** A standalone copy of a component's content, with fresh ids. */
export function detachComponent(n: PageNode): PageNode {
  const { component: _c, componentVariant: _v, overrides: _o, ...rest } = n
  return cloneNode(rest as PageNode)
}

/** Puts the shared content of global sections in place of their references. */
export function expandGlobals(nodes: PageNode[], globals: Record<string, PageNode>): PageNode[] {
  return nodes.map((n) => {
    const g = n.global ? globals[n.global] : undefined
    return g ? { ...g, id: n.id, global: n.global } : n
  })
}

/** The other way round: references for the page, and the content of each global section. */
export function collapseGlobals(nodes: PageNode[]): { nodes: PageNode[]; globals: Record<string, PageNode> } {
  const globals: Record<string, PageNode> = {}
  const out = nodes.map((n) => {
    if (!n.global) return n
    const { id: _, ...content } = n
    globals[n.global] = { ...content, id: n.global }
    return { id: n.id, type: 'frame' as const, global: n.global, name: n.name }
  })
  return { nodes: out, globals }
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
.mz-page .mz-n a:not(.mz-n){text-decoration:underline;text-underline-offset:.18em}
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
.mz-page .mz-scene{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0}
.mz-page [data-mz-sticky]{transition:transform .45s cubic-bezier(.2,.8,.2,1),background-color .3s,backdrop-filter .3s,box-shadow .3s}
.mz-page [data-mz-sticky].mz-away{transform:translateY(-100%)}
.mz-page [data-mz-sticky~="glass"].mz-scrolled{background:color-mix(in srgb,var(--mz-sticky-bg) 72%,transparent)!important;backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);box-shadow:0 1px 0 color-mix(in srgb,currentColor 10%,transparent)}
@keyframes mzMarquee{to{transform:translateX(calc(-50% - var(--mz-gap, 0px) / 2))}}
@media (prefers-reduced-motion:reduce){.mz-page .mz-track{animation:none!important}}
.mz-page [data-mz-split] > span{display:inline-block;white-space:pre;background-image:inherit;-webkit-background-clip:inherit;background-clip:inherit}
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
  /** A repeated copy (marquee): not editable, hidden from assistive technology. */
  ghost?: boolean
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
  const isV = n.type === 'video'
  const isE = n.type === 'embed'
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
    s.width = p.width === 'fixed' ? cssLength(p.fixedW, '240px') : 'auto'
    s.minWidth = '0'
  } else if (pl === 'grid')
    s.width = p.width === 'fixed' ? cssLength(p.fixedW, '240px') : p.width === 'hug' ? 'fit-content' : 'auto'
  else s.width = p.width === 'fixed' ? cssLength(p.fixedW, '240px') : p.width === 'hug' ? 'fit-content' : '100%'
  s.maxWidth = p.maxW ? cssLength(p.maxW, 'none') : p.width === 'fixed' ? '100%' : 'none'
  if (pl === 'col' && !isSec && p.width === 'hug') s.alignSelf = 'auto'

  // padding
  if (isSec) {
    const sizes = { xs: [20, 16], s: [56, 40], m: [104, 64], l: [140, 80] }
    const sz = sizes[p.size ?? 'm'] ?? sizes.m
    const py = bp === 'desktop' ? sz[0] : bp === 'mobile' ? sz[1] : Math.round(((sz[0] ?? 0) + (sz[1] ?? 0)) / 2)
    const gx = bp === 'desktop' ? 'max(56px, calc((100% - 1168px) / 2))' : bp === 'tablet' ? '40px' : '20px'
    s.padding = `${py}px ${gx}`
  } else if (isB) s.padding = `${cssLength(p.padY ?? 14)} ${cssLength(p.padX ?? 24)}`
  else s.padding = `${cssLength(p.padY)} ${cssLength(p.padX)}`

  // colors
  let bg = 'transparent'
  let fg = 'inherit'
  let border = 'none'
  if (changed) {
    bg = col('bg')
    fg = col('text')
  }
  if ((isF || isT || isE) && p.bg) bg = col(p.bg)
  if (isF && p.gradient) bg = gradientCss(p.gradient, col)
  if (isT) fg = col(p.color ?? 'text')
  if (isI || isV) bg = C[`tone${p.tone ?? 1}`] ?? C.tone1 ?? '#e6e1d7'
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
  if (p.borderW) border = `${cssLength(p.borderW)} solid ${col(p.borderColor ?? 'border')}`
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
    r === 'btn'
      ? `${theme.btnRadius}px`
      : r === 'card'
        ? `${theme.cardRadius}px`
        : cssLength(typeof r === 'string' && /^\d+$/.test(r) ? Number(r) : r)
  s.borderRadius = isSec ? '0' : rad(p.radius ?? (isI || isV ? 'card' : isB ? 'btn' : 0))

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
    // Big pixel gaps shrink on smaller screens; relative units already scale.
    if (!gapOver && typeof gap === 'number' && gap >= 32)
      gap = bp === 'mobile' ? Math.round(gap * 0.62) : bp === 'tablet' ? Math.round(gap * 0.8) : gap
    s.gap = cssLength(gap)
    const al = { start: 'flex-start', center: 'center', end: 'flex-end', stretch: 'stretch' }
    const jm = { start: 'flex-start', center: 'center', end: 'flex-end', between: 'space-between' }
    s.alignItems = al[p.align ?? 'start'] ?? 'flex-start'
    s.justifyContent = jm[p.justify ?? 'start'] ?? 'flex-start'
    if (p.bgImage?.src || p.marquee || p.scene) s.overflow = 'hidden'
  } else if (n.type === 'scene') {
    s.display = 'block'
    s.position = 'relative'
    s.overflow = 'hidden'
    s.aspectRatio = p.h ? 'auto' : (p.ratio ?? '16/9').replace('/', ' / ')
  } else if (isI || isV) {
    s.display = 'block'
    s.aspectRatio = p.h ? 'auto' : (p.ratio ?? (isV ? '16/9' : '4/3')).replace('/', ' / ')
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

  if (p.sticky && isSec) {
    s.position = 'sticky'
    s.top = '0'
    s.zIndex = '50'
    s['--mz-sticky-bg'] = color(C, 'bg', scheme)
    // Over the next section: transparent until the page scrolls.
    if (p.stickyOverlay && !p.scheme) s.background = 'transparent'
  }
  if (p.sticky && !isSec) {
    s.position = 'sticky'
    s.top = cssLength(p.stickyTop ?? 24)
    s.alignSelf = 'flex-start'
    s.zIndex = '2'
  }
  if (p.minH) s.minHeight = `${p.minH}svh`
  if (p.h) s.height = typeof p.h === 'number' && p.hUnit === 'vh' ? `${p.h}svh` : cssLength(p.h)
  if (pl === 'grid' && !isSec) {
    if (p.span && p.span > 1) s.gridColumn = `span ${p.span}`
    if (p.rowSpan && p.rowSpan > 1) s.gridRow = `span ${p.rowSpan}`
  }
  if (p.overflow) s.overflow = p.overflow
  if (p.pos === 'absolute' && !isSec) {
    s.position = 'absolute'
    for (const side of ['top', 'left', 'right', 'bottom'] as const) {
      const v = p[side]
      if (v !== null && v !== undefined) s[side] = cssLength(v)
    }
    // Pinned to both sides: it stretches between them.
    if (p.left != null && p.right != null) s.width = 'auto'
    s.flex = 'none'
    s.margin = '0'
  }
  if (p.z != null) s.zIndex = String(p.z)
  if (p.rot) s.rotate = `${p.rot}deg`
  if (p.opa != null && p.opa < 1) s.opacity = String(p.opa)
  if (p.blend && p.blend !== 'normal') s.mixBlendMode = p.blend
  const fx = [p.blurFx ? `blur(${p.blurFx}px)` : '', p.gray ? `grayscale(${p.gray}%)` : ''].filter(Boolean)
  if (fx.length) s.filter = fx.join(' ')
  if (p.glass) {
    s.backdropFilter = `blur(${p.glass}px)`
    s.WebkitBackdropFilter = `blur(${p.glass}px)`
  }
  if (isE) {
    s.display = p.hidden ? 'none' : 'block'
    if (!p.h) s.minHeight = '40px'
  }

  // type
  if (isT || isB) {
    const st = textStyle(theme, p.style ?? (isB ? 'button' : 'body'), bp)
    s.fontFamily = st.family
    s.fontSize = p.fontSize != null ? cssLength(p.fontSize, `${st.size}px`) : `${st.size}px`
    s.fontWeight = String(p.weight ?? st.w)
    s.lineHeight = String(p.leading ?? st.lh)
    s.letterSpacing = p.tracking != null ? `${p.tracking}em` : st.ls
    s.textTransform = p.upper ? 'uppercase' : st.tt
    if (p.font?.family) s.fontFamily = fontStack(p.font.family, p.font.category)
    if (p.italic) s.fontStyle = 'italic'
    if (p.textGradient && isT) {
      s.backgroundImage = gradientCss(p.textGradient, col)
      s.WebkitBackgroundClip = 'text'
      s.backgroundClip = 'text'
      s.WebkitTextFillColor = 'transparent'
    }
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
    if (options.editor && !c.ghost) attrs.push(`data-mz-id="${esc(n.id)}"`, `data-mz-type="${n.type}"`)
    if (c.depth === 0 && p.sticky)
      attrs.push(
        `data-mz-sticky="${[p.stickyHide && 'hide', p.stickyGlass && 'glass', p.stickyOverlay && 'overlay'].filter(Boolean).join(' ')}"`,
      )
    if (c.depth === 0 && p.anchor && /^[a-z][a-z0-9-]*$/.test(p.anchor)) attrs.push(`id="${p.anchor}"`)
    if (p.interactions?.length) attrs.push(`data-mz-motion="${esc(JSON.stringify(p.interactions))}"`)
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
      const scene = p.scene ? sceneCanvas(p.scene, (t) => color(C, t, d.scheme)) : ''
      if (p.scene)
        desktop.push(`.mz-page .${cls}{background-image:${sceneFallback(p.scene, (t) => color(C, t, d.scheme))}}`)
      const bgImg =
        scene ||
        (p.bgImage?.src
          ? `<img class="mz-bgimg" src="${esc(p.bgImage.src)}" alt=""${srcsetAttr(p.bgImage.src, options)} sizes="100vw"><div class="mz-bgdim" style="background:rgba(0,0,0,${p.bgDim ?? 0.45})"></div>`
          : '')
      const renderKids = (ghost: boolean) =>
        (n.children ?? [])
          .map((ch, i) =>
            render(ch, {
              depth: c.depth + 1,
              scheme,
              parent: { layout: p.layout ?? 'col', wrap: !!p.wrap },
              inherit,
              idx: i,
              ghost: ghost || c.ghost,
            }),
          )
          .join('')
      let kids = renderKids(false)
      // A bound list repeats its first child for every entry of the collection.
      const entries = p.bind ? (options.data?.[p.bind.collection] ?? []).slice(0, p.bind.limit ?? 12) : null
      const template = n.children?.[0]
      if (entries && template) {
        kids = entries
          .map((entry, i) =>
            render(bindTo(template, entry), {
              depth: c.depth + 1,
              scheme,
              parent: { layout: p.layout ?? 'col', wrap: !!p.wrap },
              inherit,
              idx: i,
              ghost: i > 0 || c.ghost,
            }),
          )
          .join('')
      }
      if (p.marquee) {
        // Two copies side by side, moved by half the track: the loop never shows a seam.
        const gap = p.gap ?? 16
        const dir = p.marquee.reverse ? 'reverse' : 'normal'
        desktop.push(
          `.mz-page .${cls}>.mz-track{--mz-gap:${gap}px;display:flex;gap:${gap}px;width:max-content;align-items:center;animation:mzMarquee ${p.marquee.duration}s linear infinite ${dir}}` +
            `.mz-page .${cls}>.mz-track>div{display:flex;gap:${gap}px;align-items:center;flex:none}` +
            `.mz-page .${cls}>.mz-track>div>.mz-n{flex:none;width:auto}`,
        )
        kids = `<div class="mz-track"><div>${kids}</div><div aria-hidden="true">${renderKids(true)}</div></div>`
      }
      const content = bgImg ? `${bgImg}<div style="display:contents">${kids}</div>` : kids
      // Children above the background photo; :where keeps a child's own position (absolute) and layer.
      if (bgImg) desktop.push(`:where(.mz-page .${cls}>.mz-n,.mz-page .${cls}>div>.mz-n){position:relative;z-index:1}`)
      // A frame with an address is a link (cards in a bound list).
      if (p.href && !isSec)
        return `<a ${attrs.join(' ')} href="${esc(safeHref(p.href))}" style="text-decoration:none;color:inherit">${content}</a>`
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
    if (n.type === 'scene') {
      const cfg = p.scene ?? { preset: 'mesh' as const }
      const col = (t: string) => color(C, t, d.scheme)
      // A transparent 3D scene floats on the section: nothing behind it, even before WebGL starts.
      if (!cfg.transparent) desktop.push(`.mz-page .${cls}{background-image:${sceneFallback(cfg, col)}}`)
      return `<div ${attrs.join(' ')} role="img" aria-label="${esc(p.alt || p.name || 'Animazione')}">${sceneCanvas(cfg, col)}</div>`
    }
    if (n.type === 'video') {
      if (!p.src) {
        return `<div ${attrs.join(' ').replace('class="mz-n ', 'class="mz-n mz-ph ')} role="img" aria-label="${esc(p.alt || p.name || 'Video')}">${PLACEHOLDER_ICON}</div>`
      }
      const poster = p.poster ? ` poster="${esc(p.poster)}"` : ''
      const play = p.controls ? ' controls' : ' autoplay muted loop playsinline'
      return `<video ${attrs.join(' ')} src="${esc(safeHref(p.src))}"${poster}${play} preload="metadata" aria-label="${esc(p.alt || p.name || 'Video')}"></video>`
    }
    if (n.type === 'embed') {
      // The editor shows custom code in a sandbox; the site runs it as written.
      const code = p.html ?? ''
      if (options.editor)
        return `<div ${attrs.join(' ')}><iframe sandbox="allow-scripts" title="${esc(p.name || 'Codice personalizzato')}" srcdoc="${esc(code)}" style="border:0;width:100%;height:100%;min-height:inherit;display:block;pointer-events:none"></iframe></div>`
      return `<div ${attrs.join(' ')}>${code}</div>`
    }
    // image
    if (!p.src) {
      return `<div ${attrs.join(' ').replace('class="mz-n ', 'class="mz-n mz-ph ')} role="img" aria-label="${esc(p.alt || p.name || 'Immagine')}">${PLACEHOLDER_ICON}</div>`
    }
    return `<img ${attrs.join(' ')} src="${esc(p.src)}" alt="${esc(p.alt ?? '')}"${srcsetAttr(p.src, options)}${p.interactions?.length ? '' : ' loading="lazy"'} decoding="async">`
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

/** A copy of a list's template filled with one entry; ids stay, so every copy shares the template's styles. */
function bindTo(n: PageNode, entry: BoundEntry): PageNode {
  const out: PageNode = { ...n }
  if (n.field) {
    const v = entryValue(entry, n.field)
    if (n.type === 'text' || (n.type === 'button' && n.field !== 'url')) {
      out.text = v == null ? '' : typeof v === 'object' ? '' : String(v)
      out.runs = null
    } else if (n.type === 'image') {
      const m = v as { src?: string; alt?: string; focal?: { x: number; y: number } } | null
      out.src = typeof v === 'string' ? v : (m?.src ?? null)
      out.alt = m?.alt ?? entry.title
      if (m?.focal) out.focal = m.focal
    } else if ((n.type === 'button' || n.type === 'frame') && n.field === 'url') out.href = entry.url ?? '#'
  }
  if (n.type === 'button' && n.field !== 'url' && entry.url && !n.href?.startsWith('http')) out.href = entry.url
  if (n.children) out.children = n.children.map((ch) => bindTo(ch, entry))
  return out
}

const SCENE_COLORS: [string, string, string] = ['inverse', 'accent', 'surface']

function sceneColors(cfg: SceneConfig, col: (t: string) => string): [string, string, string] {
  const [a, b, c] = cfg.colors ?? SCENE_COLORS
  return [col(a), col(b), col(c)]
}

/** The canvas the scene runtime starts; the colors are resolved here, so themes apply. */
function sceneCanvas(cfg: SceneConfig, col: (t: string) => string): string {
  const data = { ...cfg, colors: sceneColors(cfg, col) }
  return `<canvas class="mz-scene" aria-hidden="true" data-mz-scene="${esc(JSON.stringify(data))}"></canvas>`
}

/** What shows before WebGL starts, or without it. */
function sceneFallback(cfg: SceneConfig, col: (t: string) => string): string {
  const [a, b, c] = sceneColors(cfg, col)
  return `radial-gradient(120% 90% at 20% 10%, ${b}, transparent 60%), radial-gradient(100% 80% at 90% 90%, ${c}, transparent 55%), linear-gradient(${a}, ${a})`
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
  const data = [
    theme.smoothScroll ? ' data-mz-smooth' : '',
    theme.cursor && theme.cursor !== 'default' ? ` data-mz-cursor="${theme.cursor}"` : '',
  ].join('')
  return {
    html: `<div class="mz-page" style="${pageRootStyle(theme)}"${data}>${html}</div>`,
    css: options.editor ? css : css + transitionCss(theme),
  }
}

/** Animated transitions between the site's pages (cross-document view transitions). */
export function transitionCss(theme: Theme): string {
  if (!theme.transition || theme.transition === 'none') return ''
  const out = theme.transition === 'slide' ? 'mzVtOut .45s cubic-bezier(.7,0,.3,1) both' : 'mzVtFade .35s ease both'
  const inn =
    theme.transition === 'slide' ? 'mzVtIn .6s cubic-bezier(.2,.8,.2,1) both' : 'mzVtFade .45s ease reverse both'
  return `
@view-transition{navigation:auto}
@keyframes mzVtFade{to{opacity:0}}
@keyframes mzVtOut{to{opacity:0;transform:translateY(-40px)}}
@keyframes mzVtIn{from{opacity:0;transform:translateY(60px)}}
@media (prefers-reduced-motion:no-preference){::view-transition-old(root){animation:${out}}::view-transition-new(root){animation:${inn}}}
@media (prefers-reduced-motion:reduce){@view-transition{navigation:none}}`
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
