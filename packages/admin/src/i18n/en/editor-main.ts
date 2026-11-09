/** The page editor's frame: toolbar, side panel tabs, right-click menu, empty page, page settings. */
export const editorMain: Record<string, string> = {
  // messages
  'Stile copiato: ⌥⌘V per incollarlo su altri elementi': 'Style copied: ⌥⌘V to paste it onto other elements',
  'Prima copia lo stile di un elemento (⌥⌘C)': 'First copy the style of an element (⌥⌘C)',
  'Per raggruppare, seleziona elementi dello stesso contenitore': 'To group, select elements in the same container',
  'Le sezioni non si raggruppano: seleziona elementi al loro interno':
    'Sections cannot be grouped: select elements inside them',
  'Stile “{name}” creato: ora lo puoi usare su ogni testo': 'Style “{name}” created: you can now use it on any text',
  'Componente creato: lo trovi nella libreria': 'Component created: you will find it in the library',
  Copiato: 'Copied',
  'Le sezioni globali si rinominano nella lingua principale': 'Shared sections are renamed in the main language',
  'Le sezioni globali si eliminano nella lingua principale': 'Shared sections are deleted in the main language',

  // right-click menu
  'Seleziona il contenitore': 'Select container',
  'Seleziona gli elementi vicini': 'Select neighboring elements',
  Rinomina: 'Rename',
  'Nome del livello': 'Layer name',
  Duplica: 'Duplicate',
  Copia: 'Copy',
  Incolla: 'Paste',
  'Copia lo stile': 'Copy style',
  'Incolla lo stile': 'Paste style',
  Raggruppa: 'Group',
  Separa: 'Ungroup',
  'Sposta su': 'Move up',
  'Sposta giù': 'Move down',
  'Crea componente': 'Create component',
  'Rendi sezione globale': 'Make shared section',
  'Mostra su questo dispositivo': 'Show on this device',
  'Nascondi su questo dispositivo': 'Hide on this device',
  Sblocca: 'Unlock',
  Blocca: 'Lock',
  'fermo sulla tela': 'fixed on the canvas',
  Commenta: 'Comment',
  'Elimina {n} elementi': 'Delete {n} elements',
  Elimina: 'Delete',

  // bound fields
  Titolo: 'Title',
  'Indirizzo della pagina': 'Page address',

  // left panel
  Sezioni: 'Sections',
  Controlli: 'Checks',
  Livelli: 'Layers',
  Aggiungi: 'Add',
  Stili: 'Styles',
  'Trascina per allargare il pannello · doppio clic per la larghezza normale':
    'Drag to widen the panel · double-click for the normal width',

  // small screens
  'Il Design si usa da uno schermo più grande': 'Design needs a larger screen',
  'Da qui puoi cambiare testi, immagini e collegamenti della pagina.':
    'From here you can change the page’s text, images and links.',
  'Modifica i contenuti': 'Edit content',

  // toolbar
  'Aggiungi Contenitore · F': 'Add Container · F',
  'Aggiungi Testo · T': 'Add Text · T',
  'Aggiungi Immagine · I': 'Add Image · I',
  'Aggiungi Pulsante · B': 'Add Button · B',
  'Aggiungi Icona o forma · O': 'Add Icon or shape · O',
  'Altri elementi': 'More elements',
  Video: 'Video',
  Codice: 'Code',
  'Scena WebGL': 'WebGL scene',
  'Campo di un modulo': 'Form field',
  'Clicca un testo per scriverci, un’immagine per cambiarla.': 'Click a text to write in it, an image to change it.',
  'Larghezza dell’anteprima': 'Preview width',
  'Larghezza dello schermo su cui provi la pagina': 'Width of the screen you try the page on',
  'Tutti i dispositivi affiancati': 'All devices side by side',
  'Esporta in PDF o PNG': 'Export as PDF or PNG',
  'Scorciatoie da tastiera · ?': 'Keyboard shortcuts · ?',
  'Scorciatoie da tastiera': 'Keyboard shortcuts',
  'Righelli · ⇧R': 'Rulers · ⇧R',
  Righelli: 'Rulers',
  'Assistente AI': 'AI assistant',
  'Commenti sulla pagina': 'Comments on the page',
  Commenti: 'Comments',
  '{names} sta lavorando su questa pagina: chi salva per ultimo sovrascrive.':
    '{names} is working on this page: whoever saves last overwrites.',
  '{names} stanno lavorando su questa pagina: chi salva per ultimo sovrascrive.':
    '{names} are working on this page: whoever saves last overwrites.',
  'Altri comandi della tela': 'More canvas commands',
  'Riproduci le animazioni': 'Play animations',
  'Prova scroll, mouse e clic come sul sito · Esc per uscire':
    'Try scrolling, hovering and clicking as on the site · Esc to exit',
  'Esci dall’anteprima': 'Exit preview',
  Anteprima: 'Preview',
  'Riduci lo zoom': 'Zoom out',
  'Aumenta lo zoom': 'Zoom in',
  'Adatta alla finestra': 'Fit to window',

  // a past version
  'Stai guardando {version}. La bozza resta com’è finché non ripristini.':
    'You are looking at {version}. The draft stays as it is until you restore.',
  'Ripristina questa versione': 'Restore this version',
  Chiudi: 'Close',

  // empty page
  'Pagina vuota': 'Blank page',
  'Scegli una sezione nella libreria a sinistra: un clic la aggiunge qui.':
    'Choose a section in the library on the left: one click adds it here.',
  'Da dove vuoi partire?': 'Where do you want to start?',
  'Una pagina già composta da modificare, oppure una pagina vuota da riempire con le sezioni della libreria.':
    'A ready-made page to edit, or a blank page to fill with sections from the library.',
  'Pagina pronta: menu, apertura, servizi, invito e piè di pagina':
    'Ready-made page: menu, hero, services, call to action and footer',
  'Pagina vuota: scelgo io le sezioni': 'Blank page: I’ll choose the sections',

  // the page, nothing selected
  Pagina: 'Page',
  '1 sezione · seleziona un elemento sulla tela per modificarlo.':
    '1 section · select an element on the canvas to edit it.',
  '{n} sezioni · seleziona un elemento sulla tela per modificarlo.':
    '{n} sections · select an element on the canvas to edit it.',
  Modello: 'Template',
  'Modello per le voci di una raccolta': 'Template for the entries of a collection',
  'Pagina normale': 'Normal page',
  'Modello per ogni voce di “{collection}”': 'Template for each entry of “{collection}”',
  'Ogni voce usa questa pagina. Seleziona un testo o un’immagine e scegli quale campo mostra, in “Dato collegato”.':
    'Every entry uses this page. Select a text or an image and choose which field it shows, in “Linked data”.',
  'Voce mostrata nell’anteprima': 'Entry shown in the preview',
  'Anteprima con: {title}': 'Preview with: {title}',
  'Una pagina può fare da modello per tutte le voci di una raccolta, come la pagina di ogni progetto.':
    'A page can be the template for all the entries of a collection, like the page of each project.',
  'Salva la pagina per usarla come modello.': 'Save the page to use it as a template.',
  // default text of a new element
  'Nuovo testo': 'New text',
}
