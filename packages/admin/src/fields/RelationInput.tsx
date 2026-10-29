import { useQueries, useQuery } from '@tanstack/react-query'
import { Check, Plus, Search, X } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { cx, Input, Popover, Spinner, StatusBadge } from '../components/ui.tsx'
import { api } from '../lib/api.ts'

export function useDocumentTitles(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({ queryKey: ['doc', id], queryFn: () => api.get(id), staleTime: 30_000 })),
  })
}

export function RelationInput({
  to,
  many,
  value,
  onChange,
  invalid,
}: {
  to: string
  many: boolean
  value: string | string[] | undefined
  onChange: (value: string | string[] | undefined) => void
  invalid?: boolean
}) {
  const { schema, locale } = useSession()
  const target = schema.collections.find((c) => c.name === to)
  const ids = many ? ((value as string[] | undefined) ?? []) : value ? [value as string] : []
  const docs = useDocumentTitles(ids)
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const list = useQuery({
    queryKey: ['list', to, locale, search.trim(), 20],
    queryFn: () => api.list(to, { locale, search: search.trim(), limit: 20 }),
    enabled: open,
  })

  const toggle = (id: string) => {
    if (!many) {
      onChange(ids[0] === id ? undefined : id)
      setOpen(false)
      return
    }
    onChange(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id])
  }

  return (
    <div
      className={cx(
        'flex min-h-8 flex-wrap items-center gap-1 rounded-md border bg-input p-1',
        invalid ? 'border-danger' : 'border-line2',
      )}
    >
      {ids.map((id, i) => {
        const doc = docs[i]?.data
        return (
          <span
            key={id}
            className="inline-flex h-6 items-center gap-1 rounded bg-seg pr-0.5 pl-2 text-[12px] font-medium"
          >
            {doc ? doc.title : docs[i]?.isError ? <span className="text-fg3">Eliminato</span> : '…'}
            <button
              type="button"
              aria-label="Rimuovi"
              onClick={() => toggle(id)}
              className="flex size-5 items-center justify-center rounded text-fg3 hover:bg-hover hover:text-fg"
            >
              <X className="size-3" />
            </button>
          </span>
        )
      })}
      <Popover
        width={300}
        open={open}
        onOpenChange={setOpen}
        trigger={({ toggle: t, ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={t}
            className="inline-flex h-6 items-center gap-1 rounded px-1.5 text-[12px] text-fg3 hover:bg-hover hover:text-fg"
          >
            <Plus className="size-3.5" />
            {ids.length && !many ? 'Cambia' : `Scegli da ${target?.label ?? to}`}
          </button>
        )}
      >
        <div className="border-b border-line p-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca…"
              className="border-0 pl-8 focus:ring-0"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {list.isPending ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : list.data?.items.length ? (
            list.data.items.map((doc) => (
              <button
                key={doc.id}
                type="button"
                onClick={() => toggle(doc.id)}
                className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-hover"
              >
                <span className="flex-1 truncate text-[13px]">{doc.title}</span>
                <StatusBadge status={doc.status} short />
                <Check className={cx('size-4 text-accent', !ids.includes(doc.id) && 'invisible')} />
              </button>
            ))
          ) : (
            <div className="px-2 py-4 text-center text-[12px] text-fg3">Nessun elemento</div>
          )}
        </div>
      </Popover>
    </div>
  )
}
