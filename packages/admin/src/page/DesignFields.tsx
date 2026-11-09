import type { Gradient, NodeProps, PageNode, SceneConfig } from '@materializecms/core/page'
import { IMAGE_SCENES, startScenes, THREE_D } from '@materializecms/core/scene'
import { useEffect, useRef } from 'react'
import { Textarea } from '../components/ui.tsx'
import { t } from '../lib/i18n.ts'
import { ColorField, LenField, NumField, Row, Section, Seg, Select, Toggle } from './controls.tsx'
import { FontPicker } from './FontPicker.tsx'

type Key = keyof NodeProps

interface Props {
  node: PageNode
  /** The node's values on the device being edited. */
  p: PageNode
  isSec: boolean
  parentLayout: string | null
  palette: Record<string, string>
  onProp: <K extends Key>(key: K, value: NodeProps[K], group?: string) => void
  onProps: (patch: Partial<NodeProps>, group?: string) => void
  sect: (keys: Key[]) => { overridden: boolean; onReset: () => void }
}

function GradientFields({
  value,
  onChange,
  palette,
}: {
  value: Gradient
  onChange: (g: Gradient, group?: string) => void
  palette: Record<string, string>
}) {
  return (
    <>
      <Row label={t('Da')}>
        <ColorField
          value={value.from}
          palette={palette}
          onChange={(from) => onChange({ ...value, from: from ?? 'bg' })}
        />
      </Row>
      <Row label={t('A')}>
        <ColorField value={value.to} palette={palette} onChange={(to) => onChange({ ...value, to: to ?? 'surface' })} />
      </Row>
      <Row label={t('Angolo')}>
        <NumField
          value={value.angle}
          unit="°"
          max={360}
          onChange={(angle) => onChange({ ...value, angle: angle ?? 0 }, 'angle')}
        />
      </Row>
    </>
  )
}

/** Free typography for one text: font, spacing, style and gradient fill. */
export function TypographyExtra({ node, p, palette, onProp, onProps }: Props) {
  return (
    <>
      <Row label={t('Carattere')}>
        <FontPicker
          label={t('Carattere dell’elemento')}
          value={p.font?.family ?? 'Del tema'}
          onChange={(f) => onProp('font', { family: f.family, category: f.category })}
        />
      </Row>
      {p.font && (
        <button
          type="button"
          onClick={() => onProp('font', null)}
          className="text-left text-[12px] text-accent hover:underline"
        >
          {t('Usa il carattere del tema')}
        </button>
      )}
      <Row label={t('Spaziatura')} hint={t('Spazio tra le lettere, in em')}>
        <NumField
          value={p.tracking ?? null}
          placeholder={t('dello stile')}
          unit="em"
          step={0.005}
          min={-0.2}
          max={1}
          onChange={(v) => onProp('tracking', v, `tracking:${node.id}`)}
        />
      </Row>
      <Row label={t('Interlinea')}>
        <NumField
          value={p.leading ?? null}
          placeholder={t('dello stile')}
          unit="×"
          step={0.05}
          min={0.6}
          max={3}
          onChange={(v) => onProp('leading', v, `leading:${node.id}`)}
        />
      </Row>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            ['italic', t('Corsivo')],
            ['upper', t('Maiuscolo')],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={!!p[k]}
            onClick={() => onProp(k, !p[k] || undefined)}
            className={
              p[k]
                ? 'h-7 rounded-md border border-accent bg-accent/10 text-[12px] font-medium text-accent'
                : 'h-7 rounded-md border border-line2 text-[12px] font-medium text-fg2 hover:text-fg'
            }
          >
            {label}
          </button>
        ))}
      </div>
      {node.type === 'text' && (
        <>
          <Toggle
            label={t('Testo con sfumatura')}
            checked={!!p.textGradient}
            onChange={(v) => onProps({ textGradient: v ? { from: 'accent', to: 'text', angle: 90 } : null })}
          />
          {p.textGradient && (
            <GradientFields
              value={p.textGradient}
              palette={palette}
              onChange={(g, group) => onProp('textGradient', g, group && `tg:${node.id}`)}
            />
          )}
        </>
      )}
    </>
  )
}

/** Background as a color or a gradient, and a border of any width and color. */
export function FillFields({ node, p, palette, onProps, onProp }: Props) {
  const kind = p.gradient ? 'gradient' : p.bg ? 'color' : 'none'
  return (
    <>
      <Row label={t('Sfondo')}>
        <Seg
          value={kind}
          onChange={(k) =>
            onProps(
              k === 'none'
                ? { bg: null, gradient: null }
                : k === 'color'
                  ? { bg: p.bg ?? 'surface', gradient: null }
                  : { gradient: { from: 'accent', to: 'inverse', angle: 135 } },
            )
          }
          options={[
            { value: 'none', label: t('Nessuno') },
            { value: 'color', label: t('Colore') },
            { value: 'gradient', label: t('Sfumatura') },
          ]}
        />
      </Row>
      {kind === 'color' && <ColorField value={p.bg ?? null} palette={palette} onChange={(bg) => onProp('bg', bg)} />}
      {kind === 'gradient' && p.gradient && (
        <GradientFields
          value={p.gradient}
          palette={palette}
          onChange={(g, group) => onProp('gradient', g, group && `g:${node.id}`)}
        />
      )}
      <Row label={t('Bordo')}>
        <LenField
          value={p.borderW ?? null}
          placeholder="0"
          max={40}
          onChange={(v) => onProp('borderW', v || null, `bw:${node.id}`)}
        />
      </Row>
      {!!p.borderW && (
        <ColorField value={p.borderColor ?? 'border'} palette={palette} onChange={(v) => onProp('borderColor', v)} />
      )}
    </>
  )
}

/** Free placement, stacking and rotation. */
export function PositionSection(props: Props) {
  const { node, p, isSec, onProp, onProps, sect } = props
  if (isSec) return null
  const abs = p.pos === 'absolute'
  return (
    <Section title={t('Posizione')} {...sect(['pos', 'top', 'left', 'right', 'bottom', 'z', 'rot'])}>
      <Row label={t('Posizione')}>
        <Seg
          value={abs ? 'absolute' : 'flow'}
          onChange={(v) =>
            onProps(v === 'absolute' ? { pos: 'absolute', top: p.top ?? 0, left: p.left ?? 0 } : { pos: 'flow' })
          }
          options={[
            { value: 'flow', label: t('Nel flusso') },
            { value: 'absolute', label: t('Libera') },
          ]}
        />
      </Row>
      {abs && (
        <>
          <p className="text-[11.5px] leading-relaxed text-fg3">
            {t('Si sovrappone agli altri elementi del contenitore. Trascinalo sulla tela per spostarlo.')}
          </p>
          <Row label={t('Dall’alto')}>
            <LenField
              value={p.top ?? null}
              placeholder="—"
              min={-4000}
              onChange={(v) => onProp('top', v, `top:${node.id}`)}
            />
            <LenField
              value={p.bottom ?? null}
              label={t('Giù')}
              placeholder="—"
              min={-4000}
              onChange={(v) => onProp('bottom', v, `bottom:${node.id}`)}
            />
          </Row>
          <Row label={t('Da sinistra')}>
            <LenField
              value={p.left ?? null}
              placeholder="—"
              min={-4000}
              onChange={(v) => onProp('left', v, `left:${node.id}`)}
            />
            <LenField
              value={p.right ?? null}
              label={t('Des.')}
              placeholder="—"
              min={-4000}
              onChange={(v) => onProp('right', v, `right:${node.id}`)}
            />
          </Row>
        </>
      )}
      <Row label={t('Livello')} hint={t('Più alto, più in primo piano')}>
        <NumField
          value={p.z ?? null}
          placeholder="auto"
          min={-10}
          max={100}
          onChange={(v) => onProp('z', v, `z:${node.id}`)}
        />
      </Row>
      <Row label={t('Rotazione')}>
        <NumField
          value={p.rot ?? null}
          placeholder="0"
          unit="°"
          min={-360}
          max={360}
          onChange={(v) => onProp('rot', v || null, `rot:${node.id}`)}
        />
      </Row>
    </Section>
  )
}

/** Opacity, blending, filters and frosted glass. */
export function EffectsSection({ node, p, onProp, sect }: Props) {
  return (
    <Section title={t('Effetti')} {...sect(['opa', 'blend', 'blurFx', 'gray', 'glass'])}>
      <Row label={t('Opacità')}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={p.opa ?? 1}
          onChange={(e) => onProp('opa', Number(e.target.value) >= 1 ? null : Number(e.target.value), `opa:${node.id}`)}
          className="flex-1 accent-[var(--accent)]"
          aria-label={t('Opacità')}
        />
        <span className="w-9 text-right font-mono text-[11.5px] text-fg3">{Math.round((p.opa ?? 1) * 100)}%</span>
      </Row>
      <Row label={t('Fusione')}>
        <Select
          label={t('Modalità di fusione')}
          value={p.blend ?? 'normal'}
          onChange={(v) => onProp('blend', v === 'normal' ? null : v)}
          options={[
            { value: 'normal', label: t('Normale') },
            { value: 'multiply', label: t('Moltiplica') },
            { value: 'screen', label: t('Scherma') },
            { value: 'overlay', label: t('Sovrapponi') },
            { value: 'soft-light', label: t('Luce soffusa') },
            { value: 'difference', label: t('Differenza') },
            { value: 'exclusion', label: t('Esclusione') },
          ]}
        />
      </Row>
      <Row label={t('Sfocatura')}>
        <NumField
          value={p.blurFx ?? null}
          placeholder="0"
          max={60}
          onChange={(v) => onProp('blurFx', v || null, `blur:${node.id}`)}
        />
      </Row>
      <Row label={t('Bianco e nero')}>
        <NumField
          value={p.gray ?? null}
          placeholder="0"
          unit="%"
          max={100}
          onChange={(v) => onProp('gray', v || null, `gray:${node.id}`)}
        />
      </Row>
      {node.type === 'frame' && (
        <Row label={t('Vetro')} hint={t('Sfoca ciò che sta dietro (usa uno sfondo semitrasparente)')}>
          <NumField
            value={p.glass ?? null}
            placeholder="0"
            max={60}
            onChange={(v) => onProp('glass', v || null, `glass:${node.id}`)}
          />
        </Row>
      )}
    </Section>
  )
}

/** Height and grid placement, added to the size section. */
export function SizeExtra({ node, p, parentLayout, onProp, onProps }: Props) {
  return (
    <>
      <Row label={t('Altezza')}>
        <LenField
          value={typeof p.h === 'number' && p.hUnit === 'vh' ? `${p.h}vh` : (p.h ?? null)}
          placeholder="auto"
          onChange={(v) => onProps({ h: v, hUnit: undefined }, `h:${node.id}`)}
        />
      </Row>
      {parentLayout === 'grid' && (
        <Row label={t('Occupa')} hint={t('Colonne e righe della griglia')}>
          <NumField
            value={p.span ?? 1}
            label={t('Col')}
            min={1}
            max={6}
            onChange={(v) => onProp('span', v && v > 1 ? v : null)}
          />
          <NumField
            value={p.rowSpan ?? 1}
            label={t('Righe')}
            min={1}
            max={6}
            onChange={(v) => onProp('rowSpan', v && v > 1 ? v : null)}
          />
        </Row>
      )}
      <Toggle
        label={t('Taglia ciò che esce')}
        checked={p.overflow === 'hidden'}
        onChange={(v) => onProp('overflow', v ? 'hidden' : null)}
      />
    </>
  )
}

/** Video and custom code content. */
export function MediaContent({
  node,
  onContent,
  onPickPoster,
  canCode,
}: {
  node: PageNode
  onContent: (patch: Partial<PageNode>, group?: string) => void
  onPickPoster: () => void
  canCode: boolean
}) {
  if (node.type === 'video')
    return (
      <Section title="Video">
        <input
          aria-label={t('Indirizzo del video')}
          value={node.src ?? ''}
          placeholder="https://…/video.mp4"
          onChange={(e) => onContent({ src: e.target.value || null }, `src:${node.id}`)}
          className="h-7 w-full rounded-md border border-line2 bg-input px-2 font-mono text-[12.5px] outline-none focus:border-accent"
        />
        <p className="text-[11.5px] leading-relaxed text-fg3">
          {t('Un file MP4 o WebM. Parte da solo, in silenzio e in loop.')}
        </p>
        <Row label={t('Copertina')}>
          <button
            type="button"
            onClick={onPickPoster}
            className="h-7 flex-1 truncate rounded-md border border-line2 bg-input px-2 text-left text-[12.5px] hover:border-fg3/50"
          >
            {node.poster ? t('Cambia immagine') : t('Scegli un’immagine')}
          </button>
        </Row>
        <Toggle
          label={t('Con i controlli (non parte da solo)')}
          checked={!!node.controls}
          onChange={(v) => onContent({ controls: v || undefined })}
        />
      </Section>
    )
  if (node.type === 'embed')
    return (
      <Section title={t('Codice personalizzato')}>
        <Textarea
          aria-label={t('Codice HTML')}
          value={node.html ?? ''}
          disabled={!canCode}
          placeholder="<div>…</div>"
          onChange={(e) => onContent({ html: e.target.value }, `html:${node.id}`)}
          className="min-h-32 font-mono text-[12px]"
        />
        <p className="text-[11.5px] leading-relaxed text-fg3">
          {canCode
            ? t('HTML, CSS e JavaScript inseriti così come sono nel sito. Nell’editor girano in un riquadro isolato.')
            : t('Il codice personalizzato lo modifica un amministratore.')}
        </p>
      </Section>
    )
  return null
}

const SCENE_GROUPS = (): { label: string; items: { value: SceneConfig['preset']; label: string }[] }[] => [
  {
    label: t('Sfondi'),
    items: [
      { value: 'mesh', label: t('Sfumatura fluida') },
      { value: 'grain', label: t('Gradiente granuloso') },
      { value: 'aurora', label: 'Aurora' },
      { value: 'silk', label: t('Seta') },
      { value: 'marble', label: t('Marmo liquido') },
      { value: 'smoke', label: t('Fumo') },
      { value: 'plasma', label: 'Plasma' },
      { value: 'prism', label: t('Luce prismatica') },
      { value: 'gradient', label: t('Gradiente a maglie') },
    ],
  },
  {
    label: t('Movimento'),
    items: [
      { value: 'waves', label: t('Onde') },
      { value: 'ripples', label: t('Increspature') },
      { value: 'lines', label: t('Linee topografiche') },
      { value: 'dots', label: t('Griglia di punti') },
      { value: 'cells', label: t('Cellule') },
      { value: 'particles', label: t('Particelle') },
      { value: 'stars', label: t('Campo stellare') },
      { value: 'tunnel', label: 'Tunnel' },
      { value: 'liquid', label: t('Forme liquide') },
      { value: 'metaballs', label: t('Gocce che si fondono') },
      { value: 'ribbons', label: t('Nastri fluidi') },
      { value: 'globe', label: t('Globo a punti') },
    ],
  },
  {
    label: t('Su un’immagine'),
    items: [
      { value: 'distort', label: t('Immagine liquida') },
      { value: 'halftone', label: t('Mezzatinta') },
      { value: 'glitch', label: 'Glitch RGB' },
      { value: 'pixel', label: t('Mosaico al mouse') },
      { value: 'lens', label: t('Lente al mouse') },
      { value: 'transition', label: t('Cambio al passaggio') },
    ],
  },
  {
    label: '3D',
    items: [
      { value: 'shapes', label: t('Forme 3D') },
      { value: 'model', label: t('Modello 3D (glTF)') },
    ],
  },
  { label: t('Avanzato'), items: [{ value: 'custom', label: t('Shader personalizzato') }] },
]
const IMAGE_PRESETS = new Set(['distort', 'halftone', 'glitch', 'pixel', 'lens', 'transition'])

const CUSTOM_TEMPLATE = `void main(){
  vec2 uv = gl_FragCoord.xy / u_res;
  float n = fbm(uv * 3. + u_time * .1);
  vec3 col = mix(u_c1, u_c2, n);
  col = mix(col, u_c3, smoothstep(.4, .9, length(uv - u_mouse)));
  gl_FragColor = vec4(col, 1.);
}`

function Slider({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <Row label={label}>
      <input
        type="range"
        min={0}
        max={max}
        step={0.05}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
        aria-label={label}
      />
      <span className="w-8 text-right font-mono text-[11.5px] text-fg3">{value.toFixed(2)}</span>
    </Row>
  )
}

/** A WebGL scene: as the element itself, or as a frame's animated background. */
export function SceneSection({
  node,
  palette,
  onContent,
  onPickImage,
  onPickImage2,
}: {
  node: PageNode
  palette: Record<string, string>
  onContent: (patch: Partial<PageNode>, group?: string) => void
  onPickImage: () => void
  onPickImage2: () => void
}) {
  const isScene = node.type === 'scene'
  const cfg = node.scene
  const set = (patch: Partial<SceneConfig>, group?: string) =>
    onContent({ scene: { preset: 'mesh', ...cfg, ...patch } }, group && `${group}:${node.id}`)
  const colors = cfg?.colors ?? ['inverse', 'accent', 'surface']
  // Live previews of the presets, in the colors chosen: one shared WebGL context draws them all.
  const previews = useRef<HTMLDivElement>(null)
  const resolved = colors.map((c) => palette[c] ?? c) as [string, string, string]
  const previewKey = cfg ? `${resolved.join()}|${cfg.image ?? ''}|${cfg.image2 ?? ''}` : ''
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart only when the colors or pictures change
  useEffect(() => (previews.current ? startScenes(previews.current) : undefined), [previewKey])
  const previewOf = (preset: SceneConfig['preset']) => {
    if (THREE_D.has(preset) || preset === 'custom') return null
    if (IMAGE_SCENES.has(preset) && !cfg?.image) return null
    const data: SceneConfig = { preset, colors: resolved, image: cfg?.image, image2: cfg?.image2, mouse: 0.6 }
    return JSON.stringify(data)
  }
  if (!isScene && node.type !== 'frame') return null
  return (
    <Section title={isScene ? t('Scena WebGL') : t('Sfondo animato (WebGL)')}>
      {!isScene && (
        <Toggle
          label={t('Usa una scena WebGL come sfondo')}
          checked={!!cfg}
          // Behind a section's content: the section's own colors, so its texts stay readable.
          onChange={(v) => onContent({ scene: v ? { preset: 'mesh', colors: ['bg', 'surface', 'accent'] } : null })}
        />
      )}
      {cfg && (
        <>
          <div ref={previews} className="space-y-2.5">
            {SCENE_GROUPS().map((g) => (
              <div key={g.label} className="space-y-1">
                <div className="text-[11px] font-medium text-fg3">{g.label}</div>
                <div className="grid grid-cols-2 gap-1">
                  {g.items.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      aria-pressed={cfg.preset === p.value}
                      onClick={() =>
                        set(
                          p.value === 'custom' && !cfg.code
                            ? { preset: p.value, code: CUSTOM_TEMPLATE }
                            : { preset: p.value },
                        )
                      }
                      className={
                        cfg.preset === p.value
                          ? 'relative flex h-12 items-end overflow-hidden rounded-md border-2 border-accent bg-panel2 text-left text-[11.5px] font-medium text-white'
                          : 'relative flex h-12 items-end overflow-hidden rounded-md border-2 border-transparent bg-panel2 text-left text-[11.5px] font-medium text-white hover:border-line2'
                      }
                    >
                      {previewOf(p.value) ? (
                        <canvas
                          key={previewKey}
                          data-mz-scene={previewOf(p.value) ?? ''}
                          className="pointer-events-none absolute inset-0 size-full"
                        />
                      ) : null}
                      <span className="relative w-full truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-3 pb-1">
                        {p.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {[0, 1, 2].map((i) => (
            <Row key={i} label={t('Colore {n}', { n: i + 1 })}>
              <ColorField
                value={colors[i] ?? null}
                palette={palette}
                onChange={(v) => {
                  const next = [...colors] as [string, string, string]
                  next[i] = v ?? 'accent'
                  set({ colors: next })
                }}
              />
            </Row>
          ))}
          <Slider label={t('Velocità')} value={cfg.speed ?? 1} max={3} onChange={(speed) => set({ speed }, 'speed')} />
          <Slider
            label={t('Intensità')}
            value={cfg.intensity ?? 1}
            max={2}
            onChange={(intensity) => set({ intensity }, 'intensity')}
          />
          <Slider label="Mouse" value={cfg.mouse ?? 1} max={2} onChange={(mouse) => set({ mouse }, 'mouse')} />
          <Slider label="Scroll" value={cfg.scroll ?? 1} max={2} onChange={(scroll) => set({ scroll }, 'scroll')} />
          {(cfg.preset === 'shapes' || cfg.preset === 'model') && (
            <>
              {cfg.preset === 'shapes' && (
                <Row label={t('Forma')}>
                  <Select
                    label={t('Forma 3D')}
                    value={cfg.shape ?? 'blob'}
                    onChange={(shape) => set({ shape })}
                    options={[
                      { value: 'blob', label: t('Goccia che respira') },
                      { value: 'knot', label: t('Nodo') },
                      { value: 'torus', label: t('Ciambella') },
                      { value: 'cube', label: t('Cubo arrotondato') },
                      { value: 'spheres', label: t('Sfere sospese') },
                      { value: 'rings', label: t('Anelli intrecciati') },
                      { value: 'gem', label: t('Gemma sfaccettata') },
                      { value: 'capsule', label: t('Capsula') },
                      { value: 'sphere', label: t('Sfera') },
                      { value: 'logo', label: t('Logo in 3D (da SVG)') },
                    ]}
                  />
                </Row>
              )}
              {cfg.preset === 'shapes' && cfg.shape === 'logo' && (
                <>
                  <Textarea
                    aria-label={t('SVG del logo')}
                    value={cfg.svg ?? ''}
                    placeholder="<svg viewBox=…>…</svg>"
                    onChange={(e) => set({ svg: e.target.value || null }, 'svg')}
                    className="min-h-24 font-mono text-[11.5px]"
                  />
                  <p className="text-[11.5px] leading-relaxed text-fg3">
                    {t(
                      'Incolla l’SVG del marchio (da Figma o Illustrator): ogni forma piena diventa un solido con i bordi smussati.',
                    )}
                  </p>
                </>
              )}
              {cfg.preset === 'model' && (
                <>
                  <Row label={t('Modello 3D')}>
                    <button
                      type="button"
                      onClick={onPickImage}
                      className="h-7 flex-1 truncate rounded-md border border-line2 bg-input px-2 text-left text-[12.5px] hover:border-fg3/50"
                    >
                      {cfg.model ? cfg.model.split('/').pop() : t('Scegli un file .glb')}
                    </button>
                  </Row>
                  <p className="text-[11.5px] leading-relaxed text-fg3">
                    {t('Carica un modello .glb nella libreria media, poi sceglilo qui.')}
                  </p>
                </>
              )}
              <Row label={t('Materiale')}>
                <Select
                  label={t('Materiale')}
                  value={cfg.material ?? (cfg.preset === 'model' ? 'original' : 'chrome')}
                  onChange={(material) => set({ material })}
                  options={[
                    ...(cfg.preset === 'model' ? [{ value: 'original' as const, label: t('Quello del modello') }] : []),
                    { value: 'chrome', label: t('Cromo') },
                    { value: 'glass', label: t('Vetro') },
                    { value: 'iridescent', label: t('Iridescente') },
                    { value: 'clay', label: t('Argilla') },
                    { value: 'wire', label: t('Fil di ferro') },
                    { value: 'gold', label: t('Metallo satinato') },
                    { value: 'pearl', label: t('Perla') },
                    { value: 'neon', label: t('Neon luminoso') },
                  ]}
                />
              </Row>
              <Row label={t('Luce')}>
                <Select
                  label={t('Luce della scena')}
                  value={cfg.lighting ?? 'studio'}
                  onChange={(lighting) => set({ lighting })}
                  options={[
                    { value: 'studio', label: 'Studio' },
                    { value: 'neon', label: t('Neon, bordi colorati') },
                    { value: 'soft', label: t('Morbida') },
                  ]}
                />
              </Row>
              <Slider
                label={t('Rotazione')}
                value={cfg.rotate ?? 1}
                max={3}
                onChange={(rotate) => set({ rotate }, 'rotate')}
              />
              <Slider
                label={t('Vicinanza')}
                value={cfg.zoom ?? 1}
                max={2}
                onChange={(zoom) => set({ zoom: Math.max(0.4, zoom) }, 'zoom')}
              />
              <Toggle
                label={t('Sfondo trasparente')}
                checked={!!cfg.transparent}
                onChange={(transparent) => set({ transparent })}
              />
            </>
          )}
          {IMAGE_PRESETS.has(cfg.preset) && (
            <Row label={t('Immagine')}>
              <button
                type="button"
                onClick={onPickImage}
                className="h-7 flex-1 truncate rounded-md border border-line2 bg-input px-2 text-left text-[12.5px] hover:border-fg3/50"
              >
                {cfg.image ? t('Cambia immagine') : t('Scegli un’immagine')}
              </button>
            </Row>
          )}
          {cfg.preset === 'transition' && (
            <>
              <Row label={t('Al passaggio')}>
                <button
                  type="button"
                  onClick={onPickImage2}
                  className="h-7 flex-1 truncate rounded-md border border-line2 bg-input px-2 text-left text-[12.5px] hover:border-fg3/50"
                >
                  {cfg.image2 ? t('Cambia la seconda') : t('Scegli la seconda immagine')}
                </button>
              </Row>
              <p className="text-[11.5px] leading-relaxed text-fg3">
                {t('Passando il mouse sulla scheda (o sul contenitore), la prima immagine si scioglie nella seconda.')}
              </p>
            </>
          )}
          {cfg.preset === 'custom' && (
            <>
              <Textarea
                aria-label={t('Shader GLSL')}
                value={cfg.code ?? ''}
                onChange={(e) => set({ code: e.target.value }, 'code')}
                className="min-h-40 font-mono text-[11.5px]"
              />
              <p className="text-[11.5px] leading-relaxed text-fg3">
                {t(
                  'GLSL: u_time, u_res, u_mouse, u_scroll, u_c1…u_c3, u_intensity e le funzioni noise e fbm. Se il codice ha un errore, si vede la sfumatura fluida.',
                )}
              </p>
            </>
          )}
        </>
      )}
    </Section>
  )
}
