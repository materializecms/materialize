import { Sparkles, Wand2, X } from 'lucide-react'
import { useState } from 'react'
import { useAiReady } from '../components/AiMenu.tsx'
import { Button, cx, toast } from '../components/ui.tsx'
import { api, type Data, type ReviewIssue } from '../lib/api.ts'

const KIND: Record<ReviewIssue['kind'], string> = {
  spelling: 'Ortografia',
  grammar: 'Grammatica',
  voice: 'Voce del brand',
  consistency: 'Incoerenza',
  link: 'Link',
  clarity: 'Chiarezza',
}

const plain = (s: string) => s.replace(/<[^>]+>/g, '')

/** Reviews by document, kept while the panel is open: switching tab does not lose a paid review. */
const kept = new Map<string, { issues: ReviewIssue[]; reviewed: string }>()

/**
 * The AI review of a page before publishing: started by hand (each review is a paid request),
 * each finding with the exact words, the replacement and why. «Applica» changes the draft as one
 * step, which ⌘Z undoes.
 */
export function Review({
  docId,
  data,
  onApply,
  onSelect,
  className,
}: {
  docId?: string
  data: Data
  /** The draft with a suggestion applied. */
  onApply: (next: Data) => void
  onSelect?: (node: string) => void
  className?: string
}) {
  const ready = useAiReady()
  const [issues, setIssuesState] = useState<ReviewIssue[] | null>(
    () => (docId ? kept.get(docId)?.issues : null) ?? null,
  )
  const [reviewed, setReviewedState] = useState<string | null>(() => (docId ? kept.get(docId)?.reviewed : null) ?? null)
  const remember = (next: { issues?: ReviewIssue[]; reviewed?: string }) => {
    if (!docId) return
    const before = kept.get(docId)
    kept.set(docId, { issues: next.issues ?? before?.issues ?? [], reviewed: next.reviewed ?? before?.reviewed ?? '' })
  }
  const setIssues = (update: ReviewIssue[] | ((list: ReviewIssue[] | null) => ReviewIssue[] | null)) =>
    setIssuesState((list) => {
      const next = typeof update === 'function' ? update(list) : update
      if (next) remember({ issues: next })
      return next
    })
  const setReviewed = (value: string) => {
    remember({ reviewed: value })
    setReviewedState(value)
  }
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState<number | null>(null)
  if (!ready) return null
  const current = JSON.stringify(data)
  const stale = reviewed !== null && reviewed !== current

  const run = async () => {
    if (!docId) return toast('Salva la pagina, poi falla rivedere', 'error')
    setBusy(true)
    try {
      const res = await api.review(docId, data)
      setIssues(res.issues)
      setReviewed(JSON.stringify(data))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Revisione non riuscita', 'error')
    } finally {
      setBusy(false)
    }
  }

  const apply = async (issue: ReviewIssue, i: number) => {
    if (!docId) return
    setApplying(i)
    try {
      const res = await api.applyReview(docId, data, issue)
      onApply(res.data)
      setIssues((list) => list?.filter((_, n) => n !== i) ?? null)
      // The page changed only by the suggestion: the review still holds for the rest.
      setReviewed(JSON.stringify(res.data))
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Non è riuscito', 'error')
    } finally {
      setApplying(null)
    }
  }

  return (
    <div className={cx('space-y-2', className)}>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => void run()}
          loading={busy}
          icon={<Sparkles className="size-3.5 text-accent" />}
          className="flex-1"
        >
          {issues ? 'Rivedi di nuovo' : 'Rivedi con l’AI'}
        </Button>
      </div>
      {!issues && !busy && (
        <p className="text-[11.5px] leading-snug text-fg3">
          Rilegge la pagina come un correttore: refusi, grammatica, voce del brand, incoerenze, link che non portano
          dove dicono.
        </p>
      )}
      {stale && <p className="text-[11.5px] text-warn">La pagina è cambiata dopo la revisione.</p>}
      {issues && !issues.length && <p className="text-[12.5px] text-fg2">Nessun problema trovato.</p>}
      {issues && issues.length > 0 && (
        <ul className="space-y-1.5">
          {issues.map((it, i) => (
            <li key={`${it.slot}-${it.find}`} className="rounded-md border border-line p-2 text-[12px]">
              <div className="flex items-start gap-1.5">
                <button
                  type="button"
                  disabled={!it.node || !onSelect}
                  onClick={() => it.node && onSelect?.(it.node)}
                  className="min-w-0 flex-1 text-left disabled:cursor-default"
                >
                  <span className="text-[11px] font-semibold tracking-wide text-fg3 uppercase">{KIND[it.kind]}</span>
                  <span className="block leading-snug text-fg">{it.note}</span>
                  <span className="mt-1 block leading-snug">
                    <span className="text-danger line-through decoration-danger/60">{plain(it.find)}</span>
                    {it.replace && (
                      <>
                        {' → '}
                        <span className="text-ok">{plain(it.replace)}</span>
                      </>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Ignora"
                  title="Ignora"
                  onClick={() => setIssues((list) => list?.filter((_, n) => n !== i) ?? null)}
                  className="text-fg3 hover:text-fg [&_svg]:size-3.5"
                >
                  <X />
                </button>
              </div>
              {it.replace && (
                <Button
                  size="sm"
                  className="mt-1.5 h-6 text-[12px]"
                  loading={applying === i}
                  onClick={() => void apply(it, i)}
                  icon={<Wand2 className="size-3" />}
                >
                  Applica
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
