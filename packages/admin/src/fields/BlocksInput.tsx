import { ArrowDown, ArrowUp, ChevronRight, Copy, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, cx, IconButton, Popover } from '../components/ui.tsx'
import type { FieldDescription } from '../lib/api.ts'
import { blockTitle, countIssuesUnder, move, newBlock, newKey, type Path, pathKey } from '../lib/doc.ts'
import { BlockLibrary, blockIcon } from './BlockLibrary.tsx'
import type { Change } from './FieldInput.tsx'
import { FieldsForm } from './FieldInput.tsx'
import { useForm } from './form-context.ts'

type BlockValue = Record<string, unknown> & { _type: string; _key: string }

export function BlocksInput({
  field,
  value,
  onChange,
  path,
}: {
  field: FieldDescription
  value: Record<string, unknown>[]
  onChange: Change
  path: Path
}) {
  const blocks = value as BlockValue[]
  const defs = field.blocks ?? []
  const { issues } = useForm()
  const [open, setOpen] = useState<Set<string>>(() => new Set(blocks.length <= 2 ? blocks.map((b) => b._key) : []))
  const max = field.options.max as number | undefined

  const toggle = (key: string) =>
    setOpen((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  const add = (type: string, at = blocks.length) => {
    const def = defs.find((d) => d.name === type)
    if (!def) return
    const block = newBlock(type, def.fields) as BlockValue
    const next = [...blocks]
    next.splice(at, 0, block)
    onChange(next)
    setOpen((s) => new Set(s).add(block._key))
  }

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        const def = defs.find((d) => d.name === block._type)
        const expanded = open.has(block._key)
        const errors = countIssuesUnder(issues, pathKey([...path, i]))
        const title = def ? blockTitle(def.fields, block) : undefined
        return (
          <div
            key={block._key}
            data-path={pathKey([...path, i])}
            className={cx('rounded-lg border bg-panel', errors ? 'border-danger/60' : 'border-line')}
          >
            <div className="group flex h-10 items-center gap-1 pr-1.5 pl-1">
              <button
                type="button"
                onClick={() => toggle(block._key)}
                aria-expanded={expanded}
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 text-left hover:bg-hover"
              >
                <ChevronRight
                  className={cx('size-3.5 shrink-0 text-fg3 transition-transform', expanded && 'rotate-90')}
                />
                <span className="text-fg2 [&_svg]:size-4">{blockIcon(block._type)}</span>
                <span className="shrink-0 text-[14px] font-medium">{def?.label ?? block._type}</span>
                {title && <span className="truncate text-[13px] text-fg3">{title}</span>}
                {errors > 0 && (
                  <span className="ml-auto shrink-0 rounded-full bg-danger/12 px-1.5 text-[12px] font-medium text-danger">
                    {errors}
                  </span>
                )}
              </button>
              <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <IconButton label="Sposta su" disabled={i === 0} onClick={() => onChange(move(blocks, i, i - 1))}>
                  <ArrowUp />
                </IconButton>
                <IconButton
                  label="Sposta giù"
                  disabled={i === blocks.length - 1}
                  onClick={() => onChange(move(blocks, i, i + 1))}
                >
                  <ArrowDown />
                </IconButton>
                <IconButton
                  label="Duplica"
                  disabled={max !== undefined && blocks.length >= max}
                  onClick={() => {
                    const next = [...blocks]
                    next.splice(i + 1, 0, { ...structuredClone(block), _key: newKey() })
                    onChange(next)
                  }}
                >
                  <Copy />
                </IconButton>
                <IconButton label="Elimina" onClick={() => onChange(blocks.filter((_, j) => j !== i))}>
                  <Trash2 />
                </IconButton>
              </div>
            </div>
            {expanded && (
              <div className="border-t border-line px-4 py-4">
                {def ? (
                  <FieldsForm
                    fields={def.fields}
                    value={block}
                    path={[...path, i]}
                    onChange={(v, group) => {
                      const next = [...blocks]
                      next[i] = v as BlockValue
                      onChange(next, group)
                    }}
                  />
                ) : (
                  <p className="text-[13px] text-warn">
                    Il blocco “{block._type}” non esiste più nello schema. Puoi eliminarlo.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      {(max === undefined || blocks.length < max) && (
        <Popover
          width={300}
          trigger={({ toggle: t, ref }) => (
            <Button
              ref={ref}
              variant="ghost"
              icon={<Plus className="size-4" />}
              onClick={t}
              className="w-full border border-dashed border-line2"
            >
              Aggiungi blocco
            </Button>
          )}
        >
          {(close) => (
            <BlockLibrary
              blocks={defs}
              onPick={(b) => {
                add(b.name)
                close()
              }}
            />
          )}
        </Popover>
      )}
    </div>
  )
}
