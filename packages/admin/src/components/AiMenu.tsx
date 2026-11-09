import { parseRunsMarkup, runsMarkup } from '@materializecms/core/i18n'
import { type PageNode, plainText } from '@materializecms/core/page'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useSession } from '../app/context.ts'
import { api, type TextAction } from '../lib/api.ts'
import { t } from '../lib/i18n.ts'
import { cx, MenuItem, MenuSeparator, Popover, toast } from './ui.tsx'

const actions = (): [TextAction, string][] => [
  ['rewrite', t('Riscrivi meglio')],
  ['shorten', t('Accorcia')],
  ['expand', t('Allunga')],
  ['fix', t('Correggi errori')],
  ['formal', t('Più formale')],
  ['friendly', t('Più colloquiale')],
]
/** The languages to translate into: the first word goes to the AI as the instruction, the second is shown. */
const languages = (): [string, string][] => [
  ['inglese', t('inglese')],
  ['italiano', t('italiano')],
  ['francese', t('francese')],
  ['tedesco', t('tedesco')],
  ['spagnolo', t('spagnolo')],
  ['portoghese', t('portoghese')],
]

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
  format,
  max,
}: {
  text: string
  onResult: (text: string) => void
  /** Shown next to the icon; empty: the icon alone. */
  label?: string
  /** rich: `text` is rich text as markup (richTextMarkup), and so is the result. */
  format?: 'plain' | 'rich'
  /** The most characters the field takes: the result stays within it. */
  max?: number
}) {
  const ready = useAiReady()
  const { locale } = useSession()
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState('')
  if (!ready) return null

  const run = async (action: TextAction, instruction?: string) => {
    setBusy(true)
    try {
      const res = await api.aiText({ action, text, instruction, locale, format, max })
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
          title={t('Scrivi con l’AI')}
          aria-label={t('Scrivi con l’AI')}
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
          {actions().map(([action, name]) => (
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
          <div className="px-2 pt-1 pb-0.5 text-[12px] font-medium text-fg3">{t('Traduci in')}</div>
          <div className="flex flex-wrap gap-1 px-2 pb-1.5">
            {languages().map(([l, name]) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  close()
                  void run('translate', l)
                }}
                className="rounded-md border border-line px-1.5 py-0.5 text-[12px] text-fg2 hover:border-accent hover:text-fg"
              >
                {name}
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
              placeholder={t('Chiedi: “più ironico”, “3 punti”…')}
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

/**
 * ✨ for a text or a button on the canvas. A text with bold, italic or links goes as markup and
 * comes back with them; the rest as plain text.
 */
export function CanvasTextMenu({ node, onResult }: { node: PageNode; onResult: (patch: Partial<PageNode>) => void }) {
  if (node.type === 'text' && node.runs?.some((r) => r.b || r.i || r.href)) {
    const markup = runsMarkup(node.runs)
    return (
      <AiTextMenu
        text={markup.text}
        format="rich"
        onResult={(text) => {
          const runs = parseRunsMarkup(text, markup.links)
          onResult({ runs, text: runs.map((r) => r.t).join('') })
        }}
      />
    )
  }
  return (
    <AiTextMenu
      text={node.type === 'text' ? plainText(node) : (node.text ?? '')}
      onResult={(text) => onResult(node.type === 'text' ? { text, runs: null } : { text: text.replace(/\n/g, ' ') })}
    />
  )
}
