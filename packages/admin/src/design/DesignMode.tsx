import {
  ArrowDown,
  ArrowUp,
  Copy,
  FileText,
  Globe,
  GripVertical,
  Info,
  Monitor,
  Plus,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react'
import {
  type DragEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSession } from '../app/context.ts'
import { cx, IconButton, Popover, Segmented } from '../components/ui.tsx'
import { type BlockDef, BlockLibrary, blockIcon } from '../fields/BlockLibrary.tsx'
import { FieldsForm } from '../fields/FieldInput.tsx'
import type { CollectionDescription, Data, FieldDescription, ValidationIssue } from '../lib/api.ts'
import { blockTitle, countIssuesUnder, move, newBlock, newKey } from '../lib/doc.ts'
import { usePref } from '../lib/prefs.ts'
import { BlockPreview } from './BlockPreview.tsx'
import { SiteCanvas } from './SiteCanvas.tsx'

type Block = Record<string, unknown> & { _type: string; _key: string }
type Device = 'desktop' | 'tablet' | 'mobile'
const WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, mobile: 390 }

export function DesignMode({
  collection,
  blocksField,
  data,
  onChange,
  issues,
  focusRequest,
}: {
  collection: CollectionDescription
  blocksField: FieldDescription
  data: Data
  onChange: (data: Data, group?: string) => void
  issues: ValidationIssue[]
  /** Path of a problem to show: selects its block (or the page) and scrolls the inspector to the field. */
  focusRequest?: { path: string; n: number } | null
}) {
  const blocks = ((data[blocksField.name] as Block[] | undefined) ?? []).filter((b) => b && typeof b === 'object')
  const defs = blocksField.blocks ?? []
  const [selected, setSelected] = useState<string | null>(null)
  const [device, setDevice] = usePref<Device>('mz-device', 'desktop')
  const max = blocksField.options.max as number | undefined
  const canAdd = max === undefined || blocks.length < max

  const { schema, locale } = useSession()
  const live = schema.preview === true
  const index = blocks.findIndex((b) => b._key === selected)
  const current = index >= 0 ? blocks[index] : undefined

  const setBlocks = useCallback(
    (next: Block[], group?: string) => onChange({ ...data, [blocksField.name]: next }, group),
    [data, blocksField.name, onChange],
  )

  const insert = (def: BlockDef, at: number) => {
    const block = newBlock(def.name, def.fields) as Block
    const next = [...blocks]
    next.splice(at, 0, block)
    setBlocks(next)
    setSelected(block._key)
  }
  const duplicate = (i: number) => {
    const source = blocks[i]
    if (!source || !canAdd) return
    const copy = { ...structuredClone(source), _key: newKey() }
    const next = [...blocks]
    next.splice(i + 1, 0, copy)
    setBlocks(next)
    setSelected(copy._key)
  }
  const remove = (i: number) => {
    setBlocks(blocks.filter((_, j) => j !== i))
    setSelected(blocks[i + 1]?._key ?? blocks[i - 1]?._key ?? null)
  }
  const updateBlock = (i: number, block: Block, group?: string) => {
    const next = [...blocks]
    next[i] = block
    setBlocks(next, group)
  }

  // Keyboard: delete, duplicate, move and deselect the selected block (not while typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable], .ProseMirror')) return
      if (index < 0) return
      if (e.key === 'Escape') setSelected(null)
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault()
        remove(index)
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicate(index)
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault()
        setBlocks(move(blocks, index, index + (e.key === 'ArrowUp' ? -1 : 1)))
      } else if (!e.altKey && !e.metaKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const next = blocks[index + (e.key === 'ArrowUp' ? -1 : 1)]
        if (next) {
          e.preventDefault()
          setSelected(next._key)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per request
  useEffect(() => {
    if (!focusRequest) return
    const [first, second] = focusRequest.path.split('.')
    const block = first === blocksField.name ? blocks[Number(second)] : undefined
    setSelected(block?._key ?? null)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        let el: Element | null = null
        for (let p = focusRequest.path; p && !el; p = p.split('.').slice(0, -1).join('.'))
          el = document.querySelector(`aside [data-path="${p}"]`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }),
    )
  }, [focusRequest])

  // Bring the selected block into view on the canvas.
  useEffect(() => {
    if (!selected) return
    const el = document.querySelector(`[data-block-key="${selected}"]`)
    if (!el) return
    const r = el.getBoundingClientRect()
    const canvas = el.closest('[data-canvas]')?.getBoundingClientRect()
    if (canvas && (r.bottom < canvas.top + 40 || r.top > canvas.bottom - 40))
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selected])

  const errorKeys = useMemo(
    () => new Set(blocks.filter((_, i) => countIssuesUnder(issues, `${blocksField.name}.${i}`) > 0).map((b) => b._key)),
    [blocks, issues, blocksField.name],
  )
  const labels = useMemo(
    () => Object.fromEntries(blocks.map((b) => [b._key, defs.find((d) => d.name === b._type)?.label ?? b._type])),
    [blocks, defs],
  )

  return (
    <div className="flex min-h-0 flex-1">
      <Layers
        blocks={blocks}
        defs={defs}
        selected={selected}
        onSelect={setSelected}
        onMove={(from, to) => setBlocks(move(blocks, from, to))}
        onAdd={(def) => insert(def, blocks.length)}
        canAdd={canAdd}
        issues={issues}
        path={blocksField.name}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex h-10 shrink-0 items-center justify-center gap-2 border-b border-line bg-panel/60 px-3">
          <Segmented
            size="sm"
            value={device}
            onChange={setDevice}
            options={[
              { value: 'desktop', label: <Monitor />, title: 'Desktop · 1280 px' },
              { value: 'tablet', label: <Tablet />, title: 'Tablet · 820 px' },
              { value: 'mobile', label: <Smartphone />, title: 'Mobile · 390 px' },
            ]}
          />
          <span className="text-[11.5px] text-fg3 tabular-nums">{WIDTH[device]} px</span>
          {live ? (
            <span
              className="absolute right-3 inline-flex items-center gap-1 text-[11.5px] text-fg3"
              title="La tela usa il layout e i componenti del sito: è la pagina come la vedranno i visitatori."
            >
              <Globe className="size-3.5" /> Il sito vero
            </span>
          ) : (
            <span
              className="absolute right-3 inline-flex items-center gap-1 text-[11.5px] text-fg3"
              title="La tela mostra struttura e contenuti con uno stile neutro. Collega un sito Astro per vedere l’aspetto definitivo."
            >
              <Info className="size-3.5" /> Anteprima neutra
            </span>
          )}
          {live && canAdd && (
            <div className="absolute left-3">
              <AddButton compact defs={defs} onPick={(d) => insert(d, index >= 0 ? index + 1 : blocks.length)} />
            </div>
          )}
        </div>
        {live ? (
          <SiteCanvas
            collection={collection.name}
            locale={locale}
            data={data}
            width={WIDTH[device]}
            selected={selected}
            errors={errorKeys}
            labels={labels}
            onSelect={setSelected}
            onField={(key, field, text) => {
              const i = blocks.findIndex((b) => b._key === key)
              const block = blocks[i]
              if (block) updateBlock(i, { ...block, [field]: text }, `canvas:${key}:${field}`)
            }}
          />
        ) : (
          <Canvas device={device} onBackground={() => setSelected(null)}>
            {blocks.length === 0 ? (
              <EmptyPage defs={defs} onPick={(d) => insert(d, 0)} />
            ) : (
              blocks.map((block, i) => {
                const def = defs.find((d) => d.name === block._type)
                const isSelected = block._key === selected
                const errors = countIssuesUnder(issues, `${blocksField.name}.${i}`)
                return (
                  <div key={block._key}>
                    {i > 0 && canAdd && <Inserter defs={defs} onPick={(d) => insert(d, i)} />}
                    <div
                      data-block-key={block._key}
                      role="presentation"
                      onPointerDown={() => setSelected(block._key)}
                      className={cx(
                        'group/block relative',
                        isSelected
                          ? 'outline-2 -outline-offset-2 outline-[#3d5afe]'
                          : errors
                            ? 'outline-2 -outline-offset-2 outline-[#c4320a]/70'
                            : 'hover:outline-2 hover:-outline-offset-2 hover:outline-[#3d5afe]/40',
                      )}
                    >
                      <span
                        className={cx(
                          'pointer-events-none absolute top-0 left-0 z-10 inline-flex h-[22px] items-center gap-1 rounded-br-md px-2 font-sans text-[11px] font-medium text-white [&_svg]:size-3',
                          isSelected
                            ? 'bg-[#3d5afe]'
                            : errors
                              ? 'bg-[#c4320a]'
                              : 'bg-[#3d5afe]/80 opacity-0 group-hover/block:opacity-100',
                        )}
                      >
                        {blockIcon(block._type)}
                        {def?.label ?? block._type}
                        {errors > 0 && ` · ${errors} da sistemare`}
                      </span>
                      {isSelected && (
                        <div className="absolute top-2 right-2 z-10 flex items-center gap-0.5 rounded-lg border border-black/10 bg-white p-0.5 text-neutral-700 shadow-lg [&_button]:text-neutral-600 [&_button:hover]:bg-neutral-100 [&_button:hover]:text-neutral-950">
                          <IconButton
                            label="Sposta su (⌥↑)"
                            disabled={i === 0}
                            onClick={() => setBlocks(move(blocks, i, i - 1))}
                          >
                            <ArrowUp />
                          </IconButton>
                          <IconButton
                            label="Sposta giù (⌥↓)"
                            disabled={i === blocks.length - 1}
                            onClick={() => setBlocks(move(blocks, i, i + 1))}
                          >
                            <ArrowDown />
                          </IconButton>
                          <IconButton label="Duplica (⌘D)" disabled={!canAdd} onClick={() => duplicate(i)}>
                            <Copy />
                          </IconButton>
                          <IconButton label="Elimina (⌫)" onClick={() => remove(i)}>
                            <Trash2 />
                          </IconButton>
                        </div>
                      )}
                      {def ? (
                        <BlockPreview
                          def={def}
                          value={block}
                          index={i}
                          selected={isSelected}
                          onField={(name, v) => updateBlock(i, { ...block, [name]: v }, `canvas:${block._key}:${name}`)}
                        />
                      ) : (
                        <div className="bg-amber-50 px-8 py-10 text-[14px] text-amber-800">
                          Il blocco “{block._type}” non esiste più nello schema.
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            {blocks.length > 0 && canAdd && (
              <div className="flex justify-center bg-white py-6">
                <AddButton defs={defs} onPick={(d) => insert(d, blocks.length)} />
              </div>
            )}
          </Canvas>
        )}
      </div>

      <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-line bg-panel">
        {current ? (
          <div>
            <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-line bg-panel pr-2 pl-4">
              <span className="text-fg2 [&_svg]:size-4">{blockIcon(current._type)}</span>
              <span className="flex-1 truncate text-[13px] font-semibold">
                {defs.find((d) => d.name === current._type)?.label}
              </span>
              <IconButton
                label="Sposta su (⌥↑)"
                disabled={index === 0}
                onClick={() => setBlocks(move(blocks, index, index - 1))}
              >
                <ArrowUp />
              </IconButton>
              <IconButton
                label="Sposta giù (⌥↓)"
                disabled={index === blocks.length - 1}
                onClick={() => setBlocks(move(blocks, index, index + 1))}
              >
                <ArrowDown />
              </IconButton>
              <IconButton label="Duplica (⌘D)" disabled={!canAdd} onClick={() => duplicate(index)}>
                <Copy />
              </IconButton>
              <IconButton label="Elimina (⌫)" onClick={() => remove(index)}>
                <Trash2 />
              </IconButton>
            </div>
            <div className="p-4">
              {(() => {
                const def = defs.find((d) => d.name === current._type)
                if (!def) return null
                return (
                  <FieldsForm
                    fields={def.fields}
                    value={current}
                    path={[blocksField.name, index]}
                    onChange={(v, group) => updateBlock(index, v as Block, group)}
                  />
                )
              })()}
            </div>
          </div>
        ) : (
          <div>
            <div className="sticky top-0 z-10 flex h-11 items-center gap-2 border-b border-line bg-panel px-4">
              <FileText className="size-4 text-fg2" />
              <span className="text-[13px] font-semibold">Pagina</span>
            </div>
            <div className="p-4">
              <FieldsForm
                fields={collection.fields}
                value={data}
                path={[]}
                onChange={onChange}
                skip={[blocksField.name]}
              />
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}

function Canvas({ device, children, onBackground }: { device: Device; children: ReactNode; onBackground: () => void }) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const width = WIDTH[device]
  useLayoutEffect(() => {
    const el = outer.current
    if (!el) return
    const fit = () => setScale(Math.min(1, (el.clientWidth - 64) / width))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div
      ref={outer}
      data-canvas
      role="presentation"
      className="mz-dots min-h-0 flex-1 overflow-y-auto"
      onPointerDown={(e) => e.target === e.currentTarget && onBackground()}
    >
      <div
        role="presentation"
        className="flex justify-center px-8 py-8"
        onPointerDown={(e) => e.target === e.currentTarget && onBackground()}
      >
        <div
          className="@container overflow-hidden rounded-md bg-white font-sans text-neutral-900 shadow-[0_0_0_1px_rgba(0,0,0,.06),0_8px_40px_rgba(0,0,0,.08)] transition-[width] duration-200"
          style={{ width, zoom: scale }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function AddButton({
  defs,
  onPick,
  compact,
}: {
  defs: BlockDef[]
  onPick: (def: BlockDef) => void
  compact?: boolean
}) {
  return (
    <Popover
      width={300}
      align={compact ? 'start' : 'center'}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          onClick={toggle}
          className={cx(
            'inline-flex items-center gap-1.5 font-medium',
            compact
              ? 'h-7 rounded-md px-2 text-[12px] text-fg2 hover:bg-hover hover:text-fg'
              : 'h-9 rounded-full border border-dashed border-neutral-300 px-4 text-[13px] text-neutral-500 hover:border-[#3d5afe] hover:text-[#3d5afe]',
          )}
        >
          <Plus className="size-4" /> Aggiungi blocco
        </button>
      )}
    >
      {(close) => (
        <BlockLibrary
          blocks={defs}
          onPick={(d) => {
            onPick(d)
            close()
          }}
        />
      )}
    </Popover>
  )
}

/** Thin line between blocks that reveals a "+" on hover. */
function Inserter({ defs, onPick }: { defs: BlockDef[]; onPick: (def: BlockDef) => void }) {
  return (
    <div className="group/ins relative z-20 h-0">
      <div className="absolute inset-x-0 -top-3 flex h-6 items-center justify-center opacity-0 transition-opacity group-hover/ins:opacity-100 has-[[aria-expanded=true]]:opacity-100">
        <div className="absolute inset-x-0 top-1/2 h-0.5 bg-[#3d5afe]" />
        <Popover
          width={300}
          align="center"
          trigger={({ toggle, ref, open }) => (
            <button
              ref={ref}
              type="button"
              aria-expanded={open}
              aria-label="Inserisci un blocco qui"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggle}
              className="relative flex size-6 items-center justify-center rounded-full bg-[#3d5afe] text-white shadow"
            >
              <Plus className="size-4" />
            </button>
          )}
        >
          {(close) => (
            <BlockLibrary
              blocks={defs}
              onPick={(d) => {
                onPick(d)
                close()
              }}
            />
          )}
        </Popover>
      </div>
    </div>
  )
}

function EmptyPage({ defs, onPick }: { defs: BlockDef[]; onPick: (def: BlockDef) => void }) {
  return (
    <div className="px-10 py-24 text-center">
      <div className="text-[22px] font-semibold tracking-tight text-neutral-900">La pagina è vuota</div>
      <p className="mt-2 text-[15px] text-neutral-500">Componila con i blocchi: scegli da dove partire.</p>
      <div className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-3 @3xl:grid-cols-3">
        {defs.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => onPick(d)}
            className="flex flex-col items-start gap-3 rounded-xl border border-neutral-200 p-4 text-left transition-colors hover:border-[#3d5afe] hover:bg-[#3d5afe]/[0.03] [&_svg]:size-5 [&_svg]:text-neutral-500"
          >
            {blockIcon(d.name)}
            <span className="text-[14px] font-medium text-neutral-900">{d.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function Layers({
  blocks,
  defs,
  selected,
  onSelect,
  onMove,
  onAdd,
  canAdd,
  issues,
  path,
}: {
  blocks: Block[]
  defs: BlockDef[]
  selected: string | null
  onSelect: (key: string | null) => void
  onMove: (from: number, to: number) => void
  onAdd: (def: BlockDef) => void
  canAdd: boolean
  issues: ValidationIssue[]
  path: string
}) {
  const [drag, setDrag] = useState<{ from: number; over: number | null } | null>(null)

  const onDragOver = (e: DragEvent, i: number) => {
    if (!drag) return
    e.preventDefault()
    const r = e.currentTarget.getBoundingClientRect()
    const over = e.clientY < r.top + r.height / 2 ? i : i + 1
    if (over !== drag.over) setDrag({ ...drag, over })
  }
  const onDrop = () => {
    if (drag && drag.over !== null) {
      const to = drag.over > drag.from ? drag.over - 1 : drag.over
      onMove(drag.from, to)
    }
    setDrag(null)
  }

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-11 items-center justify-between border-b border-line pr-2 pl-4">
        <span className="text-[13px] font-semibold">Livelli</span>
        {canAdd && (
          <Popover
            width={300}
            side="right"
            trigger={({ toggle, ref }) => (
              <IconButton ref={ref} label="Aggiungi blocco" onClick={toggle}>
                <Plus />
              </IconButton>
            )}
          >
            {(close) => (
              <BlockLibrary
                blocks={defs}
                onPick={(d) => {
                  onAdd(d)
                  close()
                }}
              />
            )}
          </Popover>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={cx(
            'flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]',
            selected === null ? 'bg-accent/10 font-medium text-accent' : 'text-fg2 hover:bg-hover hover:text-fg',
          )}
        >
          <FileText className="size-4" />
          Pagina
        </button>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: drop zone for the rows below */}
        <div
          className="mt-0.5 pl-2"
          onDragLeave={(e) => e.currentTarget === e.target && setDrag((d) => d && { ...d, over: null })}
        >
          {blocks.map((block, i) => {
            const def = defs.find((d) => d.name === block._type)
            const title = def ? blockTitle(def.fields, block) : undefined
            const errors = countIssuesUnder(issues, `${path}.${i}`)
            return (
              <div key={block._key} className="relative">
                {drag?.over === i && <div className="absolute -top-px right-1 left-1 h-0.5 rounded bg-accent" />}
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move'
                    setDrag({ from: i, over: null })
                  }}
                  onDragEnd={() => setDrag(null)}
                  onDragOver={(e) => onDragOver(e, i)}
                  onDrop={onDrop}
                  onClick={() => onSelect(block._key)}
                  className={cx(
                    'group flex h-8 w-full items-center gap-2 rounded-md pr-1.5 pl-1 text-left text-[13px] [&>svg]:size-4 [&>svg]:shrink-0',
                    selected === block._key ? 'bg-accent/10 text-accent' : 'text-fg2 hover:bg-hover hover:text-fg',
                    drag?.from === i && 'opacity-40',
                  )}
                >
                  <GripVertical className="!size-3.5 cursor-grab text-fg3 opacity-0 group-hover:opacity-100" />
                  {blockIcon(block._type)}
                  <span className={cx('truncate', selected === block._key && 'font-medium')}>
                    {title ?? def?.label ?? block._type}
                  </span>
                  {errors > 0 && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-danger" />}
                </button>
                {drag?.over === blocks.length && i === blocks.length - 1 && (
                  <div className="absolute right-1 -bottom-px left-1 h-0.5 rounded bg-accent" />
                )}
              </div>
            )
          })}
        </div>
        {blocks.length === 0 && (
          <p className="px-2 py-3 text-[12px] text-fg3">Nessun blocco. Aggiungine uno dalla tela.</p>
        )}
      </div>
    </aside>
  )
}
