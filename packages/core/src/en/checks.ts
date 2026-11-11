/**
 * English texts of the checks (SEO, accessibility, performance), the content schema, the site
 * settings shown in the panel (mail, tracking, voice, structured data) and the editor's names.
 */
export const checks: Record<string, string> = {
  // quality.ts: accessibility
  'Immagine senza descrizione: {name}': 'Image without a description: {name}',
  immagine: 'image',
  'Chi usa un lettore di schermo non sa cosa mostra; serve anche a Google Immagini.':
    'People using a screen reader can’t tell what it shows; it also helps Google Images.',
  'Link poco chiaro: «{text}»': 'Unclear link: “{text}”',
  'Scrivi dove porta, per esempio «Leggi il caso Nova Bank».':
    'Say where it leads, for example “Read the Nova Bank case study”.',
  'Pulsante senza testo': 'Button without text',
  'Un lettore di schermo non sa dire cosa fa.': 'A screen reader can’t tell what it does.',
  'Pulsante poco chiaro: «{text}»': 'Unclear button: “{text}”',
  'Scrivi dove porta, per esempio «Scopri i servizi».': 'Say where it leads, for example “See our services”.',
  'Icona cliccabile senza nome': 'Clickable icon without a name',
  'Scrivi nel testo alternativo dove porta (per esempio «Instagram»).':
    'Say in the alt text where it leads (for example “Instagram”).',
  'Campo del modulo senza etichetta': 'Form field without a label',
  'Senza etichetta, chi non vede il campo non sa cosa scrivere.':
    'Without a label, people who can’t see the field don’t know what to type.',
  'Video che si muove da solo, senza pausa': 'Video that plays by itself, with no pause',
  'Attiva «Comandi» se dura più di 5 secondi: c’è chi deve poterlo fermare.':
    'Turn on “With controls” if it lasts more than 5 seconds: some people need to be able to stop it.',
  'Livelli dei titoli saltati': 'Heading levels skipped',
  'Per esempio da Titolo 1 a Titolo 3 senza un Titolo 2: chi naviga per titoli si perde.':
    'For example from H1 to H3 without an H2: people who move through headings get lost.',
  'Tutte le immagini hanno una descrizione': 'Every image has a description',
  'Testo poco leggibile: «{text}»': 'Hard-to-read text: “{text}”',
  'Contrasto {ratio}:1, ne serve almeno {needed}:1. Scurisci o schiarisci il testo o lo sfondo.':
    'Contrast {ratio}:1, at least {needed}:1 is needed. Darken or lighten the text or the background.',
  'Testi ben leggibili sul loro sfondo': 'Text is easy to read on its background',

  // quality.ts: performance
  'Video da un altro sito: {name}': 'Video from another site: {name}',
  'Immagine da un altro sito: {name}': 'Image from another site: {name}',
  'Non viene ridimensionata né convertita: caricala nella libreria media.':
    'It isn’t resized or converted: upload it to the media library.',
  'GIF pesante ({size})': 'Heavy GIF ({size})',
  'Un video MP4 corto pesa un decimo e si vede meglio.': 'A short MP4 video weighs a tenth and looks better.',
  'Video pesante ({size})': 'Heavy video ({size})',
  'Su un telefono si scarica piano: comprimilo sotto i 10 MB, per esempio con HandBrake.':
    'It downloads slowly on a phone: compress it under 10 MB, for example with HandBrake.',
  'Video senza immagine di copertina': 'Video without a cover image',
  'Finché il video non si carica, al suo posto c’è un vuoto: aggiungi la copertina.':
    'Until the video loads, there is an empty space in its place: add a cover image.',
  '{n} scene animate 3D o WebGL': '{n} animated 3D or WebGL scenes',
  'Ognuna lavora sulla scheda grafica: sui telefoni meno recenti la pagina può scattare. Ne bastano una o due.':
    'Each one works the graphics card: on older phones the page may stutter. One or two are enough.',
  'Codice personalizzato che carica uno script esterno': 'Custom code that loads an external script',
  '{n} script esterni nel codice personalizzato': '{n} external scripts in custom code',
  'Ogni script di un altro sito rallenta l’apertura: tieni solo quelli che servono.':
    'Every script from another site slows down loading: keep only the ones you need.',
  '{n} caratteri diversi': '{n} different fonts',
  'Ogni carattere è un file da scaricare: due o tre bastano e rendono la pagina più coerente.':
    'Every font is a file to download: two or three are enough and make the page more consistent.',
  'Pagina molto grande ({n} elementi)': 'Very large page ({n} elements)',
  'Dividila in più pagine, o usa un elenco con «Mostra altri».':
    'Split it into several pages, or use a list with “Show more”.',
  'Nessun peso inutile trovato': 'No unnecessary weight found',
  // page.ts: the site's details a text can show
  'Nome del sito': 'Site name',
  'Descrizione del sito': 'Site description',
  Email: 'Email',
  Indirizzo: 'Address',
  // seo.ts: sitemap.xml in a browser
  'Mappa del sito': 'Sitemap',
  'Le pagine che i motori di ricerca possono trovare. Il file è scritto per Google e gli altri motori di ricerca: qui lo vedi in forma leggibile.':
    'The pages search engines can find. The file is written for Google and other search engines: here you see it in a readable form.',
  // seo.ts: structured data
  Organizzazione: 'Organization',
  'Attività locale': 'Local business',
  'Studio professionale': 'Professional service',
  Negozio: 'Store',
  Ristorante: 'Restaurant',
  Persona: 'Person',
  Pagina: 'Page',
  Articolo: 'Article',
  'Progetto o opera': 'Project or work',
  Servizio: 'Service',
  Evento: 'Event',
  'Domande frequenti': 'FAQ',

  // seo.ts: checks
  'La pagina è nascosta ai motori di ricerca': 'The page is hidden from search engines',
  'Togli “Nascondi” se deve comparire su Google.': 'Turn off “Hide from search engines” if it should appear on Google.',
  'Titolo lungo ({n} caratteri)': 'Long title ({n} characters)',
  'Google ne mostra circa 60.': 'Google shows about 60.',
  'Titolo molto corto': 'Very short title',
  'Descrivi la pagina in 30–60 caratteri.': 'Describe the page in 30–60 characters.',
  'Titolo di lunghezza giusta': 'Title length is right',
  'Manca la descrizione': 'Description missing',
  'È il testo sotto al titolo nei risultati di Google.': 'It’s the text under the title in Google results.',
  'Descrizione corta': 'Short description',
  'Meglio tra 120 e 160 caratteri.': 'Best between 120 and 160 characters.',
  'Descrizione lunga ({n} caratteri)': 'Long description ({n} characters)',
  'Google la taglia a circa 160.': 'Google cuts it at about 160.',
  'Descrizione di lunghezza giusta': 'Description length is right',
  'Indirizzo lungo': 'Long address',
  'Indirizzi brevi si leggono e si ricordano meglio.': 'Short addresses are easier to read and remember.',
  'Collegamento a una pagina che non esiste: {path}': 'Link to a page that doesn’t exist: {path}',
  'In {n} punti della pagina.': 'In {n} places on the page.',
  'Manca il titolo principale (H1)': 'Main heading (H1) missing',
  'Dai lo stile “Titolo 1” al titolo della pagina.': 'Give the page title the “H1” tag.',
  '{n} titoli principali (H1)': '{n} main headings (H1)',
  'Clicca per selezionare il secondo: se non è il titolo della pagina, in Testo scegli Tag → Paragrafo o H2.':
    'Click to select the second one: if it isn’t the page title, choose Tag → Paragraph or H2 under Text.',
  'Un solo titolo principale (H1)': 'A single main heading (H1)',
  'Poco testo ({n} parola)': 'Little text ({n} word)',
  'Poco testo ({n} parole)': 'Little text ({n} words)',
  'Le pagine con almeno 300 parole si posizionano meglio.': 'Pages with at least 300 words rank better.',
  '{n} parole': '{n} words',
  'Nessuna immagine per la condivisione': 'No sharing image',
  'Sui social apparirà solo il testo.': 'Only the text will appear on social media.',
  'Immagine per la condivisione': 'Sharing image',
  // schema.ts: validation
  'Campo obbligatorio': 'Required',
  'Valore non valido': 'Invalid value',
  'Almeno {n} caratteri': 'At least {n} characters',
  'Aggiungi almeno {n} elemento': 'Add at least {n} item',
  'Aggiungi almeno {n} elementi': 'Add at least {n} items',
  'Il valore minimo è {n}': 'The minimum is {n}',
  'Al massimo {n} caratteri': 'At most {n} characters',
  'Al massimo {n} elementi': 'At most {n} items',
  'Il valore massimo è {n}': 'The maximum is {n}',
  'Scegli una delle opzioni disponibili': 'Choose one of the available options',
  'Formato non valido': 'Invalid format',
  // fields.ts: validation
  'Usa lettere minuscole, numeri e trattini': 'Use lowercase letters, numbers and hyphens',
  'Scegli l’immagine': 'Choose the image',
  'Usa lettere minuscole, numeri e trattini singoli': 'Use lowercase letters, numbers and single hyphens',
  'Usa un colore nel formato #rrggbb': 'Use a color in the #rrggbb format',
  // mail.ts: providers
  'Brevo → SMTP e API → scheda SMTP: il «Login» (un indirizzo che finisce con @smtp-brevo.com).':
    'Brevo → SMTP & API → SMTP tab: the “Login” (an address ending in @smtp-brevo.com).',
  'Nella stessa scheda: «Genera una nuova chiave SMTP».': 'In the same tab: “Generate a new SMTP key”.',
  'Il mittente deve essere un indirizzo o un dominio verificato in Brevo → Mittenti e domini.':
    'The sender must be an address or a domain verified in Brevo → Senders & domains.',
  'Il «Server API token» del server Postmark (scheda API Tokens).':
    'The “Server API token” of the Postmark server (API Tokens tab).',
  'Lo stesso token: in Postmark utente e password coincidono.':
    'The same token: in Postmark the user name and password are the same.',
  'Il dominio del mittente va verificato in Postmark → Sender Signatures.':
    'The sender’s domain must be verified in Postmark → Sender Signatures.',
  'Sempre «resend».': 'Always “resend”.',
  'Una chiave API creata in Resend → API Keys.': 'An API key created in Resend → API Keys.',
  'Il dominio del mittente va verificato in Resend → Domains.':
    'The sender’s domain must be verified in Resend → Domains.',
  'Mailgun → Domain settings → SMTP credentials: il login, per esempio postmaster@mg.example.com.':
    'Mailgun → Domain settings → SMTP credentials: the login, for example postmaster@mg.example.com.',
  'La password di quel login (si reimposta dalla stessa pagina).':
    'The password of that login (you can reset it on the same page).',
  'Per un account negli Stati Uniti il server è smtp.mailgun.org.':
    'For an account in the US the server is smtp.mailgun.org.',
  'Credenziali SMTP create in Amazon SES → SMTP settings (non sono le chiavi IAM normali).':
    'SMTP credentials created in Amazon SES → SMTP settings (not the usual IAM keys).',
  'La password SMTP mostrata quando crei quelle credenziali.':
    'The SMTP password shown when you create those credentials.',
  'Cambia la regione nel server (eu-west-1, eu-central-1…) con quella del tuo account SES.':
    'Change the region in the server (eu-west-1, eu-central-1…) to the one of your SES account.',
  'Sempre «apikey».': 'Always “apikey”.',
  'Una chiave API creata in SendGrid → Settings → API Keys.': 'An API key created in SendGrid → Settings → API Keys.',
  'La «API Key» (Account settings → API key management).': 'The “API Key” (Account settings → API key management).',
  'La «Secret Key» della stessa chiave.': 'The “Secret Key” of the same key.',
  'Un «SMTP user» creato in SMTP2GO → Sending → SMTP Users.':
    'An “SMTP user” created in SMTP2GO → Sending → SMTP Users.',
  'La password di quell’utente.': 'The password of that user.',
  'Se la porta 587 è bloccata, SMTP2GO accetta anche la 2525.': 'If port 587 is blocked, SMTP2GO also accepts 2525.',
  '{brand} (casella email)': '{brand} (mailbox)',
  'L’indirizzo email completo della casella.': 'The full email address of the mailbox.',
  'La password della casella.': 'The mailbox password.',
  'Una casella normale ha limiti di invio giornalieri: per molti messaggi meglio un servizio dedicato.':
    'A regular mailbox has daily sending limits: for many messages a dedicated service is better.',
  'L’indirizzo Gmail o Workspace completo.': 'The full Gmail or Workspace address.',
  'Una «password per le app» (Account Google → Sicurezza), che richiede la verifica in due passaggi: non la password normale.':
    'An “app password” (Google Account → Security), which requires 2-Step Verification: not your usual password.',
  'Gmail invia solo con il tuo indirizzo, con limiti giornalieri: va bene per pochi messaggi.':
    'Gmail sends only from your own address, with daily limits: fine for a few messages.',
  'L’indirizzo email completo.': 'The full email address.',
  'Microsoft sta disattivando l’accesso SMTP con la sola password: se l’invio fallisce, l’amministratore di Microsoft 365 deve abilitare «SMTP autenticato» per la casella, oppure usa un servizio dedicato.':
    'Microsoft is turning off SMTP access with just a password: if sending fails, the Microsoft 365 admin must enable “Authenticated SMTP” for the mailbox, or use a dedicated service.',
  // voice.ts: tones
  Professionale: 'Professional',
  Amichevole: 'Friendly',
  Diretto: 'Direct',
  Ispirazionale: 'Inspirational',
  Tecnico: 'Technical',
  Elegante: 'Elegant',
  Rassicurante: 'Reassuring',
  Ironico: 'Witty',
  // page.ts: the first variant of a new component
  Predefinita: 'Default',
  // icons.ts: names of icons and shapes
  'Freccia a destra': 'Arrow right',
  'Freccia a sinistra': 'Arrow left',
  'Freccia su': 'Arrow up',
  'Freccia giù': 'Arrow down',
  'Freccia in diagonale': 'Diagonal arrow',
  'Freccia giù a destra': 'Arrow down right',
  'Punta a destra': 'Chevron right',
  'Punta a sinistra': 'Chevron left',
  'Punta su': 'Chevron up',
  'Punta giù': 'Chevron down',
  'Link esterno': 'External link',
  Telefono: 'Phone',
  Luogo: 'Place',
  Calendario: 'Calendar',
  Orario: 'Time',
  Messaggio: 'Message',
  Invia: 'Send',
  Sito: 'Site',
  Chiudi: 'Close',
  Più: 'Plus',
  Meno: 'Minus',
  Spunta: 'Check',
  'Spunta nel cerchio': 'Check in a circle',
  Cerca: 'Search',
  Scarica: 'Download',
  Riproduci: 'Play',
  Informazioni: 'Info',
  Persone: 'People',
  Borsa: 'Bag',
  Casa: 'House',
  Righello: 'Ruler',
  Matita: 'Pencil',
  Tavolozza: 'Palette',
  Livelli: 'Layers',
  Bussola: 'Compass',
  Idea: 'Idea',
  Foglia: 'Leaf',
  Alberi: 'Trees',
  Sole: 'Sun',
  Luna: 'Moon',
  Stella: 'Star',
  Cuore: 'Heart',
  Premio: 'Award',
  Garanzia: 'Shield',
  Energia: 'Energy',
  Scintille: 'Sparkles',
  Fotocamera: 'Camera',
  Citazione: 'Quote',
  Cerchio: 'Circle',
  Anello: 'Ring',
  Arco: 'Arch',
  'Mezzo cerchio': 'Half circle',
  'Stella a quattro punte': 'Four-pointed star',
  Macchia: 'Blob',
  Onda: 'Wave',
  Linea: 'Line',
  Triangolo: 'Triangle',
  Ghirigoro: 'Squiggle',
}
