import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Menu } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cx, Spinner } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { usePref } from '../lib/prefs.ts'
import { href, useRoute } from '../lib/router.ts'
import { MediaLibrary } from '../media/MediaLibrary.tsx'
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
import { Sidebar } from './Sidebar.tsx'

export function App() {
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
  if (setup.data.needsSetup || !me.data) return <AuthScreen mode={setup.data.needsSetup ? 'setup' : 'login'} />
  // The site requires two-step verification: nothing else until it is on.
  if (me.data.needsTwoFactor) return <RequiredTwoFactor />
  if (!schema.data) return <Loading />
  return <Workspace user={me.data.user} schema={schema.data} />
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
    route.name === 'settings' ||
    route.name === 'invite'
      ? undefined
      : schema.collections.find((c) => c.name === route.collection)

  // The page editor takes the whole window; everything else sits in a panel beside the sidebar.
  const fullscreen = (route.name === 'document' || route.name === 'new') && !collection?.singleton

  return (
    <SessionContext.Provider value={session}>
      <div className="flex h-full min-h-0 flex-col bg-bg md:flex-row">
        {!fullscreen && (
          <>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2 md:hidden">
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
              <span className="truncate text-[14px] font-semibold">{schema.site.name}</span>
            </header>
            {drawer && (
              <button
                type="button"
                aria-label="Chiudi il menu"
                onClick={() => setDrawer(false)}
                className="fixed inset-0 z-40 bg-black/40 md:hidden"
              />
            )}
            <div
              className={cx(
                'flex max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-50 max-md:bg-bg max-md:shadow-pop max-md:transition-transform max-md:duration-200',
                !drawer && 'max-md:-translate-x-full max-md:invisible',
              )}
            >
              <Sidebar />
            </div>
          </>
        )}
        <main
          className={cx(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            !fullscreen &&
              'overflow-hidden bg-panel md:my-2 md:mr-2 md:rounded-xl md:border md:border-line md:shadow-[0_1px_2px_rgb(10_10_11/0.04),0_8px_24px_rgb(10_10_11/0.04)]',
          )}
        >
          {route.name === 'home' ? (
            <Overview />
          ) : route.name === 'media' ? (
            <MediaLibrary />
          ) : route.name === 'people' ? (
            <PeopleScreen />
          ) : route.name === 'settings' ? (
            <SettingsScreen tab={route.tab} />
          ) : !collection ? (
            <Fatal
              message={`La collezione "${'collection' in route ? route.collection : ''}" non esiste nello schema.`}
            />
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
        <div className="text-[15px] font-semibold">Qualcosa non va</div>
        <p className="mt-1 text-fg2">{message}</p>
        <button type="button" className="mt-4 text-accent hover:underline" onClick={() => location.assign('/admin/')}>
          Ricarica
        </button>
      </div>
    </div>
  )
}

/** Shown when the site requires two-step verification of everyone and this account has none yet. */
function RequiredTwoFactor() {
  const queryClient = useQueryClient()
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-[420px]">
        <Logo className="mb-6 size-9" />
        <h1 className="text-[20px] font-semibold tracking-tight">Attiva la verifica in due passaggi</h1>
        <p className="mt-1 mb-6 text-fg2">
          Questo sito la richiede a tutti: oltre alla password, per entrare servirà un codice dall’app del telefono.
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
          Esci
        </button>
      </div>
    </div>
  )
}
