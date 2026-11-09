import { useEffect, useState } from 'react'
import { GuidedTour, type TourStep } from '../components/Tour.tsx'
import { usePref } from '../lib/prefs.ts'
import { navigate } from '../lib/router.ts'

/** The panel, area by area: where things are, for someone who has never seen it. */
const STEPS: TourStep[] = [
  {
    part: 'Benvenuto',
    title: 'Il pannello in un minuto',
    text: 'Da qui gestisci tutto il sito: pagine, articoli, immagini, newsletter e impostazioni. Ti mostriamo dove sono le cose: ← → per spostarti, Esc per uscire.',
  },
  {
    part: 'Panoramica',
    title: 'Si parte da qui',
    text: 'Ogni volta che entri, la panoramica ti dice cosa c’è da fare. In alto apri il sito, crei una pagina nuova o, con l’AI, una prima versione del sito da un brief.',
    target: '[data-tour="overview-head"]',
  },
  {
    part: 'Panoramica',
    title: 'Chiedi all’AI',
    text: 'Scrivi a parole cosa vuoi fare su tutto il sito: le descrizioni per Google che mancano, una pagina nuova, una traduzione. L’AI lavora in bozza e ti elenca le bozze da rivedere.',
    target: '[data-tour="studio"]',
    optional: true,
  },
  {
    part: 'Panoramica',
    title: 'Le cose da fare',
    text: 'Le pagine da pubblicare, il rilascio in preparazione, la prossima uscita programmata e i messaggi nuovi. Un clic porta dove serve.',
    target: '[data-tour="todo"]',
    optional: true,
  },
  {
    part: 'Panoramica',
    title: 'Le ultime modifiche',
    text: 'Chi ha cambiato cosa, e quando. Lo stato dice se è online, in bozza o con modifiche ancora da pubblicare.',
    target: '[data-tour="recent"]',
  },
  {
    part: 'A sinistra',
    title: 'I contenuti',
    text: 'Le raccolte del sito: pagine, articoli, progetti, persone del team. Ogni raccolta è un elenco: aprila per cercare, filtrare per stato e crearne di nuovi. Le pagine si compongono sulla tela.',
    target: '[data-tour="nav-content"]',
  },
  {
    part: 'A sinistra',
    title: 'Rilasci e newsletter',
    text: 'Con i Rilasci fai uscire più pagine insieme, subito o a un’ora stabilita. Con la Newsletter raccogli iscritti e mandi email a chi segue il sito.',
    target: '[data-tour="nav-publish"]',
  },
  {
    part: 'A sinistra',
    title: 'Le immagini',
    text: 'La libreria dei media: carica foto trascinandole, scrivi la descrizione per chi non vede, e scopri in quali pagine è usata ogni immagine.',
    target: '[data-tour="nav-media"]',
  },
  {
    part: 'A sinistra',
    title: 'Impostazioni e persone',
    text: 'Nelle Impostazioni ci sono SEO, email, lingue, AI, voce del brand, backup e aggiornamenti. In Persone inviti chi lavora con te e scegli cosa può fare.',
    target: '[data-tour="nav-manage"]',
  },
  {
    part: 'Ovunque',
    title: 'Cerca o vai a…',
    text: 'Premi ⌘K (Ctrl+K su Windows) da qualsiasi schermata: trovi una pagina per titolo, apri una sezione o crei un contenuto senza cercarlo nei menu.',
    target: '[data-tour="search"]',
  },
  {
    part: 'Ovunque',
    title: 'Il tuo profilo',
    text: 'Nome, password, verifica in due passaggi e lingua del pannello. Accanto, il pulsante per il tema chiaro o scuro.',
    target: '[data-tour="me"]',
  },
  {
    part: 'Fine',
    title: 'Tutto qui',
    text: 'Quando apri una pagina, un altro tour ti presenta l’editor. Questo lo ritrovi nel menu del tuo profilo, in alto a destra, e cercando «tour» con ⌘K.',
  },
]

/** Asks for the panel tour from anywhere (the profile menu, the search). */
export const startPanelTour = () => window.dispatchEvent(new Event('mz:panel-tour'))

/**
 * The panel tour: the first time someone opens the panel on a screen wide enough for the sidebar,
 * and again whenever they ask for it.
 */
export function PanelTour({ onHome }: { onHome: boolean }) {
  const [pref, setPref] = usePref<'todo' | 'done'>('mz-panel-tour', 'todo')
  useEffect(() => {
    const again = () => {
      navigate({ name: 'home' })
      setPref('todo')
    }
    window.addEventListener('mz:panel-tour', again)
    return () => window.removeEventListener('mz:panel-tour', again)
  }, [setPref])
  const wide = typeof window !== 'undefined' && window.innerWidth >= 768
  if (pref !== 'todo' || !onHome || !wide) return null
  return <TourWhenReady onDone={() => setPref('done')} />
}

/** Waits a moment, so the overview has drawn the areas the tour lights up. */
function TourWhenReady({ onDone }: { onDone: () => void }) {
  const ready = useDelay(700)
  return ready ? <GuidedTour steps={STEPS} label="Tour del pannello" onDone={onDone} /> : null
}

function useDelay(ms: number) {
  const [done, setDone] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), ms)
    return () => clearTimeout(timer)
  }, [ms])
  return done
}
