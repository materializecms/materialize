import { X } from 'lucide-react'
import { useEffect, useState } from 'react'
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
export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
      </div>
    </div>
  )
}

const STEPS: { title: string; text: string; where: 'left' | 'center' | 'right' | 'top' }[] = [
  {
    title: 'Aggiungi',
    text: 'Dalla scheda Aggiungi trascini sezioni pronte ed elementi sulla tela, o li aggiungi con un clic.',
    where: 'left',
  },
  {
    title: 'Componi sulla tela',
    text: 'Clic per selezionare, doppio clic per scrivere, trascina per spostare. ⇧ clic o un riquadro per selezionare più elementi.',
    where: 'center',
  },
  {
    title: 'Rifinisci a destra',
    text: 'Il pannello cambia con l’elemento: disposizione, dimensioni, colori, animazioni, stato al passaggio del mouse.',
    where: 'right',
  },
  {
    title: 'Prova e pubblica',
    text: 'Desktop, tablet e mobile in alto (anche affiancati), Anteprima per provare scroll e mouse, Pubblica quando è pronta. Premi ? per tutte le scorciatoie.',
    where: 'top',
  },
]

const POS: Record<(typeof STEPS)[number]['where'], string> = {
  left: 'left-[276px] top-28',
  center: 'left-1/2 top-1/3 -translate-x-1/2',
  right: 'right-[300px] top-28',
  top: 'left-1/2 top-14 -translate-x-1/2',
}

/** A four-step introduction, shown the first time someone opens the editor. */
export function Tour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const step = STEPS[i]
  if (!step) return null
  return (
    <div
      role="dialog"
      aria-label="Introduzione all’editor"
      className={`fixed z-40 w-80 rounded-xl border border-accent/40 bg-panel p-4 shadow-pop ${POS[step.where]}`}
    >
      <div className="text-[11.5px] font-medium text-accent">
        {i + 1} di {STEPS.length}
      </div>
      <h3 className="mt-1 text-[14px] font-semibold">{step.title}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-fg2">{step.text}</p>
      <div className="mt-3 flex items-center justify-between">
        <button type="button" onClick={onDone} className="text-[12.5px] text-fg3 hover:text-fg">
          Salta
        </button>
        <button
          type="button"
          onClick={() => (i + 1 < STEPS.length ? setI(i + 1) : onDone())}
          className="h-7 rounded-md bg-accent px-3 text-[12.5px] font-medium text-white"
        >
          {i + 1 < STEPS.length ? 'Avanti' : 'Inizia'}
        </button>
      </div>
    </div>
  )
}
