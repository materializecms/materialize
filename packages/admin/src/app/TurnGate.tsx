import { Eye, Hand, Lock, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '../components/ui.tsx'
import { api } from '../lib/api.ts'
import { relativeTime } from '../lib/format.ts'

type TurnState = {
  mine: boolean
  holder: { name: string; since: string; self: boolean } | null
  /** Who took the turn from this tab, when that just happened. */
  takenBy: string | null
}

/** "Ha appena iniziato." or "Ha iniziato 12 minuti fa.", from when the turn began. */
function started(since: string | undefined) {
  if (!since) return ''
  const when = relativeTime(since)
  return when === 'adesso' ? 'Ha appena iniziato.' : `Ha iniziato ${when}.`
}

/** How often the open document says "still here". */
const BEAT = 10_000

/**
 * The turn to edit a document: held while it is open in this tab, renewed every few seconds,
 * left when it closes. `mine` false means someone else (or another tab) is editing it.
 */
export function useTurn(docId: string | null) {
  const [state, setState] = useState<TurnState | null>(null)
  const taken = useRef<string | null>(null)
  const beat = useCallback(
    async (take = false) => {
      if (!docId) return
      try {
        const res = await api.turn(docId, take)
        if (res.takenBy) taken.current = res.takenBy
        if (res.mine) taken.current = null
        setState({ mine: res.mine, holder: res.holder, takenBy: taken.current })
      } catch {
        // Offline for a moment: keep what we knew; the server keeps the turn for a while.
      }
    },
    [docId],
  )
  useEffect(() => {
    if (!docId) return
    void beat()
    const timer = setInterval(() => void beat(), BEAT)
    const onFocus = () => void beat()
    window.addEventListener('focus', onFocus)
    const onLeave = () => api.leaveTurn(docId)
    window.addEventListener('pagehide', onLeave)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pagehide', onLeave)
      api.leaveTurn(docId)
    }
  }, [docId, beat])
  return { turn: state, take: () => beat(true), check: () => beat() }
}

/**
 * Over the editor while someone else holds the turn: who, since when, and what can be done —
 * go back, look at the page, or take over (their last unsaved seconds may be lost).
 */
export function TurnGate({
  turn,
  previewUrl,
  onTake,
  onBack,
}: {
  turn: TurnState
  previewUrl: string | null
  onTake: () => Promise<void>
  onBack: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  // The editor's shortcuts listen on the whole window: keys pressed outside this notice stop here.
  useEffect(() => {
    const stop = (e: KeyboardEvent) => {
      if (box.current?.contains(e.target as Node) || e.key === 'Tab') return
      e.stopPropagation()
      e.preventDefault()
    }
    window.addEventListener('keydown', stop, true)
    return () => window.removeEventListener('keydown', stop, true)
  }, [])
  const holder = turn.holder
  const sameUser = !!holder?.self
  const title = turn.takenBy
    ? `${turn.takenBy} ha preso il controllo`
    : sameUser
      ? 'Questo documento è aperto in un’altra scheda'
      : `${holder?.name ?? 'Qualcuno'} sta modificando questo documento`
  const text = turn.takenBy
    ? `Le tue modifiche fino all’ultimo salvataggio ci sono. Ora è ${turn.takenBy} a modificare: puoi tornare indietro o riprendere il controllo.`
    : sameUser
      ? 'Per non sovrascrivere il lavoro, si modifica da una scheda alla volta. Chiudi l’altra, oppure continua da qui.'
      : `${started(holder?.since)} Per non sovrascrivere il lavoro di nessuno, si modifica un documento alla volta: aspetta che finisca, oppure prendi il controllo.`
  const take = async () => {
    setBusy(true)
    try {
      await onTake()
    } finally {
      setBusy(false)
      setConfirm(false)
    }
  }
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-bg/70 px-4 backdrop-blur-[3px]">
      <div
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="turn-title"
        className="mz-pop-in w-full max-w-[480px] rounded-xl border border-line bg-panel p-5 shadow-pop"
      >
        <div className="flex size-9 items-center justify-center rounded-lg bg-accent/10 text-accent [&_svg]:size-4.5">
          <Lock />
        </div>
        <h2 id="turn-title" className="mt-3 text-[16px] font-semibold">
          {title}
        </h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-fg2">{text}</p>
        {confirm ? (
          <div className="mt-4 rounded-lg bg-warn/10 px-3 py-2.5 text-[13px] leading-relaxed">
            {sameUser
              ? 'L’altra scheda passa in sola lettura. Quello che lì non è ancora salvato potrebbe andare perso.'
              : `${holder?.name ?? 'L’altra persona'} passa in sola lettura e lo vede subito. Le sue modifiche degli ultimi secondi, non ancora salvate, potrebbero andare perse.`}
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" onClick={() => setConfirm(false)}>
                Annulla
              </Button>
              <Button size="sm" variant="primary" loading={busy} onClick={() => void take()}>
                Prendi il controllo
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button icon={<Undo2 className="size-3.5" />} onClick={onBack}>
              Torna indietro
            </Button>
            {previewUrl && (
              <Button icon={<Eye className="size-3.5" />} onClick={() => window.open(previewUrl, '_blank', 'noopener')}>
                Apri il sito
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Hand className="size-3.5" />}
              data-autofocus
              onClick={() => setConfirm(true)}
            >
              {turn.takenBy ? 'Riprendi il controllo' : sameUser ? 'Continua da qui' : 'Prendi il controllo'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
