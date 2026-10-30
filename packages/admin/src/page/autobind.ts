import type { PageNode } from '@materializecms/core/page'
import type { CollectionDescription } from '../lib/api.ts'

const plain = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

/** Names elements often have, and the kind of field they show. */
const SYNONYMS: [RegExp, (f: CollectionDescription['fields'][number]) => boolean][] = [
  [/^(data|date|giorno|quando)/, (f) => f.kind === 'date'],
  [/^(sommario|estratto|excerpt|riassunto|descrizione|sottotitolo)/, (f) => f.kind === 'text'],
  [/^(categoria|category|etichetta|tipo|tag)/, (f) => f.kind === 'select'],
  [/^(autore|autrice|author|di )/, (f) => f.kind === 'relation'],
  [/^(testo|corpo|body|contenuto|articolo)$/, (f) => f.kind === 'richText'],
  [/^(luogo|dove|citta|location)/, (f) => f.kind === 'text' && /luogo|location|citt/.test(plain(f.label ?? f.name))],
  [/^(anno|year)/, (f) => f.kind === 'number'],
]

/**
 * A list just bound to a collection: its template's elements take the fields their names suggest
 * (Titolo → title, Data → the date, the picture → the first image…), and the card links to the
 * entry. Elements already showing a field, or with no likely match, stay as they are.
 */
export function autoBind(template: PageNode, def: CollectionDescription): PageNode {
  const used = new Set<string>()
  const media = def.fields.filter((f) => f.kind === 'media')
  let images = 0
  const visit = (n: PageNode, root: boolean): PageNode => {
    const out: PageNode = { ...n }
    if (!n.field) {
      const name = plain(n.name ?? '')
      if (n.type === 'image' && media[images]) {
        out.field = (media[images] as { name: string }).name
        images++
      } else if (n.type === 'text' && /^(titolo|title|nome|name)/.test(name) && !used.has('title')) {
        out.field = 'title'
      } else if (n.type === 'text') {
        const exact = def.fields.find(
          (f) => !used.has(f.name) && (plain(f.label ?? '') === name || plain(f.name) === name),
        )
        const bySynonym = SYNONYMS.find(([re]) => re.test(name))
        const hit = exact ?? (bySynonym && def.fields.find((f) => !used.has(f.name) && bySynonym[1](f)))
        if (hit) out.field = hit.name
      } else if (root && n.type === 'frame' && !n.href) {
        // The whole card opens the entry's page.
        if (def.slugField) out.field = 'url'
      }
      if (out.field) used.add(out.field)
    }
    if (n.children) out.children = n.children.map((c) => visit(c, false))
    return out
  }
  return visit(template, true)
}
