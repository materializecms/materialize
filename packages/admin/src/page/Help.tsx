import { X } from 'lucide-react'
import { useEffect } from 'react'
import { GuidedTour, type TourStep } from '../components/Tour.tsx'
import { Kbd } from '../components/ui.tsx'
import { t } from '../lib/i18n.ts'

const groups = (): { title: string; keys: [string, string][] }[] => [
  {
    title: t('Aggiungere'),
    keys: [
      ['F', t('Contenitore')],
      ['T', t('Testo')],
      ['I', t('Immagine')],
      ['B', t('Pulsante')],
      ['V', t('Video')],
      ['O', t('Icona o forma')],
      ['K', t('Campo di un modulo')],
      ['G', t('Scena WebGL')],
      ['C', t('Codice')],
      ['L', t('Selettore della lingua')],
    ],
  },
  {
    title: t('Selezionare'),
    keys: [
      [t('⇧ clic'), t('Aggiungi o togli dalla selezione')],
      [t('Trascina sul vuoto'), t('Selezione a riquadro')],
      ['⌘A', t('Gli elementi vicini')],
      ['Tab · ⇧Tab', t('Elemento successivo · precedente')],
      [t('Invio'), t('Dentro il contenitore, o modifica il testo')],
      ['Esc', t('Il contenitore')],
    ],
  },
  {
    title: t('Modificare'),
    keys: [
      [t('Scrivi'), t('Su un testo selezionato: aggiunge le lettere')],
      ['⌘D', t('Duplica')],
      ['⌫', t('Elimina')],
      ['⌘C · ⌘V', t('Copia · incolla')],
      ['⌥⌘C · ⌥⌘V', t('Copia · incolla lo stile')],
      ['⌘G · ⇧⌘G', t('Raggruppa · separa')],
      ['⌥↑ · ⌥↓', t('Sposta su · giù')],
      ['⌘Z · ⇧⌘Z', t('Annulla · ripeti')],
    ],
  },
  {
    title: t('Allineare e misurare'),
    keys: [
      ['⌥⌘A · ⌥⌘D', t('A sinistra · a destra')],
      ['⌥⌘W · ⌥⌘S', t('In alto · in basso')],
      ['⌥⌘H · ⌥⌘V', t('Centra in orizzontale · in verticale')],
      [t('⌥ (tenuto)'), t('Distanze dall’elemento sotto il puntatore')],
      [t('⌘ trascinando'), t('Senza guide magnetiche')],
      ['⇧R', t('Righelli')],
      [t('Trascina da un righello'), t('Nuova guida (sul righello o doppio clic la toglie)')],
      ['?', t('Questo elenco')],
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
        aria-label={t('Scorciatoie da tastiera')}
        className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-panel p-6 shadow-pop"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">{t('Scorciatoie da tastiera')}</h2>
          <button type="button" aria-label={t('Chiudi')} onClick={onClose} className="text-fg3 hover:text-fg">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {groups().map((g) => (
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
            <span className="text-fg2">{t('Vuoi rivedere le zone dell’editor una alla volta?')}</span>
            <button
              type="button"
              onClick={() => {
                onClose()
                onTour()
              }}
              className="h-7 shrink-0 rounded-md border border-line2 px-2.5 font-medium hover:bg-hover"
            >
              {t('Rifai il tour')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

type LeftTab = 'layers' | 'add' | 'styles' | 'seo'

/** The editor, part by part: what each area is for and the gestures worth knowing on day one. */
const steps = (): TourStep<LeftTab>[] => [
  {
    part: t('Benvenuto'),
    title: t('L’editor in due minuti'),
    text: t(
      'Qui componi le pagine del sito come appariranno online. Ti mostriamo le zone dell’editor una alla volta: usa ← → per spostarti, Esc per uscire.',
    ),
  },
  {
    part: t('In alto'),
    title: t('Contenuto o Design'),
    text: t(
      'In Contenuto cambi solo testi e immagini, senza rischiare l’impaginazione: è la modalità giusta per chi aggiorna il sito ogni giorno. In Design componi e modifichi tutto.',
    ),
    target: '[data-tour="mode"]',
  },
  {
    part: t('A sinistra'),
    title: t('Livelli'),
    text: t(
      'L’albero della pagina: sezioni, contenitori ed elementi uno dentro l’altro. Clic per selezionare, doppio clic sul nome per rinominare, l’occhio per nascondere, trascina per riordinare.',
    ),
    target: '[data-tour="left"]',
    tab: 'layers',
  },
  {
    part: t('A sinistra'),
    title: t('Aggiungi'),
    text: t(
      'Sezioni già composte e responsive (copertine, servizi, prezzi, contatti…) ed elementi singoli. Un clic aggiunge, oppure trascina sulla tela. Le sezioni condivise, come menu e piè di pagina, si modificano una volta per tutte le pagine.',
    ),
    target: '[data-tour="left"]',
    tab: 'add',
  },
  {
    part: t('A sinistra'),
    title: t('Stili'),
    text: t(
      'Colori, caratteri, arrotondamenti e stili di testo del sito. Cambiarli qui aggiorna tutte le pagine: meglio che colorare un elemento alla volta.',
    ),
    target: '[data-tour="left"]',
    tab: 'styles',
  },
  {
    part: t('A sinistra'),
    title: t('Controlli'),
    text: t(
      'Prima di pubblicare: titolo e descrizione per Google, accessibilità (contrasto, testi alternativi) e peso della pagina. Un clic su un avviso seleziona l’elemento da sistemare.',
    ),
    target: '[data-tour="left"]',
    tab: 'seo',
  },
  {
    part: t('Sulla tela'),
    title: t('Aggiungere al volo'),
    text: t(
      'Contenitore, testo, immagine, pulsante e icona, più gli altri in ⋯. Ognuno ha la sua lettera: F, T, I, B, O. Il nuovo elemento va dopo quello selezionato.',
    ),
    target: '[data-tour="add-bar"]',
  },
  {
    part: t('Sulla tela'),
    title: t('Selezionare e scrivere'),
    text: t(
      'Clic per selezionare, doppio clic su un testo per scriverci, trascina per spostare. ⇧ clic o un riquadro sul vuoto selezionano più elementi; Invio entra in un contenitore, Esc esce. Il tasto destro apre il menu dell’elemento: duplica, raggruppa, crea un componente.',
    ),
    target: '[data-tour="center"] > :last-child',
  },
  {
    part: t('A destra'),
    title: t('Le proprietà'),
    text: t(
      'Il pannello cambia con ciò che selezioni: disposizione (riga, colonna, griglia), dimensioni e spazi, colori e bordi, animazioni ed effetto al passaggio del mouse. Senza niente selezionato mostra le impostazioni della pagina.',
    ),
    target: '[data-tour="inspector"]',
  },
  {
    part: t('In alto'),
    title: t('Desktop, tablet, mobile'),
    text: t(
      'Scegli il dispositivo: le modifiche fatte su tablet o mobile valgono solo lì, il desktop resta com’è. Con il pulsante a colonne li vedi tutti affiancati.',
    ),
    target: '[data-tour="devices"]',
  },
  {
    part: t('Sulla tela'),
    title: t('Zoom e anteprima'),
    text: t(
      'In basso a destra avvicini o adatti la tela alla finestra. Anteprima, in alto, prova la pagina come sul sito, con scroll, mouse e animazioni.',
    ),
    target: '[data-tour="zoom"], [data-tour="preview"]',
  },
  {
    part: t('In alto'),
    title: t('Assistente AI'),
    text: t(
      'Chiedi a parole: «aggiungi una sezione con tre servizi», «rendi i titoli più grandi», anche partendo da uno screenshot. Le modifiche arrivano sulla pagina e un solo ⌘Z le annulla.',
    ),
    target: '[data-tour="ai"]',
  },
  {
    part: t('In alto'),
    title: t('Cronologia e pubblicazione'),
    text: t(
      'Ogni salvataggio è una versione: dalla Cronologia la rivedi e la ripristini. Le modifiche restano in bozza finché non premi Pubblica; accanto, il calendario la fa uscire a un’ora stabilita.',
    ),
    target: '[data-tour="history"], [data-tour="publish"]',
  },
  {
    part: t('Fine del tour'),
    title: t('Tutto qui'),
    text: t(
      'Premi ? per l’elenco delle scorciatoie: da lì puoi anche rifare questo tour quando vuoi. ⌘Z annulla sempre, quindi prova senza paura.',
    ),
  },
]

/** The editor tour, shown the first time someone opens the editor and again from the shortcuts. */
export function Tour({ onDone, onTab }: { onDone: () => void; onTab: (tab: LeftTab) => void }) {
  return (
    <GuidedTour steps={steps()} label={t('Tour dell’editor')} onDone={onDone} onStep={(s) => s.tab && onTab(s.tab)} />
  )
}
