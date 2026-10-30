import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail, Send, Settings, Trash2 } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useSession } from '../app/context.ts'
import { DocumentScreen } from '../app/DocumentScreen.tsx'
import { Button, EmptyState, IconButton, Input, Segmented, Spinner, toast } from '../components/ui.tsx'
import { ApiError, api, type CollectionDescription, type MailSettings } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { navigate } from '../lib/router.ts'
import { ProfileDialog } from '../people/ProfileDialog.tsx'
import { AiScreen } from './AiSettings.tsx'
import { LanguagesSettings } from './LanguagesSettings.tsx'
import { SecuritySettings } from './SecuritySettings.tsx'
import { SeoSettings } from './SeoSettings.tsx'

const EMPTY: MailSettings = { host: '', port: 587, security: 'starttls', user: '', from: '', to: '' }

/**
 * A single-document collection's name as a settings tab: "Impostazioni del sito" → "Sito"
 * (it already sits under Impostazioni).
 */
export function settingsLabel(c: CollectionDescription): string {
  const short = c.label.replace(/^impostazioni(\s+(del|della|dello|dei|degli|delle|di))?\s*/i, '').trim()
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : 'Generale'
}

/**
 * Impostazioni: the site's own data (single-document collections such as name, contacts and
 * social links), outgoing email (SMTP), search engines, languages, AI, and the messages sent
 * from the site's forms.
 */
export function SettingsScreen({ tab }: { tab?: string }) {
  const { user, schema } = useSession()
  const unread = useQuery({ queryKey: ['submissions'], queryFn: () => api.submissions() }).data?.unread ?? 0
  const singletons = schema.collections.filter((c) => c.singleton)
  const active = tab ?? singletons[0]?.name ?? 'mail'
  const single = singletons.find((c) => c.name === active)
  const [profile, setProfile] = useState(false)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {profile && <ProfileDialog open onClose={() => setProfile(false)} />}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-5">
        <Settings className="size-4 text-fg3" />
        <h1 className="text-[14px] font-semibold">Impostazioni</h1>
        <div className="flex-1" />
        <Segmented
          size="sm"
          value={active}
          onChange={(t) => navigate({ name: 'settings', tab: t })}
          options={[
            ...singletons.map((c) => ({ value: c.name, label: settingsLabel(c) })),
            { value: 'mail', label: 'Email' },
            { value: 'seo', label: 'SEO' },
            { value: 'languages', label: 'Lingue' },
            { value: 'security', label: 'Sicurezza' },
            { value: 'ai', label: 'AI e MCP' },
            { value: 'messages', label: unread ? `Messaggi · ${unread}` : 'Messaggi' },
          ]}
        />
      </header>
      {single ? (
        <SingleDocument collection={single} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {active === 'ai' ? (
            <AiScreen />
          ) : active === 'security' ? (
            <SecuritySettings onOpenProfile={() => setProfile(true)} />
          ) : active === 'languages' ? (
            <LanguagesSettings />
          ) : active === 'messages' ? (
            <Messages canDelete={user.role === 'admin'} />
          ) : active === 'seo' ? (
            <SeoSettings editable={user.role === 'admin'} />
          ) : user.role === 'admin' ? (
            <MailForm />
          ) : (
            <EmptyState icon={<Mail />} title="L’invio delle email lo configura un amministratore" />
          )}
        </div>
      )}
    </div>
  )
}

/** The document of a single-document collection, edited (and published) in place. */
function SingleDocument({ collection }: { collection: CollectionDescription }) {
  const { locale } = useSession()
  const list = useQuery({
    queryKey: ['list', collection.name, locale, 'single'],
    queryFn: () => api.list(collection.name, { locale, limit: 1 }),
  })
  if (list.isPending)
    return (
      <div className="flex flex-1 justify-center py-20">
        <Spinner />
      </div>
    )
  return (
    <DocumentScreen key={`${collection.name}/${locale}`} collection={collection} id={list.data?.items[0]?.id ?? null} />
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed in as children
    <label className="block space-y-1.5">
      <span className="text-[12.5px] font-medium">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] leading-relaxed text-fg3">{hint}</span>}
    </label>
  )
}

function MailForm() {
  const queryClient = useQueryClient()
  const saved = useQuery({ queryKey: ['mail'], queryFn: api.mail })
  const [mail, setMail] = useState<MailSettings>(EMPTY)
  const [pass, setPass] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  useEffect(() => {
    if (saved.data) setMail(saved.data.mail)
  }, [saved.data])
  const set = (patch: Partial<MailSettings>) => setMail((m) => ({ ...m, ...patch }))

  const save = async (e?: FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const res = await api.saveMail({ ...mail, pass: pass || undefined })
      queryClient.setQueryData(['mail'], res)
      setPass('')
      toast('Impostazioni email salvate')
      return true
    } catch (error) {
      toast((error as Error).message, 'error')
      return false
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    setTesting(true)
    try {
      if (!(await save())) return
      const res = await api.testMail()
      toast(`Email di prova inviata a ${res.to}`)
    } catch (error) {
      const detail = error instanceof ApiError && error.code === 'mail_failed' ? `: ${error.message}` : ''
      toast(detail ? `Il server di posta ha rifiutato l’invio${detail}` : (error as Error).message, 'error')
    } finally {
      setTesting(false)
    }
  }

  if (saved.isLoading) return <Spinner />
  return (
    <form onSubmit={save} className="mx-auto max-w-xl space-y-6 px-5 py-8">
      <div>
        <h2 className="text-[16px] font-semibold">Invio delle email</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-fg2">
          Con un server SMTP (quello della tua casella, o servizi come Postmark, Brevo, Amazon SES) i messaggi dei
          moduli del sito arrivano anche per email. Senza, restano comunque in Messaggi.
        </p>
      </div>
      <div className="grid grid-cols-[1fr_120px] gap-3">
        <Field label="Server">
          <Input
            value={mail.host}
            placeholder="smtp.esempio.it"
            onChange={(e) => set({ host: e.target.value.trim() })}
          />
        </Field>
        <Field label="Porta">
          <Input type="number" value={mail.port} onChange={(e) => set({ port: Number(e.target.value) || 587 })} />
        </Field>
      </div>
      <Field label="Sicurezza" hint="TLS di solito sulla porta 465, STARTTLS sulla 587.">
        <Segmented
          value={mail.security}
          onChange={(security) =>
            set({ security, port: security === 'tls' ? 465 : security === 'starttls' ? 587 : mail.port })
          }
          options={[
            { value: 'starttls', label: 'STARTTLS' },
            { value: 'tls', label: 'TLS' },
            { value: 'none', label: 'Nessuna' },
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Utente">
          <Input value={mail.user} autoComplete="off" onChange={(e) => set({ user: e.target.value.trim() })} />
        </Field>
        <Field label="Password" hint={mail.hasPassword ? 'Salvata: lascia vuoto per non cambiarla.' : undefined}>
          <Input
            type="password"
            value={pass}
            autoComplete="new-password"
            placeholder={mail.hasPassword ? '••••••••' : ''}
            onChange={(e) => setPass(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Mittente" hint="Come appare a chi riceve, per esempio Studio Rossi <sito@studiorossi.it>.">
        <Input
          value={mail.from}
          placeholder="Nome <indirizzo@dominio.it>"
          onChange={(e) => set({ from: e.target.value })}
        />
      </Field>
      <Field label="Destinatario dei moduli" hint="Dove arrivano i messaggi inviati dal sito.">
        <Input value={mail.to} placeholder="studio@dominio.it" onChange={(e) => set({ to: e.target.value.trim() })} />
      </Field>
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={saving}>
          Salva
        </Button>
        <Button icon={<Send className="size-3.5" />} loading={testing} onClick={test} disabled={!mail.host}>
          Salva e invia una prova
        </Button>
      </div>
    </form>
  )
}

function Messages({ canDelete }: { canDelete: boolean }) {
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: ['submissions'], queryFn: () => api.submissions({ limit: 100 }) })
  const [open, setOpen] = useState<string | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['submissions'] })

  if (list.isLoading) return <Spinner />
  const items = list.data?.items ?? []
  if (!items.length)
    return (
      <EmptyState icon={<Inbox />} title="Nessun messaggio">
        Qui arrivano i messaggi dei moduli di contatto del sito.
      </EmptyState>
    )
  return (
    <ul className="mx-auto max-w-3xl divide-y divide-line px-5 py-4">
      {items.map((m) => {
        const from = m.data.nome || m.data.name || m.data.email || 'Messaggio'
        const preview = m.data.messaggio || m.data.message || Object.values(m.data).join(' · ')
        const expanded = open === m.id
        return (
          <li key={m.id} className="py-3">
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${m.read ? 'bg-transparent' : 'bg-accent'}`} />
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  setOpen(expanded ? null : m.id)
                  if (!m.read) api.markSubmission(m.id, true).then(refresh)
                }}
              >
                <div className="flex items-baseline gap-2">
                  <span className={`truncate text-[13.5px] ${m.read ? '' : 'font-semibold'}`}>{from}</span>
                  <span className="shrink-0 text-[11.5px] text-fg3" title={fullDate(m.createdAt)}>
                    {relativeTime(m.createdAt)}
                  </span>
                  {m.mailed && <span className="shrink-0 text-[11px] text-fg3">· inviato per email</span>}
                </div>
                {!expanded && <p className="truncate text-[12.5px] text-fg2">{preview}</p>}
              </button>
              {canDelete && (
                <IconButton
                  label="Elimina il messaggio"
                  onClick={async () => {
                    if (!confirm('Eliminare questo messaggio?')) return
                    await api.removeSubmission(m.id)
                    refresh()
                  }}
                >
                  <Trash2 />
                </IconButton>
              )}
            </div>
            {expanded && (
              <dl className="mt-2 ml-5 space-y-2 rounded-lg border border-line bg-panel2 p-3 text-[13px]">
                {Object.entries(m.data).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[11.5px] font-medium text-fg3">{k}</dt>
                    <dd className="whitespace-pre-wrap">{v}</dd>
                  </div>
                ))}
                {m.page && <div className="text-[11.5px] text-fg3">Dalla pagina {m.page}</div>}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}
