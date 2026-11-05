import type { PageNode } from '@materializecms/core/page'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, ImagePlus, Loader2, RotateCcw, Sparkles, Square, Wrench, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSession } from '../app/context.ts'
import { useAiReady } from '../components/AiMenu.tsx'
import { Prose } from '../components/Prose.tsx'
import { cx, IconButton, toast } from '../components/ui.tsx'
import { api, type ChatEvent } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'

/** A reference picture: made smaller here, sent as base64, shown from its own small copy. */
interface Picture {
  id: number
  data: string
  url: string
}

const MAX_PICTURES = 4
/** The longest side sent to the model: enough to read a layout, a fraction of the tokens. */
const MAX_SIDE = 1600

/** A picture as a JPEG of at most MAX_SIDE pixels (transparent parts on white). */
export async function shrink(file: File): Promise<{ data: string; url: string }> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Il browser non riesce a leggere l’immagine')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const url = canvas.toDataURL('image/jpeg', 0.88)
  return { data: url.slice(url.indexOf(',') + 1), url }
}

type Entry =
  | { kind: 'user'; text: string; pictures?: string[] }
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
  const [pictures, setPictures] = useState<Picture[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
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

  const attach = async (files: Iterable<File>) => {
    const images = [...files].filter((f) => /^image\/(png|jpeg|webp|gif)$/.test(f.type))
    if (!images.length) return toast('Allega un’immagine PNG, JPEG o WebP', 'error')
    const room = MAX_PICTURES - pictures.length
    if (images.length > room) toast(`Al massimo ${MAX_PICTURES} immagini per messaggio`, 'error')
    for (const file of images.slice(0, Math.max(0, room))) {
      try {
        const small = await shrink(file)
        setPictures((ps) => (ps.length < MAX_PICTURES ? [...ps, { id: seq.current++, ...small }] : ps))
      } catch {
        toast(`Non riesco a leggere “${file.name}”`, 'error')
      }
    }
  }

  const send = async (typed: string) => {
    const sent = pictures
    if ((!typed.trim() && !sent.length) || running) return
    const text = typed.trim() || 'Usa questa immagine come riferimento per la pagina.'
    setDraft('')
    setPictures([])
    add({ kind: 'user', text, pictures: sent.map((p) => p.url) })
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
        {
          chatId: chatId.current,
          message: text,
          nodes: nodesRef.current,
          page,
          selected: selection,
          images: sent.map((p) => ({ mime: 'image/jpeg', data: p.data })),
        },
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
    setPictures([])
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
        <span className="flex-1 text-[13px] font-semibold">Assistente</span>
        <IconButton label="Nuova conversazione" onClick={reset} disabled={!items.length}>
          <RotateCcw />
        </IconButton>
      </header>
      <div ref={list} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5">
        {!items.length && (
          <div className="space-y-3">
            <p className="text-[13px] leading-relaxed text-fg2">
              Chiedi cosa cambiare in questa pagina: nuove sezioni, testi, colori, immagini.
              {selection.length > 0 && ' Puoi dire “questo” per l’elemento selezionato.'} Puoi allegare, incollare o
              trascinare un’immagine di riferimento, per esempio lo screenshot di un sito che ti piace. Le modifiche si
              annullano con ⌘Z e restano in bozza.
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-md border border-line px-2.5 py-1.5 text-left text-[12.5px] text-fg2 transition-colors hover:border-accent hover:text-fg"
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
              className="ml-6 rounded-lg rounded-br-sm bg-accent/12 px-2.5 py-1.5 text-[13px] whitespace-pre-wrap"
            >
              {!!it.pictures?.length && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {it.pictures.map((url) => (
                    <img key={url.slice(-32)} src={url} alt="" className="size-14 rounded-md object-cover" />
                  ))}
                </div>
              )}
              {it.text}
            </div>
          ) : it.kind === 'assistant' ? (
            <Prose key={it.id} text={it.text} className="text-[13px] leading-relaxed" />
          ) : it.kind === 'step' ? (
            <div
              key={it.id}
              className="flex items-start gap-1.5 text-[12px] leading-snug text-fg3 [&_svg]:mt-px [&_svg]:size-3 [&_svg]:shrink-0"
            >
              {it.tool ? <Wrench /> : <Sparkles />}
              <span className="line-clamp-3">{it.text}</span>
            </div>
          ) : (
            <div key={it.id} className="rounded-md bg-danger/10 px-2.5 py-1.5 text-[12.5px] text-danger">
              {it.text}
            </div>
          ),
        )}
        {running && (
          <div className="flex items-center gap-1.5 text-[12px] text-fg3">
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
        onDragOver={(e) => {
          if (![...e.dataTransfer.types].includes('Files')) return
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return
          e.preventDefault()
          setDragging(false)
          void attach(e.dataTransfer.files)
        }}
      >
        {pictures.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {pictures.map((p) => (
              <div key={p.id} className="relative">
                <img
                  src={p.url}
                  alt="Immagine di riferimento"
                  className="size-14 rounded-md border border-line object-cover"
                />
                <button
                  type="button"
                  aria-label="Togli l’immagine"
                  onClick={() => setPictures((ps) => ps.filter((x) => x.id !== p.id))}
                  className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full border border-line bg-panel text-fg2 shadow-pop hover:text-fg [&_svg]:size-3"
                >
                  <X />
                </button>
              </div>
            ))}
          </div>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) void attach(e.target.files)
            e.target.value = ''
          }}
        />
        <div
          className={cx(
            'flex items-end gap-1.5 rounded-lg border border-line2 bg-input p-1.5 focus-within:border-accent',
            dragging && 'border-accent bg-accent/5',
          )}
        >
          <IconButton
            label="Allega un’immagine di riferimento"
            onClick={() => fileInput.current?.click()}
            disabled={running || pictures.length >= MAX_PICTURES}
          >
            <ImagePlus />
          </IconButton>
          <textarea
            value={draft}
            rows={Math.min(6, Math.max(1, draft.split('\n').length))}
            placeholder="Chiedi una modifica…"
            onChange={(e) => setDraft(e.target.value)}
            onPaste={(e) => {
              const files = [...e.clipboardData.files]
              if (!files.some((f) => f.type.startsWith('image/'))) return
              e.preventDefault()
              void attach(files)
            }}
            onKeyDown={(e) => {
              // The editor's shortcuts stay out of the conversation.
              e.stopPropagation()
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void send(draft)
              }
            }}
            className="min-w-0 flex-1 resize-none bg-transparent px-1 py-0.5 text-[13px] leading-snug outline-none placeholder:text-fg3"
          />
          {running ? (
            <IconButton label="Interrompi" onClick={() => abort.current?.abort()}>
              <Square className="fill-current" />
            </IconButton>
          ) : (
            <button
              type="submit"
              aria-label="Invia"
              disabled={!draft.trim() && !pictures.length}
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
