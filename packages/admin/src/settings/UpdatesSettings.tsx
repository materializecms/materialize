import { newer, type ReleaseNotes } from '@materializecms/core/updates'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, CircleCheck, Download, History, Loader2, RefreshCw } from 'lucide-react'
import { Children, type ReactNode, useEffect, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, Dialog, EmptyState, Spinner, Switch, toast } from '../components/ui.tsx'
import { api, type UpdateState } from '../lib/api.ts'
import { dayDate, relativeTime } from '../lib/format.ts'

/** The few marks the changelog uses: "- " lists and **bold**. */
function Notes({ text }: { text: string }) {
  // Bold parts sit at odd positions of the split; Children.toArray gives them their keys.
  const inline = (line: string) =>
    Children.toArray(
      line.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 ? (
          <strong key={part} className="font-semibold text-fg">
            {part}
          </strong>
        ) : (
          part
        ),
      ),
    )
  const blocks: ReactNode[] = []
  let items: string[] = []
  const flush = () => {
    if (!items.length) return
    blocks.push(
      <ul key={blocks.length} className="ml-4 list-disc space-y-1">
        {items.map((it) => (
          <li key={it}>{inline(it)}</li>
        ))}
      </ul>,
    )
    items = []
  }
  for (const line of text.split('\n')) {
    if (line.startsWith('- ')) items.push(line.slice(2))
    else {
      flush()
      if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
    }
  }
  flush()
  return <div className="space-y-2 text-[14px] leading-relaxed text-fg2">{blocks}</div>
}

function Release({ release }: { release: ReleaseNotes }) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <span className="font-semibold">Materialize {release.version}</span>
        {release.date && <span className="text-[13px] text-fg3">{dayDate(release.date)}</span>}
      </div>
      <Notes text={release.notes} />
    </div>
  )
}

const card = 'rounded-xl border border-line bg-panel p-5'

/** The newer version waiting to be installed, for admins (checked by the server once a day). */
export function useUpdateAvailable(): string | null {
  const { user } = useSession()
  const data = useQuery({
    queryKey: ['updates'],
    queryFn: api.updates,
    enabled: user.role === 'admin',
    staleTime: 60 * 60_000,
  }).data
  return data?.latest && data.notes.length > 0 && !data.unavailable ? data.latest : null
}

/**
 * Impostazioni → Aggiornamenti: the running version, what is new, and one button to install it.
 * The server backs up, installs the new version beside the site and restarts on it; if it does
 * not start, the previous version comes back by itself.
 */
export function UpdatesSettings() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [confirm, setConfirm] = useState<'install' | 'rollback' | null>(null)
  const [checking, setChecking] = useState(false)
  // While the server restarts, the panel waits for it to answer again.
  const [restarting, setRestarting] = useState<string | null>(null)
  const state = useQuery({
    queryKey: ['updates'],
    queryFn: api.updates,
    enabled: user.role === 'admin' && !restarting,
    refetchInterval: (q) => (q.state.data?.job.state === 'working' ? 1000 : false),
  })
  const data = state.data
  const before = useRef<string | null>(null)

  useEffect(() => {
    if (data?.job.state === 'restarting') setRestarting(data.current)
  }, [data?.job.state, data?.current])

  useEffect(() => {
    if (!restarting) return
    before.current = restarting
    let stop = false
    const poll = async () => {
      while (!stop) {
        await new Promise((r) => setTimeout(r, 1500))
        const health = await api.health().catch(() => null)
        // Back up: the new panel may differ from the one loaded, so the page starts over.
        if (health?.ok) {
          const after = await api.updates().catch(() => null)
          if (after && after.job.state !== 'restarting') {
            if (health.version !== before.current) location.reload()
            else {
              queryClient.setQueryData(['updates'], after)
              setRestarting(null)
            }
            return
          }
        }
      }
    }
    void poll()
    return () => {
      stop = true
    }
  }, [restarting, queryClient])

  if (user.role !== 'admin')
    return <EmptyState icon={<Download />} title="Gli aggiornamenti li installa un amministratore" />
  if (state.isPending && !restarting) return <Spinner />

  const run = async (action: () => Promise<UpdateState>) => {
    try {
      queryClient.setQueryData(['updates'], await action())
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }
  const check = async () => {
    setChecking(true)
    await run(api.checkUpdates)
    setChecking(false)
  }

  if (restarting || !data)
    return (
      <div className="mx-auto max-w-2xl px-5 py-8">
        <div className={`${card} flex items-center gap-3`}>
          <Loader2 className="size-5 animate-spin text-accent" />
          <div>
            <div className="font-medium">Riavvio con la nuova versione…</div>
            <div className="text-[13px] text-fg3">
              Di solito bastano pochi secondi: la pagina si ricarica da sola. Il sito torna online appena è pronto.
            </div>
          </div>
        </div>
      </div>
    )

  const available = data.latest && data.notes.length > 0 ? data.latest : null
  const working = data.job.state === 'working'
  const recent = data.last && Date.now() - new Date(data.last.at).getTime() < 7 * 24 * 60 * 60_000

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-5 py-8">
      <div>
        <h2 className="text-[16px] font-semibold">Aggiornamenti</h2>
        <p className="mt-1 text-[14px] text-fg2">
          Stai usando <strong className="font-semibold text-fg">Materialize {data.current}</strong>.
          {data.checkedAt && <span className="text-fg3"> Controllato {relativeTime(data.checkedAt)}.</span>}
        </p>
      </div>

      {recent && data.last && (
        <div
          className={`flex gap-3 rounded-xl px-4 py-3 text-[14px] ${data.last.ok ? 'bg-ok/10' : 'bg-danger/10'}`}
          role="status"
        >
          {data.last.ok ? (
            <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
          ) : (
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          )}
          <div>
            {data.last.ok
              ? data.last.kind === 'install'
                ? `Aggiornato dalla ${data.last.from} alla ${data.last.to}, ${relativeTime(data.last.at)}.`
                : `Tornato alla ${data.last.to}, ${relativeTime(data.last.at)}.`
              : `La ${data.last.to} non è partita, quindi è rimasta la ${data.last.from}: il sito non si è mai fermato a lungo.`}
            {!data.last.ok && data.last.message && <div className="text-fg2">{data.last.message}</div>}
          </div>
        </div>
      )}

      {working ? (
        <div className={`${card} flex items-center gap-3`}>
          <Loader2 className="size-5 animate-spin text-accent" />
          <div>
            <div className="font-medium">{data.job.step}…</div>
            <div className="text-[13px] text-fg3">Il sito resta online. Puoi lasciare questa pagina.</div>
          </div>
        </div>
      ) : available ? (
        <div className={`${card} space-y-5`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[15px] font-semibold">È disponibile Materialize {available}</div>
              <div className="text-[13px] text-fg3">Prima si fa un backup del database e dei media.</div>
            </div>
            {!data.unavailable && (
              <Button variant="primary" icon={<Download className="size-4" />} onClick={() => setConfirm('install')}>
                Aggiorna ora
              </Button>
            )}
          </div>
          <div className="space-y-5 border-t border-line pt-4">
            {data.notes.map((r) => (
              <Release key={r.version} release={r} />
            ))}
          </div>
        </div>
      ) : (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <div className="flex items-center gap-2.5">
            {data.checkError ? <CircleAlert className="size-4 text-fg3" /> : <CircleCheck className="size-4 text-ok" />}
            <span className="text-[14px]">
              {data.checkError ?? (data.checkedAt ? 'Hai l’ultima versione.' : 'Non ancora controllato.')}
            </span>
          </div>
          <Button icon={<RefreshCw className="size-4" />} loading={checking} onClick={check}>
            Controlla ora
          </Button>
        </div>
      )}

      {data.job.state === 'failed' && (
        <div className="rounded-xl bg-danger/10 px-4 py-3 text-[14px]" role="alert">
          <div className="font-medium">L’aggiornamento non è riuscito: non è cambiato niente.</div>
          <div className="text-fg2">{data.job.message}</div>
          {data.job.log && (
            <details className="mt-2">
              <summary className="cursor-pointer text-[13px] text-fg3">Dettagli</summary>
              <pre className="mt-2 max-h-60 overflow-auto rounded-md bg-panel2 p-3 font-mono text-[11px] whitespace-pre-wrap">
                {data.job.log}
              </pre>
            </details>
          )}
        </div>
      )}

      {data.unavailable && (
        <div className="rounded-xl bg-panel2 px-4 py-3 text-[13px] leading-relaxed text-fg2">
          <div className="font-medium text-fg">Da qui non si può aggiornare</div>
          {data.unavailable}
          {available && (
            <>
              <div className="mt-2">Dalla cartella del sito:</div>
              <pre className="mt-1 overflow-x-auto rounded-md bg-panel px-3 py-2 font-mono text-[12px]">
                {`npm install --save-exact @materializecms/astro@${available} @materializecms/cli@${available} @materializecms/core@${available}`}
              </pre>
              <div className="mt-1">Poi riavvia il server.</div>
            </>
          )}
        </div>
      )}

      {!data.unavailable && (
        <div className={`${card} space-y-4`}>
          <span className="flex items-start gap-3 text-[14px]">
            <Switch
              checked={data.settings.auto}
              label="Installa da sola le correzioni"
              onChange={(auto) => void run(() => api.saveUpdateSettings({ auto }))}
            />
            <span>
              Installa da sola le correzioni
              <span className="block text-[13px] text-fg3">
                Solo le versioni che correggono problemi ({data.current.replace(/\d+$/, 'x')}); per le novità decidi tu.
              </span>
            </span>
          </span>
          {data.previous && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <span className="text-[14px] text-fg2">
                {newer(data.previous, data.current)
                  ? `La ${data.previous} è ancora pronta: puoi tornarci quando vuoi.`
                  : `Qualcosa non va dopo l’aggiornamento? Puoi tornare alla ${data.previous}.`}
              </span>
              <Button icon={<History className="size-4" />} onClick={() => setConfirm('rollback')}>
                Torna alla {data.previous}
              </Button>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={confirm === 'install' ? `Aggiornare a Materialize ${available}?` : `Tornare alla ${data.previous}?`}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>Annulla</Button>
            <Button
              variant="primary"
              onClick={() => {
                const action = confirm
                setConfirm(null)
                void run(() =>
                  action === 'install' && available ? api.installUpdate(available) : api.rollbackUpdate(),
                )
              }}
            >
              {confirm === 'install' ? 'Aggiorna' : 'Torna indietro'}
            </Button>
          </>
        }
      >
        {confirm === 'install'
          ? 'Prima si fa un backup, poi la nuova versione si scarica mentre il sito resta online. Alla fine il server si riavvia: pochi secondi. Se la nuova versione non parte, torna da sola quella di adesso.'
          : 'Il server si riavvia con la versione precedente: pochi secondi. I contenuti restano come sono.'}
      </Dialog>
    </div>
  )
}
