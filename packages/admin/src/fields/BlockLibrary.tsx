import {
  AlignLeft,
  BarChart3,
  CircleHelp,
  Images,
  LayoutGrid,
  Mail,
  MousePointerClick,
  PanelTop,
  Quote,
  Square,
  Tag,
  Users,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Input } from '../components/ui.tsx'
import type { FieldDescription } from '../lib/api.ts'

export type BlockDef = NonNullable<FieldDescription['blocks']>[number]

export function blockIcon(name: string): ReactNode {
  const n = name.toLowerCase()
  if (/hero|header|banner/.test(n)) return <PanelTop />
  if (/text|content|prose|rich/.test(n)) return <AlignLeft />
  if (/grid|list|projects|cards|features/.test(n)) return <LayoutGrid />
  if (/cta|action|invito/.test(n)) return <MousePointerClick />
  if (/gallery|images|photos/.test(n)) return <Images />
  if (/quote|testimonial/.test(n)) return <Quote />
  if (/faq|question/.test(n)) return <CircleHelp />
  if (/team|people/.test(n)) return <Users />
  if (/stat|number|metric/.test(n)) return <BarChart3 />
  if (/price|pricing|plan/.test(n)) return <Tag />
  if (/form|contact|newsletter/.test(n)) return <Mail />
  return <Square />
}

/** Searchable list of the block types a page accepts. */
export function BlockLibrary({ blocks, onPick }: { blocks: BlockDef[]; onPick: (block: BlockDef) => void }) {
  const [search, setSearch] = useState('')
  const q = search.trim().toLowerCase()
  const shown = blocks.filter((b) => !q || `${b.label} ${b.name} ${b.description ?? ''}`.toLowerCase().includes(q))
  return (
    <div>
      {blocks.length > 6 && (
        <div className="border-b border-line p-1.5">
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca un blocco…"
            className="border-0 focus:ring-0"
          />
        </div>
      )}
      <div className="max-h-80 overflow-y-auto p-1">
        <div className="px-2 pt-1.5 pb-1 text-[12px] font-medium text-fg3">Aggiungi un blocco</div>
        {shown.map((b) => (
          <button
            key={b.name}
            type="button"
            onClick={() => onPick(b)}
            className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-hover"
          >
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-panel2 text-fg2 [&_svg]:size-4">
              {blockIcon(b.name)}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium">{b.label}</span>
              <span className="block truncate text-[13px] text-fg3">
                {b.description ?? `${b.fields.length} ${b.fields.length === 1 ? 'campo' : 'campi'}`}
              </span>
            </span>
          </button>
        ))}
        {!shown.length && <div className="px-2 py-4 text-center text-[13px] text-fg3">Nessun blocco</div>}
      </div>
    </div>
  )
}
