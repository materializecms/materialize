import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail, Settings, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { DocumentScreen } from '../app/DocumentScreen.tsx'
import { cx, EmptyState, IconButton, ScreenHeader, Spinner } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { fullDate, relativeTime } from '../lib/format.ts'
import { navigate } from '../lib/router.ts'
import { ProfileDialog } from '../people/ProfileDialog.tsx'
import { About } from './About.tsx'
import { AiScreen } from './AiSettings.tsx'
import { ImportWordPress } from './ImportWordPress.tsx'
import { LanguagesSettings } from './LanguagesSettings.tsx'
import { MailForm } from './MailSettings.tsx'
import { SecuritySettings } from './SecuritySettings.tsx'
import { SeoSettings } from './SeoSettings.tsx'
import { TrackingSettings } from './TrackingSettings.tsx'
import { UpdatesSettings, useUpdateAvailable } from './UpdatesSettings.tsx'

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
  const update = useUpdateAvailable()
  // Grouped, so the list can grow: the site's own data, how it talks to people, safety, tools.
  const groups: { title: string; items: { value: string; label: string; badge?: number; dot?: boolean }[] }[] = [
    {
      title: 'Sito',
      items: [
        ...singletons.map((c) => ({ value: c.name, label: settingsLabel(c) })),
        { value: 'languages', label: 'Lingue' },
        { value: 'seo', label: 'SEO' },
        { value: 'tracking', label: 'Tracciamento e cookie' },
      ],
    },
    {
      title: 'Comunicazione',
      items: [
        { value: 'mail', label: 'Email' },
        { value: 'messages', label: 'Messaggi', badge: unread },
      ],
    },
    {
      title: 'Protezione',
      items: [
        { value: 'security', label: 'Sicurezza' },
        ...(user.role === 'admin'
          ? [
              { value: 'backups', label: 'Backup' },
              { value: 'activity', label: 'Registro attività' },
            ]
          : []),
      ],
    },
    {
      title: 'Strumenti',
      items: [
        { value: 'ai', label: 'AI e MCP' },
        { value: 'import', label: 'Importa' },
        ...(user.role === 'admin' ? [{ value: 'updates', label: 'Aggiornamenti', dot: !!update }] : []),
        { value: 'about', label: 'Informazioni' },
      ],
    },
  ]
  const item = (it: { value: string; label: string; badge?: number; dot?: boolean }) => (
    <button
      key={it.value}
      type="button"
      aria-current={active === it.value ? 'page' : undefined}
      // On phones the list scrolls sideways: the open section stays in view.
      ref={active === it.value ? (el) => el?.scrollIntoView({ block: 'nearest', inline: 'center' }) : undefined}
      onClick={() => navigate({ name: 'settings', tab: it.value })}
      className={cx(
        'flex h-8 shrink-0 items-center gap-2 rounded-lg px-2.5 text-left text-[14px] transition-colors max-md:border max-md:border-line',
        active === it.value ? 'bg-hover font-medium text-fg' : 'text-fg2 hover:bg-hover hover:text-fg',
      )}
    >
      <span className="flex-1 whitespace-nowrap">{it.label}</span>
      {!!it.badge && (
        <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
          {it.badge}
        </span>
      )}
      {it.dot && (
        <span title="Nuova versione" className="size-2 rounded-full bg-accent">
          <span className="sr-only">Nuova versione</span>
        </span>
      )}
    </button>
  )
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {profile && <ProfileDialog open onClose={() => setProfile(false)} />}
      <ScreenHeader
        icon={<Settings />}
        color="#64748b"
        title="Impostazioni"
        subtitle="Il sito, la posta, la sicurezza e gli strumenti."
      >
        <div className="mt-5 border-b border-line" />
      </ScreenHeader>
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        <nav
          aria-label="Sezioni delle impostazioni"
          className="shrink-0 border-line md:w-52 md:overflow-y-auto md:border-r md:p-3 max-md:flex max-md:gap-1.5 max-md:overflow-x-auto max-md:border-b max-md:px-4 max-md:py-2.5 max-md:[scrollbar-width:none]"
        >
          {groups.map((g) => (
            <div key={g.title} className="md:mb-4 max-md:contents">
              <div className="px-2.5 pb-1 text-[12px] font-medium text-fg3 max-md:hidden">{g.title}</div>
              <div className="flex flex-col gap-0.5 max-md:contents">{g.items.map(item)}</div>
            </div>
          ))}
        </nav>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {single ? (
            <SingleDocument collection={single} />
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto">
              {active === 'about' ? (
                <About />
              ) : active === 'ai' ? (
                <AiScreen />
              ) : active === 'updates' ? (
                <UpdatesSettings />
              ) : active === 'tracking' ? (
                <TrackingSettings />
              ) : active === 'import' ? (
                <ImportWordPress />
              ) : active === 'security' || active === 'backups' || active === 'activity' ? (
                <SecuritySettings part={active} onOpenProfile={() => setProfile(true)} />
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
      </div>
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
    <DocumentScreen
      key={`${collection.name}/${locale}`}
      collection={collection}
      id={list.data?.items[0]?.id ?? null}
      embedded
    />
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
                  <span className={`truncate text-[14px] ${m.read ? '' : 'font-semibold'}`}>{from}</span>
                  <span className="shrink-0 text-[12px] text-fg3" title={fullDate(m.createdAt)}>
                    {relativeTime(m.createdAt)}
                  </span>
                  {m.mailed && <span className="shrink-0 text-[12px] text-fg3">· inviato per email</span>}
                </div>
                {!expanded && <p className="truncate text-[13px] text-fg2">{preview}</p>}
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
              <dl className="mt-2 ml-5 space-y-2 rounded-lg border border-line bg-panel2 p-3 text-[14px]">
                {Object.entries(m.data).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[12px] font-medium text-fg3">{k}</dt>
                    <dd className="whitespace-pre-wrap">{v}</dd>
                  </div>
                ))}
                {m.page && <div className="text-[12px] text-fg3">Dalla pagina {m.page}</div>}
              </dl>
            )}
          </li>
        )
      })}
    </ul>
  )
}
