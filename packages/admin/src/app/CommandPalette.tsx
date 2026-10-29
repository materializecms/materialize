import { useQueries } from '@tanstack/react-query'
import { FileText, Images, Monitor, Moon, Plus, Search, Sun, UserRound } from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cx, Kbd } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { useTheme } from '../lib/prefs.ts'
import { navigate } from '../lib/router.ts'
import { useSession } from './context.ts'
import { collectionIcon } from './Sidebar.tsx'

interface Command {
  id: string
  label: string
  hint?: string
  icon: ReactNode
  group: string
  run: () => void
}

/** ⌘K: jump to any collection or document, create content, switch theme. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { schema, locale, user } = useSession()
  const [, setTheme] = useTheme()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [active, setActive] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setDebounced('')
      setActive(0)
    }
  }, [open])
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 150)
    return () => clearTimeout(t)
  }, [query])

  const searches = useQueries({
    queries: schema.collections.map((c) => ({
      queryKey: ['list', c.name, locale, debounced, 5],
      queryFn: () => api.list(c.name, { locale, search: debounced, limit: 5 }),
      enabled: open && debounced.length > 1,
    })),
  })

  const commands = useMemo(() => {
    const q = query.trim().toLowerCase()
    const match = (text: string) => !q || text.toLowerCase().includes(q)
    const out: Command[] = []
    if (debounced.length > 1) {
      schema.collections.forEach((c, i) => {
        for (const doc of searches[i]?.data?.items ?? []) {
          out.push({
            id: `doc:${doc.id}`,
            label: doc.title,
            hint: c.label,
            icon: <FileText />,
            group: 'Documenti',
            run: () => navigate({ name: 'document', collection: c.name, id: doc.id }),
          })
        }
      })
    }
    for (const c of schema.collections) {
      if (match(c.label)) {
        out.push({
          id: `go:${c.name}`,
          label: c.label,
          icon: collectionIcon(c),
          group: 'Vai a',
          run: () => navigate({ name: 'collection', collection: c.name }),
        })
      }
    }
    if (match('Media immagini libreria')) {
      out.push({
        id: 'go:media',
        label: 'Media',
        icon: <Images />,
        group: 'Vai a',
        run: () => navigate({ name: 'media' }),
      })
    }
    if (user.role === 'admin' && match('Persone inviti utenti')) {
      out.push({
        id: 'go:people',
        label: 'Persone',
        icon: <UserRound />,
        group: 'Vai a',
        run: () => navigate({ name: 'people' }),
      })
    }
    for (const c of schema.collections) {
      if (c.singleton) continue
      const label = `Nuovo in ${c.label}`
      if (match(label) || match('nuovo crea')) {
        out.push({
          id: `new:${c.name}`,
          label,
          icon: <Plus />,
          group: 'Crea',
          run: () => navigate({ name: 'new', collection: c.name }),
        })
      }
    }
    const themes = [
      { id: 'light', label: 'Tema chiaro', icon: <Sun /> },
      { id: 'dark', label: 'Tema scuro', icon: <Moon /> },
      { id: 'system', label: 'Tema come il sistema', icon: <Monitor /> },
    ] as const
    for (const t of themes) {
      if (match(t.label)) out.push({ ...t, id: `theme:${t.id}`, group: 'Preferenze', run: () => setTheme(t.id) })
    }
    return out
  }, [query, debounced, schema.collections, searches, setTheme, user.role])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new result list starts from the top
  useEffect(() => setActive(0), [commands.length])
  // biome-ignore lint/correctness/useExhaustiveDependencies: keep the highlighted row visible
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const run = (c: Command | undefined) => {
    if (!c) return
    onClose()
    c.run()
  }

  let lastGroup = ''
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/25 px-4 pt-[12vh] backdrop-blur-[2px]">
      <button type="button" aria-label="Chiudi" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div
        role="dialog"
        aria-label="Comandi"
        className="mz-pop-in relative w-[560px] max-w-full overflow-hidden rounded-xl border border-line bg-panel shadow-pop"
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search className="size-4 text-fg3" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(a + 1, commands.length - 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(a - 1, 0))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                run(commands[active])
              } else if (e.key === 'Escape') onClose()
            }}
            placeholder="Cerca contenuti o azioni…"
            className="h-12 flex-1 bg-transparent text-[14px] placeholder:text-fg3 focus:outline-none"
          />
          <Kbd>esc</Kbd>
        </div>
        <div ref={list} className="max-h-[360px] overflow-y-auto p-1.5">
          {commands.length === 0 && (
            <div className="px-3 py-8 text-center text-fg3">
              {query.trim() !== debounced || searches.some((s) => s.isFetching) ? 'Ricerca…' : 'Nessun risultato'}
            </div>
          )}
          {commands.map((c, i) => {
            const header = c.group !== lastGroup
            lastGroup = c.group
            return (
              <div key={c.id}>
                {header && <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-fg3">{c.group}</div>}
                <button
                  type="button"
                  data-active={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => run(c)}
                  className={cx(
                    'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-[13px] [&>svg]:size-4 [&_svg]:text-fg2',
                    i === active && 'bg-hover',
                  )}
                >
                  {c.icon}
                  <span className="flex-1 truncate">{c.label}</span>
                  {c.hint && <span className="text-[12px] text-fg3">{c.hint}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
