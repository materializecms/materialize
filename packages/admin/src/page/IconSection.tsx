import { ICONS, iconSvg } from '@materializecms/core/icons'
import type { NodeProps, PageNode } from '@materializecms/core/page'
import { useEffect, useMemo, useState } from 'react'
import { cx, Textarea } from '../components/ui.tsx'
import { ColorField, NumField, Row, Section, Select } from './controls.tsx'
import { ICON_SETS, type LoadedSet, loadSet, searchNames, styleOf } from './iconSets.ts'

const GROUPS = ['Frecce', 'Contatti', 'Social', 'Interfaccia', 'Temi', 'Forme'] as const
/** At most this many icons drawn at once: libraries have thousands. */
const LIMIT = 240

const tile = (on: boolean) =>
  cx(
    'flex aspect-square items-center justify-center rounded-md border p-1.5 text-fg2 hover:text-fg [&_svg]:size-full',
    on ? 'border-accent bg-accent/10 text-accent' : 'border-line',
  )

/** The icon element: an icon from a library or the basic set, a shape, or a pasted SVG; color, weight, link. */
export function IconSection({
  node,
  p,
  palette,
  onProps,
  onContent,
}: {
  node: PageNode
  /** The element as shown on the device being edited. */
  p: PageNode
  palette: Record<string, string>
  onProps: (patch: Partial<NodeProps>, group?: string) => void
  onContent: (patch: Partial<PageNode>, group?: string) => void
}) {
  const current = node.icon?.includes(':') && !node.icon.startsWith('shape:') ? node.icon.split(':')[0] : null
  const [source, setSource] = useState<string>(
    node.svg && !current ? 'custom' : current && ICON_SETS.some((s) => s.id === current) ? current : 'base',
  )
  const [query, setQuery] = useState('')
  const [style, setStyle] = useState('')
  const [loaded, setLoaded] = useState<LoadedSet | null>(null)
  const set = ICON_SETS.find((s) => s.id === source)

  useEffect(() => {
    setLoaded(null)
    setStyle('')
    if (!set) return
    let live = true
    loadSet(set).then((l) => live && setLoaded(l))
    return () => {
      live = false
    }
  }, [set])

  const basePreviews = useMemo(
    () => Object.fromEntries(ICONS.map((i) => [i.name, iconSvg({ icon: i.name, strokeW: 1.75 })])),
    [],
  )
  const q = query.trim().toLowerCase()
  const baseShown = ICONS.filter((i) => !q || i.label.toLowerCase().includes(q) || i.name.toLowerCase().includes(q))
  const found = useMemo(() => {
    if (!set || !loaded) return []
    const inStyle = set.styles ? loaded.names.filter((n) => styleOf(set, n) === style) : loaded.names
    return searchNames(inStyle, query)
  }, [set, loaded, style, query])

  const line = node.svg ? /^(lucide|tabler):/.test(node.icon ?? '') : !node.icon?.startsWith('shape:')

  return (
    <Section title="Icona">
      <Row label="Da">
        <Select
          label="Libreria di icone"
          value={source}
          onChange={setSource}
          options={[
            { value: 'base', label: 'Essenziali e forme' },
            ...ICON_SETS.map((s) => ({ value: s.id, label: s.label })),
            { value: 'custom', label: 'SVG personale' },
          ]}
        />
      </Row>
      {source === 'custom' ? (
        <>
          <Textarea
            aria-label="Codice SVG"
            value={node.svg ?? ''}
            placeholder="<svg viewBox=…>…</svg>"
            onChange={(e) => onContent({ svg: e.target.value || null, icon: null }, `svg:${node.id}`)}
            className="font-mono text-[11px]"
          />
          <p className="text-[11px] leading-relaxed text-fg3">
            Incolla un SVG da Figma o Illustrator. Gli script vengono tolti; usa “currentColor” per prendere il colore
            qui sotto.
          </p>
        </>
      ) : (
        <>
          {set && <p className="text-[11px] text-fg3">{set.hint}</p>}
          <div className="flex gap-1.5">
            <input
              aria-label="Cerca un’icona"
              value={query}
              placeholder="Cerca: freccia, email, stella…"
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent"
            />
            {set?.styles && (
              <select
                aria-label="Stile delle icone"
                value={style}
                onChange={(e) => setStyle(e.target.value)}
                className="h-7 rounded-md border border-line2 bg-input px-1 text-[11.5px] outline-none focus:border-accent"
              >
                {set.styles.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </div>
          {set ? (
            !loaded ? (
              <p className="py-6 text-center text-[12px] text-fg3">Carico {set.label}…</p>
            ) : (
              <>
                <div className="grid max-h-72 grid-cols-6 gap-1 overflow-y-auto pr-0.5">
                  {found.slice(0, LIMIT).map((name) => {
                    const id = `${set.id}:${name}`
                    return (
                      <button
                        key={name}
                        type="button"
                        title={name}
                        aria-label={name}
                        aria-pressed={node.icon === id}
                        onClick={() => onContent({ icon: id, svg: loaded.svg(name) })}
                        className={tile(node.icon === id)}
                        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from an installed icon library
                        dangerouslySetInnerHTML={{ __html: loaded.svg(name) }}
                      />
                    )
                  })}
                </div>
                <p className="text-[11px] text-fg3">
                  {found.length === 0
                    ? 'Nessuna icona: prova in inglese (arrow, mail…).'
                    : found.length > LIMIT
                      ? `${found.length} icone: scrivi per restringere.`
                      : `${found.length} icone.`}
                </p>
              </>
            )
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
              {GROUPS.map((g) => {
                const items = baseShown.filter((i) => i.group === g)
                if (!items.length) return null
                return (
                  <div key={g}>
                    <div className="mb-1 text-[10.5px] font-medium tracking-wide text-fg3 uppercase">{g}</div>
                    <div className="grid grid-cols-6 gap-1">
                      {items.map((i) => (
                        <button
                          key={i.name}
                          type="button"
                          title={i.label}
                          aria-label={i.label}
                          aria-pressed={node.icon === i.name && !node.svg}
                          onClick={() => onContent({ icon: i.name, svg: null })}
                          className={tile(node.icon === i.name && !node.svg)}
                          // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG from our own icon set
                          dangerouslySetInnerHTML={{ __html: basePreviews[i.name] ?? '' }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
      <Row label="Colore">
        <ColorField value={p.color ?? 'text'} palette={palette} onChange={(v) => onProps({ color: v ?? 'text' })} />
      </Row>
      {line && (
        <Row label="Spessore" hint="Spessore delle linee dell’icona">
          <NumField
            value={p.strokeW ?? (node.svg ? 2 : 1.5)}
            min={0.5}
            max={4}
            step={0.25}
            unit=""
            onChange={(v) => onProps({ strokeW: v }, `stroke:${node.id}`)}
          />
        </Row>
      )}
      <Row label="Collegamento">
        <input
          aria-label="Collegamento dell’icona"
          value={node.href ?? ''}
          placeholder="nessuno, oppure /contatti"
          onChange={(e) => onContent({ href: e.target.value || undefined }, `href:${node.id}`)}
          className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 font-mono text-[12px] outline-none focus:border-accent"
        />
      </Row>
      <input
        aria-label="Descrizione per chi non vede"
        value={node.alt ?? ''}
        placeholder="Descrizione (vuota se è solo decorativa)"
        onChange={(e) => onContent({ alt: e.target.value }, `alt:${node.id}`)}
        className="h-7 w-full rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent"
      />
    </Section>
  )
}
