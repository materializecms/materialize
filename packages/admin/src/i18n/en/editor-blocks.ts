/** The page designer: layers, canvas, block toolbar, live site preview, block style panel. */
export const editorBlocks: Record<string, string> = {
  // design mode
  'Desktop · 1280 px': 'Desktop · 1280 px',
  'Tablet · 820 px': 'Tablet · 820 px',
  'Mobile · 390 px': 'Mobile · 390 px',
  'La tela usa il layout e i componenti del sito: è la pagina come la vedranno i visitatori.':
    'The canvas uses the site’s layout and components: this is the page as visitors will see it.',
  'Il sito vero': 'The real site',
  'La tela mostra struttura e contenuti con uno stile neutro. Collega un sito Astro per vedere l’aspetto definitivo.':
    'The canvas shows structure and content in a neutral style. Connect an Astro site to see the final look.',
  'Anteprima neutra': 'Neutral preview',
  '1 da sistemare': '1 to fix',
  '{n} da sistemare': '{n} to fix',
  'Il blocco “{type}” non esiste più nello schema.': 'The block “{type}” no longer exists in the schema.',
  'Sposta su (⌥↑)': 'Move up (⌥↑)',
  'Sposta giù (⌥↓)': 'Move down (⌥↓)',
  'Duplica (⌘D)': 'Duplicate (⌘D)',
  'Elimina (⌫)': 'Delete (⌫)',
  Contenuto: 'Content',
  Stile: 'Style',
  Pagina: 'Page',
  'Aggiungi blocco': 'Add a block',
  'Inserisci un blocco qui': 'Insert a block here',
  'La pagina è vuota': 'The page is empty',
  'Componila con i blocchi: scegli da dove partire.': 'Build it with blocks: choose where to start.',
  Livelli: 'Layers',
  'Nome del livello': 'Layer name',
  'Doppio clic per rinominare': 'Double-click to rename',
  'Rinomina {name}': 'Rename {name}',
  Rinomina: 'Rename',
  'Nessun blocco. Aggiungine uno dalla tela.': 'No blocks. Add one from the canvas.',

  // live site canvas
  'Sessione scaduta': 'Session expired',
  'Errore {status} dal sito': 'Error {status} from the site',
  'Trascina per spostare': 'Drag to move',
  'Anteprima della pagina': 'Page preview',
  'Anteprima non aggiornata: {error}': 'Preview not updated: {error}',

  // neutral block preview
  '{field}: imposta nel pannello': '{field}: set it in the panel',
  '{field}: scrivi nel pannello a destra': '{field}: write it in the panel on the right',
  'Scegli i contenuti da mostrare in “{label}” nel pannello a destra':
    'Choose the content to show in “{label}” in the panel on the right',

  // style panel
  Tenue: 'Muted',
  Scuro: 'Dark',
  Accento: 'Accent',
  Nessuna: 'None',
  Dissolvenza: 'Fade',
  Salita: 'Rise',
  Zoom: 'Zoom',
  Scorrimento: 'Slide',
  Sfondo: 'Background',
  'Spazio sopra e sotto': 'Space above and below',
  Nessuno: 'None',
  Ridotto: 'Compact',
  Normale: 'Normal',
  Ampio: 'Spacious',
  'Animazione all’ingresso': 'Entrance animation',
  'Riproduci l’animazione': 'Play the animation',
  'Parte quando il blocco entra nello schermo, mai per chi ha chiesto meno movimento.':
    'Plays when the block comes into view, never for people who asked for reduced motion.',
  Ancora: 'Anchor',
  'chi-siamo': 'about-us',
  'Usa lettere minuscole, numeri e trattini, iniziando con una lettera':
    'Use lowercase letters, numbers and hyphens, starting with a letter',
  'Link diretto: {url}': 'Direct link: {url}',
  'Per collegarsi direttamente a questo blocco, ad esempio dal menu.':
    'To link straight to this block, for example from the menu.',
}
