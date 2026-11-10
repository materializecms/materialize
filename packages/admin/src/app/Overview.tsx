import { useQuery } from '@tanstack/react-query'
import { ArrowRight, ArrowUpRight, ImagePlus, Plus, SlidersHorizontal, Sparkles, UserPlus } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useAiReady } from '../components/AiMenu.tsx'
import { Button, cx, Spinner, StatusBadge, TintIcon } from '../components/ui.tsx'
import { api, type DocumentSummary, thumb } from '../lib/api.ts'
import { fullDate, relativeTime, whenDate } from '../lib/format.ts'
import { intlLocale, t, tn } from '../lib/i18n.ts'
import { href, navigate, type Route } from '../lib/router.ts'
import { useUpdateNotice } from '../settings/UpdatesSettings.tsx'
import { BriefDialog } from './BriefDialog.tsx'
import { useSession } from './context.ts'
import { useReleases } from './ReleasesScreen.tsx'
import { collectionIcon, useCollectionTint, useOverview } from './Sidebar.tsx'
import { Studio } from './Studio.tsx'

function greeting(name: string) {
  const hour = new Date().getHours()
  const first = name.split(' ')[0] ?? name
  if (hour < 5) return t('Buonanotte, {name}', { name: first })
  if (hour < 13) return t('Buongiorno, {name}', { name: first })
  if (hour < 18) return t('Buon pomeriggio, {name}', { name: first })
  return t('Buonasera, {name}', { name: first })
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
  const aiReady = useAiReady()
  const [briefOpen, setBriefOpen] = useState(false)
  const canBuild = aiReady && user.role === 'admin'
  const releases = useReleases()
  const schedules = useQuery({ queryKey: ['schedules'], queryFn: api.schedules, staleTime: 30_000 })
  const messages = useQuery({
    queryKey: ['submissions', { status: 'unread', limit: 1 }],
    queryFn: () => api.submissions({ status: 'unread', limit: 1 }),
    staleTime: 30_000,
  })
  const lists = schema.collections.filter((c) => !c.singleton)
  const singletons = schema.collections.filter((c) => c.singleton)
  const pages = lists.find((c) => /page|pagin/.test(c.name)) ?? lists[0]
  const counts = overview.data?.counts ?? []
  const toPublish = counts.reduce((n, c) => n + c.drafts + c.changed, 0)
  const waiting = (overview.data?.recent ?? []).filter((d) => d.status !== 'published').slice(0, 3)
  const release = releases.data?.releases[0] ?? null
  const next = schedules.data?.items[0] ?? null
  const unread = messages.data?.unread ?? 0
  const update = useUpdateNotice()
  const lastMessage = messages.data?.items[0] ?? null
  const today = new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(
    new Date(),
  )
  const summary = [
    toPublish ? tn(toPublish, 'un documento da pubblicare', '{n} documenti da pubblicare') : '',
    release ? (release.status === 'failed' ? t('un rilascio non uscito') : t('un rilascio in preparazione')) : '',
    unread ? tn(unread, 'un messaggio nuovo', '{n} messaggi nuovi') : '',
  ].filter(Boolean)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1080px] space-y-8 px-4 pt-8 pb-20 sm:px-8 sm:pt-12">
        <header data-tour="overview-head" className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[13px] font-medium text-fg3 first-letter:uppercase">
              {today} · {schema.site.name}
            </p>
            <h1 className="mt-1 text-[30px] leading-tight font-semibold tracking-[-0.03em]">{greeting(user.name)}</h1>
            <p className="mt-1.5 text-[14px] text-fg2">
              {overview.isPending
                ? t('Un attimo…')
                : summary.length
                  ? t('Ti aspettano {list}.', {
                      list: new Intl.ListFormat(intlLocale(), { type: 'conjunction' }).format(summary),
                    })
                  : t('Tutto il sito è pubblicato e aggiornato.')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<ArrowUpRight className="size-4" />} onClick={() => window.open('/', '_blank', 'noopener')}>
              {t('Apri il sito')}
            </Button>
            {canBuild && (
              <Button icon={<Sparkles className="size-4 text-accent" />} onClick={() => setBriefOpen(true)}>
                {t('Sito da un brief')}
              </Button>
            )}
            {pages && (
              <Button
                variant="primary"
                icon={<Plus className="size-4" />}
                onClick={() => navigate({ name: 'new', collection: pages.name })}
              >
                {/page|pagin/.test(pages.name)
                  ? t('Nuova pagina')
                  : t('Aggiungi in {collection}', { collection: pages.label })}
              </Button>
            )}
          </div>
        </header>

        {aiReady && (
          <div data-tour="studio">
            <Studio />
          </div>
        )}

        {(waiting.length > 0 || release || next || unread > 0 || update) && (
          <section
            data-tour="todo"
            aria-label={t('Da fare')}
            className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3"
          >
            {waiting.length > 0 && (
              <Todo label={t('Da pubblicare')} color="var(--accent)">
                <ul className="space-y-1">
                  {waiting.map((d) => {
                    const c = schema.collections.find((x) => x.name === d.collection)
                    return (
                      <li key={d.id}>
                        <a
                          {...go({ name: 'document', collection: d.collection, id: d.id })}
                          className="flex items-center gap-2 rounded-md py-0.5 font-medium hover:text-accent"
                        >
                          <span className="min-w-0 flex-1 truncate">{c?.singleton ? c.label : d.title}</span>
                          <StatusBadge status={d.status} short />
                        </a>
                      </li>
                    )
                  })}
                </ul>
                {toPublish > waiting.length && (
                  <p className="text-[12.5px] text-fg3">
                    {t('e altri {n} negli elenchi', { n: toPublish - waiting.length })}
                  </p>
                )}
              </Todo>
            )}
            {release && (
              <Todo label={release.status === 'failed' ? t('Rilascio non uscito') : t('Rilascio')} color="#f97316">
                <p className="font-semibold">{release.name}</p>
                <p className="text-[13px] text-fg2">
                  {release.status === 'failed'
                    ? (release.error ?? t('Qualcosa non era pronto.'))
                    : [
                        tn(release.items.length, '1 pagina', '{n} pagine'),
                        release.runAt ? t('esce {when}', { when: whenDate(release.runAt) }) : t('senza data di uscita'),
                      ].join(', ') + (release.ready ? '.' : t(': qualcosa non è ancora pronto.'))}
                </p>
                <a {...go({ name: 'releases' })} className="text-[13px] font-medium text-accent hover:underline">
                  {release.runAt && release.status !== 'failed' ? t('Apri i rilasci →') : t('Programma l’uscita →')}
                </a>
              </Todo>
            )}
            {next && (
              <Todo label={t('In uscita')} color="#0ea5e9">
                <p className="font-semibold">{next.title}</p>
                <p className="text-[13px] text-fg2">
                  {next.action === 'publish'
                    ? t('Esce {when}', { when: whenDate(next.runAt) })
                    : t('Si toglie dal sito {when}', { when: whenDate(next.runAt) })}
                  {schedules.data && schedules.data.items.length > 1
                    ? t(', poi altre {n} programmazioni', { n: schedules.data.items.length - 1 })
                    : ''}
                  .
                </p>
              </Todo>
            )}
            {update && (
              <Todo label={t('Aggiornamento')} color="#8b5cf6">
                <p className="font-semibold">{t('È disponibile Materialize {version}', { version: update.version })}</p>
                {update.headline && <p className="line-clamp-2 text-[13px] text-fg2">{update.headline}</p>}
                <a
                  {...go({ name: 'settings', tab: 'updates' })}
                  className="text-[13px] font-medium text-accent hover:underline"
                >
                  {update.installable ? t('Vedi le novità e aggiorna →') : t('Vedi le novità →')}
                </a>
              </Todo>
            )}
            {unread > 0 && (
              <Todo label={t('Messaggi')} color="#10b981">
                <p className="font-semibold">{tn(unread, 'Un messaggio nuovo', '{n} messaggi nuovi')}</p>
                {lastMessage && (
                  <p className="line-clamp-2 text-[13px] text-fg2">
                    {lastMessage.formName || t('Modulo')}, {relativeTime(lastMessage.createdAt)}
                  </p>
                )}
                <a
                  {...go({ name: 'settings', tab: 'messages' })}
                  className="text-[13px] font-medium text-accent hover:underline"
                >
                  {t('Leggi →')}
                </a>
              </Todo>
            )}
          </section>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section
            data-tour="recent"
            className="rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgb(10_10_11/0.04)]"
          >
            <h2 className="flex h-12 items-center border-b border-line px-4 text-[14px] font-semibold">
              {t('Ultime modifiche')}
            </h2>
            {overview.isPending ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : !overview.data?.recent.length ? (
              <p className="px-4 py-10 text-center text-fg2">{t('Ancora nessun documento: crea la prima pagina.')}</p>
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
                          <span className="block truncate text-[13px] text-fg3">
                            {c.label}
                            {doc.updatedBy && ` · ${doc.updatedBy}`}
                          </span>
                        </span>
                        <StatusBadge status={doc.status} short />
                        <span
                          className="hidden w-24 shrink-0 text-right text-[13px] text-fg3 tabular-nums sm:block"
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
            <h2 className="px-1 text-[14px] font-semibold">{t('Il sito a colpo d’occhio')}</h2>
            <div className="grid grid-cols-2 gap-2">
              {lists.map((c) => {
                const row = counts.find((r) => r.collection === c.name)
                const total = row?.total ?? 0
                return (
                  <a
                    key={c.name}
                    {...go({ name: 'collection', collection: c.name })}
                    className="group rounded-xl border border-line bg-panel p-3 transition-colors hover:border-line2"
                  >
                    <span className="flex items-center gap-2 text-[12.5px] font-medium text-fg2">
                      <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: tint(c.name) }} />
                      {c.label}
                    </span>
                    <span className="mt-1 block text-[24px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                      {overview.isPending ? '–' : total}
                    </span>
                    <span className="mt-1 block text-[12px] text-fg3">
                      {t('{n} online', { n: total - (row?.drafts ?? 0) })}
                      {row?.drafts ? ` · ${t('{n} in bozza', { n: row.drafts })}` : ''}
                    </span>
                  </a>
                )
              })}
              <a {...go({ name: 'media' })} className="rounded-xl border border-line bg-panel p-3 hover:border-line2">
                <span className="flex items-center gap-2 text-[12.5px] font-medium text-fg2">
                  <span aria-hidden="true" className="size-2 rounded-[2px] bg-[#0ea5e9]" />
                  {t('Media')}
                </span>
                <span className="mt-1 block text-[24px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                  {overview.data?.media ?? '–'}
                </span>
                <span className="mt-1 block text-[12px] text-fg3">{t('immagini')}</span>
              </a>
            </div>
            <h2 className="px-1 pt-3 text-[14px] font-semibold">{t('Azioni rapide')}</h2>
            {lists.slice(0, 3).map((c) => (
              <Action
                key={c.name}
                route={{ name: 'new', collection: c.name }}
                icon={<Plus />}
                color={tint(c.name)}
                title={t('Aggiungi in {collection}', { collection: c.label })}
              />
            ))}
            <Action route={{ name: 'media' }} icon={<ImagePlus />} color="#0ea5e9" title={t('Carica immagini')} />
            {user.role === 'admin' && (
              <Action route={{ name: 'people' }} icon={<UserPlus />} color="#8b5cf6" title={t('Invita una persona')} />
            )}
            {singletons.map((c) => (
              <Action
                key={c.name}
                route={{ name: 'settings', tab: c.name }}
                icon={<SlidersHorizontal />}
                color="var(--text2)"
                title={c.label}
              />
            ))}
          </aside>
        </div>
      </div>
      {canBuild && <BriefDialog open={briefOpen} onClose={() => setBriefOpen(false)} />}
    </div>
  )
}

/** A thing waiting for someone, with the block of colour of its kind. */
function Todo({ label, color, children }: { label: string; color: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-panel p-4 shadow-[0_1px_2px_rgb(10_10_11/0.04)]">
      <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.07em] text-fg2 uppercase">
        <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ background: color }} />
        {label}
      </span>
      {children}
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
