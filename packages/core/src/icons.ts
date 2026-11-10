/**
 * Icons and decorative shapes for the "icon" element: a curated set of Lucide icons (line icons,
 * drawn with the element's color), simple filled shapes, and custom SVG pasted by an editor.
 */
import {
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Award,
  Calendar,
  Camera,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Compass,
  Download,
  ExternalLink,
  Globe,
  Heart,
  House,
  type IconNode,
  Info,
  Layers,
  Leaf,
  Lightbulb,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Moon,
  Palette,
  Pencil,
  Phone,
  Play,
  Plus,
  Quote,
  Ruler,
  Search,
  Send,
  Shield,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Trees,
  User,
  Users,
  X,
  Zap,
} from 'lucide'
import { t } from './t.ts'

export interface IconDef {
  name: string
  label: string
  group: 'Frecce' | 'Contatti' | 'Social' | 'Interfaccia' | 'Temi' | 'Forme'
}

/** Brands, drawn in the same line style (Lucide no longer ships them). */
const INSTAGRAM: IconNode = [
  ['rect', { x: '2', y: '2', width: '20', height: '20', rx: '5' }],
  ['circle', { cx: '12', cy: '12', r: '4' }],
  ['path', { d: 'M17.5 6.5h.01' }],
]
const LINKEDIN: IconNode = [
  ['path', { d: 'M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z' }],
  ['rect', { x: '2', y: '9', width: '4', height: '12' }],
  ['circle', { cx: '4', cy: '4', r: '2' }],
]
const FACEBOOK: IconNode = [['path', { d: 'M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z' }]]
const YOUTUBE: IconNode = [
  [
    'path',
    {
      d: 'M2.5 17a24 24 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.6 49.6 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24 24 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.6 49.6 0 0 1-16.2 0A2 2 0 0 1 2.5 17',
    },
  ],
  ['path', { d: 'm10 15 5-3-5-3z' }],
]
const XLOGO: IconNode = [
  ['path', { d: 'M4 4l11.7 16H20L8.3 4z' }],
  ['path', { d: 'M4 20l6.8-7.4' }],
  ['path', { d: 'M20 4l-6.6 7.2' }],
]
const GITHUB: IconNode = [
  [
    'path',
    {
      d: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4',
    },
  ],
  ['path', { d: 'M9 18c-4.51 2-5-2-7-2' }],
]

const LUCIDE: Record<string, [IconNode, () => string, IconDef['group']]> = {
  ArrowRight: [ArrowRight, () => t('Freccia a destra'), 'Frecce'],
  ArrowLeft: [ArrowLeft, () => t('Freccia a sinistra'), 'Frecce'],
  ArrowUp: [ArrowUp, () => t('Freccia su'), 'Frecce'],
  ArrowDown: [ArrowDown, () => t('Freccia giù'), 'Frecce'],
  ArrowUpRight: [ArrowUpRight, () => t('Freccia in diagonale'), 'Frecce'],
  ArrowDownRight: [ArrowDownRight, () => t('Freccia giù a destra'), 'Frecce'],
  ChevronRight: [ChevronRight, () => t('Punta a destra'), 'Frecce'],
  ChevronLeft: [ChevronLeft, () => t('Punta a sinistra'), 'Frecce'],
  ChevronUp: [ChevronUp, () => t('Punta su'), 'Frecce'],
  ChevronDown: [ChevronDown, () => t('Punta giù'), 'Frecce'],
  ExternalLink: [ExternalLink, () => t('Link esterno'), 'Frecce'],
  Mail: [Mail, () => 'Email', 'Contatti'],
  Phone: [Phone, () => t('Telefono'), 'Contatti'],
  MapPin: [MapPin, () => t('Luogo'), 'Contatti'],
  Calendar: [Calendar, () => t('Calendario'), 'Contatti'],
  Clock: [Clock, () => t('Orario'), 'Contatti'],
  MessageCircle: [MessageCircle, () => t('Messaggio'), 'Contatti'],
  Send: [Send, () => t('Invia'), 'Contatti'],
  Globe: [Globe, () => t('Sito'), 'Contatti'],
  Instagram: [INSTAGRAM, () => 'Instagram', 'Social'],
  Linkedin: [LINKEDIN, () => 'LinkedIn', 'Social'],
  Facebook: [FACEBOOK, () => 'Facebook', 'Social'],
  Youtube: [YOUTUBE, () => 'YouTube', 'Social'],
  Twitter: [XLOGO, () => 'X / Twitter', 'Social'],
  Github: [GITHUB, () => 'GitHub', 'Social'],
  Menu: [Menu, () => 'Menu', 'Interfaccia'],
  X: [X, () => t('Chiudi'), 'Interfaccia'],
  Plus: [Plus, () => t('Più'), 'Interfaccia'],
  Minus: [Minus, () => t('Meno'), 'Interfaccia'],
  Check: [Check, () => t('Spunta'), 'Interfaccia'],
  CheckCircle: [CheckCircle, () => t('Spunta nel cerchio'), 'Interfaccia'],
  Search: [Search, () => t('Cerca'), 'Interfaccia'],
  Download: [Download, () => t('Scarica'), 'Interfaccia'],
  Play: [Play, () => t('Riproduci'), 'Interfaccia'],
  Info: [Info, () => t('Informazioni'), 'Interfaccia'],
  User: [User, () => t('Persona'), 'Interfaccia'],
  Users: [Users, () => t('Persone'), 'Interfaccia'],
  ShoppingBag: [ShoppingBag, () => t('Borsa'), 'Interfaccia'],
  House: [House, () => t('Casa'), 'Temi'],
  Ruler: [Ruler, () => t('Righello'), 'Temi'],
  Pencil: [Pencil, () => t('Matita'), 'Temi'],
  Palette: [Palette, () => t('Tavolozza'), 'Temi'],
  Layers: [Layers, () => t('Livelli'), 'Temi'],
  Compass: [Compass, () => t('Bussola'), 'Temi'],
  Lightbulb: [Lightbulb, () => t('Idea'), 'Temi'],
  Leaf: [Leaf, () => t('Foglia'), 'Temi'],
  Trees: [Trees, () => t('Alberi'), 'Temi'],
  Sun: [Sun, () => t('Sole'), 'Temi'],
  Moon: [Moon, () => t('Luna'), 'Temi'],
  Star: [Star, () => t('Stella'), 'Temi'],
  Heart: [Heart, () => t('Cuore'), 'Temi'],
  Award: [Award, () => t('Premio'), 'Temi'],
  Shield: [Shield, () => t('Garanzia'), 'Temi'],
  Zap: [Zap, () => t('Energia'), 'Temi'],
  Sparkles: [Sparkles, () => t('Scintille'), 'Temi'],
  Camera: [Camera, () => t('Fotocamera'), 'Temi'],
  Quote: [Quote, () => t('Citazione'), 'Temi'],
}

/** Filled shapes, drawn with the element's color: [viewBox, inner markup, label]. */
const SHAPES: Record<string, [string, string, () => string]> = {
  circle: ['0 0 100 100', '<circle cx="50" cy="50" r="50"/>', () => t('Cerchio')],
  ring: [
    '0 0 100 100',
    '<path fill-rule="evenodd" d="M50 0a50 50 0 1 1 0 100A50 50 0 0 1 50 0Zm0 10a40 40 0 1 0 0 80 40 40 0 0 0 0-80Z"/>',
    () => t('Anello'),
  ],
  arch: ['0 0 100 120', '<path d="M0 50a50 50 0 0 1 100 0v70H0Z"/>', () => t('Arco')],
  half: ['0 0 100 50', '<path d="M0 50a50 50 0 0 1 100 0Z"/>', () => t('Mezzo cerchio')],
  star: [
    '0 0 100 100',
    '<path d="M50 0c4 30 20 46 50 50-30 4-46 20-50 50-4-30-20-46-50-50 30-4 46-20 50-50Z"/>',
    () => t('Stella a quattro punte'),
  ],
  blob: [
    '0 0 100 100',
    '<path d="M83 17c14 14 18 39 8 57S58 103 39 98 4 77 2 56 9 13 30 4s39-1 53 13Z"/>',
    () => t('Macchia'),
  ],
  wave: [
    '0 0 200 40',
    '<path d="M0 20c25 0 25-16 50-16s25 16 50 16 25-16 50-16 25 16 50 16v4c-25 0-25 16-50 16s-25-16-50-16-25 16-50 16S25 24 0 24Z"/>',
    () => t('Onda'),
  ],
  line: ['0 0 200 4', '<rect width="200" height="4" rx="2"/>', () => t('Linea')],
  triangle: ['0 0 100 88', '<path d="M50 0l50 88H0Z"/>', () => t('Triangolo')],
  squiggle: [
    '0 0 200 40',
    '<path d="M2 20c16-24 32-24 48 0s32 24 48 0 32-24 48 0 32 24 48 0" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>',
    () => t('Ghirigoro'),
  ],
}

/** Every icon and shape, with its name in the reader's language. */
export const icons = (): IconDef[] => [
  ...Object.entries(LUCIDE).map(([name, [, label, group]]) => ({ name, label: label(), group })),
  ...Object.entries(SHAPES).map(([key, [, , label]]) => ({
    name: `shape:${key}`,
    label: label(),
    group: 'Forme' as const,
  })),
]

/** Proportions of a shape (width / height), to size the element without distortion. */
export function iconRatio(name: string | null | undefined): string {
  const shape = name?.startsWith('shape:') ? SHAPES[name.slice(6)] : undefined
  if (!shape) return '1/1'
  const [, , w, h] = shape[0].split(' ')
  return `${w}/${h}`
}

const escAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * Custom SVG, kept to drawing: no scripts, event handlers, foreign content or external links.
 * Returns '' when what was pasted is not an SVG.
 */
export function sanitizeSvg(svg: string): string {
  const m = /<svg[\s\S]*<\/svg>/i.exec(svg)
  if (!m) return ''
  return m[0]
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/<(iframe|object|embed|style|use)[\s\S]*?(<\/\1>|\/>)/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/\s(href|xlink:href)\s*=\s*("[^"#][^"]*"|'[^'#][^']*')/gi, '')
    .replace(/javascript:/gi, '')
}

/** The SVG for an icon element: a Lucide icon, a shape, or the custom SVG, sized to fill the element. */
export function iconSvg(p: { icon?: string | null; svg?: string | null; strokeW?: number | null }): string {
  const fill = 'width="100%" height="100%" style="display:block" aria-hidden="true" focusable="false"'
  if (p.svg) {
    let clean = sanitizeSvg(p.svg)
    // Line icons from a library: their stroke follows the element's weight.
    if (p.strokeW) clean = clean.replace(/stroke-width="[^"]*"/g, `stroke-width="${Number(p.strokeW)}"`)
    // Custom drawings take the element's size; their own colors stay unless they use currentColor.
    return clean.replace(/<svg\b/i, `<svg ${fill}`).replace(/\s(width|height)="[^"]*"(?=[^>]*>)/, '')
  }
  const name = p.icon ?? 'ArrowRight'
  if (name.startsWith('shape:')) {
    const shape = SHAPES[name.slice(6)] ?? SHAPES.circle
    if (!shape) return ''
    return `<svg ${fill} viewBox="${shape[0]}" fill="currentColor" preserveAspectRatio="none">${shape[1]}</svg>`
  }
  const node = (LUCIDE[name] ?? LUCIDE.ArrowRight)?.[0] ?? []
  const inner = node
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([k, v]) => `${k}="${escAttr(String(v))}"`)
          .join(' ')}/>`,
    )
    .join('')
  return `<svg ${fill} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${p.strokeW ?? 1.5}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`
}
