import { type Interaction, type MotionProps, newId, type PageNode } from '@materializecms/core/page'
import { ChevronDown, Play, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { cx, IconButton, MenuItem, MenuSeparator, Popover } from '../components/ui.tsx'
import { NumField, Row, Section, Seg, Select, Toggle } from './controls.tsx'
import { Timeline, toKeys } from './Timeline.tsx'

const TRIGGERS: { value: Interaction['trigger']; label: string; hint: string }[] = [
  { value: 'view', label: 'Entra nello schermo', hint: 'Parte quando l’elemento diventa visibile' },
  { value: 'scroll', label: 'Con lo scroll', hint: 'Avanza e torna indietro insieme allo scorrimento' },
  { value: 'load', label: 'All’apertura', hint: 'Parte appena la pagina si apre' },
  { value: 'hover', label: 'Passaggio del mouse', hint: 'Mentre il puntatore è sopra l’elemento' },
  { value: 'click', label: 'Clic', hint: 'Ogni clic alterna i due stati' },
  { value: 'mouse', label: 'Movimento del mouse', hint: 'Segue il puntatore nella pagina' },
]

const PROPS: {
  key: keyof MotionProps
  label: string
  unit: string
  step: number
  min: number
  max: number
  rest: number
}[] = [
  { key: 'x', label: 'Sposta X', unit: 'px', step: 1, min: -2000, max: 2000, rest: 0 },
  { key: 'y', label: 'Sposta Y', unit: 'px', step: 1, min: -2000, max: 2000, rest: 0 },
  { key: 'scale', label: 'Scala', unit: '×', step: 0.01, min: 0, max: 10, rest: 1 },
  { key: 'rotate', label: 'Ruota', unit: '°', step: 1, min: -720, max: 720, rest: 0 },
  { key: 'rx', label: 'Ruota 3D X', unit: '°', step: 1, min: -180, max: 180, rest: 0 },
  { key: 'ry', label: 'Ruota 3D Y', unit: '°', step: 1, min: -180, max: 180, rest: 0 },
  { key: 'opacity', label: 'Opacità', unit: '', step: 0.05, min: 0, max: 1, rest: 1 },
  { key: 'blur', label: 'Sfocatura', unit: 'px', step: 1, min: 0, max: 60, rest: 0 },
  { key: 'clip', label: 'Ritaglio', unit: '%', step: 1, min: 0, max: 100, rest: 0 },
]

/** Ready-made interactions: a starting point, every value stays editable. */
const PRESETS: { group: string; label: string; make: (n: PageNode) => Omit<Interaction, 'id'> }[] = [
  {
    group: 'Entrata',
    label: 'Comparsa dal basso',
    make: () => ({ trigger: 'view', from: { y: 48, opacity: 0 }, duration: 0.9, ease: 'out' }),
  },
  {
    group: 'Entrata',
    label: 'Rivela come una tenda',
    make: () => ({ trigger: 'view', from: { clip: 100 }, clipSide: 'bottom', duration: 1.2, ease: 'expo' }),
  },
  {
    group: 'Entrata',
    label: 'Messa a fuoco',
    make: () => ({ trigger: 'view', from: { blur: 18, opacity: 0, scale: 1.04 }, duration: 1.1, ease: 'out' }),
  },
  {
    group: 'Entrata',
    label: 'Testo parola per parola',
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
    group: 'Entrata',
    label: 'Testo lettera per lettera',
    make: () => ({
      trigger: 'view',
      split: 'chars',
      stagger: 0.025,
      from: { y: 24, opacity: 0, rotate: 6 },
      duration: 0.7,
      ease: 'back',
    }),
  },
  { group: 'Entrata', label: 'Contatore', make: () => ({ trigger: 'view', count: true, duration: 1.8, ease: 'expo' }) },
  { group: 'Scroll', label: 'Parallasse', make: () => ({ trigger: 'scroll', from: { y: 90 }, to: { y: -90 } }) },
  {
    group: 'Scroll',
    label: 'Zoom con lo scroll',
    make: () => ({ trigger: 'scroll', from: { scale: 1.2 }, to: { scale: 1 }, range: [0, 0.7] }),
  },
  {
    group: 'Scroll',
    label: 'Si apre con lo scroll',
    make: () => ({ trigger: 'scroll', from: { clip: 60, scale: 0.92 }, clipSide: 'bottom', range: [0, 0.6] }),
  },
  { group: 'Scroll', label: 'Scorre di lato', make: () => ({ trigger: 'scroll', from: { x: 240 }, to: { x: -240 } }) },
  {
    group: 'Scroll',
    label: 'Ruota con lo scroll',
    make: () => ({ trigger: 'scroll', from: { rotate: -10 }, to: { rotate: 10 } }),
  },
  {
    group: 'Mouse',
    label: 'Solleva al passaggio',
    make: () => ({ trigger: 'hover', to: { y: -8, scale: 1.02 }, duration: 0.45, ease: 'out' }),
  },
  {
    group: 'Mouse',
    label: 'Ingrandisci al passaggio',
    make: () => ({ trigger: 'hover', to: { scale: 1.06 }, duration: 0.6, ease: 'out' }),
  },
  { group: 'Mouse', label: 'Inclinazione 3D', make: () => ({ trigger: 'mouse', to: { rx: 8, ry: 10 } }) },
  { group: 'Mouse', label: 'Segue il mouse', make: () => ({ trigger: 'mouse', to: { x: 30, y: 20 } }) },
  {
    group: 'Mouse',
    label: 'Al clic si espande',
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
  const groups = [...new Set(PRESETS.map((p) => p.group))]

  return (
    <Section
      title="Interazioni"
      action={
        <span className="flex items-center gap-0.5">
          {list.length > 0 && (
            <IconButton label="Prova le interazioni nell’anteprima" onClick={onPreview} className="size-6">
              <Play />
            </IconButton>
          )}
          <Popover
            width={240}
            align="end"
            trigger={({ toggle, ref }) => (
              <IconButton ref={ref} label="Aggiungi un’interazione" onClick={toggle} className="size-6">
                <Plus />
              </IconButton>
            )}
          >
            {(close) => (
              <div className="max-h-[420px] overflow-y-auto p-1">
                {groups.map((g, gi) => (
                  <div key={g}>
                    {gi > 0 && <MenuSeparator />}
                    <div className="px-2 pt-1.5 pb-1 text-[11px] font-medium text-fg3">{g}</div>
                    {PRESETS.filter((p) => p.group === g)
                      .filter((p) => !(p.label.startsWith('Testo') || p.label === 'Contatore') || node.type === 'text')
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
        <p className="text-[11.5px] leading-relaxed text-fg3">
          Fai muovere l’elemento con lo scroll, il mouse o un clic. Aggiungi un’interazione con +.
        </p>
      )}
      {list.map((ix) => (
        <div key={ix.id} className="rounded-lg border border-line">
          <button
            type="button"
            onClick={() => setOpen(open === ix.id ? null : ix.id)}
            className="flex h-8 w-full items-center gap-2 px-2.5 text-left text-[12px] font-medium"
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
  const t = TRIGGERS.find((x) => x.value === ix.trigger)?.label ?? ix.trigger
  const what = ix.count
    ? 'contatore'
    : ix.split && ix.split !== 'none'
      ? ix.split === 'words'
        ? 'parole'
        : 'lettere'
      : PROPS.filter((p) => ix.from?.[p.key] !== undefined || ix.to?.[p.key] !== undefined)
          .map((p) => p.label.toLowerCase())
          .slice(0, 2)
          .join(', ')
  return what ? `${t} · ${what}` : t
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
  const used = PROPS.filter((p) => ix.from?.[p.key] !== undefined || ix.to?.[p.key] !== undefined)
  const unused = PROPS.filter((p) => !used.includes(p))
  const mouse = ix.trigger === 'mouse'
  const setProp = (side: 'from' | 'to', key: keyof MotionProps, v: number | null) => {
    const next = { ...ix[side] }
    if (v === null) delete next[key]
    else next[key] = v
    onChange({ [side]: next }, `${side}:${key}:${ix.id}`)
  }

  return (
    <div className="space-y-2.5 border-t border-line px-2.5 pt-2.5 pb-3">
      <Row label="Attivazione">
        <Select
          label="Attivazione"
          value={ix.trigger}
          options={TRIGGERS.map((t) => ({ value: t.value, label: t.label }))}
          onChange={(trigger) => onChange({ trigger })}
        />
      </Row>
      <p className="-mt-1 text-[11px] text-fg3">{TRIGGERS.find((t) => t.value === ix.trigger)?.hint}</p>

      {!ix.count && !mouse && ix.keys && ix.keys.length >= 2 && (
        <>
          <Timeline nodeId={nodeId} ix={ix} props={PROPS} onChange={onChange} />
          <button
            type="button"
            onClick={() => onChange({ keys: null })}
            className="text-left text-[11.5px] text-fg3 hover:text-fg"
          >
            Torna a uno stato iniziale e uno finale
          </button>
        </>
      )}
      {!ix.count && !mouse && !(ix.keys && ix.keys.length >= 2) && (
        <button
          type="button"
          onClick={() => onChange({ keys: toKeys(ix) })}
          className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-accent/50 text-[11.5px] font-medium text-accent hover:bg-accent/8"
        >
          ◆ Usa una linea temporale con fotogrammi chiave
        </button>
      )}
      {!ix.count && !(ix.keys && ix.keys.length >= 2 && !mouse) && (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[72px_1fr_1fr_20px] gap-1.5 text-[10.5px] font-medium text-fg3">
            <span />
            <span>{mouse ? '' : 'Da'}</span>
            <span>{mouse ? 'Massimo' : 'A'}</span>
            <span />
          </div>
          {used.map((p) => (
            <div key={p.key} className="grid grid-cols-[72px_1fr_1fr_20px] items-center gap-1.5">
              <span className="truncate text-[11.5px] text-fg2">{p.label}</span>
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
                title="Togli la proprietà"
                aria-label={`Togli ${p.label}`}
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
              label="Aggiungi una proprietà"
              value={'' as string}
              options={[
                { value: '', label: '+ Aggiungi una proprietà' },
                ...unused.map((p) => ({ value: p.key, label: p.label })),
              ]}
              onChange={(k) => {
                const p = PROPS.find((x) => x.key === k)
                if (!p) return
                if (mouse) setProp('to', p.key, p.key === 'scale' ? 1.05 : 10)
                else onChange({ from: { ...ix.from, [p.key]: p.rest }, to: { ...ix.to, [p.key]: p.rest } })
              }}
            />
          )}
          {used.some((p) => p.key === 'clip') && (
            <Row label="Ritaglio da">
              <Seg
                value={ix.clipSide ?? 'bottom'}
                onChange={(clipSide) => onChange({ clipSide })}
                options={[
                  { value: 'bottom', label: 'Sotto' },
                  { value: 'top', label: 'Sopra' },
                  { value: 'left', label: 'Sin.' },
                  { value: 'right', label: 'Des.' },
                ]}
              />
            </Row>
          )}
        </div>
      )}

      {TIMED.has(ix.trigger) && (
        <>
          <Row label="Durata">
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
              label="Rit."
              onChange={(v) => onChange({ delay: v ?? 0 }, `delay:${ix.id}`)}
            />
          </Row>
          <Row label="Curva">
            <Select
              label="Curva di velocità"
              value={ix.ease ?? 'out'}
              onChange={(ease) => onChange({ ease })}
              options={[
                { value: 'out', label: 'Rallenta alla fine' },
                { value: 'inOut', label: 'Morbida' },
                { value: 'expo', label: 'Esponenziale' },
                { value: 'back', label: 'Con rimbalzo' },
                { value: 'spring', label: 'Molla' },
                { value: 'linear', label: 'Costante' },
              ]}
            />
          </Row>
        </>
      )}
      {ix.trigger === 'view' && (
        <Toggle label="Solo la prima volta" checked={ix.once !== false} onChange={(v) => onChange({ once: v })} />
      )}
      {ix.trigger === 'scroll' && (
        <Row label="Intervallo" hint="La parte del passaggio nello schermo in cui avviene">
          <NumField
            label="Da"
            unit="%"
            max={100}
            value={Math.round((ix.range?.[0] ?? 0) * 100)}
            onChange={(v) => onChange({ range: [(v ?? 0) / 100, ix.range?.[1] ?? 1] })}
          />
          <NumField
            label="A"
            unit="%"
            max={100}
            value={Math.round((ix.range?.[1] ?? 1) * 100)}
            onChange={(v) => onChange({ range: [ix.range?.[0] ?? 0, (v ?? 100) / 100] })}
          />
        </Row>
      )}
      {isText && TIMED.has(ix.trigger) && (
        <>
          <Row label="Suddividi">
            <Seg
              value={ix.split ?? 'none'}
              onChange={(split) => onChange({ split })}
              options={[
                { value: 'none', label: 'Tutto' },
                { value: 'words', label: 'Parole' },
                { value: 'chars', label: 'Lettere' },
              ]}
            />
          </Row>
          {ix.split && ix.split !== 'none' && (
            <Row label="Tra i pezzi">
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
            label="Conta fino al numero nel testo"
            checked={!!ix.count}
            onChange={(v) => onChange({ count: v || undefined })}
          />
        </>
      )}
      <button
        type="button"
        onClick={onDelete}
        className="flex h-7 w-full items-center justify-center gap-1.5 rounded-md text-[11.5px] font-medium text-fg3 hover:bg-danger/10 hover:text-danger"
      >
        <Trash2 className="size-3" /> Elimina interazione
      </button>
    </div>
  )
}
