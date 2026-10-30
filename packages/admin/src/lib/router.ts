import { useSyncExternalStore } from 'react'

const BASE = '/admin'

export type Route =
  | { name: 'home' }
  | { name: 'media' }
  | { name: 'people' }
  /** A built-in tab, or the name of a single-document collection (site settings, contacts…). */
  | {
      name: 'settings'
      tab?: 'mail' | 'messages' | 'seo' | 'ai' | 'languages' | 'security' | 'import' | 'tracking' | (string & {})
    }
  | { name: 'invite'; token: string }
  | { name: 'collection'; collection: string }
  | { name: 'document'; collection: string; id: string }
  | { name: 'new'; collection: string }

export function parse(pathname: string): Route {
  const parts = pathname
    .replace(/^\/admin\/?/, '')
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent)
  const [collection, id] = parts
  if (!collection) return { name: 'home' }
  // Collection names cannot start with "_", so built-in screens never clash with them.
  if (collection === '_media') return { name: 'media' }
  if (collection === '_people') return { name: 'people' }
  if (collection === '_settings')
    return {
      name: 'settings',
      tab:
        (
          {
            messaggi: 'messages',
            lingue: 'languages',
            email: 'mail',
            sicurezza: 'security',
            importa: 'import',
            tracciamento: 'tracking',
          } as Record<string, string>
        )[id ?? ''] ?? id,
    }
  if (collection === '_invite' && id) return { name: 'invite', token: id }
  if (!id) return { name: 'collection', collection }
  if (id === 'new') return { name: 'new', collection }
  return { name: 'document', collection, id }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return `${BASE}/`
    case 'media':
      return `${BASE}/_media`
    case 'people':
      return `${BASE}/_people`
    case 'settings':
      return `${BASE}/_settings${route.tab ? `/${{ messages: 'messaggi', languages: 'lingue', mail: 'email', security: 'sicurezza', import: 'importa', tracking: 'tracciamento' }[route.tab as string] ?? route.tab}` : ''}`
    case 'invite':
      return `${BASE}/_invite/${route.token}`
    case 'collection':
      return `${BASE}/${route.collection}`
    case 'new':
      return `${BASE}/${route.collection}/new`
    case 'document':
      return `${BASE}/${route.collection}/${route.id}`
  }
}

const listeners = new Set<() => void>()
const notify = () => {
  for (const l of listeners) l()
}
window.addEventListener('popstate', notify)

/** Guards let a screen with unsaved changes stop navigation. */
let guard: (() => boolean) | null = null
export function setNavigationGuard(fn: (() => boolean) | null) {
  guard = fn
}

export function navigate(route: Route, options: { replace?: boolean } = {}) {
  if (guard && !guard()) return
  const url = href(route)
  if (url === location.pathname) return
  if (options.replace) history.replaceState(null, '', url)
  else history.pushState(null, '', url)
  notify()
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => location.pathname,
  )
  return parse(pathname)
}
