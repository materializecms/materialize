import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Compass, Menu } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button, cx, EmptyState, Spinner } from '../components/ui.tsx'
import { ApiError, api, type User } from '../lib/api.ts'
import { setLang, t, useLang } from '../lib/i18n.ts'
import { usePref } from '../lib/prefs.ts'
import { href, navigate, useRoute } from '../lib/router.ts'
import { MediaLibrary } from '../media/MediaLibrary.tsx'
import { NewsletterScreen } from '../newsletter/NewsletterScreen.tsx'
import { InviteScreen } from '../people/InviteScreen.tsx'
import { PeopleScreen } from '../people/PeopleScreen.tsx'
import { TwoFactorSetup } from '../people/Security.tsx'
import { SettingsScreen } from '../settings/SettingsScreen.tsx'
import { AuthScreen, Logo } from './Auth.tsx'
import { CollectionView } from './CollectionView.tsx'
import { CommandPalette } from './CommandPalette.tsx'
import { type Session, SessionContext } from './context.ts'
import { DocumentScreen, openedAsNew } from './DocumentScreen.tsx'
import { Overview } from './Overview.tsx'
import { PanelTour } from './PanelTour.tsx'
import { ReleasesScreen } from './ReleasesScreen.tsx'
import { SetupWizard } from './Setup.tsx'
import { Sidebar } from './Sidebar.tsx'
import { WorkspaceTools } from './WorkspaceTools.tsx'

export function App() {
  // The whole panel is drawn again in the new language when it changes.
  const lang = useLang()
  return <Routed key={lang} />
}

function Routed() {
  const route = useRoute()
  // One-time links work without signing in, so they come before everything else.
  if (route.name === 'invite') return <InviteScreen token={route.token} />
  return <SignedIn />
}

function SignedIn() {
  const setup = useQuery({ queryKey: ['setup'], queryFn: api.setupStatus })
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.me()
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  })
  const schema = useQuery({
    queryKey: ['schema'],
    queryFn: api.schema,
    enabled: !!me.data && !me.data.needsTwoFactor,
  })

  if (setup.error || me.error || schema.error) {
    return <Fatal message={(setup.error ?? me.error ?? schema.error)?.message ?? ''} />
  }
  if (setup.isPending || me.isPending) return <Loading />
  if (setup.data.needsSetup) return <SetupWizard status={setup.data} />
  if (!me.data) return <AuthScreen />
  // The site requires two-step verification: nothing else until it is on.
  if (me.data.needsTwoFactor) return <RequiredTwoFactor />
  if (!schema.data) return <Loading />
  return (
    <>
      <WithLanguage locale={me.data.user.locale} />
      <Workspace user={me.data.user} schema={schema.data} />
    </>
  )
}

/** The language the person chose for the panel, once they are signed in. */
function WithLanguage({ locale }: { locale: User['locale'] }) {
  useEffect(() => {
    if (locale !== undefined) setLang(locale)
  }, [locale])
  return null
}

function Workspace({ user, schema }: Pick<Session, 'user' | 'schema'>) {
  const [locale, setLocale] = usePref('mz-locale', schema.locales.default)
  const [palette, setPalette] = useState(false)
  // On phones and small tablets the sidebar is a drawer, opened from the top bar.
  const [drawer, setDrawer] = useState(false)
  const route = useRoute()
  // Closed when the page changes (the route object is new at every render: compare its address).
  const address = href(route)
  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer when the address changes
  useEffect(() => setDrawer(false), [address])
  const queryClient = useQueryClient()
  const activeLocale = schema.locales.available.includes(locale) ? locale : schema.locales.default

  // The schema changes while developers edit materialize.config.ts: refresh it when the tab regains focus.
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['schema'] })
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [queryClient])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawer(false)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const session = useMemo<Session>(
    () => ({ user, schema, locale: activeLocale, setLocale, openPalette: () => setPalette(true) }),
    [user, schema, activeLocale, setLocale],
  )

  const collection =
    route.name === 'home' ||
    route.name === 'media' ||
    route.name === 'people' ||
    route.name === 'releases' ||
    route.name === 'newsletter' ||
    route.name === 'settings' ||
    route.name === 'invite'
      ? undefined
      : schema.collections.find((c) => c.name === route.collection)

  // The page editor takes the whole window; everything else sits in a panel beside the sidebar.
  const fullscreen = (route.name === 'document' || route.name === 'new') && !collection?.singleton

  return (
    <SessionContext.Provider value={session}>
      <div className="flex h-full min-h-0 flex-col bg-shell md:flex-row">
        {!fullscreen && (
          <>
            <header className="flex h-14 shrink-0 items-center gap-2 px-2 md:hidden">
              <button
                type="button"
                aria-label="Menu"
                aria-expanded={drawer}
                onClick={() => setDrawer(true)}
                className="flex size-9 items-center justify-center rounded-lg hover:bg-hover"
              >
                <Menu className="size-5" />
              </button>
              <Logo className="size-6" />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{schema.site.name}</span>
              <div className="flex shrink-0 items-center gap-1.5">
                <WorkspaceTools compact />
              </div>
            </header>
            {drawer && (
              <button
                type="button"
                aria-label={t('Chiudi il menu')}
                onClick={() => setDrawer(false)}
                className="fixed inset-0 z-40 bg-black/40 md:hidden"
              />
            )}
            <div
              className={cx(
                'flex max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:bg-shell max-md:shadow-pop max-md:transition-transform max-md:duration-200',
                !drawer && 'max-md:-translate-x-full max-md:invisible',
              )}
            >
              <Sidebar />
            </div>
          </>
        )}
        <main
          className={cx(
            'relative flex min-h-0 min-w-0 flex-1 flex-col',
            !fullscreen &&
              'overflow-hidden bg-panel max-md:mx-2 max-md:mb-2 max-md:rounded-[20px] md:my-2.5 md:mr-2.5 md:rounded-[24px] md:pt-12',
          )}
        >
          {!fullscreen && (
            <div className="mz-notch absolute top-0 right-10 z-20 max-md:hidden">
              <WorkspaceTools />
            </div>
          )}
          {route.name === 'home' ? (
            <Overview />
          ) : route.name === 'media' ? (
            <MediaLibrary />
          ) : route.name === 'people' ? (
            <PeopleScreen />
          ) : route.name === 'releases' ? (
            <ReleasesScreen />
          ) : route.name === 'newsletter' ? (
            <NewsletterScreen view={route.view} />
          ) : route.name === 'settings' ? (
            <SettingsScreen tab={route.tab} />
          ) : !collection ? (
            <NotFound name={route.name === 'collection' ? route.collection : ''} />
          ) : route.name === 'collection' ? (
            <CollectionView key={collection.name} collection={collection} />
          ) : (
            <DocumentScreen
              key={`${collection.name}/${route.name === 'document' && !openedAsNew.has(route.id) ? route.id : 'new'}/${activeLocale}`}
              collection={collection}
              id={route.name === 'document' ? route.id : null}
            />
          )}
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <PanelTour onHome={route.name === 'home'} />
    </SessionContext.Provider>
  )
}

function Loading() {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <Spinner />
    </div>
  )
}

function Fatal({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-1 items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="text-[15px] font-semibold">{t('Qualcosa non va')}</div>
        <p className="mt-1 text-fg2">{message}</p>
        <button type="button" className="mt-4 text-accent hover:underline" onClick={() => location.assign('/admin/')}>
          {t('Ricarica')}
        </button>
      </div>
    </div>
  )
}

/** Shown when the site requires two-step verification of everyone and this account has none yet. */
function RequiredTwoFactor() {
  const queryClient = useQueryClient()
  return (
    <div className="mz-backdrop flex min-h-full items-center justify-center px-4 py-12">
      <div className="mz-card w-full max-w-[468px]">
        <Logo className="mb-6 size-9" />
        <h1 className="text-[20px] font-semibold tracking-tight">{t('Attiva la verifica in due passaggi')}</h1>
        <p className="mt-1 mb-6 text-fg2">
          {t(
            'Questo sito la richiede a tutti: oltre alla password, per entrare servirà un codice dall’app del telefono.',
          )}
        </p>
        <TwoFactorSetup onDone={() => void queryClient.invalidateQueries()} />
        <button
          type="button"
          className="mt-6 text-[13px] text-fg2 hover:text-fg"
          onClick={async () => {
            await api.logout().catch(() => {})
            queryClient.clear()
            location.assign('/admin/')
          }}
        >
          {t('Esci')}
        </button>
      </div>
    </div>
  )
}

/** Built-in screens typed by hand without the "_" (/admin/media): used when no collection has the name. */
const BUILT_IN: Record<string, 'media' | 'people' | 'releases' | 'settings' | 'newsletter'> = {
  newsletter: 'newsletter',
  releases: 'releases',
  rilasci: 'releases',
  media: 'media',
  people: 'people',
  persone: 'people',
  settings: 'settings',
  impostazioni: 'settings',
}

/** An address of the panel that leads nowhere: a typo, an old link, a removed collection. */
function NotFound({ name }: { name: string }) {
  const screen = BUILT_IN[name]
  useEffect(() => {
    if (screen) navigate({ name: screen }, { replace: true })
  }, [screen])
  if (screen) return null
  return (
    <EmptyState icon={<Compass />} title={t('Questa pagina del pannello non esiste')}>
      <p>{t('L’indirizzo potrebbe essere sbagliato, oppure la sezione è stata tolta.')}</p>
      <div className="mt-4 flex justify-center">
        <Button variant="primary" onClick={() => navigate({ name: 'home' })}>
          {t('Torna alla panoramica')}
        </Button>
      </div>
    </EmptyState>
  )
}
