import type { PageNode } from '@materializecms/core/page'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, Loader2, RotateCcw, Sparkles, Square, Wrench } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { useAiReady } from '../components/AiMenu.tsx'
import { cx, IconButton, toast } from '../components/ui.tsx'
import { api, type ChatEvent } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'

type Entry =
  | { kind: 'user'; text: string }
  | { kind: 'assistant'; text: string }
  | { kind: 'step'; text: string; tool?: boolean }
  | { kind: 'error'; text: string }
type Item = Entry & { id: number }

const SUGGESTIONS = [
  'Aggiungi una sezione con tre piani e i prezzi',
  'Rendi la prima sezione più essenziale',
  'Migliora i testi di questa pagina',
  'Traduci i testi in inglese',
]

/**
 * The assistant beside the canvas: asked in words, it reads and changes the page open in the
 * editor (and can look at the rest of the site). Its changes land in one step that ⌘Z undoes.
 */
export function AssistantPanel({
  nodes,
  selection,
  page,
  onApply,
}: {
  nodes: PageNode[]
  selection: string[]
  page: { title: string; collection: string; url?: string | null }
  onApply: (nodes: PageNode[]) => void
}) {
  const ready = useAiReady()
  const { user } = useSession()
  const queryClient = useQueryClient()
  const [items, setItems] = useState<Item[]>([])
  const seq = useRef(0)
  const add = (entry: Entry) => setItems((xs) => [...xs, { ...entry, id: seq.current++ }])
  const [draft, setDraft] = useState('')
  const [running, setRunning] = useState(false)
  const chatId = useRef<string | undefined>(undefined)
  const abort = useRef<AbortController | null>(null)
  const list = useRef<HTMLDivElement>(null)
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the conversation as it grows
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' })
  }, [items])

  const send = async (text: string) => {
    if (!text.trim() || running) return
    setDraft('')
    add({ kind: 'user', text: text.trim() })
    setRunning(true)
    const controller = new AbortController()
    abort.current = controller
    const touched = new Set<string>()
    const onEvent = (e: ChatEvent) => {
      if (e.type === 'tool') {
        touched.add(e.name)
        add({ kind: 'step', text: e.title, tool: true })
      } else if (e.type === 'status') add({ kind: 'step', text: e.text })
      else if (e.type === 'text') e.text && add({ kind: 'assistant', text: e.text })
      else if (e.type === 'error') add({ kind: 'error', text: e.message })
      else if (e.type === 'page') {
        onApply(e.nodes)
        toast('Modifiche dell’assistente applicate · ⌘Z per annullare')
      } else if (e.type === 'done') chatId.current = e.chatId
    }
    try {
      await api.chat(
        { chatId: chatId.current, message: text.trim(), nodes: nodesRef.current, page, selected: selection },
        onEvent,
        controller.signal,
      )
    } catch (error) {
      if ((error as Error).name !== 'AbortError') add({ kind: 'error', text: (error as Error).message })
      else add({ kind: 'error', text: 'Interrotto.' })
    } finally {
      setRunning(false)
      abort.current = null
      // What it changed elsewhere shows up in the panel too.
      if (touched.has('update_theme')) void queryClient.invalidateQueries({ queryKey: ['theme'] })
      if (touched.has('upload_media_from_url')) void queryClient.invalidateQueries({ queryKey: ['media'] })
      if (touched.has('create_entry') || touched.has('update_entry'))
        void queryClient.invalidateQueries({ queryKey: ['list'] })
    }
  }

  const reset = () => {
    abort.current?.abort()
    chatId.current = undefined
    setItems([])
  }

  if (!ready)
    return (
      <div className="space-y-3 p-4 text-[13px] leading-relaxed text-fg2">
        <p className="flex items-center gap-2 font-semibold text-fg">
          <Sparkles className="size-4 text-accent" /> Assistente
        </p>
        <p>Per usarlo serve un modello AI: Claude con una chiave di Anthropic, o un server compatibile OpenAI.</p>
        {user.role === 'admin' ? (
          <button
            type="button"
            onClick={() => navigate({ name: 'settings', tab: 'ai' })}
            className="font-medium text-accent hover:underline"
          >
            Configura in Impostazioni → AI e MCP
          </button>
        ) : (
          <p className="text-fg3">Chiedi a un amministratore di configurarlo.</p>
        )}
      </div>
    )

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-3.5">
        <Sparkles className="size-4 text-accent" />
        <span className="flex-1 text-[12.5px] font-semibold">Assistente</span>
        <IconButton label="Nuova conversazione" onClick={reset} disabled={!items.length}>
          <RotateCcw />
        </IconButton>
      </header>
      <div ref={list} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {!items.length && (
          <div className="space-y-3">
            <p className="text-[12.5px] leading-relaxed text-fg2">
              Chiedi cosa cambiare in questa pagina: nuove sezioni, testi, colori, immagini.
              {selection.length > 0 && ' Puoi dire “questo” per l’elemento selezionato.'} Le modifiche si annullano con
              ⌘Z e restano in bozza.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-md border border-line px-2.5 py-1.5 text-left text-[12px] text-fg2 transition-colors hover:border-accent hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {items.map((it) =>
          it.kind === 'user' ? (
            <div
              key={it.id}
              className="ml-6 rounded-lg rounded-br-sm bg-accent/12 px-2.5 py-1.5 text-[12.5px] whitespace-pre-wrap"
            >
              {it.text}
            </div>
          ) : it.kind === 'assistant' ? (
            <div key={it.id} className="text-[12.5px] leading-relaxed whitespace-pre-wrap">
              {it.text}
            </div>
          ) : it.kind === 'step' ? (
            <div
              key={it.id}
              className="flex items-start gap-1.5 text-[11.5px] leading-snug text-fg3 [&_svg]:mt-px [&_svg]:size-3 [&_svg]:shrink-0"
            >
              {it.tool ? <Wrench /> : <Sparkles />}
              <span className="line-clamp-3">{it.text}</span>
            </div>
          ) : (
            <div key={it.id} className="rounded-md bg-danger/10 px-2.5 py-1.5 text-[12px] text-danger">
              {it.text}
            </div>
          ),
        )}
        {running && (
          <div className="flex items-center gap-1.5 text-[11.5px] text-fg3">
            <Loader2 className="size-3 animate-spin" /> Sto lavorando…
          </div>
        )}
      </div>
      <form
        className="shrink-0 border-t border-line p-2.5"
        onSubmit={(e) => {
          e.preventDefault()
          void send(draft)
        }}
      >
        <div className="flex items-end gap-1.5 rounded-lg border border-line2 bg-input p-1.5 focus-within:border-accent">
          <textarea
            value={draft}
            rows={Math.min(6, Math.max(1, draft.split('\n').length))}
            placeholder="Chiedi una modifica…"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // The editor's shortcuts stay out of the conversation.
              e.stopPropagation()
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(draft)
              }
            }}
            className="min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-[12.5px] leading-snug outline-none placeholder:text-fg3"
          />
          {running ? (
            <IconButton label="Interrompi" onClick={() => abort.current?.abort()}>
              <Square className="fill-current" />
            </IconButton>
          ) : (
            <button
              type="submit"
              aria-label="Invia"
              disabled={!draft.trim()}
              className={cx(
                'flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-white transition-opacity disabled:opacity-35',
              )}
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
