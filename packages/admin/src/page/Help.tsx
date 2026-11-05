import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Kbd } from '../components/ui.tsx'

const GROUPS: { title: string; keys: [string, string][] }[] = [
  {
    title: 'Aggiungere',
    keys: [
      ['F', 'Contenitore'],
      ['T', 'Testo'],
      ['I', 'Immagine'],
      ['B', 'Pulsante'],
      ['V', 'Video'],
      ['O', 'Icona o forma'],
      ['K', 'Campo di un modulo'],
      ['G', 'Scena WebGL'],
      ['C', 'Codice'],
      ['L', 'Selettore della lingua'],
    ],
  },
  {
    title: 'Selezionare',
    keys: [
      ['⇧ clic', 'Aggiungi o togli dalla selezione'],
      ['Trascina sul vuoto', 'Selezione a riquadro'],
      ['⌘A', 'Gli elementi vicini'],
      ['Tab · ⇧Tab', 'Elemento successivo · precedente'],
      ['Invio', 'Dentro il contenitore, o modifica il testo'],
      ['Esc', 'Il contenitore'],
    ],
  },
  {
    title: 'Modificare',
    keys: [
      ['Scrivi', 'Su un testo selezionato: aggiunge le lettere'],
      ['⌘D', 'Duplica'],
      ['⌫', 'Elimina'],
      ['⌘C · ⌘V', 'Copia · incolla'],
      ['⌥⌘C · ⌥⌘V', 'Copia · incolla lo stile'],
      ['⌘G · ⇧⌘G', 'Raggruppa · separa'],
      ['⌥↑ · ⌥↓', 'Sposta su · giù'],
      ['⌘Z · ⇧⌘Z', 'Annulla · ripeti'],
    ],
  },
  {
    title: 'Allineare e misurare',
    keys: [
      ['⌥⌘A · ⌥⌘D', 'A sinistra · a destra'],
      ['⌥⌘W · ⌥⌘S', 'In alto · in basso'],
      ['⌥⌘H · ⌥⌘V', 'Centra in orizzontale · in verticale'],
      ['⌥ (tenuto)', 'Distanze dall’elemento sotto il puntatore'],
      ['⌘ trascinando', 'Senza guide magnetiche'],
      ['⇧R', 'Righelli'],
      ['Trascina da un righello', 'Nuova guida (sul righello o doppio clic la toglie)'],
      ['?', 'Questo elenco'],
    ],
  },
]

/** Every shortcut of the editor, grouped: opened with "?" or the button in the toolbar. */
export function ShortcutsDialog({
  open,
  onClose,
  onTour,
}: {
  open: boolean
  onClose: () => void
  /** Starts the editor tour again. */
  onTour?: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes it too
    // biome-ignore lint/a11y/noStaticElementInteractions: the backdrop closes the dialog
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6" onClick={onClose}>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: keeps clicks inside from closing it */}
      <div
        role="dialog"
        aria-label="Scorciatoie da tastiera"
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">Scorciatoie da tastiera</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose} className="text-fg3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3 className="mb-2 text-[11.5px] font-semibold tracking-wide text-fg3 uppercase">{g.title}</h3>
              <ul className="space-y-1.5">
                {g.keys.map(([k, label]) => (
                  <li key={k + label} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-fg2">{label}</span>
                    <Kbd>{k}</Kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        {onTour && (
          <div className="mt-6 flex items-center justify-between gap-3 border-t border-line pt-4 text-[13px]">
            <span className="text-fg2">Vuoi rivedere le zone dell’editor una alla volta?</span>
            <button
              type="button"
              onClick={() => {
                onClose()
                onTour()
              }}
              className="h-7 shrink-0 rounded-md border border-line2 px-2.5 font-medium hover:bg-hover"
            >
              Rifai il tour
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type LeftTab = 'layers' | 'add' | 'styles' | 'seo'

interface Step {
  part: string
  title: string
  text: string
  /** The element to light up (a CSS selector); none: a card in the middle. */
  target?: string
  /** The left tab to open before showing the step. */
  tab?: LeftTab
}

/** The editor, part by part: what each area is for and the gestures worth knowing on day one. */
const STEPS: Step[] = [
  {
    part: 'Benvenuto',
    title: 'L’editor in due minuti',
    text: 'Qui componi le pagine del sito come appariranno online. Ti mostriamo le zone dell’editor una alla volta: usa ← → per spostarti, Esc per uscire.',
  },
  {
    part: 'In alto',
    title: 'Contenuto o Design',
    text: 'In Contenuto cambi solo testi e immagini, senza rischiare l’impaginazione: è la modalità giusta per chi aggiorna il sito ogni giorno. In Design componi e modifichi tutto.',
    target: '[data-tour="mode"]',
  },
  {
    part: 'A sinistra',
    title: 'Livelli',
    text: 'L’albero della pagina: sezioni, contenitori ed elementi uno dentro l’altro. Clic per selezionare, doppio clic sul nome per rinominare, l’occhio per nascondere, trascina per riordinare.',
    target: '[data-tour="left"]',
    tab: 'layers',
  },
  {
    part: 'A sinistra',
    title: 'Aggiungi',
    text: 'Sezioni già composte e responsive (copertine, servizi, prezzi, contatti…) ed elementi singoli. Un clic aggiunge, oppure trascina sulla tela. Le sezioni condivise, come menu e piè di pagina, si modificano una volta per tutte le pagine.',
    target: '[data-tour="left"]',
    tab: 'add',
  },
  {
    part: 'A sinistra',
    title: 'Stili',
    text: 'Colori, caratteri, arrotondamenti e stili di testo del sito. Cambiarli qui aggiorna tutte le pagine: meglio che colorare un elemento alla volta.',
    target: '[data-tour="left"]',
    tab: 'styles',
  },
  {
    part: 'A sinistra',
    title: 'Controlli',
    text: 'Prima di pubblicare: titolo e descrizione per Google, accessibilità (contrasto, testi alternativi) e peso della pagina. Un clic su un avviso seleziona l’elemento da sistemare.',
    target: '[data-tour="left"]',
    tab: 'seo',
  },
  {
    part: 'Sulla tela',
    title: 'Aggiungere al volo',
    text: 'Contenitore, testo, immagine, pulsante e icona, più gli altri in ⋯. Ognuno ha la sua lettera: F, T, I, B, O. Il nuovo elemento va dopo quello selezionato.',
    target: '[data-tour="add-bar"]',
  },
  {
    part: 'Sulla tela',
    title: 'Selezionare e scrivere',
    text: 'Clic per selezionare, doppio clic su un testo per scriverci, trascina per spostare. ⇧ clic o un riquadro sul vuoto selezionano più elementi; Invio entra in un contenitore, Esc esce. Il tasto destro apre il menu dell’elemento: duplica, raggruppa, crea un componente.',
    target: '[data-tour="center"] > :nth-child(2)',
  },
  {
    part: 'A destra',
    title: 'Le proprietà',
    text: 'Il pannello cambia con ciò che selezioni: disposizione (riga, colonna, griglia), dimensioni e spazi, colori e bordi, animazioni ed effetto al passaggio del mouse. Senza niente selezionato mostra le impostazioni della pagina.',
    target: '[data-tour="inspector"]',
  },
  {
    part: 'In alto',
    title: 'Desktop, tablet, mobile',
    text: 'Scegli il dispositivo: le modifiche fatte su tablet o mobile valgono solo lì, il desktop resta com’è. Con il pulsante a colonne li vedi tutti affiancati.',
    target: '[data-tour="devices"]',
  },
  {
    part: 'In alto',
    title: 'Zoom e anteprima',
    text: 'Avvicina o adatta la tela alla finestra. Anteprima prova la pagina come sul sito, con scroll, mouse e animazioni.',
    target: '[data-tour="zoom"], [data-tour="preview"]',
  },
  {
    part: 'In alto',
    title: 'Assistente AI',
    text: 'Chiedi a parole: «aggiungi una sezione con tre servizi», «rendi i titoli più grandi», anche partendo da uno screenshot. Le modifiche arrivano sulla pagina e un solo ⌘Z le annulla.',
    target: '[data-tour="ai"]',
  },
  {
    part: 'In alto',
    title: 'Cronologia e pubblicazione',
    text: 'Ogni salvataggio è una versione: dalla Cronologia la rivedi e la ripristini. Le modifiche restano in bozza finché non premi Pubblica; accanto, il calendario la fa uscire a un’ora stabilita.',
    target: '[data-tour="history"], [data-tour="publish"]',
  },
  {
    part: 'Fine',
    title: 'Tutto qui',
    text: 'Premi ? per l’elenco delle scorciatoie: da lì puoi anche rifare questo tour quando vuoi. ⌘Z annulla sempre, quindi prova senza paura.',
  },
]

/** The bounding box of every element a selector matches, or null when none is on screen. */
function boxOf(selector: string): DOMRect | null {
  const rects = [...document.querySelectorAll<HTMLElement>(selector)]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
  if (!rects.length) return null
  const left = Math.min(...rects.map((r) => r.left))
  const top = Math.min(...rects.map((r) => r.top))
  const right = Math.max(...rects.map((r) => r.right))
  const bottom = Math.max(...rects.map((r) => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

const CARD_W = 340
const GAP = 12
const PAD = 6

/** Where the card goes: beside the lit area where there is room, kept inside the window. */
function cardPlace(box: DOMRect | null, height: number): { left: number; top: number } {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const clampX = (x: number) => Math.max(GAP, Math.min(vw - CARD_W - GAP, x))
  const clampY = (y: number) => Math.max(GAP, Math.min(vh - height - GAP, y))
  if (!box) return { left: (vw - CARD_W) / 2, top: Math.max(GAP, (vh - height) / 2) }
  // A tall area (a side panel): beside it. A short one (a toolbar button): below it.
  if (box.height > vh * 0.5) {
    if (box.right + GAP + CARD_W < vw) return { left: box.right + GAP, top: clampY(box.top + 60) }
    if (box.left - GAP - CARD_W > 0) return { left: box.left - GAP - CARD_W, top: clampY(box.top + 60) }
    return { left: clampX(box.left + (box.width - CARD_W) / 2), top: clampY(box.top + box.height / 3) }
  }
  const below = box.bottom + GAP
  const top = below + height < vh ? below : box.top - GAP - height
  return { left: clampX(box.left + box.width / 2 - CARD_W / 2), top: clampY(top) }
}

/**
 * The editor tour, shown the first time someone opens the editor and again from the shortcuts.
 * Each step lights up the real area it talks about (and opens the left tab it explains).
 */
export function Tour({ onDone, onTab }: { onDone: () => void; onTab: (tab: LeftTab) => void }) {
  const [i, setI] = useState(0)
  const [box, setBox] = useState<DOMRect | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(200)
  const step = STEPS[i]

  // biome-ignore lint/correctness/useExhaustiveDependencies: onTab changes identity on every render
  useEffect(() => {
    if (!step) return
    if (step.tab) onTab(step.tab)
    let frame = 0
    const measure = () => {
      setBox(step.target ? boxOf(step.target) : null)
      if (card.current) setHeight(card.current.offsetHeight)
    }
    // After the tab has opened and the layout settled.
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(measure)
    })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
    }
  }, [i])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') setI((n) => (n + 1 < STEPS.length ? n + 1 : n))
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onDone])

  if (!step) return null
  const last = i + 1 === STEPS.length
  const place = cardPlace(box, height)
  return (
    <div className="fixed inset-0 z-[60]">
      {/* The window dims except the area being explained; clicks outside the card do nothing. */}
      {box ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent transition-all duration-300 ease-out"
          style={{
            left: box.left - PAD,
            top: box.top - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)',
          }}
        />
      ) : (
        <div aria-hidden="true" className="absolute inset-0 bg-black/55" />
      )}
      <div
        ref={card}
        role="dialog"
        aria-label="Tour dell’editor"
        aria-live="polite"
        className="absolute rounded-xl border border-line bg-panel p-4 shadow-pop transition-all duration-300 ease-out"
        style={{ width: CARD_W, left: place.left, top: place.top }}
      >
        <div className="flex items-center justify-between text-[11.5px] font-medium">
          <span className="text-accent">{step.part}</span>
          <span className="text-fg3 tabular-nums">
            {i + 1} di {STEPS.length}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-seg">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((i + 1) / STEPS.length) * 100}%` }}
          />
        </div>
        <h3 className="mt-3 text-[15px] font-semibold">{step.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-fg2">{step.text}</p>
        <div className="mt-4 flex items-center gap-2">
          {!last && (
            <button type="button" onClick={onDone} className="mr-auto text-[12.5px] text-fg3 hover:text-fg">
              Salta il tour
            </button>
          )}
          {last && <span className="mr-auto" />}
          {i > 0 && (
            <button
              type="button"
              onClick={() => setI(i - 1)}
              className="h-7 rounded-md px-2.5 text-[12.5px] font-medium text-fg2 hover:bg-hover hover:text-fg"
            >
              Indietro
            </button>
          )}
          <button
            type="button"
            autoFocus
            onClick={() => (last ? onDone() : setI(i + 1))}
            className="h-7 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white hover:brightness-110"
          >
            {i === 0 ? 'Iniziamo' : last ? 'Inizia a lavorare' : 'Avanti'}
          </button>
        </div>
      </div>
    </div>
  )
}
