import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { LayoutGrid, List, Plus, Search } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button, cx, EmptyState, Input, Segmented, Spinner, StatusBadge, TintIcon } from '../components/ui.tsx'
import { api, type CollectionDescription, type DocumentStatus, type DocumentSummary, thumb } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { usePref } from '../lib/prefs.ts'
import { href, navigate } from '../lib/router.ts'
import { useSession } from './context.ts'
import { BulkBar, ConfirmDelete, type ListActions, RowMenu, SelectBox, useListActions } from './ListActions.tsx'
import { Thumb } from './Overview.tsx'
import { collectionIcon, useCollectionTint } from './Sidebar.tsx'

const PAGE = 50
type Filter = 'all' | DocumentStatus

export function CollectionView({ collection }: { collection: CollectionDescription }) {
  const { locale } = useSession()
  const tint = useCollectionTint()(collection.name)
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = usePref<'list' | 'grid'>(`mz-view-${collection.name}`, 'list')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200)
    return () => clearTimeout(t)
  }, [search])

  const list = useQuery({
    queryKey: ['list', collection.name, locale, debounced, limit],
    queryFn: () => api.list(collection.name, { locale, search: debounced, limit }),
    placeholderData: keepPreviousData,
  })

  // A single document (site settings) lives in Impostazioni.
  useEffect(() => {
    if (collection.singleton) navigate({ name: 'settings', tab: collection.name }, { replace: true })
  }, [collection])

  const create = () => navigate({ name: 'new', collection: collection.name })
  const items = (list.data?.items ?? []).filter((d) => filter === 'all' || d.status === filter)

  // Several documents at once: tick them (⇧ for a range), then act on all of them.
  const actions = useListActions(collection)
  const { user } = useSession()
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState<DocumentSummary[] | null>(null)
  const anchor = useRef<string | null>(null)
  const picked = items.filter((d) => checked.has(d.id))
  const clear = () => setChecked(new Set())
  const toggle = (doc: DocumentSummary, e: React.MouseEvent) => {
    const next = new Set(checked)
    const from = anchor.current ? items.findIndex((d) => d.id === anchor.current) : -1
    const to = items.findIndex((d) => d.id === doc.id)
    if (e.shiftKey && from >= 0) {
      const on = !checked.has(doc.id)
      for (const d of items.slice(Math.min(from, to), Math.max(from, to) + 1))
        if (on) next.add(d.id)
        else next.delete(d.id)
    } else if (next.has(doc.id)) next.delete(doc.id)
    else next.add(doc.id)
    anchor.current = doc.id
    setChecked(next)
  }
  // Ticks of documents no longer shown (filtered, deleted) go away.
  const visible = items.map((d) => d.id).join()
  useEffect(() => {
    setChecked((old) => {
      const ids = new Set(visible.split(','))
      const next = new Set([...old].filter((id) => ids.has(id)))
      return next.size === old.size ? old : next
    })
  }, [visible])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest?.('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return
      if (e.key === 'Escape' && checked.size) clear()
      else if ((e.key === 'Backspace' || e.key === 'Delete') && checked.size && user.role === 'admin') {
        e.preventDefault()
        setDeleting(items.filter((d) => checked.has(d.id)))
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a' && items.length) {
        e.preventDefault()
        setChecked(new Set(items.map((d) => d.id)))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const confirmDelete = async () => {
    const ids = (deleting ?? []).map((d) => d.id)
    setDeleting(null)
    await actions.remove(ids)
    clear()
  }
  const countOf = (status: DocumentStatus) => list.data?.items.filter((d) => d.status === status).length ?? 0
  const icon = <TintIcon color={tint}>{collectionIcon(collection)}</TintIcon>

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 px-4 pt-6 sm:px-8 sm:pt-8">
        <div className="flex flex-wrap items-center gap-3">
          <TintIcon color={tint} size="lg">
            {collectionIcon(collection)}
          </TintIcon>
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.025em]">{collection.label}</h1>
            <p className="text-[13px] text-fg3">
              {list.data ? (list.data.total === 1 ? '1 documento' : `${list.data.total} documenti`) : ' '}
            </p>
          </div>
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
            Nuovo
          </Button>
        </div>

        <div className="mt-6 flex min-h-11 flex-wrap items-center gap-2 border-b border-line pb-3">
          {picked.length > 0 ? (
            <BulkBar
              count={picked.length}
              total={items.length}
              docs={picked}
              actions={actions}
              onSelectAll={() => setChecked(new Set(items.map((d) => d.id)))}
              onClear={clear}
              onDelete={() => setDeleting(picked)}
            />
          ) : (
            <>
              <div role="tablist" aria-label="Stato" className="flex gap-1">
                {(
                  [
                    ['all', 'Tutti', list.data?.items.length ?? 0],
                    ['published', 'Pubblicati', countOf('published')],
                    ['changed', 'Da pubblicare', countOf('changed')],
                    ['draft', 'Bozze', countOf('draft')],
                  ] as [Filter, string, number][]
                ).map(([value, label, n]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={filter === value}
                    onClick={() => setFilter(value)}
                    className={cx(
                      'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors',
                      filter === value ? 'bg-fg text-bg' : 'text-fg2 hover:bg-hover hover:text-fg',
                    )}
                  >
                    {label}
                    <span className={cx('tabular-nums', filter === value ? 'opacity-60' : 'text-fg3')}>{n}</span>
                  </button>
                ))}
              </div>
              <div className="flex-1" />
              <div className="relative w-full sm:w-60">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Cerca in ${collection.label.toLowerCase()}`}
                  className="pl-8"
                  aria-label="Cerca"
                />
              </div>
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: 'list', label: <List />, title: 'Elenco' },
                  { value: 'grid', label: <LayoutGrid />, title: 'Griglia' },
                ]}
              />
            </>
          )}
        </div>
      </header>
      <ConfirmDelete docs={deleting} onCancel={() => setDeleting(null)} onConfirm={() => void confirmDelete()} />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-2 pb-10 sm:px-8">
        {list.isPending || collection.singleton ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : list.error ? (
          <EmptyState icon={collectionIcon(collection)} title="Impossibile caricare l’elenco">
            {list.error.message}
          </EmptyState>
        ) : items.length === 0 ? (
          debounced ? (
            <EmptyState icon={<Search />} title="Nessun risultato">
              Nessun documento contiene “{debounced}”.
            </EmptyState>
          ) : filter !== 'all' ? (
            <EmptyState icon={collectionIcon(collection)} title="Niente qui">
              Nessun documento con questo stato.
            </EmptyState>
          ) : (
            <EmptyState icon={collectionIcon(collection)} title={`Ancora nessun elemento in ${collection.label}`}>
              <Button variant="primary" className="mt-3" icon={<Plus className="size-4" />} onClick={create}>
                Crea il primo
              </Button>
            </EmptyState>
          )
        ) : view === 'grid' ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-4 pt-3">
            {items.map((doc) => (
              <Card
                key={doc.id}
                collection={collection}
                doc={doc}
                icon={icon}
                checked={checked.has(doc.id)}
                selecting={checked.size > 0}
                onToggle={(e) => toggle(doc, e)}
                actions={actions}
                onDelete={(d) => setDeleting([d])}
              />
            ))}
          </div>
        ) : (
          <ul>
            {items.map((doc) => (
              <li
                key={doc.id}
                className={cx(
                  'group -mx-3 flex min-h-14 items-center gap-3 rounded-lg border-b border-line px-3 transition-colors last:border-0 hover:bg-hover',
                  checked.has(doc.id) && 'bg-accent/8 hover:bg-accent/12',
                )}
              >
                <SelectBox
                  checked={checked.has(doc.id)}
                  label={`Seleziona ${doc.title}`}
                  onToggle={(e) => toggle(doc, e)}
                  className={cx(!checked.size && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')}
                />
                <a
                  {...link(collection, doc, checked.size > 0 ? (e) => toggle(doc, e) : undefined)}
                  className="flex min-w-0 flex-1 items-center gap-3 self-stretch py-2"
                >
                  <Thumb doc={doc} fallback={icon} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-fg">{doc.title}</span>
                    {(doc.url || doc.slug) && (
                      <span className="block truncate font-mono text-[12px] text-fg3">{doc.url ?? `/${doc.slug}`}</span>
                    )}
                  </span>
                  <OtherLanguages doc={doc} />
                  <StatusBadge status={doc.status} short />
                  <span
                    className="hidden w-28 shrink-0 text-right text-[13px] text-fg3 tabular-nums sm:block"
                    title={fullDate(doc.updatedAt)}
                  >
                    {relativeTime(doc.updatedAt)}
                  </span>
                </a>
                <RowMenu collection={collection} doc={doc} actions={actions} onDelete={(d) => setDeleting([d])} />
              </li>
            ))}
          </ul>
        )}
        {list.data && list.data.total > list.data.items.length && (
          <div className="flex justify-center py-4">
            <Button size="sm" onClick={() => setLimit((l) => l + PAGE)} loading={list.isFetching}>
              Mostra altri
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/** Opens the document; while documents are selected, a click selects instead. */
function link(collection: CollectionDescription, doc: DocumentSummary, select?: (e: React.MouseEvent) => void) {
  const route = { name: 'document', collection: collection.name, id: doc.id } as const
  return {
    href: href(route),
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return
      e.preventDefault()
      if (select) select(e)
      else navigate(route)
    },
  }
}

function Card({
  collection,
  doc,
  icon,
  checked,
  selecting,
  onToggle,
  actions,
  onDelete,
}: {
  collection: CollectionDescription
  doc: DocumentSummary
  icon: React.ReactNode
  checked: boolean
  selecting: boolean
  onToggle: (e: React.MouseEvent) => void
  actions: ListActions
  onDelete: (doc: DocumentSummary) => void
}) {
  return (
    <div
      className={cx(
        'group relative overflow-hidden rounded-xl border bg-panel shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-[box-shadow,border-color,transform] hover:-translate-y-px hover:shadow-pop',
        checked ? 'border-accent ring-3 ring-accent/25' : 'border-line hover:border-line2',
      )}
    >
      <a {...link(collection, doc, selecting ? onToggle : undefined)} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-panel2">
          {doc.image ? (
            <img
              src={thumb(doc.image, 640)}
              alt=""
              loading="lazy"
              className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex size-full items-center justify-center bg-[radial-gradient(var(--dot)_1px,transparent_1px)] [background-size:14px_14px]">
              {icon}
            </div>
          )}
          <span className="absolute top-2.5 left-2.5 rounded-full bg-panel shadow-sm">
            <StatusBadge status={doc.status} short />
          </span>
        </div>
        <div className="px-3.5 py-3">
          <div className="truncate font-medium">{doc.title}</div>
          <div className="mt-0.5 flex justify-between gap-2 text-[13px] text-fg3">
            <span className="truncate font-mono">{doc.url ?? (doc.slug ? `/${doc.slug}` : '')}</span>
            <span className="shrink-0" title={fullDate(doc.updatedAt)}>
              {relativeTime(doc.updatedAt)}
            </span>
          </div>
        </div>
      </a>
      <SelectBox
        checked={checked}
        label={`Seleziona ${doc.title}`}
        onToggle={onToggle}
        className={cx(
          'absolute top-2.5 right-2.5 shadow-sm',
          !selecting && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
        )}
      />
      <RowMenu
        collection={collection}
        doc={doc}
        actions={actions}
        onDelete={onDelete}
        className="absolute top-1.5 right-9 bg-panel/90 shadow-sm backdrop-blur"
      />
    </div>
  )
}

/** The other languages a document exists in, as small codes ("EN FR"). */
function OtherLanguages({ doc }: { doc: DocumentSummary }) {
  const { schema } = useSession()
  if (schema.locales.available.length < 2) return null
  const others = (doc.locales ?? []).filter((l) => schema.locales.available.includes(l))
  return (
    <span
      className="flex shrink-0 gap-1"
      title={others.length ? `Anche in: ${others.join(', ')}` : 'Solo in questa lingua'}
    >
      {others.map((l) => (
        <span key={l} className="rounded border border-line px-1 font-mono text-[11px] leading-4 text-fg3 uppercase">
          {l}
        </span>
      ))}
    </span>
  )
}
