import { useQuery } from '@tanstack/react-query'
import { Mail, Settings } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { DocumentScreen } from '../app/DocumentScreen.tsx'
import { cx, EmptyState, ScreenHeader, Spinner } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'
import { ProfileDialog } from '../people/ProfileDialog.tsx'
import { About } from './About.tsx'
import { AiScreen } from './AiSettings.tsx'
import { ImportWordPress } from './ImportWordPress.tsx'
import { LanguagesSettings } from './LanguagesSettings.tsx'
import { MailForm } from './MailSettings.tsx'
import { Messages } from './Messages.tsx'
import { SecuritySettings } from './SecuritySettings.tsx'
import { SeoSettings } from './SeoSettings.tsx'
import { TrackingSettings } from './TrackingSettings.tsx'
import { UpdatesSettings, useUpdateAvailable } from './UpdatesSettings.tsx'
import { VoiceSettings } from './VoiceSettings.tsx'

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
        { value: 'voice', label: 'Voce del brand' },
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
            <div key={g.title} className="md:mb-5 max-md:contents">
              <div className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.07em] text-fg uppercase max-md:hidden">
                {g.title}
              </div>
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
              ) : active === 'voice' ? (
                <VoiceSettings editable={user.role === 'admin'} />
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
