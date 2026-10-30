import { useQuery } from '@tanstack/react-query'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { api, type TextAction } from '../lib/api.ts'
import { cx, MenuItem, MenuSeparator, Popover, toast } from './ui.tsx'

const ACTIONS: [TextAction, string][] = [
  ['rewrite', 'Riscrivi meglio'],
  ['shorten', 'Accorcia'],
  ['expand', 'Allunga'],
  ['fix', 'Correggi errori'],
  ['formal', 'Più formale'],
  ['friendly', 'Più colloquiale'],
]
const LANGUAGES = ['inglese', 'italiano', 'francese', 'tedesco', 'spagnolo', 'portoghese']

/** The AI is set up: actions show only then (and stay out of the way otherwise). */
export function useAiReady(): boolean {
  return !!useQuery({ queryKey: ['ai'], queryFn: api.ai, staleTime: 60_000 }).data?.ai.ready
}

const trigger = (busy: boolean, label: string) =>
  cx(
    'inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-1.5 text-[12px] font-medium text-accent transition-colors hover:bg-accent/10 disabled:opacity-50 [&_svg]:size-3.5',
    busy && 'pointer-events-none',
    !label && 'w-6 justify-center px-0',
  )

/**
 * ✨ next to a text: rewrite, shorten, fix, change the tone, translate, or ask for anything; the
 * result replaces the text (undo brings it back).
 */
export function AiTextMenu({
  text,
  onResult,
  label = '',
}: {
  text: string
  onResult: (text: string) => void
  /** Shown next to the icon; empty: the icon alone. */
  label?: string
}) {
  const ready = useAiReady()
  const { locale } = useSession()
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState('')
  if (!ready) return null

  const run = async (action: TextAction, instruction?: string) => {
    setBusy(true)
    try {
      const res = await api.aiText({ action, text, instruction, locale })
      onResult(res.text)
    } catch (error) {
      toast((error as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      align="end"
      width={230}
      trigger={({ toggle, ref }) => (
        <button
          ref={ref}
          type="button"
          title="Scrivi con l’AI"
          aria-label="Scrivi con l’AI"
          disabled={busy || !text.trim()}
          onClick={toggle}
          className={trigger(busy, label)}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {label}
        </button>
      )}
    >
      {(close) => (
        <div className="p-1">
          {ACTIONS.map(([action, name]) => (
            <MenuItem
              key={action}
              onClick={() => {
                close()
                void run(action)
              }}
            >
              {name}
            </MenuItem>
          ))}
          <MenuSeparator />
          <div className="px-2 pt-1 pb-0.5 text-[12px] font-medium text-fg3">Traduci in</div>
          <div className="flex flex-wrap gap-1 px-2 pb-1.5">
            {LANGUAGES.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  close()
                  void run('translate', l)
                }}
                className="rounded-md border border-line px-1.5 py-0.5 text-[12px] text-fg2 hover:border-accent hover:text-fg"
              >
                {l}
              </button>
            ))}
          </div>
          <MenuSeparator />
          <form
            className="flex items-center gap-1.5 px-2 py-1"
            onSubmit={(e) => {
              e.preventDefault()
              if (!ask.trim()) return
              close()
              void run('custom', ask.trim())
              setAsk('')
            }}
          >
            <Wand2 className="size-3.5 shrink-0 text-fg3" />
            <input
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              placeholder="Chiedi: “più ironico”, “3 punti”…"
              className="h-7 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-fg3"
            />
          </form>
        </div>
      )}
    </Popover>
  )
}

/**
 * One AI action with its own button: an image's alternative text, a page's SEO title or
 * description written from its content.
 */
export function AiButton({
  action,
  text = '',
  src,
  label,
  title,
  onResult,
}: {
  action: Extract<TextAction, 'alt' | 'seo_title' | 'seo_description'>
  text?: string
  src?: string
  label: string
  title?: string
  onResult: (text: string) => void
}) {
  const ready = useAiReady()
  const { locale } = useSession()
  const [busy, setBusy] = useState(false)
  if (!ready) return null
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={busy || (action === 'alt' ? !src : !text.trim())}
      onClick={async () => {
        setBusy(true)
        try {
          onResult((await api.aiText({ action, text, src, locale })).text)
        } catch (error) {
          toast((error as Error).message, 'error')
        } finally {
          setBusy(false)
        }
      }}
      className={trigger(busy, label)}
    >
      {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
      {label}
    </button>
  )
}
