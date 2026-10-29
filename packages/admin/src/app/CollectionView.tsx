import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, EmptyState, Input, Spinner, StatusBadge } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { href, navigate } from '../lib/router.ts'
import { useSession } from './context.ts'
import { collectionIcon } from './Sidebar.tsx'

const PAGE = 50

export function CollectionView({ collection }: { collection: CollectionDescription }) {
  const { locale } = useSession()
  const [search, setSearch] = useState('')
  const [debounced, setDebounced] = useState('')
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 200)
    return () => clearTimeout(t)
  }, [search])

  const list = useQuery({
    queryKey: ['list', collection.name, locale, debounced, limit],
    queryFn: () => api.list(collection.name, { locale, search: debounced, limit }),
    placeholderData: keepPreviousData,
  })

  // A singleton is a single document: open it directly.
  useEffect(() => {
    if (!collection.singleton || !list.data) return
    const doc = list.data.items[0]
    navigate(
      doc
        ? { name: 'document', collection: collection.name, id: doc.id }
        : { name: 'new', collection: collection.name },
      {
        replace: true,
      },
    )
  }, [collection, list.data])

  const create = () => navigate({ name: 'new', collection: collection.name })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
        <span className="text-fg3 [&_svg]:size-4">{collectionIcon(collection)}</span>
        <h1 className="text-[14px] font-semibold">{collection.label}</h1>
        {list.data && <span className="text-fg3 tabular-nums">{list.data.total}</span>}
        <div className="flex-1" />
        <div className="relative w-56">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg3" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cerca in ${collection.label.toLowerCase()}`}
            className="pl-8"
            aria-label="Cerca"
          />
        </div>
        <Button variant="primary" icon={<Plus className="size-4" />} onClick={create}>
          Nuovo
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list.isPending || collection.singleton ? (
          <div className="flex justify-center py-20">
            <Spinner />
          </div>
        ) : list.error ? (
          <EmptyState icon={collectionIcon(collection)} title="Impossibile caricare l’elenco">
            {list.error.message}
          </EmptyState>
        ) : list.data.items.length === 0 ? (
          debounced ? (
            <EmptyState icon={<Search />} title="Nessun risultato">
              Nessun documento contiene “{debounced}”.
            </EmptyState>
          ) : (
            <EmptyState icon={collectionIcon(collection)} title={`Ancora nessun elemento in ${collection.label}`}>
              <Button variant="primary" className="mt-3" icon={<Plus className="size-4" />} onClick={create}>
                Crea il primo
              </Button>
            </EmptyState>
          )
        ) : (
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-bg/95 backdrop-blur">
              <tr className="border-b border-line text-[12px] text-fg3">
                <th className="py-2 pr-3 pl-5 font-medium">Titolo</th>
                <th className="w-52 px-3 py-2 font-medium">Stato</th>
                <th className="w-40 py-2 pr-5 pl-3 text-right font-medium">Modificato</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((doc) => (
                <tr key={doc.id} className="group border-b border-line transition-colors hover:bg-panel">
                  <td className="py-0 pr-3 pl-5">
                    <a
                      href={href({ name: 'document', collection: collection.name, id: doc.id })}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey) return
                        e.preventDefault()
                        navigate({ name: 'document', collection: collection.name, id: doc.id })
                      }}
                      className="flex min-h-11 flex-col justify-center py-2"
                    >
                      <span className="font-medium text-fg">{doc.title}</span>
                      {doc.slug && <span className="font-mono text-[11.5px] text-fg3">/{doc.slug}</span>}
                    </a>
                  </td>
                  <td className="px-3">
                    <StatusBadge status={doc.status} />
                  </td>
                  <td className="py-0 pr-5 pl-3 text-right text-fg2 tabular-nums" title={fullDate(doc.updatedAt)}>
                    {relativeTime(doc.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
