import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { cx, Spinner } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { usePref } from '../lib/prefs.ts'
import { useRoute } from '../lib/router.ts'
import { MediaLibrary } from '../media/MediaLibrary.tsx'
import { InviteScreen } from '../people/InviteScreen.tsx'
import { PeopleScreen } from '../people/PeopleScreen.tsx'
import { SettingsScreen } from '../settings/SettingsScreen.tsx'
import { AuthScreen } from './Auth.tsx'
import { CollectionView } from './CollectionView.tsx'
import { CommandPalette } from './CommandPalette.tsx'
import { type Session, SessionContext } from './context.ts'
import { DocumentScreen } from './DocumentScreen.tsx'
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
        return (await api.me()).user
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null
        throw error
      }
    },
  })
  const schema = useQuery({ queryKey: ['schema'], queryFn: api.schema, enabled: !!me.data })

  if (setup.error || me.error || schema.error) {
    return <Fatal message={(setup.error ?? me.error ?? schema.error)?.message ?? ''} />
  }
  if (setup.isPending || me.isPending) return <Loading />
  if (setup.data.needsSetup || !me.data) return <AuthScreen mode={setup.data.needsSetup ? 'setup' : 'login'} />
  if (!schema.data) return <Loading />
  return <Workspace user={me.data} schema={schema.data} />
}

function Workspace({ user, schema }: Pick<Session, 'user' | 'schema'>) {
  const [locale, setLocale] = usePref('mz-locale', schema.locales.default)
  const [palette, setPalette] = useState(false)
  const route = useRoute()
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
      <div className="flex h-full min-h-0 bg-bg">
        {!fullscreen && <Sidebar />}
        <main
          className={cx(
            'flex min-w-0 flex-1 flex-col',
            !fullscreen &&
              'my-2 mr-2 overflow-hidden rounded-xl border border-line bg-panel shadow-[0_1px_2px_rgb(10_10_11/0.04),0_8px_24px_rgb(10_10_11/0.04)]',
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
              key={`${collection.name}/${route.name === 'document' ? route.id : 'new'}/${activeLocale}`}
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
