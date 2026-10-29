import { sampleInteraction, styleFor } from '@materializecms/core/motion'
import { type Interaction, type Keyframe, type MotionProps, newId } from '@materializecms/core/page'
import { Pause, Play, Plus, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cx, IconButton } from '../components/ui.tsx'
import { NumField, Row, Select } from './controls.tsx'

export interface PropDef {
  key: keyof MotionProps
  label: string
  unit: string
  step: number
  min: number
  max: number
  rest: number
}

/** Shows a state of the timeline on the canvas element, without touching the page data. */
export function scrub(id: string, ix: Interaction, t: number | null) {
  window.dispatchEvent(
    new CustomEvent('mz-scrub', {
      detail: { id, style: t === null ? null : styleFor(sampleInteraction(ix, t), ix.clipSide) },
    }),
  )
}

const EASES: { value: NonNullable<Keyframe['ease']>; label: string }[] = [
  { value: 'inOut', label: 'Morbida' },
  { value: 'out', label: 'Rallenta alla fine' },
  { value: 'expo', label: 'Esponenziale' },
  { value: 'back', label: 'Con rimbalzo' },
  { value: 'spring', label: 'Molla' },
  { value: 'linear', label: 'Costante' },
]

/**
 * Keyframes on a track: click the track to add one, drag a diamond to move it, select it to edit
 * its state. The playhead shows any moment of the animation on the canvas.
 */
export function Timeline({
  nodeId,
  ix,
  props,
  onChange,
}: {
  nodeId: string
  ix: Interaction
  props: PropDef[]
  onChange: (patch: Partial<Interaction>, group?: string) => void
}) {
  const keys = [...(ix.keys ?? [])].sort((a, b) => a.at - b.at)
  const [selected, setSelected] = useState<string | null>(keys[0]?.id ?? null)
  const [head, setHead] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const track = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const current = keys.find((k) => k.id === selected) ?? null

  // Clear the preview when leaving the timeline.
  useEffect(
    () => () => {
      cancelAnimationFrame(raf.current)
      window.dispatchEvent(new CustomEvent('mz-scrub', { detail: { id: nodeId, style: null } }))
    },
    [nodeId],
  )

  const setKeys = (next: Keyframe[], group?: string) => onChange({ keys: next }, group)
  const at = (clientX: number) => {
    const r = track.current?.getBoundingClientRect()
    if (!r) return 0
    return Math.round(Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * 100) / 100
  }

  const show = (t: number | null) => {
    setHead(t)
    scrub(nodeId, ix, t)
  }

  const play = () => {
    if (playing) {
      cancelAnimationFrame(raf.current)
      setPlaying(false)
      show(null)
      return
    }
    setPlaying(true)
    const dur = (ix.trigger === 'scroll' ? 2.4 : (ix.duration ?? 0.8)) * 1000
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      show(t)
      if (t < 1) raf.current = requestAnimationFrame(step)
      else {
        setPlaying(false)
        setTimeout(() => show(null), 500)
      }
    }
    raf.current = requestAnimationFrame(step)
  }

  const setKey = (id: string, patch: Partial<Keyframe>, group?: string) =>
    setKeys(
      keys.map((k) => (k.id === id ? { ...k, ...patch } : k)),
      group,
    )

  const used = props.filter((p) => keys.some((k) => k.props[p.key] !== undefined))
  const unused = props.filter((p) => !used.includes(p))

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5">
        <IconButton label={playing ? 'Ferma' : 'Riproduci sulla tela'} onClick={play} className="size-6">
          {playing ? <Pause /> : <Play />}
        </IconButton>
        {/* The track: diamonds are keyframes, the line is the playhead. */}
        <div
          ref={track}
          className="relative h-8 flex-1 cursor-copy rounded-md bg-seg"
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget) return
            const t = at(e.clientX)
            const k: Keyframe = { id: newId(), at: t, props: pick(sampleInteraction(ix, t), used) }
            setKeys([...keys, k])
            setSelected(k.id)
            show(t)
          }}
          onPointerMove={(e) => {
            if (e.buttons === 0 && e.target === e.currentTarget) show(at(e.clientX))
          }}
          onPointerLeave={() => !playing && show(null)}
          title="Clicca per aggiungere un fotogramma chiave"
        >
          <div className="pointer-events-none absolute top-1/2 right-2 left-2 h-px bg-line2" />
          {head !== null && (
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-accent"
              style={{ left: `calc(8px + (100% - 16px) * ${head})` }}
            />
          )}
          {keys.map((k) => (
            <button
              key={k.id}
              type="button"
              title={`Fotogramma al ${Math.round(k.at * 100)}% — trascina per spostarlo`}
              aria-label={`Fotogramma al ${Math.round(k.at * 100)}%`}
              aria-pressed={k.id === selected}
              onPointerDown={(e) => {
                e.stopPropagation()
                setSelected(k.id)
                const el = e.currentTarget
                el.setPointerCapture(e.pointerId)
                const move = (ev: PointerEvent) => {
                  const t = at(ev.clientX)
                  setKey(k.id, { at: t }, `at:${k.id}`)
                  show(t)
                }
                const up = () => {
                  el.removeEventListener('pointermove', move)
                  el.removeEventListener('pointerup', up)
                }
                el.addEventListener('pointermove', move)
                el.addEventListener('pointerup', up)
              }}
              className={cx(
                'absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] border-2 transition-colors',
                k.id === selected ? 'border-accent bg-accent' : 'border-fg2 bg-panel hover:border-accent',
              )}
              style={{ left: `calc(8px + (100% - 16px) * ${k.at})` }}
            />
          ))}
        </div>
      </div>
      <div className="flex justify-between px-8 font-mono text-[10px] text-fg3">
        <span>0%</span>
        <span>{head !== null ? `${Math.round(head * 100)}%` : ''}</span>
        <span>100%</span>
      </div>

      {current && (
        <div className="space-y-2 rounded-lg bg-panel2 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11.5px] font-semibold">Fotogramma</span>
            {keys.length > 2 && (
              <IconButton
                label="Elimina il fotogramma"
                className="size-6 hover:text-danger"
                onClick={() => {
                  const rest = keys.filter((k) => k.id !== current.id)
                  setKeys(rest)
                  setSelected(rest[0]?.id ?? null)
                }}
              >
                <Trash2 />
              </IconButton>
            )}
          </div>
          <Row label="Posizione">
            <NumField
              value={Math.round(current.at * 100)}
              unit="%"
              max={100}
              onChange={(v) => setKey(current.id, { at: (v ?? 0) / 100 })}
            />
          </Row>
          {current !== keys[0] && (
            <Row label="Curva" hint="Come arriva a questo fotogramma dal precedente">
              <Select
                label="Curva"
                value={current.ease ?? 'inOut'}
                options={EASES}
                onChange={(ease) => setKey(current.id, { ease })}
              />
            </Row>
          )}
          {used.map((p) => (
            <Row key={p.key} label={p.label}>
              <NumField
                value={current.props[p.key] ?? null}
                placeholder={String(p.rest)}
                unit={p.unit}
                step={p.step}
                min={p.min}
                max={p.max}
                onChange={(v) => {
                  const next = { ...current.props }
                  if (v === null) delete next[p.key]
                  else next[p.key] = v
                  setKey(current.id, { props: next }, `kp:${current.id}:${p.key}`)
                  show(current.at)
                }}
              />
            </Row>
          ))}
          {unused.length > 0 && (
            <Select
              label="Aggiungi una proprietà"
              value={'' as string}
              options={[
                { value: '', label: '+ Proprietà animata' },
                ...unused.map((p) => ({ value: p.key, label: p.label })),
              ]}
              onChange={(k) => {
                const p = props.find((x) => x.key === k)
                if (!p) return
                setKeys(keys.map((key) => ({ ...key, props: { ...key.props, [p.key]: p.rest } })))
              }}
            />
          )}
          <p className="flex items-center gap-1 text-[10.5px] text-fg3">
            <Plus className="size-3" /> Clicca sulla linea per aggiungere un fotogramma, trascinalo per spostarlo.
          </p>
        </div>
      )}
    </div>
  )
}

function pick(state: Required<MotionProps>, used: PropDef[]): MotionProps {
  const out: MotionProps = {}
  for (const p of used) out[p.key] = Math.round(state[p.key] * 100) / 100
  return out
}

/** Turns from/to into a two-keyframe timeline, keeping the motion as it was. */
export function toKeys(ix: Interaction): Keyframe[] {
  const from = { ...ix.from }
  const to = { ...ix.to }
  for (const k of Object.keys({ ...from, ...to }) as (keyof MotionProps)[]) {
    if (from[k] === undefined) from[k] = k === 'scale' || k === 'opacity' ? 1 : 0
    if (to[k] === undefined) to[k] = k === 'scale' || k === 'opacity' ? 1 : 0
  }
  return [
    { id: newId(), at: 0, props: from },
    { id: newId(), at: 1, props: to, ease: ix.ease ?? (ix.trigger === 'scroll' ? 'linear' : 'out') },
  ]
}
