/**
 * Icon libraries in the Iconify JSON format, loaded only when opened (each is a separate chunk of
 * the admin). A chosen icon is saved in the page as its SVG, so the site never loads a library.
 */

interface IconifyJson {
  prefix: string
  width?: number
  height?: number
  icons: Record<string, { body: string; width?: number; height?: number; hidden?: boolean }>
  aliases?: Record<string, { parent: string }>
}

export interface IconSet {
  id: string
  label: string
  hint: string
  /** Line icons: their stroke can be made thinner or thicker. */
  line: boolean
  /** Styles as name suffixes ('' = the default style). */
  styles?: { value: string; label: string }[]
  load: () => Promise<{ default: IconifyJson }>
}

export const ICON_SETS: IconSet[] = [
  {
    id: 'lucide',
    label: 'Lucide',
    hint: 'Linee pulite, ~1.900 icone',
    line: true,
    load: () => import('@iconify-json/lucide/icons.json'),
  },
  {
    id: 'ph',
    label: 'Phosphor',
    hint: '~1.500 icone in sei pesi',
    line: false,
    styles: [
      { value: '', label: 'Normale' },
      { value: '-thin', label: 'Sottile' },
      { value: '-light', label: 'Leggero' },
      { value: '-bold', label: 'Grassetto' },
      { value: '-fill', label: 'Pieno' },
      { value: '-duotone', label: 'Due toni' },
    ],
    load: () => import('@iconify-json/ph/icons.json'),
  },
  {
    id: 'tabler',
    label: 'Tabler',
    hint: 'La più vasta a linee, ~6.000',
    line: true,
    load: () => import('@iconify-json/tabler/icons.json'),
  },
  {
    id: 'material-symbols',
    label: 'Material',
    hint: 'Lo standard di Google',
    line: false,
    styles: [
      { value: '', label: 'Pieno' },
      { value: '-outline', label: 'Contorno' },
      { value: '-rounded', label: 'Arrotondato' },
      { value: '-sharp', label: 'Squadrato' },
    ],
    load: () => import('@iconify-json/material-symbols/icons.json'),
  },
  {
    id: 'simple-icons',
    label: 'Marchi',
    hint: '~3.700 loghi: Instagram, Stripe, Figma…',
    line: false,
    load: () => import('@iconify-json/simple-icons/icons.json'),
  },
]

export interface LoadedSet {
  id: string
  names: string[]
  svg: (name: string) => string
}

const cache = new Map<string, Promise<LoadedSet>>()

/** A library, once: its icon names and a way to draw each one. */
export function loadSet(set: IconSet): Promise<LoadedSet> {
  let p = cache.get(set.id)
  if (!p) {
    p = set.load().then(({ default: json }) => {
      const names = Object.keys(json.icons).filter((n) => !json.icons[n]?.hidden)
      const svg = (name: string) => {
        const icon = json.icons[name] ?? json.icons[json.aliases?.[name]?.parent ?? '']
        if (!icon) return ''
        const w = icon.width ?? json.width ?? 24
        const h = icon.height ?? json.height ?? 24
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${icon.body}</svg>`
      }
      return { id: set.id, names, svg }
    })
    cache.set(set.id, p)
  }
  return p
}

/** Which style a name belongs to, for libraries that have several. */
export function styleOf(set: IconSet, name: string): string {
  const suffixes = (set.styles ?? []).map((s) => s.value).filter(Boolean)
  // Longest first: "-outline-rounded" is not "-rounded".
  const hit = suffixes.filter((s) => name.endsWith(s)).sort((a, b) => b.length - a.length)[0]
  if (set.id === 'material-symbols' && /-outline-(rounded|sharp)$/.test(name)) return 'other'
  return hit ?? ''
}

/** Italian words for common icons, so "freccia" finds "arrow". */
const WORDS: Record<string, string[]> = {
  freccia: ['arrow'],
  destra: ['right'],
  sinistra: ['left'],
  su: ['up'],
  giu: ['down'],
  casa: ['home', 'house'],
  email: ['mail', 'envelope'],
  posta: ['mail', 'envelope'],
  telefono: ['phone'],
  cellulare: ['phone', 'mobile', 'smartphone'],
  luogo: ['map-pin', 'location', 'pin'],
  mappa: ['map'],
  indirizzo: ['map-pin', 'location'],
  stella: ['star'],
  cuore: ['heart'],
  persona: ['user', 'person'],
  persone: ['users', 'people', 'group'],
  cerca: ['search', 'magnifying'],
  chiudi: ['close', 'x'],
  spunta: ['check'],
  piu: ['plus', 'add'],
  meno: ['minus'],
  scarica: ['download'],
  condividi: ['share'],
  impostazioni: ['settings', 'gear', 'cog'],
  carrello: ['cart', 'shopping'],
  borsa: ['bag', 'shopping'],
  calendario: ['calendar'],
  orologio: ['clock', 'time'],
  orario: ['clock', 'time'],
  idea: ['bulb', 'lightbulb'],
  foglia: ['leaf'],
  albero: ['tree'],
  sole: ['sun'],
  luna: ['moon'],
  fuoco: ['flame', 'fire'],
  occhio: ['eye'],
  lucchetto: ['lock'],
  chiave: ['key'],
  foto: ['camera', 'photo', 'image'],
  immagine: ['image', 'photo'],
  video: ['video', 'play'],
  musica: ['music'],
  documento: ['file', 'document'],
  matita: ['pencil', 'edit'],
  pennello: ['brush', 'paint'],
  righello: ['ruler'],
  premio: ['award', 'trophy', 'medal'],
  scudo: ['shield'],
  fulmine: ['bolt', 'zap', 'lightning'],
  regalo: ['gift'],
  messaggio: ['message', 'chat'],
  pagamento: ['credit-card', 'wallet', 'payment'],
  auto: ['car'],
  bici: ['bike', 'bicycle'],
  aereo: ['plane'],
  libro: ['book'],
  scuola: ['school'],
  lavoro: ['briefcase'],
  edificio: ['building'],
  negozio: ['store', 'shop'],
  mondo: ['globe', 'world'],
}

/** The names matching a search, best first: Italian words become their English equivalents. */
export function searchNames(names: string[], query: string): string[] {
  const q = query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  if (!q) return names
  const words = q.split(/\s+/)
  const alternatives = words.map((w) => [w, ...(WORDS[w] ?? [])])
  const hits = names.filter((n) => alternatives.every((alts) => alts.some((a) => n.includes(a))))
  // Exact and shorter names first: "arrow-right" before "arrow-right-circle-dashed".
  return hits.sort((a, b) => a.length - b.length)
}
