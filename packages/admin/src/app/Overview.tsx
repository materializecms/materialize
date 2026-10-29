import { ArrowRight, ArrowUpRight, ImagePlus, Images, Plus, SlidersHorizontal, UserPlus } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, cx, Spinner, StatusBadge, TintIcon } from '../components/ui.tsx'
import { type DocumentSummary, thumb } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { href, navigate, type Route } from '../lib/router.ts'
import { useSession } from './context.ts'
import { collectionIcon, useCollectionTint, useOverview } from './Sidebar.tsx'

function greeting(name: string) {
  const hour = new Date().getHours()
  const first = name.split(' ')[0] ?? name
  if (hour < 5) return `Buonanotte, ${first}`
  if (hour < 13) return `Buongiorno, ${first}`
  if (hour < 18) return `Buon pomeriggio, ${first}`
  return `Buonasera, ${first}`
}

/** Plain links that open in-app, or in a new tab with ⌘. */
function go(route: Route) {
  return {
    href: href(route),
    onClick: (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return
      e.preventDefault()
      navigate(route)
    },
  }
}

export function Overview() {
  const { schema, user } = useSession()
  const overview = useOverview()
  const tint = useCollectionTint()
  const lists = schema.collections.filter((c) => !c.singleton)
  const singletons = schema.collections.filter((c) => c.singleton)
  const pages = lists.find((c) => /page|pagin/.test(c.name)) ?? lists[0]
  const counts = overview.data?.counts ?? []
  const toPublish = counts.reduce((n, c) => n + c.drafts + c.changed, 0)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1080px] px-8 pt-12 pb-20">
        <header className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[12.5px] font-medium text-fg3">{schema.site.name}</p>
            <h1 className="mt-1 text-[30px] leading-tight font-semibold tracking-[-0.03em]">{greeting(user.name)}</h1>
            <p className="mt-1.5 text-[14px] text-fg2">
              {overview.isPending
                ? 'Un attimo…'
                : toPublish === 0
                  ? 'Tutto il sito è pubblicato e aggiornato.'
                  : toPublish === 1
                    ? 'C’è un documento da pubblicare.'
                    : `Ci sono ${toPublish} documenti da pubblicare.`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button icon={<ArrowUpRight className="size-4" />} onClick={() => window.open('/', '_blank', 'noopener')}>
              Apri il sito
            </Button>
            {pages && (
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => navigate({ name: 'new', collection: pages.name })}
              >
                {/page|pagin/.test(pages.name) ? 'Nuova pagina' : `Aggiungi in ${pages.label}`}
              </Button>
            )}
          </div>
        </header>

        <section className="mt-10 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {lists.map((c) => {
            const row = counts.find((r) => r.collection === c.name)
            const total = row?.total ?? 0
            const published = total - (row?.drafts ?? 0)
            return (
              <a
                key={c.name}
                {...go({ name: 'collection', collection: c.name })}
                className="group relative overflow-hidden rounded-xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-line2 hover:shadow-pop"
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-10 -right-10 size-28 rounded-full opacity-[0.07] blur-xl transition-opacity group-hover:opacity-[0.14]"
                  style={{ background: tint(c.name) }}
                />
                <div className="flex items-center justify-between">
                  <TintIcon color={tint(c.name)}>{collectionIcon(c)}</TintIcon>
                  <ArrowRight className="size-4 -translate-x-1 text-fg3 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </div>
                <div className="mt-4 text-[13px] font-medium text-fg2">{c.label}</div>
                <div className="mt-0.5 text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {overview.isPending ? '–' : total}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 text-[12px] text-fg3">
                  <span>{published} online</span>
                  {!!row?.drafts && <span>{row.drafts} in bozza</span>}
                  {!!row?.changed && <span className="text-warn">{row.changed} da pubblicare</span>}
                </div>
              </a>
            )
          })}
          <a
            {...go({ name: 'media' })}
            className="group rounded-xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-[border-color,box-shadow,transform] hover:-translate-y-px hover:border-line2 hover:shadow-pop"
          >
            <div className="flex items-center justify-between">
              <TintIcon color="#0ea5e9">
                <Images />
              </TintIcon>
              <ArrowRight className="size-4 -translate-x-1 text-fg3 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
            <div className="mt-4 text-[13px] font-medium text-fg2">Media</div>
            <div className="mt-0.5 text-[28px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
              {overview.data?.media ?? '–'}
            </div>
            <div className="mt-2.5 text-[12px] text-fg3">immagini nella libreria</div>
          </a>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgb(10_10_11/0.04)]">
            <h2 className="flex h-12 items-center border-b border-line px-4 text-[13px] font-semibold">
              Modifiche recenti
            </h2>
            {overview.isPending ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !overview.data?.recent.length ? (
              <p className="px-4 py-10 text-center text-fg2">Ancora nessun documento: crea la prima pagina.</p>
            ) : (
              <ul>
                {overview.data.recent.map((doc) => {
                  const c = schema.collections.find((x) => x.name === doc.collection)
                  if (!c) return null
                  return (
                    <li key={doc.id} className="border-b border-line last:border-0">
                      <a
                        {...go({ name: 'document', collection: c.name, id: doc.id })}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover"
                      >
                        <Thumb doc={doc} fallback={<TintIcon color={tint(c.name)}>{collectionIcon(c)}</TintIcon>} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{c.singleton ? c.label : doc.title}</span>
                          <span className="block truncate text-[12px] text-fg3">
                            {c.label}
                            {doc.updatedBy && ` · ${doc.updatedBy}`}
                          </span>
                        </span>
                        <StatusBadge status={doc.status} short />
                        <span
                          className="w-24 shrink-0 text-right text-[12px] text-fg3 tabular-nums"
                          title={fullDate(doc.updatedAt)}
                        >
                          {relativeTime(doc.updatedAt)}
                        </span>
                      </a>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <aside className="space-y-3">
            <h2 className="px-1 text-[13px] font-semibold">Azioni rapide</h2>
            {lists.map((c) => (
              <Action
                key={c.name}
                route={{ name: 'new', collection: c.name }}
                icon={<Plus />}
                color={tint(c.name)}
                title={`Aggiungi in ${c.label}`}
              />
            ))}
            <Action route={{ name: 'media' }} icon={<ImagePlus />} color="#0ea5e9" title="Carica immagini" />
            {user.role === 'admin' && (
              <Action route={{ name: 'people' }} icon={<UserPlus />} color="#8b5cf6" title="Invita una persona" />
            )}
            {singletons.map((c) => (
              <Action
                key={c.name}
                route={{ name: 'collection', collection: c.name }}
                icon={<SlidersHorizontal />}
                color="var(--text2)"
                title={c.label}
              />
            ))}
          </aside>
        </div>
      </div>
    </div>
  )
}

function Action({ route, icon, color, title }: { route: Route; icon: ReactNode; color: string; title: string }) {
  return (
    <a
      {...go(route)}
      className="group flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5 shadow-[0_1px_2px_rgb(10_10_11/0.04)] transition-colors hover:border-line2"
    >
      <TintIcon color={color}>{icon}</TintIcon>
      <span className="flex-1 font-medium">{title}</span>
      <ArrowRight className="size-4 text-fg3 transition-transform group-hover:translate-x-0.5" />
    </a>
  )
}

/** A document's first image, or the collection's icon when it has none. */
export function Thumb({
  doc,
  fallback,
  className,
}: {
  doc: Pick<DocumentSummary, 'image' | 'title'>
  fallback: ReactNode
  className?: string
}) {
  if (!doc.image)
    return <span className={cx('flex size-9 shrink-0 items-center justify-center', className)}>{fallback}</span>
  return (
    <img
      src={thumb(doc.image, 320)}
      alt=""
      loading="lazy"
      className={cx('size-9 shrink-0 rounded-md bg-seg object-cover ring-1 ring-black/5', className)}
    />
  )
}
