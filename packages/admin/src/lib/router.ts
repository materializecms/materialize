import { useSyncExternalStore } from 'react'

const BASE = '/admin'

export type Route =
  | { name: 'home' }
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
  if (!id) return { name: 'collection', collection }
  if (id === 'new') return { name: 'new', collection }
  return { name: 'document', collection, id }
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return `${BASE}/`
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
