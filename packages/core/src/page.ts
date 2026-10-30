/**
 * Pages made of elements: sections hold frames, text, images and buttons, edited on the canvas
 * like a design tool and rendered to plain HTML and CSS, the same in the editor and on the site.
 *
 * Responsive changes live in `over.tablet` / `over.mobile` and become container queries, so a page
 * renders correctly at any width: in the editor's device frames, in thumbnails and on the site.
 */

import { iconRatio, iconSvg } from './icons.ts'

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
  /** Its own look under the pointer: on the element itself, or when the card around it is hovered. */
  hoverStyle?: HoverStyle | null
  /** Interactions played by the motion runtime (scroll, hover, click, pointer…). */
  interactions?: Interaction[] | null
  /** Stays in place while its container scrolls past (position: sticky); on a section, a fixed menu. */
  sticky?: boolean
  /** Fixed section: hides while scrolling down, comes back when scrolling up. */
  stickyHide?: boolean
  /** Fixed section: frosted glass once the page has scrolled. */
  stickyGlass?: boolean
  /** A menu section: on mobile, what is hidden there opens from a ☰ button. */
  mobileMenu?: boolean
  /** The shape of a menu section (see NAV_SHAPES): a bar by default. */
  navShape?: 'bar' | 'floating' | 'island' | 'transparent' | null
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
  /** Locked in the editor: not picked or moved on the canvas (still in the layers). */
  locked?: boolean
  /** A container that is a contact form: what it sends goes to the panel and by email. */
  form?: { subject?: string; success?: string } | null
  // input: a field of a form; its label is `text`
  inputKind?: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox'
  /** The name the value arrives with ("email", "messaggio"). */
  fieldName?: string
  placeholder?: string
  required?: boolean
  /** select: the choices. */
  options?: string[]
  /** A button that sends the form it is in. */
  submit?: boolean
  // icon: a Lucide icon by name, "shape:arch" for a filled shape, or custom SVG markup
  icon?: string | null
  svg?: string | null
  /** Line icons: stroke width in the icon's 24-unit grid. */
  strokeW?: number | null
  /** A WebGL scene: the element itself (type "scene") or a frame's background. */
  scene?: SceneConfig | null
  /** Section address for links within the page: #anchor. */
  anchor?: string | null
  /** A list fed by a collection: the first child is repeated for each entry. */
  bind?: ListBinding | null
  /** Inside a bound list: which field of the entry fills this element ("title", "url", or a field name). */
  field?: string | null
  /** A frame whose children scroll endlessly sideways. */
  /** fade: how far in from each side the band fades out, in % of its width (0 = a sharp cut). */
  marquee?: { duration: number; reverse?: boolean; fade?: number } | null
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
  /** A text style shared by the site (theme.textStyles): its typography, under this element's own. */
  textStyle?: string | null
  text?: string
  runs?: Run[] | null
  /** A language switcher in place of the text: language codes ("IT / EN") or names. */
  langs?: 'code' | 'name' | null
  style?: TextStyle
  /** Rich text from a bound field (an article's body), set while rendering: never saved. */
  rich?: string
  /** The HTML element, when it should differ from what the style suggests: a big number is not a heading. */
  tag?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' | null
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

/** A hover state: what changes, and what triggers it. */
export interface HoverStyle {
  /** self: the pointer on the element · card: on the nearest container that is a link or has a hover state. */
  on?: 'self' | 'card'
  bg?: string | null
  color?: string | null
  borderColor?: string | null
  /** Scale (1 = as is), lift in px (negative = up), opacity 0–1. */
  scale?: number | null
  y?: number | null
  opa?: number | null
  shadow?: 'none' | 'sm' | 'lg' | null
}

/** Which entries a bound list shows, in what order, and how many at a time. */
export interface ListBinding {
  collection: string
  /** Entries shown (with "more": shown at first and added by each click). */
  limit?: number
  sort?: { field: string; dir: 'asc' | 'desc' } | null
  filter?: { field: string; op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt'; value: string } | null
  /** A button under the list shows the next entries. */
  more?: boolean
  moreLabel?: string
}

/** A named text style shared by the site: typography for every device, like a design system's. */
export interface SharedTextStyle {
  id: string
  name: string
  props: Partial<NodeProps>
  over?: { tablet?: Partial<NodeProps>; mobile?: Partial<NodeProps> }
}

/** What a shared text style sets; the rest stays the element's own. */
export const TEXT_STYLE_KEYS = [
  'style',
  'font',
  'fontSize',
  'weight',
  'tracking',
  'leading',
  'italic',
  'upper',
  'color',
  'textGradient',
] as const

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
    | 'gradient'
    | 'globe'
    | 'metaballs'
    | 'ribbons'
    | 'lens'
    | 'transition'
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
  /** transition: the picture that appears on hover. */
  image2?: string | null
  /** custom: the body of a GLSL fragment shader (void main(){…}). */
  code?: string
  /** model: a .glb file; shapes: which generated shape. */
  model?: string | null
  shape?: 'blob' | 'knot' | 'torus' | 'cube' | 'spheres' | 'rings' | 'gem' | 'capsule' | 'sphere' | 'logo'
  /** logo: the SVG extruded into a solid (a brand mark, an icon). */
  svg?: string | null
  /** 3D lighting mood. */
  lighting?: 'studio' | 'neon' | 'soft'
  /** 3D surfaces; "original" keeps the model's own. */
  material?: 'chrome' | 'glass' | 'clay' | 'iridescent' | 'wire' | 'gold' | 'pearl' | 'neon' | 'original'
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
  /** The variant this copy turns into under the pointer (colors and opacity follow it). */
  hoverVariant?: string | null
  /** Content this copy changes, by the id of the element inside the component. */
  overrides?: Record<string, Partial<NodeProps>> | null
  /** A section shared by every page that uses it (menu, footer): the content lives in the site's globals. */
  global?: string
  type: 'frame' | 'text' | 'image' | 'button' | 'video' | 'embed' | 'scene' | 'icon' | 'input'
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
  /** Named text styles elements can share. */
  textStyles?: SharedTextStyle[]
  /** Where tablet and mobile designs start: container widths in px (defaults 1023 and 639). */
  breakpoints?: { tablet: number; mobile: number }
  /** Colors with a name, beyond the theme's own: one value for the light theme, one for the dark. */
  swatches?: Swatch[]
}

export interface Swatch {
  /** Used as the color token in elements ("sw-…"). */
  id: string
  name: string
  light: string
  dark: string
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

/** Container widths: tablet up to 1023 px, mobile up to 639 px (the theme can move them). */
export const BREAKPOINTS = { tablet: 1023, mobile: 639 } as const

/** The theme's breakpoints, kept sensible: mobile below tablet, both within real screen sizes. */
export function breakpointsOf(theme: Theme): { tablet: number; mobile: number } {
  const clamp = (v: unknown, lo: number, hi: number, d: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(hi, Math.max(lo, v))) : d
  const tablet = clamp(theme.breakpoints?.tablet, 600, 1600, BREAKPOINTS.tablet)
  const mobile = clamp(theme.breakpoints?.mobile, 320, tablet - 40, Math.min(BREAKPOINTS.mobile, tablet - 40))
  return { tablet, mobile }
}
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
  // Named colors join the palette under their id; only real colors get through to the stylesheet.
  const swatches = Object.fromEntries(
    (theme.swatches ?? []).flatMap((sw) => {
      const v = (dark ? sw.dark : sw.light)?.trim()
      return v && SAFE_COLOR.test(v) ? [[sw.id, v]] : []
    }),
  )
  return {
    ...swatches,
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
  /**
   * The entry a template page shows (a project's page): elements with a field take its values,
   * except inside bound lists, which have their own entries.
   */
  entry?: BoundEntry
  /** The page's language, and the same page in the site's other languages, for language switchers. */
  locale?: string
  alternates?: { locale: string; url: string }[]
}

/** A language's own name, as its speakers write it: "English", "Deutsch", "Italiano". */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code) ?? code
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
  } catch {
    return code
  }
}

/** What a bound list needs from an entry. */
export interface BoundEntry {
  title: string
  url: string | null
  data: Record<string, unknown>
  /** Readable values where the data holds a code: a choice's label, a related entry's title. */
  labels?: Record<string, string>
  /** For dates in the entry's language. */
  locale?: string
}

/** Rich text as HTML: paragraphs, headings, quotes, lists, with bold, italic and links. */
export function richTextHtml(blocks: unknown): string {
  if (!Array.isArray(blocks)) return ''
  const run = (r: { text?: string; bold?: boolean; italic?: boolean; href?: string }) => {
    let h = esc(r.text ?? '').replace(/\n/g, '<br>')
    if (r.bold) h = `<strong>${h}</strong>`
    if (r.italic) h = `<em>${h}</em>`
    if (r.href) h = `<a href="${esc(safeHref(r.href))}">${h}</a>`
    return h
  }
  const inline = (b: { children?: unknown[] }) => (b.children ?? []).map((r) => run(r as never)).join('')
  let html = ''
  let list = false
  for (const b of blocks as { type?: string; level?: number; children?: unknown[] }[]) {
    if (b.type === 'listItem') {
      html += `${list ? '' : '<ul>'}<li>${inline(b)}</li>`
      list = true
      continue
    }
    if (list) html += '</ul>'
    list = false
    if (b.type === 'quote') html += `<blockquote>${inline(b)}</blockquote>`
    else if (b.type === 'heading')
      html += `<h${b.level === 3 || b.level === 4 ? b.level : 2}>${inline(b)}</h${b.level === 3 || b.level === 4 ? b.level : 2}>`
    else html += `<p>${inline(b)}</p>`
  }
  return list ? `${html}</ul>` : html
}

const isRichText = (v: unknown) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((b) => b && typeof b === 'object' && Array.isArray((b as { children?: unknown }).children))

/** A field's value as text on the page: dates in words, related entries by their title. */
export function displayValue(v: unknown, locale = 'it'): string {
  if (v == null) return ''
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(v)) {
    const d = new Date(v.length === 10 ? `${v}T12:00:00Z` : v)
    if (!Number.isNaN(d.getTime()))
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
  }
  if (typeof v === 'object') {
    const o = v as { title?: unknown; name?: unknown }
    if (typeof o.title === 'string') return o.title
    if (typeof o.name === 'string') return o.name
    return ''
  }
  return String(v)
}

/** A value of an entry for a bound element: "title" and "url" first, then the entry's own fields. */
export function entryValue(entry: BoundEntry, field: string): unknown {
  if (field === 'title') return entry.title
  if (field === 'url') return entry.url
  return field
    .split('.')
    .reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), entry.data)
}

const asText = (v: unknown) => (v == null ? '' : typeof v === 'object' ? '' : String(v)).toLowerCase()

function compareValues(a: unknown, b: unknown): number {
  if (a == null || a === '') return b == null || b === '' ? 0 : 1
  if (b == null || b === '') return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return asText(a).localeCompare(asText(b), undefined, { numeric: true })
}

function matches(v: unknown, f: NonNullable<ListBinding['filter']>): boolean {
  const want = f.value.trim().toLowerCase()
  // A list of values (tags, categories) matches when one of them does.
  const values = Array.isArray(v) ? v : [v]
  const one = (x: unknown) => {
    const t = asText(x)
    if (f.op === 'contains') return t.includes(want)
    if (f.op === 'gt' || f.op === 'lt') {
      const c =
        typeof x === 'number' && want !== '' && !Number.isNaN(Number(want)) ? x - Number(want) : compareValues(t, want)
      return f.op === 'gt' ? c > 0 : c < 0
    }
    return t === want
  }
  return f.op === 'neq' ? !values.some((x) => asText(x) === want) : values.some(one)
}

/** The entries a bound list shows, filtered and sorted as it asks (before its limit). */
export function listEntries(entries: BoundEntry[], bind: ListBinding): BoundEntry[] {
  let out = entries
  const f = bind.filter
  if (f?.field) out = out.filter((e) => matches(entryValue(e, f.field), f))
  const s = bind.sort
  if (s?.field) {
    const dir = s.dir === 'desc' ? -1 : 1
    out = [...out].sort((a, b) => {
      const va = entryValue(a, s.field)
      const vb = entryValue(b, s.field)
      // Empty values go last whichever the direction.
      if (va == null || va === '' || vb == null || vb === '') return compareValues(va, vb)
      return compareValues(va, vb) * dir
    })
  }
  return out
}

/** An element with its shared text style underneath: its own values win, then the style's. */
export function withTextStyle(n: PageNode, theme: Theme): PageNode {
  const ts = n.textStyle ? theme.textStyles?.find((s) => s.id === n.textStyle) : undefined
  if (!ts) return n
  const own = Object.fromEntries(Object.entries(n).filter(([, v]) => v !== undefined && v !== null)) as PageNode
  const over: PageNode['over'] = {}
  for (const bp of ['tablet', 'mobile'] as const) {
    const merged = { ...ts.over?.[bp], ...n.over?.[bp] }
    if (Object.keys(merged).length) over[bp] = merged
  }
  return { ...(ts.props as PageNode), ...own, over }
}

/** Every element of the tree with its shared text style applied. */
export function applyTextStyles(nodes: PageNode[], theme: Theme): PageNode[] {
  if (!theme.textStyles?.length) return nodes
  return nodes.map((n) => {
    const out = withTextStyle(n, theme)
    return out.children ? { ...out, children: applyTextStyles(out.children, theme) } : out
  })
}

/** A reusable component: one or more variants of the same element, shared by every page. */
export interface Component {
  id: string
  name: string
  /** Made from a whole section: copies go between sections. */
  section?: boolean
  /** Taken out of the library: no new copies, the existing ones keep working. */
  archived?: boolean
  variants: { id: string; name: string; node: PageNode }[]
}

/** What a copy of a component keeps for itself: its content and where it sits. */
export const OVERRIDE_KEYS = [
  'text',
  'runs',
  'src',
  'alt',
  'href',
  'newTab',
  'poster',
  'focal',
  'icon',
  'svg',
  'hidden',
] as const
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
  'hoverVariant',
] as const
const SEP = '~'

/** Colors a scheme gives a container and its texts, as theme tokens. */
const SCHEME_TOKENS: Record<string, { bg: string; fg: string; muted: string }> = {
  accent: { bg: 'accent', fg: 'onAccent', muted: 'onAccentMuted' },
  inverse: { bg: 'inverse', fg: 'onInverse', muted: 'onInverseMuted' },
  surface: { bg: 'surface', fg: 'text', muted: 'muted' },
}

/**
 * A copy that changes variant under the pointer: what differs in colors and opacity between its
 * variant and the hover one becomes hover states, on the copy and on the elements inside it.
 */
function withHoverVariant(tree: PageNode, hover: PageNode, prefix: string): PageNode {
  const target = new Map<string, PageNode>()
  walk([hover], (c) => target.set(c.id, c))
  const scheme = hover.scheme && hover.scheme !== tree.scheme ? SCHEME_TOKENS[hover.scheme] : undefined
  return mapTree(tree, (c) => {
    const isRoot = !c.id.includes(SEP)
    const h = target.get(isRoot ? hover.id : c.id.slice(prefix.length))
    if (!h) return c
    const hs: HoverStyle = { ...c.hoverStyle, on: isRoot ? 'self' : 'card' }
    const differs = (k: 'bg' | 'color' | 'borderColor' | 'opa') =>
      JSON.stringify(h[k] ?? null) !== JSON.stringify(c[k] ?? null)
    if (differs('bg') && h.bg) hs.bg = h.bg
    if (differs('color') && h.color) hs.color = h.color
    if (differs('borderColor') && h.borderColor) hs.borderColor = h.borderColor
    if (differs('opa')) hs.opa = h.opa ?? 1
    if (scheme) {
      // The hover variant's scheme: its background on the copy, its text colors inside.
      if (isRoot) {
        hs.bg = hs.bg ?? scheme.bg
        hs.color = hs.color ?? scheme.fg
      } else if (c.type === 'text' || c.type === 'icon' || c.type === 'button') {
        hs.color = hs.color ?? ((h.color ?? c.color) === 'muted' ? scheme.muted : scheme.fg)
      }
    }
    const changed = hs.bg || hs.color || hs.borderColor || hs.opa != null
    return changed || isRoot ? { ...c, hoverStyle: hs } : c
  })
}

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
        const hover = n.hoverVariant ? def.variants.find((v) => v.id === n.hoverVariant) : undefined
        if (hover && hover.id !== variant.id) {
          const id = node.id
          // The hover states are made on every expansion: they never go back into the component.
          node = { ...withHoverVariant({ ...node, id: variant.node.id }, hover.node, prefix), id }
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
        // Hover states made from the hover variant belong to this copy's expansion, not to the component.
        if (n.hoverVariant) {
          if (before?.hoverStyle) out.hoverStyle = before.hoverStyle
          else delete out.hoverStyle
        }
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
.mz-page [data-mz-later]{display:none!important}
.mz-page .mz-trap{position:absolute!important;left:-9999px;width:1px;height:1px;opacity:0}
.mz-page .mz-field-label{font-size:.85em;opacity:.8}
.mz-page .mz-field{width:100%;font:inherit;color:inherit;background:transparent;border:1px solid var(--mz-field-line);border-radius:var(--mz-field-r);padding:12px 14px;outline:none;transition:border-color .2s,box-shadow .2s}
.mz-page .mz-field:focus{border-color:currentColor;box-shadow:0 0 0 3px color-mix(in srgb,currentColor 15%,transparent)}
.mz-page textarea.mz-field{resize:vertical;min-height:120px}
.mz-page .mz-check{width:18px;height:18px;accent-color:currentColor}
.mz-page .mz-form-msg{font-size:.95em;padding-top:4px}
.mz-page :where(button.mz-n){font:inherit;cursor:pointer;border:none}
.mz-page .mz-more{display:flex;justify-content:center;width:100%;padding-top:32px}
.mz-page [data-mz-sticky]{transition:transform .45s cubic-bezier(.2,.8,.2,1),background-color .3s,backdrop-filter .3s,box-shadow .3s}
.mz-page [data-mz-sticky].mz-away{transform:translateY(-100%)}
.mz-page .mz-burger{display:none;flex-direction:column;justify-content:center;gap:6px;width:40px;height:40px;padding:0 9px;margin-left:4px;border:0;border-radius:999px;background:transparent;color:inherit;cursor:pointer}
.mz-page .mz-burger span{display:block;height:1.5px;width:100%;background:currentColor;transition:transform .3s}
.mz-page .mz-open>.mz-burger span:first-child{transform:translateY(3.75px) rotate(45deg)}
.mz-page .mz-open>.mz-burger span:last-child{transform:translateY(-3.75px) rotate(-45deg)}
.mz-page [id]{scroll-margin-top:var(--mz-anchor-offset,0px)}
.mz-page .mz-n[data-mz-langs]{display:flex;flex-wrap:wrap;align-items:baseline;gap:.5em}
.mz-page .mz-n[data-mz-langs] a{color:inherit;text-decoration:none;opacity:.55;transition:opacity .2s}
.mz-page .mz-n[data-mz-langs] a:hover,.mz-page .mz-n[data-mz-langs] a[aria-current]{opacity:1}
.mz-page .mz-n[data-mz-langs] span{opacity:.35}
.mz-page [data-mz-prose]{white-space:normal}
.mz-page [data-mz-prose]>*{margin:0}
.mz-page [data-mz-prose]>*+*{margin-top:1em}
.mz-page [data-mz-prose] h2,.mz-page [data-mz-prose] h3,.mz-page [data-mz-prose] h4{font-family:var(--mz-display,inherit);line-height:1.2;margin-top:1.6em}
.mz-page [data-mz-prose] h2{font-size:1.5em}.mz-page [data-mz-prose] h3{font-size:1.25em}
.mz-page [data-mz-prose] blockquote{padding-left:1em;border-left:2px solid currentColor;font-style:italic;opacity:.9}
.mz-page [data-mz-prose] ul{padding-left:1.2em}.mz-page [data-mz-prose] li+li{margin-top:.4em}
.mz-page [data-mz-prose] a{text-decoration:underline}
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
  /** Inside a section with a mobile menu: its children hidden on mobile open from ☰. */
  menu?: boolean
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
  // The body of an article keeps a readable line length unless a width is set.
  s.maxWidth = p.maxW
    ? cssLength(p.maxW, 'none')
    : p.width === 'fixed'
      ? '100%'
      : isT && p.rich && p.width !== 'hug'
        ? '68ch'
        : 'none'
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
    if (p.bgImage?.src || p.scene) s.overflow = 'hidden'
    // A marquee cuts only at the sides: letters with descenders (g, y) stay whole below.
    else if (p.marquee) {
      s.overflowX = 'clip'
      s.overflowY = 'visible'
    }
  } else if (n.type === 'input') {
    s.display = 'flex'
    s.flexDirection = p.inputKind === 'checkbox' ? 'row' : 'column'
    s.alignItems = p.inputKind === 'checkbox' ? 'center' : 'stretch'
    s.gap = p.inputKind === 'checkbox' ? '10px' : '8px'
    s.color = col(p.color ?? 'text')
    s['--mz-field-line' as 'color'] = col('line')
    s['--mz-field-r' as 'color'] = rad(p.radius ?? 'card')
    s.borderRadius = '0'
  } else if (n.type === 'icon') {
    s.display = 'block'
    s.aspectRatio = p.h ? 'auto' : (p.ratio ?? (p.svg ? '1/1' : iconRatio(p.icon))).replace('/', ' / ')
    s.color = col(p.color ?? 'text')
    s.lineHeight = '0'
  } else if (n.type === 'scene') {
    s.display = 'block'
    s.position = 'relative'
    s.overflow = 'hidden'
    s.aspectRatio = p.h ? 'auto' : (p.ratio ?? '16/9').replace('/', ' / ')
    // In a grid an item with an aspect ratio takes its content's width (Safari follows the spec,
    // Chrome does not), and a scene has no content: it must stretch to its cell.
    if (pl === 'grid' && p.width !== 'fixed' && p.width !== 'hug') s.justifySelf = 'stretch'
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
      // The gradient is painted only inside the box: with tight leading, descenders (g, p, y) fall
      // outside it and vanish. Room below, given back with a negative margin, keeps the layout.
      s.paddingBottom = `calc(${cssLength(p.padY ?? 0)} + .2em)`
      s.marginBottom = '-0.2em'
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
  if (isSec && p.navShape && p.navShape !== 'bar')
    navShapeStyle(s, p.navShape, c.bp, color(C, 'bg', scheme), !!p.sticky)
  return { style: s, scheme, anim }
}

/** The shapes a menu section can take: a full bar, a floating card, a centered island, or nothing. */
export const NAV_SHAPES = [
  { value: 'bar', label: 'Barra' },
  { value: 'floating', label: 'Sospesa' },
  { value: 'island', label: 'Isola' },
  { value: 'transparent', label: 'Trasparente' },
] as const

function navShapeStyle(
  s: Style,
  shape: NonNullable<NodeProps['navShape']>,
  bp: Breakpoint,
  bg: string,
  sticky: boolean,
) {
  s.boxShadow = 'none'
  if (shape === 'transparent') {
    s.background = 'transparent'
    return
  }
  const inset = bp === 'mobile' ? 10 : 16
  // Frosted, detached from the edges: the page shows through around and behind it.
  s.background = `color-mix(in srgb,${bg} 78%,transparent)`
  s.backdropFilter = 'blur(18px) saturate(1.4)'
  s.WebkitBackdropFilter = 'blur(18px) saturate(1.4)'
  s.border = '1px solid color-mix(in srgb,currentColor 12%,transparent)'
  s.boxShadow = '0 10px 30px rgba(0,0,0,.16)'
  s.marginTop = `${inset}px`
  s.marginLeft = 'auto'
  s.marginRight = 'auto'
  if (sticky) s.top = `${inset}px`
  if (shape === 'floating') {
    s.width = `calc(100% - ${inset * 2}px)`
    s.borderRadius = bp === 'mobile' ? '18px' : '20px'
    s.padding = bp === 'mobile' ? '10px 16px' : '12px 24px'
  } else {
    s.width = bp === 'mobile' ? `calc(100% - ${inset * 2}px)` : `min(960px,calc(100% - ${inset * 2}px))`
    s.borderRadius = bp === 'mobile' ? '28px' : '999px'
    s.padding = bp === 'mobile' ? '8px 8px 8px 18px' : '8px 8px 8px 28px'
  }
}

function diff(base: Style, next: Style): Style {
  const out: Style = {}
  for (const [k, v] of Object.entries(next)) if (base[k] !== v) out[k] = v
  for (const k of Object.keys(base)) if (!(k in next)) out[k] = 'initial'
  return out
}

const TAGS: Record<string, string> = { display: 'h1', h1: 'h1', h2: 'h2', h3: 'h3' }

/** The HTML element of a text: its own choice, else the one its style suggests. */
export function textTag(p: Pick<NodeProps, 'tag' | 'style' | 'text' | 'runs'>): string {
  const tag = p.tag ?? TAGS[p.style ?? 'body'] ?? 'p'
  // A separator (✦, —, •) is never a heading, whatever its size.
  const words = p.runs ? p.runs.map((r) => r.t).join('') : (p.text ?? '')
  return /^h/.test(tag) && (p.text !== undefined || p.runs) && !/[\p{L}\p{N}]/u.test(words) ? 'p' : tag
}

/**
 * Renders sections to HTML and the CSS that styles them. Wrap the HTML in an element with the
 * `mz-page` class (`renderPage` does it), so the container queries and base styles apply.
 */
export function renderSections(
  sections: PageNode[],
  theme: Theme = DEFAULT_THEME,
  options: RenderOptions = {},
): { html: string; css: string } {
  sections = applyTextStyles(sections, theme)
  const limits = breakpointsOf(theme)
  if (options.entry) {
    const entry = options.entry
    sections = sections.map((n) => bindTo(n, entry))
  }
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
    if (c.menu && n.over?.mobile?.hidden && !n.hidden) attrs.push('data-mz-menu')
    if (p.interactions?.length) attrs.push(`data-mz-motion="${esc(JSON.stringify(p.interactions))}"`)
    if (p.hover && p.hover !== 'none') attrs.push(`data-hover="${p.hover}"`)
    // A container that reacts to the pointer is a "card": elements inside can change with it.
    if (n.type === 'frame' && (p.href || p.hoverStyle || (p.hover && p.hover !== 'none'))) attrs.push('data-mz-group')
    if (p.hoverStyle) {
      const h = p.hoverStyle
      const hc = (t: string) => color(C, t, d.scheme)
      const decls = [
        h.bg ? `background:${hc(h.bg)}` : '',
        h.color ? `color:${hc(h.color)}` : '',
        h.borderColor ? `border-color:${hc(h.borderColor)}` : '',
        // Individual transform properties: they add to the motion runtime's transform instead of replacing it.
        h.scale != null && h.scale !== 1 ? `scale:${Number(h.scale)}` : '',
        h.y ? `translate:0 ${Number(h.y)}px` : '',
        h.opa != null && h.opa < 1 ? `opacity:${Number(h.opa)}` : '',
        h.shadow === 'lg'
          ? 'box-shadow:0 18px 40px rgba(0,0,0,.18)'
          : h.shadow === 'sm'
            ? 'box-shadow:0 1px 2px rgba(0,0,0,.06),0 8px 24px rgba(0,0,0,.1)'
            : '',
      ].filter(Boolean)
      if (decls.length) {
        const sel = h.on === 'card' ? `.mz-page [data-mz-group]:hover .${cls}` : `.mz-page .${cls}:hover`
        desktop.push(
          `.mz-page .${cls}{transition:background-color .3s,color .3s,border-color .3s,scale .45s cubic-bezier(.2,.8,.2,1),translate .45s cubic-bezier(.2,.8,.2,1),opacity .3s,box-shadow .45s}` +
            `@media (hover:hover){${sel}{${decls.join(';')}}}`,
        )
      }
    }

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
              menu: c.depth === 0 && !!p.mobileMenu,
            }),
          )
          .join('')
      let kids = renderKids(false)
      // A bound list repeats its first child for every entry of the collection.
      const bind = p.bind
      const pageSize = bind?.limit ?? 12
      const all = bind ? listEntries(options.data?.[bind.collection] ?? [], bind) : null
      // With a "more" button, the next entries are on the page already, waiting to be shown.
      const entries = all?.slice(0, bind?.more && !options.editor ? 100 : pageSize) ?? null
      const template = n.children?.[0]
      let more = ''
      if (entries && template) {
        kids = entries
          .map((entry, i) => {
            const html = render(bindTo(template, entry), {
              depth: c.depth + 1,
              scheme,
              parent: { layout: p.layout ?? 'col', wrap: !!p.wrap },
              inherit,
              idx: i,
              ghost: i > 0 || c.ghost,
            })
            return i >= pageSize ? html.replace(/^<(\w+) /, '<$1 data-mz-later ') : html
          })
          .join('')
        if (bind?.more && (all?.length ?? 0) > pageSize) {
          const button: PageNode = {
            id: `${n.id}-more`,
            type: 'button',
            text: bind.moreLabel || 'Mostra altri',
            variant: 'secondary',
            href: '#',
            width: 'hug',
            padX: 26,
            padY: 14,
            radius: 'btn',
          }
          const html = render(button, { ...c, depth: c.depth + 1, scheme, inherit, idx: 0, ghost: true })
          more = `<div class="mz-more">${html.replace(/^<a /, `<a data-mz-more="${cls}" data-mz-step="${pageSize}" `)}</div>`
        }
      }
      if (p.marquee) {
        // Two copies side by side, moved by half the track: the loop never shows a seam.
        const gap = cssLength(p.gap ?? 16)
        const dir = p.marquee.reverse ? 'reverse' : 'normal'
        desktop.push(
          `.mz-page .${cls}>.mz-track{--mz-gap:${gap};display:flex;gap:${gap};width:max-content;align-items:center;animation:mzMarquee ${p.marquee.duration}s linear infinite ${dir}}` +
            `.mz-page .${cls}>.mz-track>div{display:flex;gap:${gap};align-items:center;flex:none}` +
            // No growing in the endless track; a child's own fixed width (a logo, an icon) still applies.
            `.mz-page .${cls}>.mz-track>div>.mz-n{flex:none}:where(.mz-page .${cls}>.mz-track>div>.mz-n){width:auto}`,
        )
        // Soft edges: what enters and leaves fades in and out instead of being cut.
        const fade = Math.min(40, Math.max(0, p.marquee.fade ?? 0))
        if (fade) {
          const mask = `linear-gradient(90deg,transparent,#000 ${fade}%,#000 ${100 - fade}%,transparent)`
          desktop.push(`.mz-page .${cls}{-webkit-mask-image:${mask};mask-image:${mask}}`)
        }
        // In the editor it stops under the pointer, so what is inside can be clicked.
        if (options.editor) desktop.push(`.mz-page .${cls}:hover>.mz-track{animation-play-state:paused}`)
        kids = `<div class="mz-track"><div>${kids}</div><div aria-hidden="true">${renderKids(true)}</div></div>`
      }
      if (c.depth === 0 && p.mobileMenu) {
        // ☰ on mobile: it opens the parts of the menu that are hidden there, below the bar.
        kids += `<button type="button" class="mz-burger" data-mz-burger aria-expanded="false" aria-label="Apri il menu"><span></span><span></span></button>`
        mobile.push(
          `.mz-page .${cls}{flex-wrap:wrap}.mz-page .${cls}>.mz-burger{display:flex}` +
            `.mz-page .${cls}.mz-open>[data-mz-menu]{display:flex!important;flex-direction:column;align-items:flex-start;order:10;flex:1 0 100%;width:100%;gap:18px;padding:18px 0 8px}` +
            `.mz-page .${cls}.mz-open>[data-mz-menu] .mz-n{font-size:22px}.mz-page .${cls}.mz-open{border-radius:24px}`,
        )
      }
      const content = bgImg ? `${bgImg}<div style="display:contents">${kids}</div>` : kids
      // Children above the background photo; :where keeps a child's own position (absolute) and layer.
      if (bgImg) desktop.push(`:where(.mz-page .${cls}>.mz-n,.mz-page .${cls}>div>.mz-n){position:relative;z-index:1}`)
      // A frame with an address is a link (cards in a bound list).
      if (p.href && !isSec)
        return `<a ${attrs.join(' ')} href="${esc(safeHref(p.href))}" style="text-decoration:none;color:inherit">${content}</a>`
      if (p.form && !isSec) {
        // A contact form: posted to the server (also without JavaScript); a trap field catches bots.
        const subject = p.form.subject ? `<input type="hidden" name="_subject" value="${esc(p.form.subject)}">` : ''
        const ok = esc(p.form.success || 'Grazie, abbiamo ricevuto il tuo messaggio.')
        return `<form ${attrs.join(' ')} action="/api/forms/${esc(n.id)}" method="post" data-mz-form="${ok}">${subject}<input type="text" name="_gotcha" class="mz-trap" tabindex="-1" autocomplete="off" aria-hidden="true">${content}</form>${more}`
      }
      return `<${tag} ${attrs.join(' ')}>${content}</${tag}>${more}`
    }
    if (n.type === 'text') {
      // The repeated copy of a marquee repeats no headings.
      let tag = c.ghost ? 'p' : textTag(p)
      if (tag === 'h1') {
        if (h1Used) tag = 'h2'
        h1Used = true
      }
      if (p.rich) return `<div ${attrs.join(' ')} data-mz-prose>${p.rich}</div>`
      if (p.langs) {
        // A language switcher: the same page in each language it exists in.
        const list = options.alternates?.length ? options.alternates : [{ locale: options.locale ?? 'it', url: '#' }]
        const current = options.locale ?? list[0]?.locale
        const links = list
          .map(
            (a) =>
              `<a href="${esc(safeHref(a.url))}" hreflang="${esc(a.locale)}" lang="${esc(a.locale)}"${a.locale === current ? ' aria-current="true"' : ''}>${esc(p.langs === 'name' ? languageName(a.locale) : a.locale.toUpperCase())}</a>`,
          )
          .join('<span aria-hidden="true">/</span>')
        return `<nav ${attrs.join(' ')} data-mz-langs aria-label="Lingua">${links}</nav>`
      }
      // A linked text: the whole text is the link, in its own color.
      const inner = p.href
        ? `<a href="${esc(safeHref(p.href))}"${p.newTab ? ' target="_blank" rel="noopener"' : ''} style="color:inherit;text-decoration:none">${runsHtml(p)}</a>`
        : runsHtml(p)
      return `<${tag} ${attrs.join(' ')}>${inner}</${tag}>`
    }
    if (n.type === 'button' && p.submit) {
      return `<button type="submit" ${attrs.join(' ')}>${esc(p.text ?? '')}</button>`
    }
    if (n.type === 'button') {
      const target = p.newTab ? ' target="_blank" rel="noopener"' : ''
      return `<a ${attrs.join(' ')} href="${esc(safeHref(p.href))}"${target}>${esc(p.text ?? '')}</a>`
    }
    if (n.type === 'input') {
      const kind = p.inputKind ?? 'text'
      const name = esc((p.fieldName || p.text || 'campo').toString().slice(0, 60))
      const req = p.required ? ' required' : ''
      // On the canvas the fields are pictures of fields: clicking selects them.
      const still = options.editor ? ' tabindex="-1" readonly' : ''
      const ph = p.placeholder ? ` placeholder="${esc(p.placeholder)}"` : ''
      const label = `<span class="mz-field-label">${esc(p.text ?? '')}${p.required ? ' <span aria-hidden="true">*</span>' : ''}</span>`
      let field: string
      if (kind === 'textarea')
        field = `<textarea class="mz-field" name="${name}" rows="5"${ph}${req}${still}></textarea>`
      else if (kind === 'select')
        field = `<select class="mz-field" name="${name}"${req}${options.editor ? ' tabindex="-1"' : ''}>${(
          p.options ?? []
        )
          .map((o) => `<option>${esc(o)}</option>`)
          .join('')}</select>`
      else if (kind === 'checkbox')
        return `<label ${attrs.join(' ')}><input type="checkbox" class="mz-check" name="${name}" value="sì"${req}${options.editor ? ' tabindex="-1"' : ''}>${label}</label>`
      else field = `<input class="mz-field" type="${kind}" name="${name}"${ph}${req}${still}>`
      return `<label ${attrs.join(' ')}>${label}${field}</label>`
    }
    if (n.type === 'icon') {
      const label = p.alt ? ` role="img" aria-label="${esc(p.alt)}"` : ' aria-hidden="true"'
      const inner = iconSvg(p)
      if (p.href) return `<a ${attrs.join(' ')} href="${esc(safeHref(p.href))}"${label}>${inner}</a>`
      return `<span ${attrs.join(' ')}${label}>${inner}</span>`
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
    tablet.length ? `@container mzpage (max-width:${limits.tablet}px){${tablet.join('')}}` : '',
    mobile.length ? `@container mzpage (max-width:${limits.mobile}px){${mobile.join('')}}` : '',
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
    const label = entry.labels?.[n.field]
    if (n.type === 'text' && isRichText(v)) {
      // The body of an article: whole blocks, not one line.
      out.rich = richTextHtml(v)
      out.text = ''
      out.runs = null
    } else if (n.type === 'text' || (n.type === 'button' && n.field !== 'url')) {
      out.text = label ?? displayValue(v, entry.locale)
      out.runs = null
    } else if (n.type === 'image') {
      const m = v as { src?: string; alt?: string; focal?: { x: number; y: number } } | null
      out.src = typeof v === 'string' ? v : (m?.src ?? null)
      out.alt = m?.alt ?? entry.title
      if (m?.focal) out.focal = m.focal
    } else if ((n.type === 'button' || n.type === 'frame') && n.field === 'url') out.href = entry.url ?? '#'
  }
  if (n.type === 'button' && n.field !== 'url' && entry.url && !n.href?.startsWith('http')) out.href = entry.url
  // A list inside takes its values from its own entries.
  if (n.children && !n.bind) out.children = n.children.map((ch) => bindTo(ch, entry))
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
  // A text that is entirely one link (a menu item) is not underlined; a link inside a sentence is.
  const whole = runs.length === 1 && !!runs[0]?.href
  return runs
    .map((r) => {
      let h = esc(r.t).replace(/\n/g, '<br>')
      if (r.b) h = `<strong>${h}</strong>`
      if (r.i) h = `<em>${h}</em>`
      if (r.href) h = `<a href="${esc(safeHref(r.href))}"${whole ? ' style="text-decoration:none"' : ''}>${h}</a>`
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
  return `background:${C.bg};color:${C.text};font-family:${fontStack(theme.body, theme.bodyCategory)};--mz-display:${fontStack(theme.display, theme.displayCategory)}`
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

/** What content mode may change: words, links and pictures, never layout or style. */
export const CONTENT_ONLY_KEYS = [
  'text',
  'runs',
  'src',
  'alt',
  'href',
  'newTab',
  'focal',
  'poster',
  'bgImage',
  'placeholder',
  'options',
]

/** True when two versions of a page differ only in their contents (texts, links, images). */
export function sameDesign(a: PageNode[], b: PageNode[]): boolean {
  const strip = (list: PageNode[]): unknown =>
    list.map((n) => {
      const copy: Record<string, unknown> = { ...n }
      for (const k of CONTENT_ONLY_KEYS) delete copy[k]
      if (n.children) copy.children = strip(n.children)
      return copy
    })
  return JSON.stringify(strip(a)) === JSON.stringify(strip(b))
}
