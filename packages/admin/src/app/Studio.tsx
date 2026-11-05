// biome-ignore-all lint/suspicious/noArrayIndexKey: the thread only grows
import { useQueryClient } from '@tanstack/react-query'
import { ArrowUp, FileText, ImagePlus, Loader2, RotateCcw, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Prose } from '../components/Prose.tsx'
import { cx, toast } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { navigate } from '../lib/router.ts'
import { shrink } from '../page/Assistant.tsx'

const IDEAS = [
  'Scrivi la descrizione per Google delle pagine che non ce l’hanno',
  'Controlla i testi del Diario: refusi e frasi poco chiare',
  'Prepara una pagina «Domande frequenti» con i dubbi che rispondiamo più spesso',
  'Traduci in inglese le pagine principali',
]

type Item = { me: boolean; text: string } | { step: string }
type Doc = { id: string; collection: string; title: string }

/**
 * The request on the dashboard: in words, about the whole site. The AI changes drafts only, and
 * the drafts it touched are listed to open and review.
 */
export function Studio() {
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [pictures, setPictures] = useState<{ data: string; url: string }[]>([])
  const [thread, setThread] = useState<Item[]>([])
  const [touched, setTouched] = useState<Doc[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const abort = useRef<AbortController | null>(null)
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => () => abort.current?.abort(), [])

  const send = async (message: string) => {
    if (!message.trim() || busy) return
    const images = pictures.map((p) => ({ mime: 'image/jpeg' as const, data: p.data }))
    setThread((t) => [...t, { me: true, text: message.trim() }])
    setText('')
    setPictures([])
    setBusy(true)
    setStep('Leggo la richiesta…')
    const controller = new AbortController()
    abort.current = controller
    try {
      await api.studio(
        { runId: runId ?? undefined, message: message.trim(), images },
        (e) => {
          if (e.type === 'status') setStep(e.text.split('\n')[0] ?? '')
          else if (e.type === 'tool') setStep(`${e.title}…`)
          else if (e.type === 'touched') setTouched((list) => [...list.filter((d) => d.id !== e.doc.id), e.doc])
          else if (e.type === 'text') setThread((t) => [...t, { me: false, text: e.text }])
          else if (e.type === 'error') setThread((t) => [...t, { step: e.message }])
          else if (e.type === 'done') setRunId(e.runId ?? null)
        },
        controller.signal,
      )
    } catch (error) {
      if ((error as Error).name !== 'AbortError')
        setThread((t) => [...t, { step: error instanceof Error ? error.message : 'Errore' }])
    } finally {
      abort.current = null
      setBusy(false)
      setStep('')
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      void queryClient.invalidateQueries({ queryKey: ['list'] })
    }
  }

  const restart = () => {
    abort.current?.abort()
    setThread([])
    setTouched([])
    setRunId(null)
  }

  const started = thread.length > 0

  return (
    <section aria-label="Chiedi all’AI" className="space-y-3">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(text)
        }}
        className="rounded-2xl border border-accent/30 bg-panel p-1.5 shadow-[0_0_0_5px_color-mix(in_oklab,var(--accent)_7%,transparent),0_12px_32px_rgb(10_10_11/0.08)]"
      >
        <label htmlFor="studio-ask" className="sr-only">
          Cosa facciamo oggi sul sito?
        </label>
        <textarea
          id="studio-ask"
          rows={2}
          value={text}
          maxLength={6000}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send(text)
            }
          }}
          placeholder={
            started
              ? 'Rispondi o chiedi altro…'
              : 'Cosa facciamo oggi sul sito? Es. «Scrivi un articolo sul nuovo progetto, con le foto caricate ieri»'
          }
          className="block w-full resize-none bg-transparent px-3 py-2.5 text-[14.5px] leading-relaxed outline-none placeholder:text-fg3"
        />
        <div className="flex flex-wrap items-center gap-1.5 px-1.5 pb-1">
          {pictures.map((p, i) => (
            <span key={p.url} className="relative">
              <img src={p.url} alt="" className="size-8 rounded-md object-cover ring-1 ring-line" />
              <button
                type="button"
                aria-label="Togli l’immagine"
                onClick={() => setPictures((list) => list.filter((_, j) => j !== i))}
                className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-fg text-bg"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          <button
            type="button"
            disabled={busy || pictures.length >= 4}
            onClick={() => file.current?.click()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-fg2 hover:bg-hover hover:text-fg disabled:opacity-40 [&_svg]:size-4"
          >
            <ImagePlus /> Immagine
          </button>
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            hidden
            onChange={async (e) => {
              for (const f of [...(e.target.files ?? [])].slice(0, 4 - pictures.length)) {
                try {
                  const small = await shrink(f)
                  setPictures((list) => [...list, small].slice(0, 4))
                } catch {
                  toast('Non riesco a leggere questa immagine', 'error')
                }
              }
              e.target.value = ''
            }}
          />
          {started && !busy && (
            <button
              type="button"
              onClick={restart}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] text-fg2 hover:bg-hover hover:text-fg [&_svg]:size-3.5"
            >
              <RotateCcw /> Nuova richiesta
            </button>
          )}
          <span className="flex-1" />
          <span className="text-[12px] text-fg3 max-sm:hidden">Tutto resta in bozza</span>
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line2 px-3 text-[13px] font-medium hover:bg-hover [&_svg]:size-3"
            >
              <Square /> Interrompi
            </button>
          ) : (
            <button
              type="submit"
              disabled={!text.trim()}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-semibold text-accent-fg hover:brightness-110 disabled:opacity-40 [&_svg]:size-3.5"
            >
              <ArrowUp /> Prepara
            </button>
          )}
        </div>
      </form>

      {!started && (
        <div className="flex flex-wrap gap-1.5">
          {IDEAS.map((idea) => (
            <button
              key={idea}
              type="button"
              onClick={() => void send(idea)}
              className="rounded-full border border-line bg-panel px-3 py-1.5 text-[12.5px] text-fg2 transition-colors hover:border-accent/50 hover:text-fg"
            >
              {idea}
            </button>
          ))}
        </div>
      )}

      {started && (
        <div className="space-y-3 rounded-2xl border border-line bg-panel p-4">
          {thread.map((m, i) =>
            'step' in m ? (
              <p key={i} className="rounded-lg bg-danger/10 px-3 py-2 text-[13px] text-danger" role="alert">
                {m.step}
              </p>
            ) : m.me ? (
              <p
                key={i}
                className="ml-auto w-fit max-w-[85%] rounded-xl bg-accent/10 px-3 py-2 text-[13px] whitespace-pre-line text-fg"
              >
                {m.text}
              </p>
            ) : (
              <Prose key={i} text={m.text} className="text-[13.5px] leading-relaxed text-fg" />
            ),
          )}
          {busy && (
            <p className="flex items-center gap-2 text-[13px] text-fg2">
              <Loader2 className="size-3.5 shrink-0 animate-spin text-accent" />
              <span className="line-clamp-1">{step || 'Lavoro…'}</span>
            </p>
          )}
          {touched.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-[11px] font-semibold tracking-[0.07em] text-fg3 uppercase">
                Bozze da rivedere
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {touched.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => navigate({ name: 'document', collection: d.collection, id: d.id })}
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[13px] font-medium hover:border-accent/50 hover:bg-hover [&_svg]:size-3.5 [&_svg]:text-fg3',
                    )}
                  >
                    <FileText /> {d.title || 'Senza titolo'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
