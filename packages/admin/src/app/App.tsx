import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { Spinner } from '../components/ui.tsx'
import { ApiError, api } from '../lib/api.ts'
import { usePref } from '../lib/prefs.ts'
import { navigate, useRoute } from '../lib/router.ts'
import { MediaLibrary } from '../media/MediaLibrary.tsx'
import { InviteScreen } from '../people/InviteScreen.tsx'
import { PeopleScreen } from '../people/PeopleScreen.tsx'
import { AuthScreen } from './Auth.tsx'
import { CollectionView } from './CollectionView.tsx'
import { CommandPalette } from './CommandPalette.tsx'
import { type Session, SessionContext } from './context.ts'
import { DocumentScreen } from './DocumentScreen.tsx'
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

  const first = schema.collections.find((c) => !c.singleton) ?? schema.collections[0]
  useEffect(() => {
    if (route.name === 'home' && first) navigate({ name: 'collection', collection: first.name }, { replace: true })
  }, [route.name, first])

  const session = useMemo<Session>(
    () => ({ user, schema, locale: activeLocale, setLocale, openPalette: () => setPalette(true) }),
    [user, schema, activeLocale, setLocale],
  )

  const collection =
    route.name === 'home' || route.name === 'media' || route.name === 'people' || route.name === 'invite'
      ? undefined
      : schema.collections.find((c) => c.name === route.collection)

  return (
    <SessionContext.Provider value={session}>
      <div className="flex h-full min-h-0">
        {(route.name === 'home' ||
          route.name === 'media' ||
          route.name === 'people' ||
          route.name === 'collection' ||
          collection?.singleton) && <Sidebar />}
        <main className="flex min-w-0 flex-1 flex-col">
          {route.name === 'home' ? (
            <Loading />
          ) : route.name === 'media' ? (
            <MediaLibrary />
          ) : route.name === 'people' ? (
            <PeopleScreen />
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
