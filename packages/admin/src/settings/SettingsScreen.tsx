import { useQuery } from '@tanstack/react-query'
import { Mail, Settings } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { DocumentScreen } from '../app/DocumentScreen.tsx'
import { cx, EmptyState, ScreenHeader, Spinner } from '../components/ui.tsx'
import { api, type CollectionDescription } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
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
  return short ? short.charAt(0).toUpperCase() + short.slice(1) : t('Generale')
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
      title: t('Sito'),
      items: [
        ...singletons.map((c) => ({ value: c.name, label: settingsLabel(c) })),
        { value: 'languages', label: t('Lingue') },
        { value: 'seo', label: t('SEO') },
        { value: 'tracking', label: t('Tracciamento e cookie') },
      ],
    },
    {
      title: t('Comunicazione'),
      items: [
        { value: 'mail', label: t('Email') },
        { value: 'messages', label: t('Messaggi'), badge: unread },
      ],
    },
    {
      title: t('Protezione'),
      items: [
        { value: 'security', label: t('Sicurezza') },
        ...(user.role === 'admin'
          ? [
              { value: 'backups', label: t('Backup') },
              { value: 'activity', label: t('Registro attività') },
            ]
          : []),
      ],
    },
    {
      title: t('Strumenti'),
      items: [
        { value: 'ai', label: t('AI e MCP') },
        { value: 'voice', label: t('Voce del brand') },
        { value: 'import', label: t('Importa') },
        ...(user.role === 'admin' ? [{ value: 'updates', label: t('Aggiornamenti'), dot: !!update }] : []),
        { value: 'about', label: t('Informazioni') },
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
        'flex h-8 shrink-0 items-center gap-2 rounded-full px-3 text-left text-[14px] transition-colors',
        active === it.value ? 'bg-seg font-medium text-fg' : 'text-fg2 hover:bg-hover hover:text-fg',
      )}
    >
      <span className="flex-1 whitespace-nowrap">{it.label}</span>
      {!!it.badge && (
        <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold text-white tabular-nums">
          {it.badge}
        </span>
      )}
      {it.dot && (
        <span title={t('Nuova versione')} className="size-2 rounded-full bg-accent">
          <span className="sr-only">{t('Nuova versione')}</span>
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
        title={t('Impostazioni')}
        subtitle={t('Il sito, la posta, la sicurezza e gli strumenti.')}
      />
      <div className="flex min-h-0 flex-1 max-md:flex-col">
        {/* A pill list on its own; it scrolls (faded at the edges) when the window is short or narrow. */}
        <nav
          aria-label={t('Sezioni delle impostazioni')}
          className="shrink-0 md:w-56 md:overflow-y-auto md:px-4 md:pt-4 md:pb-10 md:pl-5 md:[mask-image:linear-gradient(to_bottom,transparent,#000_1rem,#000_calc(100%-2.5rem),transparent)] md:scroll-pt-6 md:scroll-pb-12 md:[scrollbar-width:thin] max-md:flex max-md:gap-1 max-md:overflow-x-auto max-md:py-3 max-md:pr-10 max-md:pl-4 max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-2.5rem),transparent)] max-md:scroll-px-12 max-md:[scrollbar-width:none]"
        >
          {groups.map((g) => (
            <div key={g.title} className="md:mb-5 max-md:contents">
              <div className="px-3 pb-1.5 text-[11px] font-semibold tracking-[0.07em] text-fg3 uppercase max-md:hidden">
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
                <EmptyState icon={<Mail />} title={t('L’invio delle email lo configura un amministratore')} />
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
