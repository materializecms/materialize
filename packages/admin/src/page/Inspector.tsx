import {
  ANIMATIONS,
  type Breakpoint,
  type NodeProps,
  type PageNode,
  plainText,
  resolveNode,
  TEXT_STYLES,
  type TextStyle,
} from '@materializecms/core/page'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Columns3,
  Copy,
  CornerLeftUp,
  ImagePlus,
  LayoutGrid,
  Play,
  Rows3,
  Trash2,
  X,
} from 'lucide-react'
import { IconButton, Textarea } from '../components/ui.tsx'
import { thumb } from '../lib/api.ts'
import { typeLabel } from './Canvas.tsx'
import { Chips, NumField, Row, Section, Seg, Select, Toggle } from './controls.tsx'
import { nodeIcon } from './Layers.tsx'

type Key = keyof NodeProps

const COLOR_OPTIONS = [
  { value: 'text', label: 'Testo' },
  { value: 'muted', label: 'Tenue' },
  { value: 'accent', label: 'Accento' },
  { value: 'onAccent', label: 'Su accento' },
  { value: 'inverse', label: 'Inverso' },
  { value: 'onInverse', label: 'Su inverso' },
]
const BG_OPTIONS = [
  { value: '', label: 'Nessuno' },
  { value: 'surface', label: 'Superficie' },
  { value: 'bg', label: 'Sfondo' },
  { value: 'accent', label: 'Accento' },
  { value: 'inverse', label: 'Inverso' },
]
const RATIOS = ['1/1', '4/3', '3/2', '16/9', '21/9', '3/4', '4/5', '3/1'].map((r) => ({
  value: r,
  label: r.replace('/', ':'),
}))
const STYLE_OPTIONS = (Object.keys(TEXT_STYLES) as TextStyle[]).map((k) => ({ value: k, label: TEXT_STYLES[k].label }))

export function Inspector({
  node,
  depth,
  device,
  onProps,
  onContent,
  onReset,
  onPickImage,
  onPlay,
  onDuplicate,
  onDelete,
  onMove,
  onSelectParent,
}: {
  node: PageNode
  depth: number
  device: Breakpoint
  /** Design properties: on tablet or mobile they change only that device. */
  onProps: (patch: Partial<NodeProps>, group?: string) => void
  /** Content and names: the same on every device. */
  onContent: (patch: Partial<PageNode>, group?: string) => void
  onReset: (keys: Key[]) => void
  onPickImage: (target: 'src' | 'bgImage') => void
  onPlay: () => void
  onDuplicate: () => void
  onDelete: () => void
  onMove: (dir: -1 | 1) => void
  onSelectParent: (() => void) | null
}) {
  const p = resolveNode(node, device)
  const onProp = <K extends Key>(key: K, value: NodeProps[K], group?: string) =>
    onProps({ [key]: value } as Partial<NodeProps>, group)
  const isF = node.type === 'frame'
  const isT = node.type === 'text'
  const isI = node.type === 'image'
  const isB = node.type === 'button'
  const isSec = depth === 0
  const over = (keys: Key[]) => device !== 'desktop' && keys.some((k) => node.over?.[device]?.[k] !== undefined)
  const sect = (keys: Key[]) => ({ overridden: over(keys), onReset: () => onReset(keys) })

  const LAYOUT: Key[] = ['layout', 'cols', 'gap', 'align', 'justify', 'wrap', 'size']
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
        <IconButton label="Duplica · ⌘D" onClick={onDuplicate}>
          <Copy />
        </IconButton>
        <IconButton label="Elimina · ⌫" onClick={onDelete} className="hover:text-danger">
          <Trash2 />
        </IconButton>
      </div>

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
            </>
          )}
        </Section>
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
            <NumField
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
              <NumField
                label="L"
                value={p.fixedW ?? 240}
                onChange={(v) => onProp('fixedW', v ?? 240, `fixedW:${node.id}`)}
              />
            </Row>
          )}
          <Row label="Massima" hint="Larghezza massima">
            <NumField
              label="M"
              value={p.maxW ?? null}
              placeholder="nessuna"
              onChange={(v) => onProp('maxW', v, `maxW:${node.id}`)}
            />
          </Row>
          {!isI && (
            <Row label="Margine interno">
              <NumField
                label="X"
                value={p.padX ?? (isB ? 24 : 0)}
                onChange={(v) => onProp('padX', v ?? 0, `padX:${node.id}`)}
                max={200}
              />
              <NumField
                label="Y"
                value={p.padY ?? (isB ? 14 : 0)}
                onChange={(v) => onProp('padY', v ?? 0, `padY:${node.id}`)}
                max={200}
              />
            </Row>
          )}
        </Section>
      )}

      {(isT || isB) && (
        <Section title="Testo" {...sect(TYPE)}>
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
                <Select
                  label="Colore del testo"
                  value={p.color ?? 'text'}
                  options={COLOR_OPTIONS}
                  onChange={(v) => onProp('color', v as PageNode['color'])}
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
            <NumField
              value={p.fontSize ?? null}
              placeholder="dello stile"
              onChange={(v) => onProp('fontSize', v, `fontSize:${node.id}`)}
              min={8}
              max={200}
            />
          </Row>
        </Section>
      )}

      <Section title="Aspetto" {...sect(LOOK)}>
        {isF && (
          <Row label="Colori">
            <Select
              label="Schema di colori"
              value={p.scheme ?? 'default'}
              onChange={(v) => onProp('scheme', v === 'default' ? null : v)}
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
        {(isF || isT) && !isSec && (
          <Row label="Sfondo">
            <Select
              label="Sfondo"
              value={p.bg ?? ''}
              options={BG_OPTIONS}
              onChange={(v) => onProp('bg', (v || null) as PageNode['bg'])}
            />
          </Row>
        )}
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
        title="Animazione"
        {...sect(MOTION)}
        action={
          <IconButton label="Riproduci le animazioni" onClick={onPlay} className="size-6">
            <Play />
          </IconButton>
        }
      >
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
