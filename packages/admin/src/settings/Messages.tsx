import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Download, Inbox, Paperclip, Search, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { Button, cx, EmptyState, IconButton, Input, Segmented, Spinner, toast } from '../components/ui.tsx'
import { api, type Submission, type SubmissionQuery } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'

type View = 'all' | 'unread' | 'spam'

const size = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

/**
 * What the site's forms sent: filtered by form, unread or spam, searched, exported as a
 * spreadsheet. Spam is kept apart (it can be put back), files are downloaded, never opened here.
 */
export function Messages({ canDelete }: { canDelete: boolean }) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>('all')
  const [form, setForm] = useState('')
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(t)
  }, [typed])
  const query: SubmissionQuery = {
    limit: 100,
    form: form || undefined,
    status: view === 'all' ? undefined : view,
    q: search || undefined,
  }
  const list = useQuery({ queryKey: ['submissions', query], queryFn: () => api.submissions(query) })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['submissions'] })

  const data = list.data
  const items = data?.items ?? []
  const forms = data?.forms ?? []
  const filtered = !!(form || search || view !== 'all')

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-5 py-4">
      {(forms.length > 0 || filtered) && (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={view}
            onChange={setView}
            options={[
              { value: 'all', label: 'Tutti' },
              { value: 'unread', label: `Da leggere${data?.unread ? ` · ${data.unread}` : ''}` },
              { value: 'spam', label: `Spam${data?.spam ? ` · ${data.spam}` : ''}` },
            ]}
          />
          {forms.length > 1 && (
            <select
              aria-label="Modulo"
              value={form}
              onChange={(e) => setForm(e.target.value)}
              className="h-7 rounded-md border border-line2 bg-input px-2 text-[13px] outline-none focus:border-accent"
            >
              <option value="">Tutti i moduli</option>
              {forms.map((f) => (
                <option key={f.form} value={f.form}>
                  {f.name || 'Modulo senza nome'} ({f.total})
                </option>
              ))}
            </select>
          )}
          <div className="relative ml-auto min-w-40 flex-1 sm:max-w-60">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-fg3" />
            <Input
              aria-label="Cerca nei messaggi"
              placeholder="Cerca nei messaggi"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-7 pl-7 text-[13px]"
            />
          </div>
          <a
            href={api.submissionsCsv({ ...query, limit: undefined })}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line2 px-2 text-[13px] text-fg2 hover:text-fg [&_svg]:size-3.5"
            download
          >
            <Download /> CSV
          </a>
        </div>
      )}

      {list.isLoading ? (
        <Spinner />
      ) : !items.length ? (
        <EmptyState icon={<Inbox />} title={filtered ? 'Nessun messaggio qui' : 'Nessun messaggio'}>
          {view === 'spam'
            ? 'Qui finiscono i messaggi che sembrano spam: compilati in un attimo, pieni di link o ripetuti.'
            : filtered
              ? 'Prova a cambiare i filtri o la ricerca.'
              : 'Qui arrivano i messaggi dei moduli di contatto del sito.'}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((m) => (
            <Message
              key={m.id}
              m={m}
              expanded={open === m.id}
              canDelete={canDelete}
              onToggle={() => {
                setOpen(open === m.id ? null : m.id)
                if (!m.read) api.markSubmission(m.id, true).then(refresh)
              }}
              onChanged={refresh}
            />
          ))}
        </ul>
      )}
      <FormsSettings />
    </div>
  )
}

function Message({
  m,
  expanded,
  canDelete,
  onToggle,
  onChanged,
}: {
  m: Submission
  expanded: boolean
  canDelete: boolean
  onToggle: () => void
  onChanged: () => void
}) {
  const from = m.data.nome || m.data.name || m.data.email || 'Messaggio'
  const preview = m.data.messaggio || m.data.message || Object.values(m.data).join(' · ')
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <span
          className={cx('mt-1.5 size-2 shrink-0 rounded-full', m.read || m.spam ? 'bg-transparent' : 'bg-accent')}
        />
        <button type="button" className="min-w-0 flex-1 text-left" onClick={onToggle}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className={cx('truncate text-[14px]', !m.read && !m.spam && 'font-semibold')}>{from}</span>
            <span className="shrink-0 text-[12px] text-fg3" title={fullDate(m.createdAt)}>
              {relativeTime(m.createdAt)}
            </span>
            {m.formName && <span className="shrink-0 text-[12px] text-fg3">· {m.formName}</span>}
            {m.files.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[12px] text-fg3 [&_svg]:size-3">
                · <Paperclip /> {m.files.length}
              </span>
            )}
            {m.mailed && <span className="shrink-0 text-[12px] text-fg3">· inviato per email</span>}
            {m.webhook === 'failed' && <span className="shrink-0 text-[12px] text-danger">· webhook non riuscito</span>}
          </div>
          {m.spam && <p className="text-[12px] text-warn">Sembra spam: {m.spam}</p>}
          {!expanded && <p className="truncate text-[13px] text-fg2">{preview}</p>}
        </button>
        <IconButton
          label={m.spam ? 'Non è spam' : 'È spam'}
          onClick={async () => {
            await api.markSpam(m.id, !m.spam)
            toast(m.spam ? 'Rimesso tra i messaggi' : 'Spostato nello spam')
            onChanged()
          }}
        >
          {m.spam ? <ShieldCheck /> : <ShieldAlert />}
        </IconButton>
        {canDelete && (
          <IconButton
            label="Elimina il messaggio"
            onClick={async () => {
              if (!confirm('Eliminare questo messaggio e i suoi allegati?')) return
              await api.removeSubmission(m.id)
              onChanged()
            }}
          >
            <Trash2 />
          </IconButton>
        )}
      </div>
      {expanded && (
        <dl className="mt-2 ml-5 space-y-2 rounded-lg border border-line bg-panel2 p-3 text-[14px]">
          {Object.entries(m.data).map(([k, v]) => {
            const n = m.files.findIndex((f) => f.field === k)
            const file = m.files[n]
            return (
              <div key={k}>
                <dt className="text-[12px] font-medium text-fg3">{k}</dt>
                <dd className="whitespace-pre-wrap">
                  {file ? (
                    <a
                      href={api.submissionFile(m.id, n)}
                      download
                      className="inline-flex items-center gap-1 text-accent hover:underline [&_svg]:size-3.5"
                    >
                      <Download /> {file.name} <span className="text-fg3">({size(file.size)})</span>
                    </a>
                  ) : (
                    v
                  )}
                </dd>
              </div>
            )
          })}
          {m.page && <div className="text-[12px] text-fg3">Dalla pagina {m.page}</div>}
        </dl>
      )}
    </li>
  )
}

const KEEP = [
  { value: '', label: 'Per sempre' },
  { value: '6', label: '6 mesi' },
  { value: '12', label: '1 anno' },
  { value: '24', label: '2 anni' },
]

/** How long messages are kept (privacy), and the key that signs webhook calls. */
function FormsSettings() {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const current = useQuery({ queryKey: ['forms-settings'], queryFn: api.formsSettings })
  if (!current.data) return null
  const admin = user.role === 'admin'
  return (
    <section className="mt-6 space-y-3 border-t border-line pt-5">
      <h2 className="text-[15px] font-semibold">Conservazione e collegamenti</h2>
      <label className="flex flex-wrap items-center gap-2 text-[14px]">
        Cancella da soli i messaggi più vecchi di
        <select
          aria-label="Per quanto conservare i messaggi"
          disabled={!admin}
          value={current.data.keepMonths ? String(current.data.keepMonths) : ''}
          onChange={async (e) => {
            const months = e.target.value ? Number(e.target.value) : null
            const res = await api.saveFormsSettings(months)
            queryClient.setQueryData(['forms-settings'], { ...current.data, ...res })
            queryClient.invalidateQueries({ queryKey: ['submissions'] })
            toast(months ? 'Salvato: i messaggi più vecchi verranno cancellati' : 'Salvato: i messaggi restano')
          }}
          className="h-7 rounded-md border border-line2 bg-input px-2 text-[13px] outline-none focus:border-accent disabled:opacity-60"
        >
          {KEEP.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </label>
      <p className="text-[13px] leading-relaxed text-fg3">
        Per la privacy (GDPR) conserva i dati solo per il tempo che serve: con gli allegati, i messaggi vengono
        cancellati per sempre allo scadere.
      </p>
      {current.data.webhookSecret && (
        <div className="space-y-1">
          <p className="text-[13px] font-medium">Chiave dei webhook</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border border-line bg-panel2 px-2 py-1 text-[12px]">
              {current.data.webhookSecret}
            </code>
            <Button
              size="sm"
              onClick={() =>
                navigator.clipboard?.writeText(current.data.webhookSecret ?? '').then(() => toast('Chiave copiata'))
              }
              icon={<Copy className="size-3.5" />}
            >
              Copia
            </Button>
          </div>
          <p className="text-[13px] leading-relaxed text-fg3">
            Ogni chiamata porta l’intestazione <code>X-Materialize-Signature: sha256=…</code>, l’HMAC del corpo con
            questa chiave: chi la riceve può verificare che arrivi dal tuo sito.
          </p>
        </div>
      )}
    </section>
  )
}
