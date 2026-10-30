import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  DatabaseBackup,
  Download,
  FileText,
  Info,
  KeyRound,
  LogIn,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
} from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, cx, EmptyState, IconButton, Spinner, Switch, toast } from '../components/ui.tsx'
import { type ActivityEntry, api, type SecurityCheck } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { navigate } from '../lib/router.ts'

const STATUS: Record<SecurityCheck['status'], { icon: ReactNode; tone: string }> = {
  bad: { icon: <CircleX />, tone: 'text-danger' },
  warn: { icon: <CircleAlert />, tone: 'text-warn' },
  ok: { icon: <CircleCheck />, tone: 'text-ok' },
  info: { icon: <Info />, tone: 'text-fg3' },
}

const SETTINGS: Record<string, string> = {
  theme: 'il tema',
  mail: 'l’invio delle email',
  ai: 'il modello AI',
  editorial: 'i permessi dei redattori',
  seo: 'la SEO del sito',
  redirects: 'i reindirizzamenti',
  languages: 'le lingue del sito',
  backups: 'i backup automatici',
}

/** One line of the log in words: "ha pubblicato “Chi siamo”". The person's name comes before it. */
export function describe(e: ActivityEntry): { text: string; group: 'access' | 'people' | 'content' | 'settings' } {
  const d = e.detail ?? {}
  const t = e.target ? `“${e.target}”` : ''
  const [kind, what = ''] = e.action.split('.')
  switch (e.action) {
    case 'login.ok':
      return { text: d.twoFactor ? 'è entrato con la verifica in due passaggi' : 'è entrato', group: 'access' }
    case 'login.failed':
      return {
        text: `password sbagliata per ${e.target}${d.known ? '' : ' (nessun account con questo indirizzo)'}`,
        group: 'access',
      }
    case 'login.code_failed':
      return { text: `codice di verifica sbagliato per ${e.target}`, group: 'access' }
    case 'login.blocked':
      return { text: `tentativo di accesso in pausa per ${e.target}`, group: 'access' }
    case 'logout':
      return { text: 'è uscito', group: 'access' }
    case 'session.ended':
      return { text: 'ha disconnesso un dispositivo', group: 'access' }
    case 'session.ended_others':
      return { text: 'ha disconnesso gli altri dispositivi', group: 'access' }
    case 'twofactor.enabled':
      return { text: 'ha attivato la verifica in due passaggi', group: 'access' }
    case 'twofactor.disabled':
      return { text: 'ha disattivato la verifica in due passaggi', group: 'access' }
    case 'twofactor.recovery':
      return { text: 'ha creato nuovi codici di riserva', group: 'access' }
    case 'twofactor.reset':
      return { text: `ha disattivato la verifica in due passaggi di ${e.target}`, group: 'access' }
    case 'token.created':
      return { text: `ha creato il token ${t}`, group: 'access' }
    case 'token.revoked':
      return { text: 'ha revocato un token', group: 'access' }
    case 'security.require_2fa':
      return { text: 'ha richiesto a tutti la verifica in due passaggi', group: 'access' }
    case 'security.optional_2fa':
      return { text: 'ha reso facoltativa la verifica in due passaggi', group: 'access' }
    case 'user.setup':
      return { text: 'ha creato il pannello del sito', group: 'people' }
    case 'user.invited':
      return {
        text: `ha invitato ${e.target} come ${d.role === 'admin' ? 'amministratore' : 'redattore'}`,
        group: 'people',
      }
    case 'user.invite_revoked':
      return { text: 'ha annullato un invito', group: 'people' }
    case 'user.joined':
      return { text: 'ha accettato l’invito', group: 'people' }
    case 'user.password':
      return { text: 'ha cambiato la password', group: 'people' }
    case 'user.password_reset':
      return { text: 'ha scelto una nuova password dal link', group: 'people' }
    case 'user.reset_link':
      return { text: `ha creato un link per una nuova password per ${e.target}`, group: 'people' }
    case 'user.email':
      return { text: `ha cambiato l’email ${d.from ? `${d.from} → ` : 'in '}${e.target}`, group: 'people' }
    case 'user.role':
      return {
        text: `ha reso ${e.target} ${d.role === 'admin' ? 'amministratore' : 'redattore'}`,
        group: 'people',
      }
    case 'user.removed':
      return { text: `ha rimosso ${e.target}`, group: 'people' }
    case 'document.created':
      return { text: `ha creato ${t}`, group: 'content' }
    case 'document.published':
      return { text: `ha pubblicato ${t}`, group: 'content' }
    case 'document.unpublished':
      return { text: `ha tolto dal sito ${t}`, group: 'content' }
    case 'document.deleted':
      return { text: `ha eliminato ${t}`, group: 'content' }
    case 'document.restored':
      return { text: `ha ripristinato una versione di ${t}`, group: 'content' }
    case 'document.translated':
      return {
        text: `ha creato la versione ${String(d.locale ?? '').toUpperCase()} di ${t}${d.ai ? ' con l’AI' : ''}`,
        group: 'content',
      }
    case 'media.uploaded':
      return { text: `ha caricato ${t}`, group: 'content' }
    case 'media.deleted':
      return { text: `ha eliminato il file ${t}`, group: 'content' }
    case 'message.deleted':
      return { text: 'ha eliminato un messaggio ricevuto', group: 'content' }
    case 'backup.created':
      return { text: d.auto ? 'Backup automatico del database' : 'ha fatto un backup del database', group: 'settings' }
    case 'backup.downloaded':
      return { text: `ha scaricato il backup ${e.target}`, group: 'settings' }
    case 'backup.deleted':
      return { text: `ha eliminato il backup ${e.target}`, group: 'settings' }
    case 'backup.archive':
      return { text: 'ha scaricato l’archivio completo del sito', group: 'settings' }
  }
  if (kind === 'settings') return { text: `ha cambiato ${SETTINGS[what] ?? 'le impostazioni'}`, group: 'settings' }
  return { text: e.action, group: 'settings' }
}

const GROUP_ICON = {
  access: <LogIn />,
  people: <UserRound />,
  content: <FileText />,
  settings: <Settings />,
}

const FILTERS = [
  { value: '', label: 'Tutto' },
  { value: 'access', label: 'Accessi' },
  { value: 'people', label: 'Persone' },
  { value: 'content', label: 'Contenuti' },
  { value: 'settings', label: 'Impostazioni' },
] as const

/** Impostazioni → Sicurezza: what to fix, then what happened. Administrators only. */
export function SecuritySettings({ onOpenProfile }: { onOpenProfile: () => void }) {
  const { user } = useSession()
  if (user.role !== 'admin')
    return (
      <EmptyState icon={<ShieldCheck />} title="Il registro della sicurezza lo vedono gli amministratori">
        La tua verifica in due passaggi e i tuoi dispositivi sono nel tuo profilo.
        <div className="mt-3">
          <Button size="sm" onClick={onOpenProfile}>
            Apri il profilo
          </Button>
        </div>
      </EmptyState>
    )
  return (
    <div className="mx-auto max-w-3xl space-y-10 px-5 py-8">
      <Overview onOpenProfile={onOpenProfile} />
      <BackupsSection />
      <ActivityLog />
    </div>
  )
}

function Overview({ onOpenProfile }: { onOpenProfile: () => void }) {
  const query = useQuery({ queryKey: ['security-overview'], queryFn: api.securityOverview })
  if (!query.data) return <Spinner />
  const order = { bad: 0, warn: 1, info: 2, ok: 3 }
  const checks = [...query.data.checks].sort((a, b) => order[a.status] - order[b.status])
  const issues = checks.filter((c) => c.status === 'bad' || c.status === 'warn').length
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
        <ShieldCheck /> Stato della sicurezza
      </h2>
      <p className="text-[13px] text-fg2">
        {issues
          ? `${issues === 1 ? 'Un punto da sistemare' : `${issues} punti da sistemare`}, dal più importante.`
          : 'Tutto in ordine.'}
      </p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3 px-4 py-3">
            <span className={cx('mt-px shrink-0 [&_svg]:size-4.5', STATUS[c.status].tone)}>
              {STATUS[c.status].icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">{c.title}</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg3">{c.detail}</p>
            </div>
            {c.action && (
              <Button
                size="sm"
                onClick={() =>
                  c.action === 'profile'
                    ? onOpenProfile()
                    : c.action === 'backups'
                      ? document.getElementById('backups')?.scrollIntoView({ behavior: 'smooth' })
                      : navigate(c.action === 'mail' ? { name: 'settings', tab: 'mail' } : { name: 'people' })
                }
              >
                {c.action === 'profile'
                  ? 'Attiva'
                  : c.action === 'mail'
                    ? 'Configura'
                    : c.action === 'backups'
                      ? 'Backup'
                      : 'Persone'}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Daily copies of the database: switch, how many to keep, make one now, download or delete. */
function BackupsSection() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['backups'], queryFn: api.backups })
  const [busy, setBusy] = useState(false)
  if (!query.data) return <Spinner />
  const data = query.data
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['backups'] })
    void queryClient.invalidateQueries({ queryKey: ['security-overview'] })
    void queryClient.invalidateQueries({ queryKey: ['activity'] })
  }
  const save = async (patch: Partial<{ enabled: boolean; keep: number }>) => {
    try {
      queryClient.setQueryData(['backups'], await api.saveBackups({ enabled: data.enabled, keep: data.keep, ...patch }))
      refresh()
    } catch (error) {
      toast((error as Error).message, 'error')
    }
  }
  return (
    <section id="backups" className="scroll-mt-6 space-y-3">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
        <DatabaseBackup /> Backup
      </h2>
      <div className="flex items-center gap-3 rounded-lg border border-line bg-panel px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium">Scarica tutto</div>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg3">
            Un unico archivio con {data.available ? 'il database, ' : ''}tutte le immagini originali e i caratteri: da
            tenere fuori dal server, o per spostare il sito. Si rimette con{' '}
            <code className="font-mono text-[11.5px]">npx materialize restore</code>.
          </p>
        </div>
        <a
          href="/api/backups/archive"
          download
          className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line2 px-2.5 text-[12px] font-medium hover:bg-hover [&_svg]:size-3.5"
          onClick={() => {
            toast('L’archivio si sta preparando: il download parte tra poco')
            setTimeout(refresh, 3000)
          }}
        >
          <Download /> Scarica tutto
        </a>
      </div>
      {!data.available ? (
        <p className="text-[13px] leading-relaxed text-fg2">
          Il database è ospitato da un fornitore (Turso, libSQL): i backup del database li fa lui, controlla che siano
          attivi nel suo pannello. L’archivio qui sopra contiene comunque immagini e caratteri.
        </p>
      ) : (
        <>
          <div className="flex items-start gap-3 rounded-lg border border-line bg-panel px-4 py-3.5">
            <Switch
              checked={data.enabled}
              label="Backup automatici ogni giorno"
              onChange={(enabled) => void save({ enabled })}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium">Una copia del database ogni giorno</div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-fg3">
                La fa il server mentre è acceso, nella cartella backups accanto al database. Ne tiene
                <select
                  value={data.keep}
                  onChange={(e) => void save({ keep: Number(e.target.value) })}
                  aria-label="Quante copie tenere"
                  className="mx-1.5 h-6 rounded-md border border-line2 bg-input px-1 text-[12px] text-fg outline-none"
                >
                  {[7, 14, 30, 90].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                e cancella le più vecchie. Copia anche le immagini nuove: quelle eliminate dalla libreria restano almeno
                30 giorni.
              </p>
            </div>
            <Button
              size="sm"
              variant="primary"
              loading={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await api.createBackup()
                  toast('Backup fatto')
                  refresh()
                } catch (error) {
                  toast((error as Error).message, 'error')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Fai un backup ora
            </Button>
          </div>
          {data.items.length > 0 && (
            <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
              {data.items.map((b) => (
                <li key={b.name} className="flex items-center gap-3 px-4 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-[12px]">{b.name}</div>
                    <div className="text-[11.5px] text-fg3" title={fullDate(b.createdAt)}>
                      {relativeTime(b.createdAt)} · {size(b.size)}
                    </div>
                  </div>
                  <a
                    href={`/api/backups/${encodeURIComponent(b.name)}`}
                    download={b.name}
                    className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-fg2 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
                  >
                    <Download /> Scarica
                  </a>
                  <IconButton
                    label={`Elimina ${b.name}`}
                    className="hover:text-danger"
                    onClick={async () => {
                      if (!confirm(`Eliminare il backup ${b.name}?`)) return
                      await api.removeBackup(b.name).catch((e: Error) => toast(e.message, 'error'))
                      refresh()
                    }}
                  >
                    <Trash2 />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11.5px] leading-relaxed text-fg3">
            {data.media.files > 0 && `Copia delle immagini: ${data.media.files} file, ${size(data.media.size)}. `}
            Per rimettere un backup: ferma il server, poi nella cartella del sito{' '}
            <code className="font-mono">npx materialize restore percorso/del/backup.db</code>. Le immagini che mancano
            tornano dalla copia; il database di prima resta salvato tra i backup.
          </p>
        </>
      )}
    </section>
  )
}

function ActivityLog() {
  const [group, setGroup] = useState<(typeof FILTERS)[number]['value']>('')
  const list = useInfiniteQuery({
    queryKey: ['activity', group],
    queryFn: ({ pageParam }) => api.activity({ group: group || undefined, before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) => (last.items.length === 50 ? last.items[last.items.length - 1]?.seq : undefined),
  })
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-[16px] font-semibold [&_svg]:size-4 [&_svg]:text-fg3">
        <KeyRound /> Attività
      </h2>
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setGroup(f.value)}
            className={cx(
              'h-7 rounded-full px-3 text-[12.5px] font-medium transition-colors',
              group === f.value ? 'bg-fg text-bg' : 'text-fg2 hover:bg-hover hover:text-fg',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      {list.isPending ? (
        <Spinner />
      ) : !items.length ? (
        <p className="py-6 text-center text-[13px] text-fg3">Ancora niente da mostrare.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-panel">
          {items.map((e) => {
            const { text, group: g } = describe(e)
            const failed = /failed|blocked/.test(e.action)
            return (
              <li key={e.id} className="flex items-start gap-3 px-4 py-2.5">
                <span className={cx('mt-0.5 shrink-0 [&_svg]:size-3.5', failed ? 'text-danger' : 'text-fg3')}>
                  {GROUP_ICON[g]}
                </span>
                <div className="min-w-0 flex-1 text-[12.5px] leading-snug">
                  {e.userName && !failed && <span className="font-medium">{e.userName} </span>}
                  <span className={failed ? 'text-danger' : 'text-fg2'}>
                    {failed ? text.charAt(0).toUpperCase() + text.slice(1) : text}
                  </span>
                </div>
                <span className="shrink-0 text-right text-[11.5px] text-fg3" title={fullDate(e.at)}>
                  {relativeTime(e.at)}
                  {e.ip && !/^(local|::1|127\.|::ffff:127\.)/.test(e.ip) && (
                    <span className="block font-mono text-[10.5px]">{e.ip}</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      )}
      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button size="sm" onClick={() => list.fetchNextPage()} loading={list.isFetchingNextPage}>
            Mostra altre
          </Button>
        </div>
      )}
      <p className="text-[11.5px] text-fg3">Il registro conserva un anno di attività.</p>
    </section>
  )
}
