import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  CalendarClock,
  Check,
  FileText,
  PackageCheck,
  Plus,
  Rocket,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  Button,
  cx,
  Dialog,
  EmptyState,
  IconButton,
  Input,
  Popover,
  ScreenHeader,
  Spinner,
  StatusBadge,
  toast,
} from '../components/ui.tsx'
import { ApiError, api, type DocumentSummary, type Release } from '../lib/api.ts'
import { relativeTime, whenDate } from '../lib/format.ts'
import { navigate } from '../lib/router.ts'
import { useSession } from './context.ts'
import { When } from './ScheduleMenu.tsx'

export const releasesKey = ['releases'] as const

export function useReleases() {
  return useQuery({ queryKey: releasesKey, queryFn: api.releases })
}

const fail = (error: unknown) => {
  if (error instanceof ApiError && error.code === 'release_not_ready') {
    toast('Alcune pagine non sono pronte: non è uscito niente', 'error')
    return
  }
  toast(error instanceof Error ? error.message : 'Errore', 'error')
}

/**
 * Releases: several pages and articles that go on (or off) the site together, by hand or at a
 * set time. All or nothing: if one is not ready, none goes out.
 */
export function ReleasesScreen() {
  const query = useReleases()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const active = query.data?.releases ?? []
  const published = query.data?.published ?? []

  const create = async () => {
    try {
      await api.createRelease(name.trim())
      setName('')
      setCreating(false)
      await queryClient.invalidateQueries({ queryKey: releasesKey })
    } catch (error) {
      fail(error)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <ScreenHeader
        icon={<Rocket />}
        color="#f97316"
        title="Rilasci"
        subtitle="Più pagine e articoli che escono insieme, subito o a un’ora stabilita"
        actions={
          <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>
            Nuovo rilascio
          </Button>
        }
      />
      <div className="mx-auto w-full max-w-[860px] space-y-4 px-4 pt-6 pb-20 sm:px-8">
        {query.isPending ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : !active.length ? (
          <EmptyState icon={<PackageCheck />} title="Nessun rilascio in preparazione">
            <p>
              Raccogli in un rilascio le pagine di un lancio, una collezione o una campagna: escono tutte nello stesso
              momento, e se una non è pronta non esce niente. Puoi anche togliere dal sito le pagine vecchie nello
              stesso istante.
            </p>
            <p className="mt-2">
              Aggiungi le pagine da qui o, dentro una pagina, da Altre azioni → Aggiungi a un rilascio.
            </p>
          </EmptyState>
        ) : (
          active.map((r) => <ReleaseCard key={r.id} release={r} />)
        )}

        {published.length > 0 && (
          <section className="pt-6">
            <h2 className="mb-2 px-1 text-[12px] font-semibold tracking-[0.06em] text-fg3 uppercase">Già usciti</h2>
            <ul className="divide-y divide-line rounded-xl border border-line bg-panel">
              {published.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Check className="size-4 shrink-0 text-ok" />
                  <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                  <span className="text-[13px] text-fg3">
                    {r.items.length === 1 ? '1 pagina' : `${r.items.length} pagine`}
                  </span>
                  <span
                    className="w-28 text-right text-[13px] text-fg3"
                    title={r.publishedAt ? whenDate(r.publishedAt) : ''}
                  >
                    {r.publishedAt ? relativeTime(r.publishedAt) : ''}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Nuovo rilascio"
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Annulla</Button>
            <Button variant="primary" disabled={!name.trim()} onClick={() => void create()}>
              Crea
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void create()
          }}
        >
          <Input
            data-autofocus
            value={name}
            maxLength={120}
            placeholder="Es. Collezione inverno, Saldi di gennaio"
            onChange={(e) => setName(e.target.value)}
          />
        </form>
      </Dialog>
    </div>
  )
}

function ReleaseCard({ release }: { release: Release }) {
  const queryClient = useQueryClient()
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [name, setName] = useState(release.name)
  useEffect(() => setName(release.name), [release.name])
  const refresh = () => queryClient.invalidateQueries({ queryKey: releasesKey })
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
    } catch (error) {
      fail(error)
    }
    await refresh()
  }
  const failed = release.status === 'failed'
  const blocked = release.items.filter((i) => i.problem).length

  const publish = async () => {
    setBusy(true)
    try {
      await api.publishRelease(release.id)
      toast(`«${release.name}» è online`)
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      void queryClient.invalidateQueries({ queryKey: ['list'] })
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
      await refresh()
    }
  }

  return (
    <article className="rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgb(10_10_11/0.04)]">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <input
          aria-label="Nome del rilascio"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== release.name) void run(() => api.renameRelease(release.id, name.trim()))
            else setName(release.name)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1 py-0.5 text-[15px] font-semibold outline-none hover:bg-hover focus:bg-hover"
        />
        {failed ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-danger/10 px-2 py-0.5 text-[12px] font-medium text-danger">
            <AlertTriangle className="size-3.5" /> Non uscito
          </span>
        ) : release.runAt ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-[12px] font-medium text-accent">
            <CalendarClock className="size-3.5" /> Esce {whenDate(release.runAt)}
          </span>
        ) : (
          <span className="rounded-md bg-seg px-2 py-0.5 text-[12px] font-medium text-fg2">In preparazione</span>
        )}
      </header>

      {failed && release.error && (
        <div className="mx-4 mt-3 rounded-md bg-danger/10 px-3 py-2 text-[13px] leading-snug text-danger">
          <p className="font-medium">Non è uscito niente{release.runAt ? ` (${whenDate(release.runAt)})` : ''}.</p>
          <p className="mt-0.5">{release.error}.</p>
          <p className="mt-0.5 text-danger/80">Sistema le pagine e programma di nuovo, oppure pubblica adesso.</p>
        </div>
      )}

      {release.items.length === 0 ? (
        <p className="px-4 py-5 text-[13px] text-fg3">
          Ancora vuoto: aggiungi le pagine e gli articoli che devono uscire insieme.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {release.items.map((item) => (
            <li key={item.documentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
              <FileText className="size-4 shrink-0 text-fg3" />
              <button
                type="button"
                onClick={() => navigate({ name: 'document', collection: item.collection, id: item.documentId })}
                className="min-w-40 flex-1 truncate text-left font-medium hover:underline"
              >
                {item.title || 'Senza titolo'}
              </button>
              <StatusBadge status={item.status} short />
              <select
                aria-label={`Cosa succede a ${item.title}`}
                value={item.action}
                onChange={(e) =>
                  void run(() =>
                    api.putReleaseItem(release.id, item.documentId, e.target.value as 'publish' | 'unpublish'),
                  )
                }
                className="h-7 rounded-md border border-line bg-panel px-1.5 text-[13px]"
              >
                <option value="publish">Pubblica</option>
                <option value="unpublish" disabled={item.status === 'draft'}>
                  Togli dal sito
                </option>
              </select>
              <IconButton
                label="Togli dal rilascio"
                onClick={() => void run(() => api.removeReleaseItem(release.id, item.documentId))}
              >
                <X />
              </IconButton>
              {item.problem && (
                <p className="flex w-full items-center gap-1.5 pl-7 text-[12.5px] text-danger">
                  <AlertTriangle className="size-3.5 shrink-0" /> {item.problem}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <AddItem release={release} onAdded={refresh} />
        <span className="flex-1" />
        <IconButton label="Annulla il rilascio" onClick={() => setConfirmCancel(true)}>
          <Trash2 />
        </IconButton>
        <Popover
          align="end"
          width={300}
          trigger={({ toggle, ref }) => (
            <Button ref={ref} size="sm" icon={<CalendarClock className="size-3.5" />} onClick={toggle}>
              {release.runAt && !failed ? 'Cambia ora' : 'Programma'}
            </Button>
          )}
        >
          {() => (
            <div className="p-3.5">
              <When
                title="Esce il"
                hint="Escono le bozze come sono in quel momento. Se una pagina non è pronta, non esce niente e qui trovi il motivo."
                current={
                  release.runAt && !failed ? { runAt: release.runAt, createdByName: release.scheduledByName } : null
                }
                disabled={!release.items.length}
                disabledHint="Aggiungi prima qualcosa al rilascio."
                onSet={async (at) => {
                  await api.scheduleRelease(release.id, at)
                  await refresh()
                  if (at) toast(`«${release.name}» uscirà ${whenDate(at)}`)
                }}
                onError={fail}
              />
            </div>
          )}
        </Popover>
        <Button
          size="sm"
          variant="primary"
          icon={<Rocket className="size-3.5" />}
          loading={busy}
          disabled={!release.items.length || blocked > 0}
          title={blocked ? 'Prima sistema le pagine segnalate' : undefined}
          onClick={() => void publish()}
        >
          Pubblica tutto ora
        </Button>
      </footer>

      <Dialog
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title={`Annullare «${release.name}»?`}
        footer={
          <>
            <Button onClick={() => setConfirmCancel(false)}>No</Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmCancel(false)
                void run(() => api.cancelRelease(release.id))
              }}
            >
              Annulla il rilascio
            </Button>
          </>
        }
      >
        Le pagine restano come sono, in bozza o online: si scioglie solo il gruppo.
      </Dialog>
    </article>
  )
}

/** Search across the collections for something to add. */
function AddItem({ release, onAdded }: { release: Release; onAdded: () => void }) {
  const { schema, locale } = useSession()
  const [search, setSearch] = useState('')
  const lists = schema.collections.filter((c) => !c.singleton)
  const results = useQuery({
    queryKey: ['release-search', search, locale],
    queryFn: async () => {
      const found: (DocumentSummary & { collection: string; label: string })[] = []
      for (const c of lists) {
        const { items } = await api.list(c.name, { locale, search, limit: 6 })
        for (const i of items) found.push({ ...i, collection: c.name, label: c.label })
      }
      return found
    },
  })
  const inRelease = new Set(release.items.map((i) => i.documentId))
  return (
    <Popover
      width={340}
      trigger={({ toggle, ref }) => (
        <Button ref={ref} size="sm" icon={<Plus className="size-3.5" />} onClick={toggle}>
          Aggiungi
        </Button>
      )}
    >
      {(close) => (
        <div className="p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg3" />
            <Input
              data-autofocus
              autoFocus
              value={search}
              placeholder="Cerca una pagina o un articolo"
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-7"
            />
          </div>
          <ul className="mt-1.5 max-h-72 overflow-y-auto">
            {results.isPending ? (
              <li className="flex justify-center py-4">
                <Spinner />
              </li>
            ) : !results.data?.length ? (
              <li className="px-2 py-3 text-[13px] text-fg3">Niente con queste parole.</li>
            ) : (
              results.data.map((doc) => (
                <li key={doc.id}>
                  <button
                    type="button"
                    disabled={inRelease.has(doc.id)}
                    onClick={async () => {
                      try {
                        await api.putReleaseItem(release.id, doc.id, 'publish')
                        onAdded()
                        close()
                      } catch (error) {
                        fail(error)
                      }
                    }}
                    className={cx(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover disabled:opacity-50',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{doc.title || 'Senza titolo'}</span>
                    <span className="shrink-0 text-[12px] text-fg3">
                      {inRelease.has(doc.id) ? 'già dentro' : doc.label}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </Popover>
  )
}
