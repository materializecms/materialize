// biome-ignore-all lint/suspicious/noArrayIndexKey: pieces of a text that never reorders
import type { Theme } from '@materializecms/core/page'
import type { BrandVoice } from '@materializecms/core/voice'
import { useQueryClient } from '@tanstack/react-query'
import { Check, FileText, ImagePlus, Loader2, MessageSquareQuote, Palette, Sparkles, Square, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Prose } from '../components/Prose.tsx'
import { Button, Dialog, Switch, Textarea, toast } from '../components/ui.tsx'
import { api, type BuiltPage } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { navigate } from '../lib/router.ts'
import { shrink } from '../page/Assistant.tsx'

const example = () =>
  t(
    'Es.: Forno Aurora è un panificio di quartiere a Bologna, in via Saragozza. Pane a lievito madre, colazioni e torte su ordinazione. Aperti dal martedì alla domenica, 7–14. Vogliamo far conoscere il forno e ricevere ordini per le torte.',
  )

/** How the voice addresses the reader, as the summary says it. */
const address = (a: 'tu' | 'voi' | 'lei') =>
  a === 'tu' ? t('uso del tu') : a === 'voi' ? t('uso del voi') : t('uso del Lei')

type Phase = 'form' | 'running' | 'done'

/**
 * A first version of the site from a few lines about the business: the AI makes the pages as
 * new drafts and proposes colors, fonts and the brand voice, which are applied only on a click.
 */
export function BriefDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [brief, setBrief] = useState('')
  const [withTheme, setWithTheme] = useState(true)
  const [pictures, setPictures] = useState<{ data: string; url: string }[]>([])
  const [phase, setPhase] = useState<Phase>('form')
  const [step, setStep] = useState('')
  const [created, setCreated] = useState<BuiltPage[]>([])
  const [theme, setTheme] = useState<Theme | null>(null)
  const [voice, setVoice] = useState<BrandVoice | null>(null)
  /** The AI's replies and the person's answers, in order. */
  const [thread, setThread] = useState<{ me: boolean; text: string }[]>([])
  const [runId, setRunId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [applied, setApplied] = useState<{ theme?: boolean; voice?: boolean }>({})
  const [saving, setSaving] = useState<'theme' | 'voice' | null>(null)
  const abort = useRef<AbortController | null>(null)
  const file = useRef<HTMLInputElement>(null)

  useEffect(() => () => abort.current?.abort(), [])

  const reset = () => {
    setPhase('form')
    setStep('')
    setCreated([])
    setTheme(null)
    setVoice(null)
    setThread([])
    setRunId(null)
    setReply('')
    setError('')
    setApplied({})
  }

  const close = () => {
    abort.current?.abort()
    if (phase !== 'form') {
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
      void queryClient.invalidateQueries({ queryKey: ['list'] })
    }
    if (phase === 'done') {
      reset()
      setBrief('')
      setPictures([])
    } else if (phase === 'running') setPhase('done')
    onClose()
  }

  /** A new brief, or (with words) an answer to the AI in the run under way. */
  const start = async (answer?: string) => {
    if (answer) {
      setThread((list) => [...list, { me: true, text: answer }])
      setReply('')
      setError('')
    } else reset()
    setPhase('running')
    setStep(answer ? t('Leggo la risposta…') : t('Leggo il brief…'))
    const id = answer ? runId : null
    setRunId(null)
    const controller = new AbortController()
    abort.current = controller
    try {
      await api.buildSite(
        id && answer
          ? { runId: id, message: answer, theme: withTheme }
          : {
              brief,
              theme: withTheme,
              images: pictures.map((p) => ({ mime: 'image/jpeg' as const, data: p.data })),
            },
        (e) => {
          if (e.type === 'status') setStep(e.text.split('\n')[0] ?? '')
          else if (e.type === 'tool') setStep(`${e.title}…`)
          else if (e.type === 'created') setCreated((list) => [...list, e.doc])
          else if (e.type === 'result') {
            setCreated(e.created)
            setTheme(e.theme)
            setVoice(e.voice)
          } else if (e.type === 'text') setThread((list) => [...list, { me: false, text: e.text }])
          else if (e.type === 'error') setError(e.message)
          else if (e.type === 'done') setRunId(e.runId ?? null)
        },
        controller.signal,
      )
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setError(err instanceof Error ? err.message : t('Errore'))
    } finally {
      abort.current = null
      setPhase('done')
      void queryClient.invalidateQueries({ queryKey: ['overview'] })
    }
  }

  const stop = () => abort.current?.abort()

  const addPictures = async (files: FileList | null) => {
    for (const f of [...(files ?? [])].slice(0, 2 - pictures.length)) {
      try {
        const small = await shrink(f)
        setPictures((list) => [...list, small].slice(0, 2))
      } catch {
        toast(t('Non riesco a leggere questa immagine'), 'error')
      }
    }
  }

  const applyTheme = async () => {
    if (!theme) return
    setSaving('theme')
    try {
      await api.saveTheme(theme)
      void queryClient.invalidateQueries({ queryKey: ['theme'] })
      setApplied((a) => ({ ...a, theme: true }))
      toast(t('Tema applicato a tutto il sito'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Errore', 'error')
    } finally {
      setSaving(null)
    }
  }

  const applyVoice = async () => {
    if (!voice) return
    setSaving('voice')
    try {
      await api.saveVoice(voice)
      void queryClient.invalidateQueries({ queryKey: ['voice'] })
      setApplied((a) => ({ ...a, voice: true }))
      toast(t('Voce del brand salvata'))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Errore', 'error')
    } finally {
      setSaving(null)
    }
  }

  const open_ = (doc: BuiltPage) => {
    close()
    navigate({ name: 'document', collection: doc.collection, id: doc.id })
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      width={580}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="size-4 text-accent" />
          {t('Crea il sito con l’AI')}
        </span>
      }
      footer={
        phase === 'form' ? (
          <>
            <Button onClick={close}>{t('Annulla')}</Button>
            <Button
              variant="primary"
              icon={<Sparkles className="size-3.5" />}
              disabled={brief.trim().length < 20}
              onClick={() => void start()}
            >
              {t('Prepara le bozze')}
            </Button>
          </>
        ) : phase === 'running' ? (
          <Button icon={<Square className="size-3" />} onClick={stop}>
            {t('Interrompi')}
          </Button>
        ) : (
          <>
            <Button onClick={reset}>{t('Nuovo brief')}</Button>
            <Button variant="primary" onClick={close}>
              {t('Fatto')}
            </Button>
          </>
        )
      }
    >
      <div className="max-h-[62vh] overflow-y-auto">
        {phase === 'form' ? (
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed">
              {t(
                'Descrivi l’attività in poche righe: cosa fa, per chi, dove, cosa deve ottenere il sito. L’AI prepara le pagine con le sezioni della libreria, tutte in bozza: niente va online finché non le pubblichi.',
              )}
            </p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-fg">{t('Il brief')}</span>
              <Textarea
                data-autofocus
                rows={5}
                value={brief}
                maxLength={6000}
                placeholder={example()}
                onChange={(e) => setBrief(e.target.value)}
                className="min-h-28"
              />
            </label>
            <div>
              <span className="mb-1.5 block text-[13px] font-medium text-fg">
                {t('Immagini di riferimento')} <span className="font-normal text-fg3">{t('(facoltative)')}</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {pictures.map((p, i) => (
                  <span key={p.url} className="relative">
                    <img src={p.url} alt="" className="size-16 rounded-md object-cover ring-1 ring-line" />
                    <button
                      type="button"
                      aria-label={t('Togli l’immagine')}
                      onClick={() => setPictures((list) => list.filter((_, j) => j !== i))}
                      className="absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full bg-fg text-bg"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                {pictures.length < 2 && (
                  <Button size="sm" icon={<ImagePlus className="size-3.5" />} onClick={() => file.current?.click()}>
                    {t('Aggiungi')}
                  </Button>
                )}
                <input
                  ref={file}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  hidden
                  onChange={(e) => {
                    void addPictures(e.target.files)
                    e.target.value = ''
                  }}
                />
              </div>
              <p className="mt-1.5 text-[12px] text-fg3">
                {t('Un sito o una grafica che ti piace: l’AI ne prende atmosfera e colori, mai testi o marchi.')}
              </p>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-3 py-2.5">
              <span>
                <span className="block text-[13px] font-medium text-fg">{t('Proponi colori e caratteri')}</span>
                <span className="block text-[12px] text-fg3">
                  {t('Una proposta che vedi alla fine e applichi solo se ti convince.')}
                </span>
              </span>
              <Switch checked={withTheme} onChange={setWithTheme} label={t('Proponi colori e caratteri')} />
            </div>
            <p className="text-[12px] text-fg3">
              {t(
                'Usa il modello principale dell’AI e richiede qualche minuto. Le pagine esistenti, i menu condivisi e il sito online non vengono toccati.',
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {phase === 'running' && (
              <div className="flex items-start gap-2 rounded-lg bg-seg px-3 py-2.5 text-[13px]">
                <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-accent" />
                <span className="line-clamp-2 min-w-0">{step || t('Lavoro…')}</span>
              </div>
            )}
            {error && (
              <p className="rounded-lg bg-danger/10 px-3 py-2.5 text-[13px] text-danger" role="alert">
                {error}
                {created.length > 0 && ` ${t('Le bozze già preparate restano.')}`}
              </p>
            )}
            {thread.map((m, i) =>
              m.me ? (
                <p
                  key={i}
                  className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent/10 px-3 py-2 text-[13px] whitespace-pre-line text-fg"
                >
                  {m.text}
                </p>
              ) : (
                <Prose key={i} text={m.text} className="text-[13px] leading-relaxed text-fg" />
              ),
            )}
            {phase === 'done' && runId && (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (reply.trim()) void start(reply.trim())
                }}
              >
                <Textarea
                  rows={1}
                  value={reply}
                  maxLength={4000}
                  placeholder={t('Rispondi all’AI o chiedi altro (es. aggiungi una pagina Chi siamo)')}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
                      e.preventDefault()
                      void start(reply.trim())
                    }
                  }}
                  className="flex-1"
                />
                <Button type="submit" variant="primary" disabled={!reply.trim()}>
                  {t('Invia')}
                </Button>
              </form>
            )}

            {(created.length > 0 || phase === 'running') && (
              <section>
                <h3 className="mb-1.5 text-[12px] font-semibold tracking-[0.06em] text-fg3 uppercase">
                  {t('Bozze preparate')}
                </h3>
                {created.length === 0 ? (
                  <p className="text-[13px] text-fg3">
                    {t('Ancora nessuna: prima l’AI studia il brief e la libreria.')}
                  </p>
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {created.map((doc) => (
                      <li key={doc.id}>
                        <button
                          type="button"
                          onClick={() => open_(doc)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-hover"
                        >
                          <FileText className="size-4 shrink-0 text-fg3" />
                          <span className="min-w-0 flex-1 truncate font-medium text-fg">{doc.title}</span>
                          {doc.url && <span className="truncate text-[12px] text-fg3">{doc.url}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {phase === 'done' && theme && (
              <section className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                      <Palette className="size-3.5" /> {t('Colori e caratteri proposti')}
                    </h3>
                    <p className="mt-0.5 text-[12px] text-fg3">
                      {t('Titoli in {display}, testi in {body}. Vale per tutto il sito, anche online.', {
                        display: theme.display,
                        body: theme.body,
                      })}
                    </p>
                  </div>
                  {applied.theme ? (
                    <span className="flex shrink-0 items-center gap-1 text-[13px] text-ok">
                      <Check className="size-3.5" /> {t('Applicato')}
                    </span>
                  ) : (
                    <Button size="sm" loading={saving === 'theme'} onClick={applyTheme}>
                      {t('Applica il tema')}
                    </Button>
                  )}
                </div>
                <div className="mt-2.5 flex gap-1.5">
                  {(['bg', 'surface', 'text', 'muted', 'accent', 'inverse'] as const).map((k) => (
                    <span
                      key={k}
                      title={`${k} ${theme.colors.light[k]}`}
                      className="h-7 flex-1 rounded-md ring-1 ring-black/10"
                      style={{ background: theme.colors.light[k] }}
                    />
                  ))}
                </div>
              </section>
            )}

            {phase === 'done' && voice && (
              <section className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
                      <MessageSquareQuote className="size-3.5" /> {t('Voce del brand proposta')}
                    </h3>
                    <p className="mt-0.5 text-[12px] leading-relaxed">
                      {[
                        voice.tones?.length ? t('Tono {tones}', { tones: voice.tones.join(', ').toLowerCase() }) : '',
                        voice.address ? address(voice.address) : '',
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      {voice.about ? `. ${voice.about}` : ''}
                    </p>
                  </div>
                  {applied.voice ? (
                    <span className="flex shrink-0 items-center gap-1 text-[13px] text-ok">
                      <Check className="size-3.5" /> {t('Salvata')}
                    </span>
                  ) : (
                    <Button size="sm" loading={saving === 'voice'} onClick={applyVoice}>
                      {t('Salva la voce')}
                    </Button>
                  )}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}
