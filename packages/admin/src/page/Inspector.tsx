import {
  ANIMATIONS,
  type Breakpoint,
  type Component,
  type ListBinding,
  NAV_SHAPES,
  type NodeProps,
  type PageNode,
  plainText,
  resolveNode,
  type SharedTextStyle,
  TEXT_STYLE_KEYS,
  TEXT_STYLES,
  type TextStyle,
  textTag,
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
import { useSession } from '../app/context.ts'
import { localeName } from '../app/Sidebar.tsx'
import { AiButton, CanvasTextMenu } from '../components/AiMenu.tsx'
import { IconButton, Textarea } from '../components/ui.tsx'
import { thumb } from '../lib/api.ts'
import { t, tx } from '../lib/i18n.ts'
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
const styleOptions = () =>
  (Object.keys(TEXT_STYLES) as TextStyle[]).map((k) => ({ value: k, label: TEXT_STYLES[k].label }))

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

const ALIGN = (): { how: AlignHow; label: string; icon: React.ReactNode }[] => [
  { how: 'left', label: t('Allinea a sinistra · ⌥⌘A'), icon: <AlignStartVertical /> },
  { how: 'hcenter', label: t('Centra in orizzontale · ⌥⌘H'), icon: <AlignCenterVertical /> },
  { how: 'right', label: t('Allinea a destra · ⌥⌘D'), icon: <AlignEndVertical /> },
  { how: 'top', label: t('Allinea in alto · ⌥⌘W'), icon: <AlignStartHorizontal /> },
  { how: 'vcenter', label: t('Centra in verticale · ⌥⌘V'), icon: <AlignCenterHorizontal /> },
  { how: 'bottom', label: t('Allinea in basso · ⌥⌘S'), icon: <AlignEndHorizontal /> },
  { how: 'hdist', label: t('Distribuisci in orizzontale'), icon: <AlignHorizontalSpaceAround /> },
  { how: 'vdist', label: t('Distribuisci in verticale'), icon: <AlignVerticalSpaceAround /> },
]

const FILTER_OPS = (): { value: NonNullable<ListBinding['filter']>['op']; label: string }[] => [
  { value: 'eq', label: t('è') },
  { value: 'neq', label: t('non è') },
  { value: 'contains', label: t('contiene') },
  { value: 'gt', label: t('dopo / più di') },
  { value: 'lt', label: t('prima / meno di') },
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
  onPickImage: (target: 'src' | 'bgImage' | 'poster' | 'sceneImage' | 'sceneImage2') => void
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
  const { locale, schema } = useSession()
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
    <Row label={t('Altezza min.')} hint={t('In percentuale dell’altezza dello schermo')}>
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
            aria-label={t('Nome del livello')}
            value={node.name ?? ''}
            placeholder={typeLabel(node)}
            onChange={(e) => onContent({ name: e.target.value }, `name:${node.id}`)}
            className="h-6 w-full rounded border border-transparent bg-transparent px-1 text-[13px] font-semibold outline-none hover:border-line2 focus:border-accent"
          />
          <div className="px-1 text-[11.5px] text-fg3">
            {isSec ? t('Sezione') : typeLabel(node)}
            {device !== 'desktop' &&
              (device === 'tablet' ? t(' · modifiche solo per tablet') : t(' · modifiche solo per mobile'))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-0.5 border-b border-line px-2.5 py-1.5">
        {onSelectParent && (
          <IconButton label={t('Seleziona il contenitore · Esc')} onClick={onSelectParent}>
            <CornerLeftUp />
          </IconButton>
        )}
        <IconButton label={t('Sposta su · ⌥↑')} onClick={() => onMove(-1)}>
          <ArrowUp />
        </IconButton>
        <IconButton label={t('Sposta giù · ⌥↓')} onClick={() => onMove(1)}>
          <ArrowDown />
        </IconButton>
        <div className="flex-1" />
        {count > 1 && !isSec && (
          <IconButton label={t('Raggruppa in un contenitore · ⌘G')} onClick={onGroup}>
            <Group />
          </IconButton>
        )}
        {count === 1 && isF && !isSec && !node.component && !!node.children?.length && (
          <IconButton label={t('Separa: gli elementi prendono il posto del contenitore · ⇧⌘G')} onClick={onUngroup}>
            <Ungroup />
          </IconButton>
        )}
        <IconButton label={t('Copia lo stile · ⌥⌘C')} onClick={onCopyStyle}>
          <Paintbrush />
        </IconButton>
        <IconButton label={t('Incolla lo stile · ⌥⌘V')} onClick={onPasteStyle}>
          <ClipboardPaste />
        </IconButton>
        <IconButton label={t('Duplica · ⌘D')} onClick={onDuplicate}>
          <Copy />
        </IconButton>
        <IconButton label={t('Elimina · ⌫')} onClick={onDelete} className="hover:text-danger">
          <Trash2 />
        </IconButton>
      </div>

      {!isSec && (
        <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
          {ALIGN().map((a, i) => (
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
        <p className="border-b border-line bg-accent/5 px-3.5 py-2 text-[12px] leading-relaxed text-fg2">
          {tx(
            '{selected} Le modifiche di stile valgono per tutti; testi e immagini restano di ciascuno. ⇧ clic per aggiungere o togliere.',
            {
              selected: (
                <strong className="font-semibold text-fg">{t('{n} elementi selezionati.', { n: count })}</strong>
              ),
            },
          )}
        </p>
      )}

      <ComponentPanel node={node} components={components} actions={componentActions} />

      {isSec && (
        <div className="border-b border-line px-3.5 py-2.5">
          <Row label={t('Ancora')} hint={t('Per i link a questa sezione: #ancora')}>
            <input
              aria-label={t('Ancora della sezione')}
              value={node.anchor ?? ''}
              placeholder={t('es. progetti')}
              onChange={(e) =>
                onContent(
                  { anchor: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') || null },
                  `anchor:${node.id}`,
                )
              }
              className="mb-2 h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 font-mono text-[12.5px] outline-none focus:border-accent"
            />
          </Row>
          {node.global ? (
            <div className="flex items-center gap-2 rounded-lg bg-accent/10 px-2.5 py-2 text-[12px] text-accent">
              <span className="min-w-0 flex-1">
                {t('Sezione globale: le modifiche valgono su tutte le pagine che la usano.')}
                {locale !== schema.locales.default &&
                  t(
                    ' In {lang} cambiano solo testi, link e immagini: struttura e stile si modificano nella lingua principale.',
                    { lang: localeName(locale).toLowerCase() },
                  )}
              </span>
              <button type="button" onClick={onUnlinkGlobal} className="shrink-0 font-medium underline">
                {t('Scollega')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onMakeGlobal}
              className="h-7 w-full rounded-md border border-line2 text-[12.5px] font-medium text-fg2 hover:bg-hover hover:text-fg"
            >
              {t('Rendi globale (es. menu e piè di pagina)')}
            </button>
          )}
        </div>
      )}

      {boundFields && (
        <Section title={t('Dato collegato')}>
          <Row label={t('Mostra')}>
            <Select
              label={t('Campo della raccolta')}
              value={node.field ?? ''}
              onChange={(v) => onContent({ field: v || null })}
              options={[{ value: '', label: t('Contenuto fisso') }, ...boundFields]}
            />
          </Row>
          <p className="text-[11.5px] leading-relaxed text-fg3">
            {t(
              'Ogni copia dell’elenco mostra il valore della sua voce. Su un contenitore, “Indirizzo” lo rende un link alla pagina.',
            )}
          </p>
        </Section>
      )}

      {isF && !isSec && (
        <Section title={t('Elenco dinamico')}>
          <Row label={t('Raccolta')}>
            <Select
              label={t('Raccolta collegata')}
              value={node.bind?.collection ?? ''}
              onChange={(v) => onContent({ bind: v ? { collection: v, limit: node.bind?.limit ?? 6 } : null })}
              options={[{ value: '', label: t('Nessuna') }, ...collections]}
            />
          </Row>
          {bind && (
            <>
              <Row label={bind.more ? t('Voci per volta') : t('Quante voci')}>
                <NumField value={bind.limit ?? 6} min={1} max={48} onChange={(v) => setBind({ limit: v ?? 6 })} />
              </Row>
              <Row label={t('Ordina per')}>
                <Select
                  label={t('Ordina per')}
                  value={bind.sort?.field ?? ''}
                  onChange={(v) => setBind({ sort: v ? { field: v, dir: bind.sort?.dir ?? 'asc' } : null })}
                  options={[{ value: '', label: t('Ordine della raccolta') }, ...collectionFields(bind.collection)]}
                />
              </Row>
              {bind.sort && (
                <Row label={t('Verso')}>
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
              <Row label={t('Filtra')}>
                <Select
                  label={t('Campo del filtro')}
                  value={bind.filter?.field ?? ''}
                  onChange={(v) =>
                    setBind({
                      filter: v ? { field: v, op: bind.filter?.op ?? 'eq', value: bind.filter?.value ?? '' } : null,
                    })
                  }
                  options={[{ value: '', label: t('Tutte le voci') }, ...collectionFields(bind.collection)]}
                />
              </Row>
              {bind.filter && (
                <div className="mb-2 flex gap-1.5">
                  <Select
                    label={t('Condizione')}
                    value={bind.filter.op}
                    onChange={(op) => bind.filter && setBind({ filter: { ...bind.filter, op } })}
                    options={FILTER_OPS()}
                  />
                  <input
                    aria-label={t('Valore del filtro')}
                    value={bind.filter.value}
                    placeholder={t('valore')}
                    onChange={(e) => bind.filter && setBind({ filter: { ...bind.filter, value: e.target.value } })}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12.5px] outline-none focus:border-accent"
                  />
                </div>
              )}
              <Toggle
                label={t('Pulsante “Mostra altri” sotto l’elenco')}
                checked={!!bind.more}
                onChange={(v) => setBind({ more: v || undefined })}
              />
              {bind.more && (
                <Row label={t('Testo')}>
                  <input
                    aria-label={t('Testo del pulsante')}
                    value={bind.moreLabel ?? ''}
                    placeholder={t('Mostra altri')}
                    onChange={(e) => setBind({ moreLabel: e.target.value || undefined })}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12.5px] outline-none focus:border-accent"
                  />
                </Row>
              )}
              <p className="text-[11.5px] leading-relaxed text-fg3">
                {t(
                  'Il primo elemento interno si ripete per ogni voce: selezionane i testi e le immagini per scegliere quale campo mostrano.',
                )}
              </p>
            </>
          )}
        </Section>
      )}

      {isT && node.langs ? (
        <Section title={t('Lingue')}>
          <Row label={t('Mostra')}>
            <Seg
              value={node.langs}
              onChange={(v) => onContent({ langs: v }, `langs:${node.id}`)}
              options={[
                { value: 'code', label: t('Sigle · IT') },
                { value: 'name', label: t('Nomi · Italiano') },
              ]}
            />
          </Row>
          <p className="text-[12px] leading-relaxed text-fg3">
            {t(
              'Porta alla stessa pagina nelle altre lingue in cui è pubblicata. Le lingue si scelgono in Impostazioni → Lingue.',
            )}
          </p>
        </Section>
      ) : (
        (isT || isB) && (
          <Section
            title={t('Contenuto')}
            action={<CanvasTextMenu node={node} onResult={(patch) => onContent(patch, `ai:${node.id}`)} />}
          >
            <Textarea
              aria-label={t('Testo')}
              value={isT ? plainText(node) : (node.text ?? '')}
              onChange={(e) =>
                onContent(
                  isT ? { text: e.target.value, runs: null } : { text: e.target.value.replace(/\n/g, ' ') },
                  `text:${node.id}`,
                )
              }
            />
            {isT && !!node.runs?.length && (
              <p className="text-[11.5px] text-fg3">
                {t('Grassetti e link si modificano sulla tela, con un doppio clic.')}
              </p>
            )}
            {isB && (
              <>
                <Row label={t('Collegamento')}>
                  <input
                    aria-label={t('Collegamento')}
                    value={node.href ?? ''}
                    placeholder="/contatti"
                    onChange={(e) => onContent({ href: e.target.value }, `href:${node.id}`)}
                    className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 font-mono text-[12.5px] outline-none focus:border-accent"
                  />
                </Row>
                <Toggle
                  label={t('Apri in una nuova scheda')}
                  checked={!!node.newTab}
                  onChange={(v) => onContent({ newTab: v || undefined })}
                />
                <Toggle
                  label={t('Invia il modulo che lo contiene')}
                  checked={!!node.submit}
                  onChange={(v) => onContent({ submit: v || undefined })}
                />
              </>
            )}
          </Section>
        )
      )}

      <SceneSection
        node={node}
        palette={palette}
        onContent={onContent}
        onPickImage={() => onPickImage('sceneImage')}
        onPickImage2={() => onPickImage('sceneImage2')}
      />

      <MediaContent node={node} onContent={onContent} onPickPoster={() => onPickImage('poster')} canCode={canCode} />

      <FormSection node={node} isSec={isSec} onContent={onContent} />
      <InputSection node={node} onContent={onContent} />

      {node.type === 'icon' && (
        <IconSection node={node} p={p} palette={palette} onProps={onProps} onContent={onContent} />
      )}

      {isI && (
        <Section title={t('Immagine')}>
          <button
            type="button"
            onClick={() => onPickImage('src')}
            className="group relative flex aspect-[16/10] w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-panel2 text-fg3"
          >
            {node.src ? (
              <img src={thumb(node.src, 640)} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-1 text-[12.5px]">
                <ImagePlus className="size-5" /> {t('Scegli un’immagine')}
              </span>
            )}
            {node.src && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[12.5px] font-medium text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100">
                {t('Cambia immagine')}
              </span>
            )}
          </button>
          <div className="flex items-center gap-1">
            <input
              aria-label={t('Testo alternativo')}
              value={node.alt ?? ''}
              placeholder={t('Descrivi l’immagine a chi non la vede')}
              onChange={(e) => onContent({ alt: e.target.value }, `alt:${node.id}`)}
              className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 text-[12.5px] outline-none focus:border-accent"
            />
            <AiButton
              action="alt"
              src={node.src ?? undefined}
              text={node.alt ?? ''}
              label=""
              title={t('Descrivi l’immagine con l’AI')}
              onResult={(alt) => onContent({ alt }, `ai:${node.id}`)}
            />
          </div>
          <Row label={t('Proporzioni')}>
            <Select
              label={t('Proporzioni')}
              value={p.ratio ?? '4/3'}
              options={RATIOS}
              onChange={(v) => onProp('ratio', v)}
            />
          </Row>
          <Row label={t('Adattamento')}>
            <Seg
              value={p.fit ?? 'cover'}
              onChange={(v) => onProp('fit', v)}
              options={[
                { value: 'cover', label: t('Riempi') },
                { value: 'contain', label: t('Intera') },
              ]}
            />
          </Row>
          {node.src && (
            <Row label={t('Punto focale')} hint={t('Resta visibile quando l’immagine viene ritagliata')}>
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
        <Section title={isSec ? t('Sezione') : t('Disposizione')} {...sect(LAYOUT)}>
          {isSec && (
            <Row label={t('Spazio')}>
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
          <Row label={t('Direzione')}>
            <Seg
              value={p.layout ?? 'col'}
              onChange={(v) => onProp('layout', v)}
              options={[
                { value: 'col', label: <Rows3 />, title: t('In colonna') },
                { value: 'row', label: <Columns3 />, title: t('In riga') },
                { value: 'grid', label: <LayoutGrid />, title: t('Griglia') },
              ]}
            />
          </Row>
          {p.layout === 'grid' && (
            <Row label={t('Colonne')}>
              <Seg
                value={p.cols ?? 3}
                onChange={(v) => onProp('cols', v)}
                options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
              />
            </Row>
          )}
          <Row label={t('Spazio interno')} hint={t('Spazio tra gli elementi')}>
            <LenField
              label="↔"
              value={p.gap ?? 16}
              onChange={(v) => onProp('gap', v ?? 0, `gap:${node.id}`)}
              max={240}
            />
          </Row>
          <Row label={t('Allinea')}>
            <Seg
              value={p.align ?? 'start'}
              onChange={(v) => onProp('align', v)}
              options={[
                { value: 'start', label: t('Inizio') },
                { value: 'center', label: t('Centro') },
                { value: 'end', label: t('Fine') },
                { value: 'stretch', label: t('Estendi') },
              ]}
            />
          </Row>
          {p.layout === 'row' && (
            <>
              <Row label={t('Distribuisci')}>
                <Seg
                  value={p.justify ?? 'start'}
                  onChange={(v) => onProp('justify', v)}
                  options={[
                    { value: 'start', label: t('Inizio') },
                    { value: 'center', label: t('Centro') },
                    { value: 'end', label: t('Fine') },
                    { value: 'between', label: t('Tra') },
                  ]}
                />
              </Row>
              <Toggle
                label={t('Vai a capo se non c’è spazio')}
                checked={!!p.wrap}
                onChange={(v) => onProp('wrap', v)}
              />
            </>
          )}
          {(p.layout ?? 'col') === 'col' && (
            <Row
              label={t('In verticale')}
              hint={t('Dove stanno gli elementi quando il contenitore è più alto di loro')}
            >
              <Seg
                value={p.justify ?? 'start'}
                onChange={(v) => onProp('justify', v)}
                options={[
                  { value: 'start', label: t('Alto') },
                  { value: 'center', label: t('Centro') },
                  { value: 'end', label: t('Basso') },
                  { value: 'between', label: t('Tra') },
                ]}
              />
            </Row>
          )}
          {isSec && minHeight}
        </Section>
      )}

      {!isSec && (
        <Section title={t('Dimensioni')} {...sect(SIZE)}>
          <Row label={t('Larghezza')}>
            <Seg
              value={p.width ?? (isB ? 'hug' : 'fill')}
              onChange={(v) => onProp('width', v)}
              options={[
                { value: 'fill', label: t('Riempi') },
                { value: 'hug', label: t('Adatta') },
                { value: 'fixed', label: t('Fissa') },
              ]}
            />
          </Row>
          {p.width === 'fixed' && (
            <Row label={t('Fissa a')}>
              <LenField
                label="L"
                value={p.fixedW ?? 240}
                onChange={(v) => onProp('fixedW', v ?? 240, `fixedW:${node.id}`)}
              />
            </Row>
          )}
          <Row label={t('Massima')} hint={t('Larghezza massima')}>
            <LenField
              label="M"
              value={p.maxW ?? null}
              placeholder={t('nessuna')}
              onChange={(v) => onProp('maxW', v, `maxW:${node.id}`)}
            />
          </Row>
          {!isI && (
            <Row label={t('Margine interno')}>
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
        <Section title={t('Testo')} {...sect(TYPE)}>
          <Row
            label={t('Stile condiviso')}
            hint={t('Uno stile del sito: cambiandolo, cambiano tutti i testi che lo usano')}
          >
            <Select
              label={t('Stile condiviso')}
              value={node.textStyle && linkedStyle ? node.textStyle : ''}
              onChange={(v) => textStyles.apply(v || null)}
              options={[
                { value: '', label: t('Nessuno') },
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
                aria-label={t('Nome del nuovo stile')}
                value={naming}
                placeholder={t('es. Titolo di sezione')}
                onChange={(e) => setNaming(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setNaming(null)}
                className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-input px-2 text-[12.5px] outline-none"
              />
              <button type="submit" className="h-7 rounded-md bg-accent px-2.5 text-[12.5px] font-medium text-white">
                {t('Crea')}
              </button>
            </form>
          ) : (
            textStyles.canEdit && (
              <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                {linkedStyle && styleChanged && (
                  <>
                    <button
                      type="button"
                      onClick={textStyles.update}
                      className="min-h-6 text-left text-accent hover:underline"
                    >
                      {t('Aggiorna “{name}” con queste modifiche', { name: linkedStyle.name })}
                    </button>
                    <button
                      type="button"
                      onClick={textStyles.reset}
                      className="min-h-6 text-left text-fg2 hover:underline"
                    >
                      {t('Torna allo stile')}
                    </button>
                  </>
                )}
                {!linkedStyle && (
                  <button
                    type="button"
                    onClick={() => setNaming('')}
                    className="min-h-6 text-left text-accent hover:underline"
                  >
                    {t('Crea uno stile da questo testo')}
                  </button>
                )}
              </div>
            )
          )}
          <Row label={t('Stile')}>
            <Select
              label={t('Stile del testo')}
              value={p.style ?? (isB ? 'button' : 'body')}
              options={styleOptions()}
              onChange={(v) => onProp('style', v)}
            />
          </Row>
          {isT && (
            <>
              <Row label="Tag" hint={t('Per Google e i lettori di schermo: l’aspetto resta quello dello stile')}>
                <Select
                  label={t('Elemento HTML')}
                  value={node.tag ?? ''}
                  onChange={(v) => onContent({ tag: (v || null) as NodeProps['tag'] })}
                  options={[
                    { value: '', label: t('Dallo stile ({tag})', { tag: textTag({ style: p.style }).toUpperCase() }) },
                    { value: 'h1', label: t('H1 · titolo della pagina') },
                    { value: 'h2', label: t('H2 · titolo di sezione') },
                    { value: 'h3', label: 'H3' },
                    { value: 'h4', label: 'H4' },
                    { value: 'p', label: t('Paragrafo (non un titolo)') },
                  ]}
                />
              </Row>
              <Row label={t('Collegamento')}>
                <input
                  aria-label={t('Collegamento del testo')}
                  value={node.href ?? ''}
                  placeholder={t('nessuno, /pagina o #sezione')}
                  onChange={(e) => onContent({ href: e.target.value || undefined }, `href:${node.id}`)}
                  className="h-7 min-w-0 flex-1 rounded-md border border-line2 bg-input px-2 font-mono text-[12.5px] outline-none focus:border-accent"
                />
              </Row>
              <Row label={t('Colore')}>
                <ColorField
                  value={p.color ?? 'text'}
                  palette={palette}
                  onChange={(v) => onProp('color', v ?? 'text')}
                />
              </Row>
              <Row label={t('Allineamento')}>
                <Seg
                  value={p.talign ?? 'left'}
                  onChange={(v) => onProp('talign', v)}
                  options={[
                    { value: 'left', label: <AlignLeft />, title: t('Allinea a sinistra') },
                    { value: 'center', label: <AlignCenter />, title: t('Al centro') },
                    { value: 'right', label: <AlignRight />, title: t('Allinea a destra') },
                  ]}
                />
              </Row>
            </>
          )}
          <Row label={t('Peso')}>
            <Select
              label={t('Peso del carattere')}
              value={String(p.weight ?? '')}
              onChange={(v) => onProp('weight', v ? Number(v) : null)}
              options={[
                { value: '', label: t('Dello stile') },
                { value: '400', label: t('Normale') },
                { value: '500', label: t('Medio') },
                { value: '600', label: t('Semigrassetto') },
                { value: '700', label: t('Grassetto') },
              ]}
            />
          </Row>
          <Row label={t('Dimensione')}>
            <LenField
              value={p.fontSize ?? null}
              placeholder={t('dello stile')}
              onChange={(v) => onProp('fontSize', v, `fontSize:${node.id}`)}
              min={8}
              max={200}
            />
          </Row>
          <TypographyExtra {...design} />
        </Section>
      )}

      <Section title={t('Aspetto')} {...sect(LOOK)}>
        {isF && (
          <Row label={t('Colori')}>
            <Select
              label={t('Schema di colori')}
              value={p.scheme ?? 'default'}
              onChange={(v) =>
                // A scheme brings its own background: a theme color set before would cancel it out.
                onProps({
                  scheme: v === 'default' ? null : (v as NodeProps['scheme']),
                  ...(v !== 'default' && typeof p.bg === 'string' && palette[p.bg] ? { bg: null } : {}),
                })
              }
              options={[
                { value: 'default', label: isSec ? t('Pagina') : t('Come il contenitore') },
                { value: 'surface', label: t('Superficie') },
                { value: 'inverse', label: t('Inverso') },
                { value: 'accent', label: t('Accento') },
                { value: 'dark', label: t('Scuro') },
              ]}
            />
          </Row>
        )}
        {isB && (
          <Row label={t('Variante')}>
            <Seg
              value={p.variant ?? 'primary'}
              onChange={(v) => onProp('variant', v)}
              options={[
                { value: 'primary', label: t('Principale') },
                { value: 'secondary', label: t('Scura') },
                { value: 'ghost', label: t('Bordo') },
              ]}
            />
          </Row>
        )}
        {(isF || isT || node.type === 'embed') && <FillFields {...design} />}
        {isSec && (
          <Row label={t('Foto di sfondo')}>
            <button
              type="button"
              onClick={() => onPickImage('bgImage')}
              className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md border border-line2 bg-input px-1.5 text-left text-[12.5px] hover:border-fg3/50"
            >
              {node.bgImage?.src ? (
                <img src={thumb(node.bgImage.src, 320)} alt="" className="size-5 rounded object-cover" />
              ) : (
                <ImagePlus className="size-3.5 text-fg3" />
              )}
              <span className="truncate">{node.bgImage?.src ? t('Cambia') : t('Aggiungi')}</span>
            </button>
            {node.bgImage?.src && (
              <IconButton label={t('Togli la foto di sfondo')} onClick={() => onContent({ bgImage: null })}>
                <X />
              </IconButton>
            )}
          </Row>
        )}
        {isSec && (node.bgImage?.src || node.scene) && (
          <Row
            label={t('Oscura')}
            hint={
              node.bgImage?.src
                ? t('Scurisce la foto perché il testo resti leggibile')
                : t('Scurisce lo sfondo animato perché il testo resti leggibile')
            }
          >
            <input
              type="range"
              min={0}
              max={0.85}
              step={0.05}
              value={node.bgDim ?? (node.bgImage?.src ? 0.45 : 0)}
              onChange={(e) => onContent({ bgDim: Number(e.target.value) }, `dim:${node.id}`)}
              className="flex-1 accent-[var(--accent)]"
              aria-label={node.bgImage?.src ? t('Oscura la foto') : t('Oscura lo sfondo animato')}
            />
          </Row>
        )}
        {!isSec && (
          <Row label={t('Angoli')}>
            <Select
              label={t('Raggio degli angoli')}
              value={String(p.radius ?? (isI ? 'card' : isB ? 'btn' : 0))}
              onChange={(v) => onProp('radius', v === 'btn' || v === 'card' ? v : Number(v))}
              options={[
                { value: '0', label: t('Netti') },
                { value: '4', label: '4 px' },
                { value: '8', label: '8 px' },
                { value: '16', label: '16 px' },
                { value: 'card', label: t('Come le schede') },
                { value: 'btn', label: t('Come i pulsanti') },
              ]}
            />
          </Row>
        )}
        {!isSec && (
          <Row label={t('Ombra')}>
            <Seg
              value={p.shadow ?? 'none'}
              onChange={(v) => onProp('shadow', v)}
              options={[
                { value: 'none', label: t('Nessuna') },
                { value: 'sm', label: t('Leggera') },
                { value: 'lg', label: t('Forte') },
              ]}
            />
          </Row>
        )}
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ['border', t('Bordo')],
              ['topline', t('Linea sopra')],
              ['divider', t('Linea sotto')],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={!!p[k]}
              onClick={() => onProp(k, !p[k])}
              className={
                p[k]
                  ? 'h-7 rounded-full border border-accent bg-accent/10 text-[12px] font-medium text-accent'
                  : 'h-7 rounded-full border border-line2 text-[12px] font-medium text-fg2 hover:text-fg'
              }
            >
              {label}
            </button>
          ))}
        </div>
        {!isSec && (
          <Row label={t('Al passaggio')} hint={t('Effetto quando il mouse passa sopra')}>
            <Select
              label={t('Effetto al passaggio del mouse')}
              value={p.hover ?? 'none'}
              onChange={(v) => onProp('hover', v)}
              options={[
                { value: 'none', label: t('Nessuno') },
                { value: 'lift', label: t('Si solleva') },
                { value: 'grow', label: t('Si ingrandisce') },
                { value: 'dim', label: t('Si attenua') },
                { value: 'zoomimg', label: t('Zoom sull’immagine') },
              ]}
            />
          </Row>
        )}
      </Section>

      <Section
        title={t('Entrata rapida')}
        {...sect(MOTION)}
        action={
          <IconButton label={t('Riproduci le animazioni')} onClick={onPlay} className="size-6">
            <Play />
          </IconButton>
        }
      >
        <p className="text-[11.5px] leading-relaxed text-fg3">
          {t(
            'Un effetto pronto quando l’elemento compare. Per linee temporali, scroll e mouse usa Interazioni, qui sotto.',
          )}
        </p>
        {hasEntrance && p.anim && p.anim !== 'none' && (
          <div className="flex items-center gap-2 rounded-lg bg-warn/10 px-2.5 py-2 text-[12px] text-fg2">
            <span className="min-w-0 flex-1">
              {t('Si somma a un’interazione di entrata: i due effetti si sovrappongono.')}
            </span>
            <button
              type="button"
              onClick={() => onProp('anim', 'none')}
              className="shrink-0 font-medium text-accent underline"
            >
              {t('Tieni l’interazione')}
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
            <Row label={t('Durata')}>
              <Seg
                value={p.animDur ?? 'm'}
                onChange={(v) => {
                  onProp('animDur', v)
                  onPlay()
                }}
                options={[
                  { value: 's', label: t('Rapida'), title: t('0,5 secondi') },
                  { value: 'm', label: t('Moderata'), title: t('0,9 secondi') },
                  { value: 'l', label: t('Lenta'), title: t('1,4 secondi') },
                ]}
              />
            </Row>
            <Row label={t('Ritardo')}>
              <Seg
                value={p.animDelay ?? 0}
                onChange={(v) => {
                  onProp('animDelay', v)
                  onPlay()
                }}
                options={[
                  { value: 0, label: '0', title: t('Nessun ritardo') },
                  { value: 1, label: '.15', title: t('0,15 secondi') },
                  { value: 2, label: '.3', title: t('0,3 secondi') },
                  { value: 3, label: '.6', title: t('0,6 secondi') },
                ]}
              />
            </Row>
            <Row label={t('Parte')}>
              <Seg
                value={p.animTrig ?? 'load'}
                onChange={(v) => onProp('animTrig', v)}
                options={[
                  { value: 'load', label: t('All’apertura') },
                  { value: 'scroll', label: t('Scorrendo') },
                ]}
              />
            </Row>
          </>
        )}
        {isF && (
          <Toggle
            label={t('Uno dopo l’altro, sugli elementi interni')}
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

      <Section title={t('Comportamento')} {...sect(['sticky', 'stickyTop', 'minH'])}>
        {!isSec && minHeight}
        {isSec && (
          <>
            <Toggle
              label={t('Resta fisso in alto (menu)')}
              checked={!!node.sticky}
              onChange={(v) => onContent({ sticky: v || undefined })}
            />
            <Row
              label={t('Forma')}
              hint={t('Per i menu: barra a tutta larghezza, sospesa, a isola centrale o trasparente')}
            >
              <Select
                label={t('Forma del menu')}
                value={node.navShape ?? 'bar'}
                onChange={(v) => onContent({ navShape: v === 'bar' ? null : (v as NodeProps['navShape']) })}
                options={NAV_SHAPES.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Row>
            <Toggle
              label={t('Menu a scomparsa su mobile (☰)')}
              checked={!!node.mobileMenu}
              onChange={(v) => onContent({ mobileMenu: v || undefined })}
            />
            {node.mobileMenu && (
              <p className="text-[11.5px] leading-relaxed text-fg3">
                {t('Su mobile gli elementi nascosti di questa sezione (per esempio i link) si aprono dal pulsante ☰.')}
              </p>
            )}
            {node.sticky && (
              <>
                <Toggle
                  label={t('Si nasconde scorrendo in giù')}
                  checked={!!node.stickyHide}
                  onChange={(v) => onContent({ stickyHide: v || undefined })}
                />
                <Toggle
                  label={t('Effetto vetro quando la pagina scorre')}
                  checked={!!node.stickyGlass}
                  onChange={(v) => onContent({ stickyGlass: v || undefined })}
                />
                <Toggle
                  label={t('Sopra la sezione successiva')}
                  checked={!!node.stickyOverlay}
                  onChange={(v) => onContent({ stickyOverlay: v || undefined })}
                />
                <p className="text-[11.5px] leading-relaxed text-fg3">
                  {t(
                    'Nascondi e vetro si vedono nell’anteprima e sul sito. Se la sezione è globale, il menu è fisso su tutte le pagine.',
                  )}
                </p>
              </>
            )}
          </>
        )}
        {!isSec && (
          <>
            <Toggle
              label={t('Resta fermo mentre la pagina scorre')}
              checked={!!p.sticky}
              onChange={(v) => onProp('sticky', v || undefined)}
            />
            {p.sticky && (
              <Row label={t('Distanza dall’alto')}>
                <LenField
                  value={p.stickyTop ?? 24}
                  max={400}
                  onChange={(v) => onProp('stickyTop', v ?? 0, `stickyTop:${node.id}`)}
                />
              </Row>
            )}
            {p.sticky && (
              <p className="text-[11.5px] leading-relaxed text-fg3">
                {t(
                  'Resta fermo finché il suo contenitore è visibile: dai al contenitore un’altezza maggiore (per esempio 200%).',
                )}
              </p>
            )}
          </>
        )}
        {isF && (
          <>
            <Toggle
              label={t('Scorre all’infinito (nastro)')}
              checked={!!node.marquee}
              onChange={(v) => onContent({ marquee: v ? { duration: 30 } : null, ...(v ? {} : {}) })}
            />
            {node.marquee && (
              <>
                <Row label={t('Velocità')}>
                  <Seg
                    value={node.marquee.duration}
                    onChange={(duration) => onContent({ marquee: { ...node.marquee, duration } })}
                    options={[
                      { value: 50, label: t('Lenta') },
                      { value: 30, label: t('Moderata') },
                      { value: 14, label: t('Veloce') },
                    ]}
                  />
                </Row>
                <Toggle
                  label={t('Verso destra')}
                  checked={!!node.marquee.reverse}
                  onChange={(reverse) => onContent({ marquee: { duration: 30, ...node.marquee, reverse } })}
                />
                <Row
                  label={t('Sfuma ai lati')}
                  hint={t('I contenuti compaiono e svaniscono gradualmente invece di essere tagliati')}
                >
                  <Seg
                    value={node.marquee.fade ?? 0}
                    onChange={(fade) => onContent({ marquee: { duration: 30, ...node.marquee, fade } })}
                    options={[
                      { value: 0, label: 'No' },
                      { value: 8, label: t('Poco') },
                      { value: 15, label: t('Medio') },
                      { value: 25, label: t('Molto') },
                    ]}
                  />
                </Row>
                {p.layout !== 'row' && (
                  <button
                    type="button"
                    onClick={() => onProp('layout', 'row')}
                    className="min-h-6 text-left text-[12px] text-accent hover:underline"
                  >
                    {t('Il nastro funziona in riga: imposta la direzione in riga')}
                  </button>
                )}
              </>
            )}
          </>
        )}
      </Section>

      <Section title={t('Visibilità')} {...sect(['hidden'])}>
        <Toggle
          label={
            device === 'desktop'
              ? t('Nascosto')
              : device === 'tablet'
                ? t('Nascosto su tablet')
                : t('Nascosto su mobile')
          }
          checked={!!p.hidden}
          onChange={(v) => onProp('hidden', v)}
        />
      </Section>
    </div>
  )
}
