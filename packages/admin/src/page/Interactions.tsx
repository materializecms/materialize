import { type Interaction, type MotionProps, newId, type PageNode } from '@materializecms/core/page'
import { ChevronDown, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cx, IconButton, MenuItem, MenuSeparator, Popover } from '../components/ui.tsx'
import { t } from '../lib/i18n.ts'
import { NumField, Row, Section, Seg, Select, Toggle } from './controls.tsx'
import { Timeline, toKeys } from './Timeline.tsx'

const TRIGGERS = (): { value: Interaction['trigger']; label: string; hint: string }[] => [
  { value: 'view', label: t('Entra nello schermo'), hint: t('Parte quando l’elemento diventa visibile') },
  { value: 'scroll', label: t('Con lo scroll'), hint: t('Avanza e torna indietro insieme allo scorrimento') },
  { value: 'load', label: t('All’apertura'), hint: t('Parte appena la pagina si apre') },
  { value: 'hover', label: t('Passaggio del mouse'), hint: t('Mentre il puntatore è sopra l’elemento') },
  { value: 'click', label: t('Clic'), hint: t('Ogni clic alterna i due stati') },
  { value: 'mouse', label: t('Movimento del mouse'), hint: t('Segue il puntatore nella pagina') },
]

const PROPS = (): {
  key: keyof MotionProps
  label: string
  unit: string
  step: number
  min: number
  max: number
  rest: number
}[] => [
  { key: 'x', label: t('Sposta X'), unit: 'px', step: 1, min: -2000, max: 2000, rest: 0 },
  { key: 'y', label: t('Sposta Y'), unit: 'px', step: 1, min: -2000, max: 2000, rest: 0 },
  { key: 'scale', label: t('Scala'), unit: '×', step: 0.01, min: 0, max: 10, rest: 1 },
  { key: 'rotate', label: t('Ruota'), unit: '°', step: 1, min: -720, max: 720, rest: 0 },
  { key: 'rx', label: t('Ruota 3D X'), unit: '°', step: 1, min: -180, max: 180, rest: 0 },
  { key: 'ry', label: t('Ruota 3D Y'), unit: '°', step: 1, min: -180, max: 180, rest: 0 },
  { key: 'opacity', label: t('Opacità'), unit: '', step: 0.05, min: 0, max: 1, rest: 1 },
  { key: 'blur', label: t('Sfocatura'), unit: 'px', step: 1, min: 0, max: 60, rest: 0 },
  { key: 'clip', label: t('Ritaglio'), unit: '%', step: 1, min: 0, max: 100, rest: 0 },
]

/** Ready-made interactions: a starting point, every value stays editable. */
/** `text`: only for text elements. */
const PRESETS = (): {
  group: string
  label: string
  text?: boolean
  make: (n: PageNode) => Omit<Interaction, 'id'>
}[] => [
  {
    group: t('Entrata'),
    label: t('Comparsa dal basso'),
    make: () => ({ trigger: 'view', from: { y: 48, opacity: 0 }, duration: 0.9, ease: 'out' }),
  },
  {
    group: t('Entrata'),
    label: t('Rivela come una tenda'),
    make: () => ({ trigger: 'view', from: { clip: 100 }, clipSide: 'bottom', duration: 1.2, ease: 'expo' }),
  },
  {
    group: t('Entrata'),
    label: t('Messa a fuoco'),
    make: () => ({ trigger: 'view', from: { blur: 18, opacity: 0, scale: 1.04 }, duration: 1.1, ease: 'out' }),
  },
  {
    group: t('Entrata'),
    label: t('Testo parola per parola'),
    text: true,
    make: () => ({
      trigger: 'view',
      split: 'words',
      stagger: 0.06,
      from: { y: 32, opacity: 0, blur: 6 },
      duration: 0.8,
      ease: 'out',
    }),
  },
  {
    group: t('Entrata'),
    label: t('Testo lettera per lettera'),
    text: true,
    make: () => ({
      trigger: 'view',
      split: 'chars',
      stagger: 0.025,
      from: { y: 24, opacity: 0, rotate: 6 },
      duration: 0.7,
      ease: 'back',
    }),
  },
  {
    group: t('Entrata'),
    label: t('Contatore'),
    text: true,
    make: () => ({ trigger: 'view', count: true, duration: 1.8, ease: 'expo' }),
  },
  { group: t('Scroll'), label: t('Parallasse'), make: () => ({ trigger: 'scroll', from: { y: 90 }, to: { y: -90 } }) },
  {
    group: t('Scroll'),
    label: t('Zoom con lo scroll'),
    make: () => ({ trigger: 'scroll', from: { scale: 1.2 }, to: { scale: 1 }, range: [0, 0.7] }),
  },
  {
    group: t('Scroll'),
    label: t('Si apre con lo scroll'),
    make: () => ({ trigger: 'scroll', from: { clip: 60, scale: 0.92 }, clipSide: 'bottom', range: [0, 0.6] }),
  },
  {
    group: t('Scroll'),
    label: t('Scorre di lato'),
    make: () => ({ trigger: 'scroll', from: { x: 240 }, to: { x: -240 } }),
  },
  {
    group: t('Scroll'),
    label: t('Ruota con lo scroll'),
    make: () => ({ trigger: 'scroll', from: { rotate: -10 }, to: { rotate: 10 } }),
  },
  {
    group: t('Mouse'),
    label: t('Solleva al passaggio'),
    make: () => ({ trigger: 'hover', to: { y: -8, scale: 1.02 }, duration: 0.45, ease: 'out' }),
  },
  {
    group: t('Mouse'),
    label: t('Ingrandisci al passaggio'),
    make: () => ({ trigger: 'hover', to: { scale: 1.06 }, duration: 0.6, ease: 'out' }),
  },
  { group: t('Mouse'), label: t('Inclinazione 3D'), make: () => ({ trigger: 'mouse', to: { rx: 8, ry: 10 } }) },
  { group: t('Mouse'), label: t('Segue il mouse'), make: () => ({ trigger: 'mouse', to: { x: 30, y: 20 } }) },
  {
    group: t('Mouse'),
    label: t('Al clic si espande'),
    make: () => ({ trigger: 'click', to: { scale: 1.12 }, duration: 0.5, ease: 'spring' }),
  },
]

const TIMED = new Set<Interaction['trigger']>(['view', 'load', 'hover', 'click'])

export function InteractionsSection({
  node,
  onChange,
  onPreview,
}: {
  node: PageNode
  onChange: (interactions: Interaction[] | null, group?: string) => void
  onPreview: () => void
}) {
  const list = node.interactions ?? []
  const [open, setOpen] = useState<string | null>(list[list.length - 1]?.id ?? null)
  const update = (id: string, patch: Partial<Interaction>, group?: string) =>
    onChange(
      list.map((i) => (i.id === id ? { ...i, ...patch } : i)),
      group,
    )
  const presets = PRESETS()
  const groups = [...new Set(presets.map((p) => p.group))]

  return (
    <Section
      title={t('Interazioni')}
      action={
        <span className="flex items-center gap-0.5">
          {list.length > 0 && (
            <IconButton label={t('Prova le interazioni nell’anteprima')} onClick={onPreview} className="size-6">
              <Play />
            </IconButton>
          )}
          <Popover
            width={240}
            align="end"
            trigger={({ toggle, ref }) => (
              <IconButton ref={ref} label={t('Aggiungi un’interazione')} onClick={toggle} className="size-6">
                <Plus />
              </IconButton>
            )}
          >
            {(close) => (
              <div className="max-h-[420px] overflow-y-auto p-1">
                {groups.map((g, gi) => (
                  <div key={g}>
                    {gi > 0 && <MenuSeparator />}
                    <div className="px-2 pt-1.5 pb-1 text-[11.5px] font-medium text-fg3">{g}</div>
                    {presets
                      .filter((p) => p.group === g)
                      .filter((p) => !p.text || node.type === 'text')
                      .map((p) => (
                        <MenuItem
                          key={p.label}
                          onClick={() => {
                            const ix = { id: newId(), ...p.make(node) }
                            onChange([...list, ix])
                            setOpen(ix.id)
                            close()
                          }}
                        >
                          {p.label}
                        </MenuItem>
                      ))}
                  </div>
                ))}
              </div>
            )}
          </Popover>
        </span>
      }
    >
      {list.length === 0 && (
        <p className="text-[12px] leading-relaxed text-fg3">
          {t('Fai muovere l’elemento con lo scroll, il mouse o un clic. Aggiungi un’interazione con +.')}
        </p>
      )}
      {list.map((ix) => (
        <div key={ix.id} className="rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setOpen(open === ix.id ? null : ix.id)}
            className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[12.5px] font-medium"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-accent" />
            <span className="min-w-0 flex-1 truncate">{summary(ix)}</span>
            <ChevronDown className={cx('size-3.5 text-fg3 transition-transform', open === ix.id && 'rotate-180')} />
          </button>
          {open === ix.id && (
            <InteractionEditor
              nodeId={node.id}
              ix={ix}
              isText={node.type === 'text'}
              onChange={(patch, group) => update(ix.id, patch, group)}
              onDelete={() => onChange(list.length > 1 ? list.filter((i) => i.id !== ix.id) : null)}
            />
          )}
        </div>
      ))}
    </Section>
  )
}

function summary(ix: Interaction): string {
  const trigger = TRIGGERS().find((x) => x.value === ix.trigger)?.label ?? ix.trigger
  const what = ix.count
    ? t('contatore')
    : ix.split && ix.split !== 'none'
      ? ix.split === 'words'
        ? t('parole')
        : t('lettere')
      : PROPS()
          .filter((p) => ix.from?.[p.key] !== undefined || ix.to?.[p.key] !== undefined)
          .map((p) => p.label.toLowerCase())
          .slice(0, 2)
          .join(', ')
  return what ? `${trigger} · ${what}` : trigger
}

function InteractionEditor({
  nodeId,
  ix,
  isText,
  onChange,
  onDelete,
}: {
  nodeId: string
  ix: Interaction
  isText: boolean
  onChange: (patch: Partial<Interaction>, group?: string) => void
  onDelete: () => void
}) {
  const props = PROPS()
  const triggers = TRIGGERS()
  const used = props.filter((p) => ix.from?.[p.key] !== undefined || ix.to?.[p.key] !== undefined)
  const unused = props.filter((p) => !used.includes(p))
  const mouse = ix.trigger === 'mouse'
  const setProp = (side: 'from' | 'to', key: keyof MotionProps, v: number | null) => {
    const next = { ...ix[side] }
    if (v === null) delete next[key]
    else next[key] = v
    onChange({ [side]: next }, `${side}:${key}:${ix.id}`)
  }

  return (
    <div className="space-y-2.5 border-t border-line px-2.5 pt-2.5 pb-3">
      <Row label={t('Attivazione')}>
        <Select
          label={t('Attivazione')}
          value={ix.trigger}
          options={triggers.map((x) => ({ value: x.value, label: x.label }))}
          onChange={(trigger) => onChange({ trigger })}
        />
      </Row>
      <p className="-mt-1 text-[11.5px] text-fg3">{triggers.find((x) => x.value === ix.trigger)?.hint}</p>

      {!ix.count && !mouse && ix.keys && ix.keys.length >= 2 && (
        <>
          <Timeline nodeId={nodeId} ix={ix} props={props} onChange={onChange} />
          <button
            type="button"
            onClick={() => onChange({ keys: null })}
            className="text-left text-[12px] text-fg3 hover:text-fg"
          >
            {t('Torna a uno stato iniziale e uno finale')}
          </button>
        </>
      )}
      {!ix.count && !mouse && !(ix.keys && ix.keys.length >= 2) && (
        <button
          type="button"
          onClick={() => onChange({ keys: toKeys(ix) })}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-accent/50 text-[12px] font-medium text-accent hover:bg-accent/8"
        >
          ◆ {t('Usa una linea temporale con fotogrammi chiave')}
        </button>
      )}
      {!ix.count && !(ix.keys && ix.keys.length >= 2 && !mouse) && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[72px_1fr_1fr_20px] gap-1.5 text-[11px] font-medium text-fg3">
            <span />
            <span>{mouse ? '' : t('Da')}</span>
            <span>{mouse ? t('Massimo') : t('A')}</span>
            <span />
          </div>
          {used.map((p) => (
            <div key={p.key} className="grid grid-cols-[72px_1fr_1fr_20px] items-center gap-1.5">
              <span className="truncate text-[12px] text-fg2">{p.label}</span>
              {mouse ? (
                <span />
              ) : (
                <NumField
                  value={ix.from?.[p.key] ?? null}
                  placeholder={String(p.rest)}
                  unit={p.unit}
                  step={p.step}
                  min={p.min}
                  max={p.max}
                  onChange={(v) => setProp('from', p.key, v)}
                />
              )}
              <NumField
                value={ix.to?.[p.key] ?? null}
                placeholder={String(p.rest)}
                unit={p.unit}
                step={p.step}
                min={p.min}
                max={p.max}
                onChange={(v) => setProp('to', p.key, v)}
              />
              <button
                type="button"
                title={t('Togli la proprietà')}
                aria-label={t('Togli {prop}', { prop: p.label })}
                onClick={() => {
                  const from = { ...ix.from }
                  const to = { ...ix.to }
                  delete from[p.key]
                  delete to[p.key]
                  onChange({ from, to })
                }}
                className="flex size-5 items-center justify-center rounded text-fg3 hover:text-danger"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {unused.length > 0 && (
            <Select
              label={t('Aggiungi una proprietà')}
              value={'' as string}
              options={[
                { value: '', label: t('+ Aggiungi una proprietà') },
                ...unused.map((p) => ({ value: p.key, label: p.label })),
              ]}
              onChange={(k) => {
                const p = props.find((x) => x.key === k)
                if (!p) return
                if (mouse) setProp('to', p.key, p.key === 'scale' ? 1.05 : 10)
                else onChange({ from: { ...ix.from, [p.key]: p.rest }, to: { ...ix.to, [p.key]: p.rest } })
              }}
            />
          )}
          {used.some((p) => p.key === 'clip') && (
            <Row label={t('Ritaglio da')}>
              <Seg
                value={ix.clipSide ?? 'bottom'}
                onChange={(clipSide) => onChange({ clipSide })}
                options={[
                  { value: 'bottom', label: t('Sotto') },
                  { value: 'top', label: t('Sopra') },
                  { value: 'left', label: t('Sin.') },
                  { value: 'right', label: t('Des.') },
                ]}
              />
            </Row>
          )}
        </div>
      )}

      {TIMED.has(ix.trigger) && (
        <>
          <Row label={t('Durata')}>
            <NumField
              value={ix.duration ?? 0.8}
              unit="s"
              step={0.05}
              max={10}
              onChange={(v) => onChange({ duration: v ?? 0.8 }, `dur:${ix.id}`)}
            />
            <NumField
              value={ix.delay ?? 0}
              unit="s"
              step={0.05}
              max={10}
              label={t('Rit.')}
              onChange={(v) => onChange({ delay: v ?? 0 }, `delay:${ix.id}`)}
            />
          </Row>
          <Row label={t('Curva')}>
            <Select
              label={t('Curva di velocità')}
              value={ix.ease ?? 'out'}
              onChange={(ease) => onChange({ ease })}
              options={[
                { value: 'out', label: t('Rallenta alla fine') },
                { value: 'inOut', label: t('Morbida') },
                { value: 'expo', label: t('Esponenziale') },
                { value: 'back', label: t('Con rimbalzo') },
                { value: 'spring', label: t('Molla') },
                { value: 'linear', label: t('Costante') },
              ]}
            />
          </Row>
        </>
      )}
      {ix.trigger === 'view' && (
        <Toggle label={t('Solo la prima volta')} checked={ix.once !== false} onChange={(v) => onChange({ once: v })} />
      )}
      {ix.trigger === 'scroll' && (
        <Row label={t('Intervallo')} hint={t('La parte del passaggio nello schermo in cui avviene')}>
          <NumField
            label={t('Da')}
            unit="%"
            max={100}
            value={Math.round((ix.range?.[0] ?? 0) * 100)}
            onChange={(v) => onChange({ range: [(v ?? 0) / 100, ix.range?.[1] ?? 1] })}
          />
          <NumField
            label={t('A')}
            unit="%"
            max={100}
            value={Math.round((ix.range?.[1] ?? 1) * 100)}
            onChange={(v) => onChange({ range: [ix.range?.[0] ?? 0, (v ?? 100) / 100] })}
          />
        </Row>
      )}
      {isText && TIMED.has(ix.trigger) && (
        <>
          <Row label={t('Suddividi')}>
            <Seg
              value={ix.split ?? 'none'}
              onChange={(split) => onChange({ split })}
              options={[
                { value: 'none', label: t('Tutto') },
                { value: 'words', label: t('Parole') },
                { value: 'chars', label: t('Lettere') },
              ]}
            />
          </Row>
          {ix.split && ix.split !== 'none' && (
            <Row label={t('Tra i pezzi')}>
              <NumField
                value={ix.stagger ?? 0.04}
                unit="s"
                step={0.01}
                max={1}
                onChange={(v) => onChange({ stagger: v ?? 0.04 }, `stagger:${ix.id}`)}
              />
            </Row>
          )}
          <Toggle
            label={t('Conta fino al numero nel testo')}
            checked={!!ix.count}
            onChange={(v) => onChange({ count: v || undefined })}
          />
        </>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[12px] font-medium text-fg3 hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-3" /> {t('Elimina interazione')}
      </button>
    </div>
  )
}
