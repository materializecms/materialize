import { createContext, useContext } from 'react'
import type { CollectionDescription, Schema, User } from '../lib/api.ts'

export interface Session {
  user: User
  schema: Schema
  locale: string
  setLocale: (locale: string) => void
  openPalette: () => void
}

export const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession outside of SessionContext')
  return session
}

export function useCollection(name: string): CollectionDescription | undefined {
  return useSession().schema.collections.find((c) => c.name === name)
}
