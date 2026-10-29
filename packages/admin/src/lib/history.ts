import { useCallback, useRef, useState } from 'react'

export interface History<T> {
  value: T
  /** Records a change. Changes with the same `group` within a short time merge into one undo step (typing). */
  set: (next: T, group?: string) => void
  /** Replaces the current value without creating an undo step (e.g. values filled in by the server). */
  replace: (value: T) => void
  /** Replaces the value and clears history (e.g. after loading a document). */
  reset: (value: T) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

const MERGE_MS = 800
const LIMIT = 200

export function useHistory<T>(initial: T): History<T> {
  const [state, setState] = useState({ past: [] as T[], value: initial, future: [] as T[] })
  const last = useRef<{ group?: string; at: number }>({ at: 0 })

  const set = useCallback((next: T, group?: string) => {
    const now = Date.now()
    const merge = group !== undefined && last.current.group === group && now - last.current.at < MERGE_MS
    last.current = { group, at: now }
    setState((s) => ({
      past: merge ? s.past : [...s.past, s.value].slice(-LIMIT),
      value: next,
      future: [],
    }))
  }, [])

  const replace = useCallback((value: T) => {
    setState((s) => ({ ...s, value }))
  }, [])

  const reset = useCallback((value: T) => {
    last.current = { at: 0 }
    setState({ past: [], value, future: [] })
  }, [])

  const undo = useCallback(() => {
    last.current = { at: 0 }
    setState((s) => {
      const prev = s.past[s.past.length - 1]
      if (prev === undefined) return s
      return { past: s.past.slice(0, -1), value: prev, future: [s.value, ...s.future] }
    })
  }, [])

  const redo = useCallback(() => {
    last.current = { at: 0 }
    setState((s) => {
      const [next, ...rest] = s.future
      if (next === undefined) return s
      return { past: [...s.past, s.value], value: next, future: rest }
    })
  }, [])

  return {
    value: state.value,
    set,
    replace,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
