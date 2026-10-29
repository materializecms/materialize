import {
  ANIMATIONS,
  type Breakpoint,
  type Component,
  type ListBinding,
  type NodeProps,
  type PageNode,
  plainText,
  resolveNode,
  type SharedTextStyle,
  TEXT_STYLE_KEYS,
  TEXT_STYLES,
  type TextStyle,
} from '@materializecms/core/page'
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalSpaceAround,
  ArrowDown,
  ArrowUp,
  ClipboardPaste,
  Columns3,
  Copy,
  CornerLeftUp,
  Group,
  ImagePlus,
  LayoutGrid,
  Paintbrush,
  Play,
  Rows3,
  Trash2,
  Ungroup,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { IconButton, Textarea } from '../components/ui.tsx'
import { thumb } from '../lib/api.ts'
import type { AlignHow } from './align.ts'
import { typeLabel } from './Canvas.tsx'
import { type ComponentActions, ComponentPanel } from './ComponentPanel.tsx'
import { Chips, ColorField, LenField, NumField, Row, Section, Seg, Select, Toggle } from './controls.tsx'
import {
  EffectsSection,
  FillFields,
  MediaContent,
  PositionSection,
  SceneSection,
  SizeExtra,
  TypographyExtra,
} from './DesignFields.tsx'
import { FormSection, InputSection } from './FormFields.tsx'
import { HoverSection } from './HoverSection.tsx'
import { IconSection } from './IconSection.tsx'
import { InteractionsSection } from './Interactions.tsx'
import { nodeIcon } from './Layers.tsx'

type Key = keyof NodeProps

const RATIOS = ['1/1', '4/3', '3/2', '16/9', '21/9', '3/4', '4/5', '3/1'].map((r) => ({
  value: r,
  label: r.replace('/', ':'),
}))
const STYLE_OPTIONS = (Object.keys(TEXT_STYLES) as TextStyle[]).map((k) => ({ value: k, label: TEXT_STYLES[k].label }))

/** Shared text styles and what can be done with them from an element. */
export interface TextStyleActions {
  list: SharedTextStyle[]
  /** Creating and changing styles is for admins (they are part of the site's theme). */
  canEdit: boolean
  apply: (id: string | null) => void
  create: (name: string) => void
  update: () => void
  reset: () => void
}

const ALIGN: { how: AlignHow; label: string; icon: React.ReactNode }[] = [
  { how: 'left', label: 'Allinea a sinistra · ⌥⌘A', icon: <AlignStartVertical /> },
  { how: 'hcenter', label: 'Centra in orizzontale · ⌥⌘H', icon: <AlignCenterVertical /> },
  { how: 'right', label: 'Allinea a destra · ⌥⌘D', icon: <AlignEndVertical /> },
  { how: 'top', label: 'Allinea in alto · ⌥⌘W', icon: <AlignStartHorizontal /> },
  { how: 'vcenter', label: 'Centra in verticale · ⌥⌘V', icon: <AlignCenterHorizontal /> },
  { how: 'bottom', label: 'Allinea in basso · ⌥⌘S', icon: <AlignEndHorizontal /> },
  { how: 'hdist', label: 'Distribuisci in orizzontale', icon: <AlignHorizontalSpaceAround /> },
  { how: 'vdist', label: 'Distribuisci in verticale', icon: <AlignVerticalSpaceAround /> },
]

const FILTER_OPS: { value: NonNullable<ListBinding['filter']>['op']; label: string }[] = [
  { value: 'eq', label: 'è' },
  { value: 'neq', label: 'non è' },
  { value: 'contains', label: 'contiene' },
  { value: 'gt', label: 'dopo / più di' },
  { value: 'lt', label: 'prima / meno di' },
]

export function Inspector({
  node,
  view,
  count = 1,
  onAlign,
  onCopyStyle,
  onPasteStyle,
  onGroup,
  onUngroup,
  textStyles,
  collectionFields,
  depth,
  device,
  onProps,
  onContent,
  onReset,
  onPickImage,
  onPlay,
  onPreview,
  onDuplicate,
  onDelete,
  onMove,
  onSelectParent,
  palette,
  parentLayout,
  canCode,
  onMakeGlobal,
  onUnlinkGlobal,
  collections,
  boundFields,
  components,
  componentActions,
}: {
  node: PageNode
  /** The element as it looks (with its shared text style), for the values shown. */
  view?: PageNode
  /** How many elements are selected: design changes go to all of them. */
  count?: number
  onAlign: (how: AlignHow) => void
  onCopyStyle: () => void
  onPasteStyle: () => void
  onGroup: () => void
  onUngroup: () => void
  textStyles: TextStyleActions
  /** Fields of a collection a bound list can sort and filter by. */
  collectionFields: (collection: string) => { value: string; label: string }[]
  depth: number
  device: Breakpoint
  /** Design properties: on tablet or mobile they change only that device. */
  onProps: (patch: Partial<NodeProps>, group?: string) => void
  /** Content and names: the same on every device. */
  onContent: (patch: Partial<PageNode>, group?: string) => void
  onReset: (keys: Key[]) => void
  onPickImage: (target: 'src' | 'bgImage' | 'poster' | 'sceneImage') => void
  onPlay: () => void
  /** Opens the interactive preview, where scroll and mouse interactions play. */
  onPreview: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onSelectParent: (() => void) | null
  /** The theme's colors, for the swatches. */
  palette: Record<string, string>
  parentLayout: string | null
  /** Custom code is for admins only. */
  canCode: boolean
  onMakeGlobal: () => void
  onUnlinkGlobal: () => void
  /** Collections a list can be bound to. */
  collections: { value: string; label: string }[]
  /** Inside a bound list: the fields this element can show. */
  boundFields: { value: string; label: string }[] | null
  components: Record<string, Component>
  componentActions: ComponentActions
}) {
  const p = resolveNode(view ?? node, device)
  const hasEntrance = !!node.interactions?.some((i) => i.trigger === 'load' || i.trigger === 'view')
  const [naming, setNaming] = useState<string | null>(null)
  const bind = node.bind
  const setBind = (patch: Partial<ListBinding>) => bind && onContent({ bind: { ...bind, ...patch } })
  const linkedStyle = textStyles.list.find((s) => s.id === node.textStyle)
  // Typography the element changes on top of its style.
  const styleChanged =
    !!linkedStyle &&
    TEXT_STYLE_KEYS.some(
      (k) =>
        (node[k] !== undefined && node[k] !== null) ||
        (['tablet', 'mobile'] as const).some((bp) => node.over?.[bp]?.[k] !== undefined),
    )
  const onProp = <K extends Key>(key: K, value: NodeProps[K], group?: string) =>
    onProps({ [key]: value } as Partial<NodeProps>, group)
  const isF = node.type === 'frame'
  const isT = node.type === 'text'
  const isI = node.type === 'image'
  const isB = node.type === 'button'
  const isSec = depth === 0
  const over = (keys: Key[]) => device !== 'desktop' && keys.some((k) => node.over?.[device]?.[k] !== undefined)
  const sect = (keys: Key[]) => ({ overridden: over(keys), onReset: () => onReset(keys) })
  const design = { node, p, isSec, parentLayout, palette, onProp, onProps, sect }

  const LAYOUT: Key[] = ['layout', 'cols', 'gap', 'align', 'justify', 'wrap', 'size', 'minH']
  // On a section it sits with the layout, where it is looked for; elsewhere with the behaviour.
  const minHeight = (
    <Row label="Altezza min." hint="In percentuale dell’altezza dello schermo">
      <Seg
        value={p.minH ?? 0}
        onChange={(v) => onProp('minH', v || null)}
        options={[
          { value: 0, label: 'Auto' },
          { value: 50, label: '50%' },
          { value: 80, label: '80%' },
          { value: 100, label: '100%' },
          { value: 200, label: '200%' },
        ]}
      />
    </Row>
  )
  const SIZE: Key[] = ['width', 'fixedW', 'maxW', 'padX', 'padY', 'ratio']
  const TYPE: Key[] = ['style', 'color', 'talign', 'weight', 'fontSize']
  const LOOK: Key[] = ['scheme', 'bg', 'radius', 'border', 'divider', 'topline', 'shadow', 'hover', 'variant', 'fit']
  const MOTION: Key[] = ['anim', 'animDur', 'animDelay', 'animTrig', 'stagger']

  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent [&_svg]:size-3.5">
          {nodeIcon(node, depth)}
        </span>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Nome del livello"
            value={node.name ?? ''}
            placeholder={typeLabel(node)}
            onChange={(e) => onContent({ name: e.target.value }, `name:${node.id}`)}
            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-[13px] font-semibold outline-none hover:border-line2 focus:border-accent"
          />
          <div className="px-1 text-[11px] text-fg3">
            {isSec ? 'Sezione' : typeLabel(node)}
            {device !== 'desktop' && ` · modifiche solo per ${device === 'tablet' ? 'tablet' : 'mobile'}`}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 border-b border-line px-2.5 py-1.5">
        {onSelectParent && (
          <IconButton label="Seleziona il contenitore · Esc" onClick={onSelectParent}>
            <CornerLeftUp />
          </IconButton>
        )}
        <IconButton label="Sposta su · ⌥↑" onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>
        <IconButton label="Sposta giù · ⌥↓" onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>
        <div className="flex-1" />
        {count > 1 && !isSec && (
          <IconButton label="Raggruppa in un contenitore · ⌘G" onClick={onGroup}>
            <Group />
          </IconButton>
        )}
        {count === 1 && isF && !isSec && !node.component && !!node.children?.length && (
          <IconButton label="Separa: gli elementi prendono il posto del contenitore · ⇧⌘G" onClick={onUngroup}>
            <Ungroup />
          </IconButton>
        )}
        <IconButton label="Copia lo stile · ⌥⌘C" onClick={onCopyStyle}>
          <Paintbrush />
        </IconButton>
        <IconButton label="Incolla lo stile · ⌥⌘V" onClick={onPasteStyle}>
          <ClipboardPaste />
        </IconButton>
        <IconButton label="Duplica · ⌘D" onClick={onDuplicate}>
          <Copy />
        </IconButton>
        <IconButton label="Elimina · ⌫" onClick={onDelete} className="hover:text-danger">
          <Trash2 />
        </IconButton>
      </div>

      {!isSec && (
        <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
          {ALIGN.map((a, i) => (
            <span key={a.how} className="contents">
              {i === 6 && <div className="mx-0.5 h-4 w-px bg-line" />}
              <IconButton label={a.label} onClick={() => onAlign(a.how)}>
                {a.icon}
              </IconButton>
            </span>
          ))}
        </div>
      )}
      {count > 1 && (
        <p className="border-b border-line bg-accent/5 px-3.5 py-2 text-[11.5px] leading-relaxed text-fg2">
          <strong className="font-semibold text-fg">{count} elementi selezionati.</strong> Le modifiche di stile valgono
          per tutti; testi e immagini restano di ciascuno. ⇧ clic per aggiungere o togliere.
        </p>
      )}

      <ComponentPanel node={node} components={components} actions={componentActions} />

      {isSec && (
        <div className="border-b border-line px-3.5 py-2.5">
          <Row label="Ancora" hint="Per i link a questa sezione: #ancora">
            <input
              aria-label="Ancora della sezione"
              value={node.anchor ?? ''}
              placeholder="es. progetti"
              onChange={(e) =>
                onContent(
                  { anchor: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') || null },
                  `anchor:${node.id}`,
                )
              }
              className="mb-2 h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 font-mono text-[12px] outline-none focus:border-accent"
            />
          </Row>
          {node.global ? (
            <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-2.5 py-2 text-[11.5px] text-accent">
              <span className="min-w-0 flex-1">
                Sezione globale: le modifiche valgono su tutte le pagine che la usano.
              </span>
              <button type="button" onClick={onUnlinkGlobal} className="shrink-0 font-medium underline">
                Scollega
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onMakeGlobal}
              className="h-7 w-full rounded-md border border-line2 text-[12px] font-medium text-fg2 hover:bg-hover hover:text-fg"
            >
              Rendi globale (es. menu e piè di pagina)
            </button>
          )}
        </div>
      )}

      {boundFields && (
        <Section title="Dato collegato">
          <Row label="Mostra">
            <Select
              label="Campo della raccolta"
              value={node.field ?? ''}
              onChange={(v) => onContent({ field: v || null })}
              options={[{ value: '', label: 'Contenuto fisso' }, ...boundFields]}
            />
          </Row>
          <p className="text-[11px] leading-relaxed text-fg3">
            Ogni copia dell’elenco mostra il valore della sua voce. Su un contenitore, “Indirizzo” lo rende un link alla
            pagina.
          </p>
        </Section>
      )}

      {isF && !isSec && (
        <Section title="Elenco dinamico">
          <Row label="Raccolta">
            <Select
              label="Raccolta collegata"
              value={node.bind?.collection ?? ''}
              onChange={(v) => onContent({ bind: v ? { collection: v, limit: node.bind?.limit ?? 6 } : null })}
              options={[{ value: '', label: 'Nessuna' }, ...collections]}
            />
          </Row>
          {bind && (
            <>
              <Row label={bind.more ? 'Voci per volta' : 'Quante voci'}>
                <NumField value={bind.limit ?? 6} min={1} max={48} onChange={(v) => setBind({ limit: v ?? 6 })} />
              </Row>
              <Row label="Ordina per">
                <Select
                  label="Ordina per"
                  value={bind.sort?.field ?? ''}
                  onChange={(v) => setBind({ sort: v ? { field: v, dir: bind.sort?.dir ?? 'asc' } : null })}
                  options={[{ value: '', label: 'Ordine della raccolta' }, ...collectionFields(bind.collection)]}
                />
              </Row>
              {bind.sort && (
                <Row label="Verso">
                  <Seg
                    value={bind.sort.dir}
                    onChange={(dir) => bind.sort && setBind({ sort: { ...bind.sort, dir } })}
                    options={[
                      { value: 'asc', label: 'A → Z, 1 → 9' },
                      { value: 'desc', label: 'Z → A, 9 → 1' },
                    ]}
                  />
                </Row>
              )}
              <Row label="Filtra">
                <Select
                  label="Campo del filtro"
                  value={bind.filter?.field ?? ''}
                  onChange={(v) =>
                    setBind({
                      filter: v ? { field: v, op: bind.filter?.op ?? 'eq', value: bind.filter?.value ?? '' } : null,
                    })
                  }
                  options={[{ value: '', label: 'Tutte le voci' }, ...collectionFields(bind.collection)]}
                />
              </Row>
              {bind.filter && (
                <div className="mb-2 flex gap-1.5">
                  <Select
                    label="Condizione"
                    value={bind.filter.op}
                    onChange={(op) => bind.filter && setBind({ filter: { ...bind.filter, op } })}
                    options={FILTER_OPS}
                  />
                  <input
                    aria-label="Valore del filtro"
                    value={bind.filter.value}
                    placeholder="valore"
                    onChange={(e) => bind.filter && setBind({ filter: { ...bind.filter, value: e.target.value } })}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent"
                  />
                </div>
              )}
              <Toggle
                label="Pulsante “Mostra altri” sotto l’elenco"
                checked={!!bind.more}
                onChange={(v) => setBind({ more: v || undefined })}
              />
              {bind.more && (
                <Row label="Testo">
                  <input
                    aria-label="Testo del pulsante"
                    value={bind.moreLabel ?? ''}
                    placeholder="Mostra altri"
                    onChange={(e) => setBind({ moreLabel: e.target.value || undefined })}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent"
                  />
                </Row>
              )}
              <p className="text-[11px] leading-relaxed text-fg3">
                Il primo elemento interno si ripete per ogni voce: selezionane i testi e le immagini per scegliere quale
                campo mostrano.
              </p>
            </>
          )}
        </Section>
      )}

      {(isT || isB) && (
        <Section title="Contenuto">
          <Textarea
            aria-label="Testo"
            value={isT ? plainText(node) : (node.text ?? '')}
            onChange={(e) =>
              onContent(
                isT ? { text: e.target.value, runs: null } : { text: e.target.value.replace(/\n/g, ' ') },
                `text:${node.id}`,
              )
            }
          />
          {isT && !!node.runs?.length && (
            <p className="text-[11px] text-fg3">Grassetti e link si modificano sulla tela, con un doppio clic.</p>
          )}
          {isB && (
            <>
              <Row label="Collegamento">
                <input
                  aria-label="Collegamento"
                  value={node.href ?? ''}
                  placeholder="/contatti"
                  onChange={(e) => onContent({ href: e.target.value }, `href:${node.id}`)}
                  className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 font-mono text-[12px] outline-none focus:border-accent"
                />
              </Row>
              <Toggle
                label="Apri in una nuova scheda"
                checked={!!node.newTab}
                onChange={(v) => onContent({ newTab: v || undefined })}
              />
              <Toggle
                label="Invia il modulo che lo contiene"
                checked={!!node.submit}
                onChange={(v) => onContent({ submit: v || undefined })}
              />
            </>
          )}
        </Section>
      )}

      <SceneSection node={node} palette={palette} onContent={onContent} onPickImage={() => onPickImage('sceneImage')} />

      <MediaContent node={node} onContent={onContent} onPickPoster={() => onPickImage('poster')} canCode={canCode} />

      <FormSection node={node} isSec={isSec} onContent={onContent} />
      <InputSection node={node} onContent={onContent} />

      {node.type === 'icon' && (
        <IconSection node={node} p={p} palette={palette} onProps={onProps} onContent={onContent} />
      )}

      {isI && (
        <Section title="Immagine">
          <button
            type="button"
            onClick={() => onPickImage('src')}
            className="group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-panel2 text-fg3"
          >
            {node.src ? (
              <img src={thumb(node.src, 640)} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-[12px]">
                <ImagePlus className="size-5" /> Scegli un’immagine
              </span>
            )}
            {node.src && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[12px] font-medium text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                Cambia immagine
              </span>
            )}
          </button>
          <input
            aria-label="Testo alternativo"
            value={node.alt ?? ''}
            placeholder="Descrivi l’immagine a chi non la vede"
            onChange={(e) => onContent({ alt: e.target.value }, `alt:${node.id}`)}
            className="h-7 w-full rounded-md border border-line2 bg-input px-2 text-[12px] outline-none focus:border-accent"
          />
          <Row label="Proporzioni">
            <Select
              label="Proporzioni"
              value={p.ratio ?? '4/3'}
              options={RATIOS}
              onChange={(v) => onProp('ratio', v)}
            />
          </Row>
          <Row label="Adatta">
            <Seg
              value={p.fit ?? 'cover'}
              onChange={(v) => onProp('fit', v)}
              options={[
                { value: 'cover', label: 'Riempi' },
                { value: 'contain', label: 'Intera' },
              ]}
            />
          </Row>
          {node.src && (
            <Row label="Punto focale" hint="Resta visibile quando l’immagine viene ritagliata">
              <NumField
                label="X"
                unit="%"
                max={100}
                value={node.focal?.x ?? 50}
                onChange={(x) => onContent({ focal: { x: x ?? 50, y: node.focal?.y ?? 50 } })}
              />
              <NumField
                label="Y"
                unit="%"
                max={100}
                value={node.focal?.y ?? 50}
                onChange={(y) => onContent({ focal: { x: node.focal?.x ?? 50, y: y ?? 50 } })}
              />
            </Row>
          )}
        </Section>
      )}

      {isF && (
        <Section title={isSec ? 'Sezione' : 'Disposizione'} {...sect(LAYOUT)}>
          {isSec && (
            <Row label="Spazio">
              <Seg
                value={p.size ?? 'm'}
                onChange={(v) => onProp('size', v)}
                options={[
                  { value: 'xs', label: 'XS' },
                  { value: 's', label: 'S' },
                  { value: 'm', label: 'M' },
                  { value: 'l', label: 'L' },
                ]}
              />
            </Row>
          )}
          <Row label="Direzione">
            <Seg
              value={p.layout ?? 'col'}
              onChange={(v) => onProp('layout', v)}
              options={[
                { value: 'col', label: <Rows3 />, title: 'In colonna' },
                { value: 'row', label: <Columns3 />, title: 'In riga' },
                { value: 'grid', label: <LayoutGrid />, title: 'Griglia' },
              ]}
            />
          </Row>
          {p.layout === 'grid' && (
            <Row label="Colonne">
              <Seg
                value={p.cols ?? 3}
                onChange={(v) => onProp('cols', v)}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
              />
            </Row>
          )}
          <Row label="Spazio interno" hint="Spazio tra gli elementi">
            <LenField
              label="↔"
              value={p.gap ?? 16}
              onChange={(v) => onProp('gap', v ?? 0, `gap:${node.id}`)}
              max={240}
            />
          </Row>
          <Row label="Allinea">
            <Seg
              value={p.align ?? 'start'}
              onChange={(v) => onProp('align', v)}
              options={[
                { value: 'start', label: 'Inizio' },
                { value: 'center', label: 'Centro' },
                { value: 'end', label: 'Fine' },
                { value: 'stretch', label: 'Estendi' },
              ]}
            />
          </Row>
          {p.layout === 'row' && (
            <>
              <Row label="Distribuisci">
                <Seg
                  value={p.justify ?? 'start'}
                  onChange={(v) => onProp('justify', v)}
                  options={[
                    { value: 'start', label: 'Inizio' },
                    { value: 'center', label: 'Centro' },
                    { value: 'end', label: 'Fine' },
                    { value: 'between', label: 'Tra' },
                  ]}
                />
              </Row>
              <Toggle label="Vai a capo se non c’è spazio" checked={!!p.wrap} onChange={(v) => onProp('wrap', v)} />
            </>
          )}
          {(p.layout ?? 'col') === 'col' && (
            <Row label="In verticale" hint="Dove stanno gli elementi quando il contenitore è più alto di loro">
              <Seg
                value={p.justify ?? 'start'}
                onChange={(v) => onProp('justify', v)}
                options={[
                  { value: 'start', label: 'Alto' },
                  { value: 'center', label: 'Centro' },
                  { value: 'end', label: 'Basso' },
                  { value: 'between', label: 'Tra' },
                ]}
              />
            </Row>
          )}
          {isSec && minHeight}
        </Section>
      )}

      {!isSec && (
        <Section title="Dimensioni" {...sect(SIZE)}>
          <Row label="Larghezza">
            <Seg
              value={p.width ?? (isB ? 'hug' : 'fill')}
              onChange={(v) => onProp('width', v)}
              options={[
                { value: 'fill', label: 'Riempi' },
                { value: 'hug', label: 'Adatta' },
                { value: 'fixed', label: 'Fissa' },
              ]}
            />
          </Row>
          {p.width === 'fixed' && (
            <Row label="Fissa a">
              <LenField
                label="L"
                value={p.fixedW ?? 240}
                onChange={(v) => onProp('fixedW', v ?? 240, `fixedW:${node.id}`)}
              />
            </Row>
          )}
          <Row label="Massima" hint="Larghezza massima">
            <LenField
              label="M"
              value={p.maxW ?? null}
              placeholder="nessuna"
              onChange={(v) => onProp('maxW', v, `maxW:${node.id}`)}
            />
          </Row>
          {!isI && (
            <Row label="Margine interno">
              <LenField
                label="X"
                value={p.padX ?? (isB ? 24 : 0)}
                onChange={(v) => onProp('padX', v ?? 0, `padX:${node.id}`)}
                max={200}
              />
              <LenField
                label="Y"
                value={p.padY ?? (isB ? 14 : 0)}
                onChange={(v) => onProp('padY', v ?? 0, `padY:${node.id}`)}
                max={200}
              />
            </Row>
          )}
          <SizeExtra {...design} />
        </Section>
      )}

      {(isT || isB) && (
        <Section title="Testo" {...sect(TYPE)}>
          <Row label="Stile condiviso" hint="Uno stile del sito: cambiandolo, cambiano tutti i testi che lo usano">
            <Select
              label="Stile condiviso"
              value={node.textStyle && linkedStyle ? node.textStyle : ''}
              onChange={(v) => textStyles.apply(v || null)}
              options={[
                { value: '', label: 'Nessuno' },
                ...textStyles.list.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </Row>
          {naming !== null ? (
            <form
              className="mb-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault()
                if (naming.trim()) textStyles.create(naming.trim())
                setNaming(null)
              }}
            >
              <input
                autoFocus
                aria-label="Nome del nuovo stile"
                value={naming}
                placeholder="es. Titolo di sezione"
                onChange={(e) => setNaming(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setNaming(null)}
                className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-input px-2 text-[12px] outline-none"
              />
              <button type="submit" className="h-7 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white">
                Crea
              </button>
            </form>
          ) : (
            textStyles.canEdit && (
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px]">
                {linkedStyle && styleChanged && (
                  <>
                    <button type="button" onClick={textStyles.update} className="text-accent hover:underline">
                      Aggiorna “{linkedStyle.name}” con queste modifiche
                    </button>
                    <button type="button" onClick={textStyles.reset} className="text-fg2 hover:underline">
                      Torna allo stile
                    </button>
                  </>
                )}
                {!linkedStyle && (
                  <button type="button" onClick={() => setNaming('')} className="text-accent hover:underline">
                    Crea uno stile da questo testo
                  </button>
                )}
              </div>
            )
          )}
          <Row label="Stile">
            <Select
              label="Stile del testo"
              value={p.style ?? (isB ? 'button' : 'body')}
              options={STYLE_OPTIONS}
              onChange={(v) => onProp('style', v)}
            />
          </Row>
          {isT && (
            <>
              <Row label="Colore">
                <ColorField
                  value={p.color ?? 'text'}
                  palette={palette}
                  onChange={(v) => onProp('color', v ?? 'text')}
                />
              </Row>
              <Row label="Allineamento">
                <Seg
                  value={p.talign ?? 'left'}
                  onChange={(v) => onProp('talign', v)}
                  options={[
                    { value: 'left', label: <AlignLeft />, title: 'A sinistra' },
                    { value: 'center', label: <AlignCenter />, title: 'Al centro' },
                    { value: 'right', label: <AlignRight />, title: 'A destra' },
                  ]}
                />
              </Row>
            </>
          )}
          <Row label="Peso">
            <Select
              label="Peso del carattere"
              value={String(p.weight ?? '')}
              onChange={(v) => onProp('weight', v ? Number(v) : null)}
              options={[
                { value: '', label: 'Dello stile' },
                { value: '400', label: 'Normale' },
                { value: '500', label: 'Medio' },
                { value: '600', label: 'Semigrassetto' },
                { value: '700', label: 'Grassetto' },
              ]}
            />
          </Row>
          <Row label="Dimensione">
            <LenField
              value={p.fontSize ?? null}
              placeholder="dello stile"
              onChange={(v) => onProp('fontSize', v, `fontSize:${node.id}`)}
              min={8}
              max={200}
            />
          </Row>
          <TypographyExtra {...design} />
        </Section>
      )}

      <Section title="Aspetto" {...sect(LOOK)}>
        {isF && (
          <Row label="Colori">
            <Select
              label="Schema di colori"
              value={p.scheme ?? 'default'}
              onChange={(v) =>
                // A scheme brings its own background: a theme color set before would cancel it out.
                onProps({
                  scheme: v === 'default' ? null : (v as NodeProps['scheme']),
                  ...(v !== 'default' && typeof p.bg === 'string' && palette[p.bg] ? { bg: null } : {}),
                })
              }
              options={[
                { value: 'default', label: isSec ? 'Pagina' : 'Come il contenitore' },
                { value: 'surface', label: 'Superficie' },
                { value: 'inverse', label: 'Inverso' },
                { value: 'accent', label: 'Accento' },
              ]}
            />
          </Row>
        )}
        {isB && (
          <Row label="Variante">
            <Seg
              value={p.variant ?? 'primary'}
              onChange={(v) => onProp('variant', v)}
              options={[
                { value: 'primary', label: 'Principale' },
                { value: 'secondary', label: 'Scura' },
                { value: 'ghost', label: 'Bordo' },
              ]}
            />
          </Row>
        )}
        {(isF || isT || node.type === 'embed') && <FillFields {...design} />}
        {isSec && (
          <Row label="Foto di sfondo">
            <button
              type="button"
              onClick={() => onPickImage('bgImage')}
              className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-line2 bg-input px-1.5 text-left text-[12px] hover:border-fg3/50"
            >
              {node.bgImage?.src ? (
                <img src={thumb(node.bgImage.src, 320)} alt="" className="size-5 rounded object-cover" />
              ) : (
                <ImagePlus className="size-3.5 text-fg3" />
              )}
              <span className="truncate">{node.bgImage?.src ? 'Cambia' : 'Aggiungi'}</span>
            </button>
            {node.bgImage?.src && (
              <IconButton label="Togli la foto di sfondo" onClick={() => onContent({ bgImage: null })}>
                <X />
              </IconButton>
            )}
          </Row>
        )}
        {isSec && node.bgImage?.src && (
          <Row label="Oscura" hint="Scurisce la foto perché il testo resti leggibile">
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={node.bgDim ?? 0.45}
              onChange={(e) => onContent({ bgDim: Number(e.target.value) }, `dim:${node.id}`)}
              className="flex-1 accent-[var(--accent)]"
              aria-label="Oscura la foto"
            />
          </Row>
        )}
        {!isSec && (
          <Row label="Angoli">
            <Select
              label="Raggio degli angoli"
              value={String(p.radius ?? (isI ? 'card' : isB ? 'btn' : 0))}
              onChange={(v) => onProp('radius', v === 'btn' || v === 'card' ? v : Number(v))}
              options={[
                { value: '0', label: 'Netti' },
                { value: '4', label: '4 px' },
                { value: '8', label: '8 px' },
                { value: '16', label: '16 px' },
                { value: 'card', label: 'Come le schede' },
                { value: 'btn', label: 'Come i pulsanti' },
              ]}
            />
          </Row>
        )}
        {!isSec && (
          <Row label="Ombra">
            <Seg
              value={p.shadow ?? 'none'}
              onChange={(v) => onProp('shadow', v)}
              options={[
                { value: 'none', label: 'Nessuna' },
                { value: 'sm', label: 'Leggera' },
                { value: 'lg', label: 'Forte' },
              ]}
            />
          </Row>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['border', 'Bordo'],
              ['topline', 'Linea sopra'],
              ['divider', 'Linea sotto'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={!!p[k]}
              onClick={() => onProp(k, !p[k])}
              className={
                p[k]
                  ? 'h-7 rounded-md border border-accent bg-accent/10 text-[11.5px] font-medium text-accent'
                  : 'h-7 rounded-md border border-line2 text-[11.5px] font-medium text-fg2 hover:text-fg'
              }
            >
              {label}
            </button>
          ))}
        </div>
        {!isSec && (
          <Row label="Al passaggio" hint="Effetto quando il mouse passa sopra">
            <Select
              label="Effetto al passaggio del mouse"
              value={p.hover ?? 'none'}
              onChange={(v) => onProp('hover', v)}
              options={[
                { value: 'none', label: 'Nessuno' },
                { value: 'lift', label: 'Si solleva' },
                { value: 'grow', label: 'Si ingrandisce' },
                { value: 'dim', label: 'Si attenua' },
                { value: 'zoomimg', label: 'Zoom sull’immagine' },
              ]}
            />
          </Row>
        )}
      </Section>

      <Section
        title="Entrata rapida"
        {...sect(MOTION)}
        action={
          <IconButton label="Riproduci le animazioni" onClick={onPlay} className="size-6">
            <Play />
          </IconButton>
        }
      >
        <p className="text-[11px] leading-relaxed text-fg3">
          Un effetto pronto quando l’elemento compare. Per linee temporali, scroll e mouse usa Interazioni, qui sotto.
        </p>
        {hasEntrance && p.anim && p.anim !== 'none' && (
          <div className="flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-2 text-[11.5px] text-fg2">
            <span className="min-w-0 flex-1">
              Si somma a un’interazione di entrata: i due effetti si sovrappongono.
            </span>
            <button
              type="button"
              onClick={() => onProp('anim', 'none')}
              className="shrink-0 font-medium text-accent underline"
            >
              Tieni l’interazione
            </button>
          </div>
        )}
        <Chips
          value={p.anim ?? 'none'}
          options={ANIMATIONS}
          onChange={(v) => {
            onProp('anim', v)
            if (v !== 'none') onPlay()
          }}
        />
        {((p.anim && p.anim !== 'none') || p.stagger) && (
          <>
            <Row label="Durata">
              <Seg
                value={p.animDur ?? 'm'}
                onChange={(v) => {
                  onProp('animDur', v)
                  onPlay()
                }}
                options={[
                  { value: 's', label: 'Rapida', title: '0,5 secondi' },
                  { value: 'm', label: 'Media', title: '0,9 secondi' },
                  { value: 'l', label: 'Lenta', title: '1,4 secondi' },
                ]}
              />
            </Row>
            <Row label="Ritardo">
              <Seg
                value={p.animDelay ?? 0}
                onChange={(v) => {
                  onProp('animDelay', v)
                  onPlay()
                }}
                options={[
                  { value: 0, label: '0', title: 'Nessun ritardo' },
                  { value: 1, label: '.15', title: '0,15 secondi' },
                  { value: 2, label: '.3', title: '0,3 secondi' },
                  { value: 3, label: '.6', title: '0,6 secondi' },
                ]}
              />
            </Row>
            <Row label="Parte">
              <Seg
                value={p.animTrig ?? 'load'}
                onChange={(v) => onProp('animTrig', v)}
                options={[
                  { value: 'load', label: 'All’apertura' },
                  { value: 'scroll', label: 'Scorrendo' },
                ]}
              />
            </Row>
          </>
        )}
        {isF && (
          <Toggle
            label="Uno dopo l’altro, sugli elementi interni"
            checked={!!p.stagger}
            onChange={(v) => {
              onProps(v && (!p.anim || p.anim === 'none') ? { stagger: v, anim: 'up' } : { stagger: v })
              onPlay()
            }}
          />
        )}
      </Section>

      <InteractionsSection
        node={node}
        onChange={(interactions, group) => {
          // A new entrance interaction takes over from the quick entrance, instead of stacking on it.
          const entrance = interactions?.some((i) => i.trigger === 'load' || i.trigger === 'view')
          const clear = entrance && !hasEntrance && p.anim && p.anim !== 'none'
          onContent(clear ? { interactions, anim: 'none' } : { interactions }, group)
        }}
        onPreview={onPreview}
      />

      <HoverSection node={node} palette={palette} isSec={isSec} onProps={onProps} />

      <PositionSection {...design} />
      <EffectsSection {...design} />

      <Section title="Comportamento" {...sect(['sticky', 'stickyTop', 'minH'])}>
        {!isSec && minHeight}
        {isSec && (
          <>
            <Toggle
              label="Resta fisso in alto (menu)"
              checked={!!node.sticky}
              onChange={(v) => onContent({ sticky: v || undefined })}
            />
            {node.sticky && (
              <>
                <Toggle
                  label="Si nasconde scorrendo in giù"
                  checked={!!node.stickyHide}
                  onChange={(v) => onContent({ stickyHide: v || undefined })}
                />
                <Toggle
                  label="Effetto vetro quando la pagina scorre"
                  checked={!!node.stickyGlass}
                  onChange={(v) => onContent({ stickyGlass: v || undefined })}
                />
                <Toggle
                  label="Sopra la sezione successiva"
                  checked={!!node.stickyOverlay}
                  onChange={(v) => onContent({ stickyOverlay: v || undefined })}
                />
                <p className="text-[11px] leading-relaxed text-fg3">
                  Nascondi e vetro si vedono nell’anteprima e sul sito. Se la sezione è globale, il menu è fisso su
                  tutte le pagine.
                </p>
              </>
            )}
          </>
        )}
        {!isSec && (
          <>
            <Toggle
              label="Resta fermo mentre la pagina scorre"
              checked={!!p.sticky}
              onChange={(v) => onProp('sticky', v || undefined)}
            />
            {p.sticky && (
              <Row label="Distanza dall’alto">
                <LenField
                  value={p.stickyTop ?? 24}
                  max={400}
                  onChange={(v) => onProp('stickyTop', v ?? 0, `stickyTop:${node.id}`)}
                />
              </Row>
            )}
            {p.sticky && (
              <p className="text-[11px] leading-relaxed text-fg3">
                Resta fermo finché il suo contenitore è visibile: dai al contenitore un’altezza maggiore (per esempio
                200%).
              </p>
            )}
          </>
        )}
        {isF && (
          <>
            <Toggle
              label="Scorre all’infinito (nastro)"
              checked={!!node.marquee}
              onChange={(v) => onContent({ marquee: v ? { duration: 30 } : null, ...(v ? {} : {}) })}
            />
            {node.marquee && (
              <>
                <Row label="Velocità">
                  <Seg
                    value={node.marquee.duration}
                    onChange={(duration) => onContent({ marquee: { ...node.marquee, duration } })}
                    options={[
                      { value: 50, label: 'Lenta' },
                      { value: 30, label: 'Media' },
                      { value: 14, label: 'Veloce' },
                    ]}
                  />
                </Row>
                <Toggle
                  label="Verso destra"
                  checked={!!node.marquee.reverse}
                  onChange={(reverse) => onContent({ marquee: { duration: node.marquee?.duration ?? 30, reverse } })}
                />
                {p.layout !== 'row' && (
                  <button
                    type="button"
                    onClick={() => onProp('layout', 'row')}
                    className="text-left text-[11.5px] text-accent hover:underline"
                  >
                    Il nastro funziona in riga: imposta la direzione in riga
                  </button>
                )}
              </>
            )}
          </>
        )}
      </Section>

      <Section title="Visibilità" {...sect(['hidden'])}>
        <Toggle
          label={device === 'desktop' ? 'Nascosto' : `Nascosto su ${device === 'tablet' ? 'tablet' : 'mobile'}`}
          checked={!!p.hidden}
          onChange={(v) => onProp('hidden', v)}
        />
      </Section>
    </div>
  )
}
