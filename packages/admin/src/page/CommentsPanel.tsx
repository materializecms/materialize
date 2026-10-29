import { findNode, type PageNode } from '@materializecms/core/page'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, MessageSquare, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { cx, IconButton, toast } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { relativeTime } from '../lib/format.ts'
import { typeLabel } from './Canvas.tsx'

/** Notes on the page for whoever works on it: pinned to an element, or to the whole page. */
export function CommentsPanel({
  docId,
  nodes,
  selected,
  onSelect,
}: {
  docId: string | undefined
  nodes: PageNode[]
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { user } = useSession()
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: ['comments', docId],
    queryFn: () => api.comments(docId as string),
    enabled: !!docId,
    refetchInterval: 15_000,
  })
  const [text, setText] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['comments', docId] })
  const target = findNode(nodes, selected)?.node ?? null
  const items = (list.data?.items ?? []).filter((c) => showResolved || !c.resolved)
  const nameOf = (id: string | null) => {
    const n = id ? findNode(nodes, id)?.node : null
    return id ? (n ? n.name || typeLabel(n) : 'Elemento rimosso') : 'Pagina'
  }

  if (!docId) return <p className="px-3.5 py-4 text-[12px] text-fg3">Salva la pagina per lasciare commenti.</p>

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3.5 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold">Commenti</span>
          <label className="flex items-center gap-1.5 text-[11.5px] text-fg2">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
            Mostra risolti
          </label>
        </div>
        <form
          className="mt-2.5 space-y-1.5"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!text.trim()) return
            try {
              await api.addComment(docId, { nodeId: target?.id ?? null, body: text.trim() })
              setText('')
              refresh()
            } catch (error) {
              toast((error as Error).message, 'error')
            }
          }}
        >
          <textarea
            aria-label="Nuovo commento"
            value={text}
            rows={3}
            placeholder={target ? `Un commento su “${nameOf(target.id)}”…` : 'Un commento sulla pagina…'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
            }}
            className="w-full rounded-md border border-line2 bg-input px-2 py-1.5 text-[12.5px] outline-none focus:border-accent"
          />
          <div className="flex items-center justify-between">
            <span className="truncate text-[11px] text-fg3">
              {target ? 'Sull’elemento selezionato' : 'Seleziona un elemento per commentarlo'} · ⌘↵
            </span>
            <button
              type="submit"
              disabled={!text.trim()}
              className="h-7 rounded-md bg-accent px-2.5 text-[12px] font-medium text-white disabled:opacity-40"
            >
              Commenta
            </button>
          </div>
        </form>
      </div>
      <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {items.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-10 text-center text-[12px] text-fg3">
            <MessageSquare className="size-5" />
            Nessun commento aperto.
          </li>
        )}
        {items.map((c) => (
          <li key={c.id} className={cx('px-3.5 py-3', c.resolved && 'opacity-55')}>
            <div className="flex items-center gap-1.5">
              <span className="truncate text-[12.5px] font-semibold">{c.authorName || 'Qualcuno'}</span>
              <span className="shrink-0 text-[11px] text-fg3">{relativeTime(c.createdAt)}</span>
              <span className="flex-1" />
              <IconButton
                label={c.resolved ? 'Riapri' : 'Risolvi'}
                className="size-6"
                onClick={async () => {
                  await api.resolveComment(c.id, !c.resolved)
                  refresh()
                }}
              >
                {c.resolved ? <RotateCcw /> : <Check />}
              </IconButton>
              {(c.authorId === user.id || user.role === 'admin') && (
                <IconButton
                  label="Elimina"
                  className="size-6 hover:text-danger"
                  onClick={async () => {
                    await api.removeComment(c.id)
                    refresh()
                  }}
                >
                  <Trash2 />
                </IconButton>
              )}
            </div>
            <button
              type="button"
              onClick={() => onSelect(c.nodeId)}
              className="mt-0.5 block truncate text-left text-[11px] text-accent hover:underline"
            >
              {nameOf(c.nodeId)}
            </button>
            <p className="mt-1 text-[12.5px] leading-relaxed whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
