# L'editor delle pagine

L'editor mostra la pagina vera, come apparirà sul sito, e la modifichi direttamente lì. Si apre con **Design** in alto nella pagina.

## Com'è fatto

- **A sinistra**, quattro schede:
  - **Livelli**: l'elenco di tutto ciò che c'è nella pagina, uno dentro l'altro;
  - **Aggiungi**: sezioni pronte ed elementi da mettere sulla pagina;
  - **Stili**: colori, caratteri e impostazioni di tutto il sito;
  - **Controlli**: motori di ricerca, accessibilità e prestazioni della pagina (vedi [Controlli della pagina](#controlli-della-pagina)).

  Il pannello si allarga trascinandone il bordo destro, fino a 440 px, e il browser se lo ricorda; un doppio clic sul bordo lo riporta com'era.
- **Al centro**, la **tela**: la pagina.
- **A destra**, il pannello dell'elemento selezionato: cambia con l'elemento (disposizione, dimensioni, colori, testo, animazioni…). Senza niente selezionato mostra **Pagina**: titolo, indirizzo, modello e motori di ricerca.
- **In cima alla tela**, tre gruppi di comandi in altrettanti incavi del bordo:
  - a sinistra, **Aggiungi**: contenitore, testo, immagine, pulsante, icona o forma; **⋯** apre gli altri (video, codice, scena WebGL, campo di un modulo);
  - al centro, il dispositivo (desktop, tablet, mobile), la larghezza, tutti affiancati ed **Esporta**;
  - a destra, **?** per le scorciatoie, i righelli, l'assistente AI, i commenti, la prova delle animazioni e **Anteprima**, per provare la pagina come sul sito.
- **In basso a destra sulla tela**, lo zoom: riduci, ingrandisci, adatta alla finestra.
- Quando la tela è stretta (finestra piccola o pannelli allargati), dispositivi affiancati, esporta, righelli, prova delle animazioni e scorciatoie passano nel menu **⋯** del gruppo di destra; pulsante e icona restano nella scheda **Aggiungi** e sui tasti B e O.

La prima volta un **tour** presenta l'editor in 14 passi: scurisce lo schermo e illumina una zona alla volta (Contenuto e Design, le quattro schede a sinistra, che apre da solo, la barra per aggiungere, la tela, il pannello delle proprietà, dispositivi, zoom e anteprima, assistente AI, cronologia e pubblicazione). Ci si sposta con ← → o con i pulsanti, Esc lo chiude. Per rifarlo: **?** (o il pulsante con la tastiera in alto) → **Rifai il tour**.

## Aggiungere

Dalla scheda **Aggiungi**:

- **Sezioni**: oltre 100 sezioni pronte in 25 categorie (navigazione, hero, chi siamo, servizi, progetti, testimonianze, team, FAQ, contatti, effetti, footer…). Si trascinano sulla tela o si aggiungono con un clic. Prendono i colori e i caratteri del tuo sito.
- **Elementi**: contenitore, testo, immagine, pulsante, video, icona o forma, campo di un modulo, scena WebGL, codice, selettore della lingua.

Ogni elemento ha anche un tasto rapido: **F** contenitore, **T** testo, **I** immagine, **B** pulsante, **V** video, **O** icona o forma, **K** campo di un modulo, **G** scena WebGL, **C** codice, **L** selettore della lingua.

## Selezionare e modificare

- **Clic** seleziona, **doppio clic** su un testo per scriverci, **trascina** per spostare.
- **⇧ clic**, oppure un riquadro trascinato dal vuoto, seleziona più elementi: le modifiche di stile valgono per tutti.
- **Invio** entra in un contenitore, **Esc** torna al contenitore che lo contiene, **Tab** passa all'elemento successivo.
- **⌘D** duplica, **⌫** elimina, **⌘G** raggruppa in un contenitore, **⇧⌘G** separa, **⌥↑ ⌥↓** sposta su e giù.
- **⌘Z** annulla, **⇧⌘Z** ripete.
- **⌥⌘C** e **⌥⌘V** copiano e incollano lo stile da un elemento all'altro.
- Sopra l'elemento selezionato compare una **barra di azioni rapide**: ✨ per l'AI sul testo, cambia immagine, duplica, sposta su o giù, **Com'è su mobile** (passa alla vista mobile tenendo la selezione), altre azioni ed elimina. Sparisce mentre scrivi o trascini.
- Il clic destro apre il menu dell'elemento, con **Blocca** per non spostarlo per sbaglio.

Su Windows usa **Ctrl** al posto di **⌘** e **Alt** al posto di **⌥**.

## Disposizione e misure

Un contenitore dispone i suoi elementi **in riga**, **in colonna** o **a griglia**, con spaziature e allineamenti. Un elemento può anche stare in **posizione libera**, sopra gli altri.

- **Maniglie**: quelle ai lati cambiano la larghezza, quelle sopra e sotto l'altezza (in un'immagine le proporzioni), quella nell'angolo entrambe. Doppio clic su una maniglia sopra o sotto e l'altezza torna automatica. Testi e pulsanti hanno solo le maniglie dei lati: la loro altezza segue il testo.
- Trascinando un elemento libero compaiono **guide magnetiche** verso bordi e centri vicini (tieni **⌘** per spostarlo senza agganci).
- Tenendo premuto **⌥** vedi le distanze dall'elemento sotto il puntatore.
- **⇧R** mostra i righelli; trascinando da un righello crei una guida.
- **Allinea e distribuisci**: ⌥⌘A a sinistra, ⌥⌘D a destra, ⌥⌘W in alto, ⌥⌘S in basso, ⌥⌘H e ⌥⌘V al centro.

## Aspetto

Per ogni elemento: colori e sfumature, tipografia, bordi e angoli, ombre, trasparenza, filtri, effetto vetro, fusione. I colori si scelgono tra quelli del tema, così le pagine restano coerenti chiunque le modifichi.

**Stili di testo condivisi**: crei uno stile da un testo (carattere, dimensioni per ogni dispositivo, colore) e lo applichi agli altri. Cambiando lo stile, cambiano tutti i testi che lo usano.

## Tablet e mobile

Scegli la larghezza in alto: ogni modifica fatta in tablet o mobile vale solo per quel dispositivo, il resto segue il desktop. **Tutti i dispositivi affiancati** mostra le tre versioni insieme. Le larghezze a cui il sito passa da desktop a tablet e mobile si cambiano nella scheda **Stili**.

## Animazioni e interazioni

Nel pannello a destra, per ogni elemento:

- **quando parte**: all'apertura della pagina, quando l'elemento entra nello schermo, scorrendo, al passaggio o al movimento del mouse, al clic;
- **cosa fa**: dissolvenze, spostamenti, rotazioni, testi che entrano per parole o lettere, contatori, parallasse, elementi fissi durante lo scroll, nastri scorrevoli;
- **linee temporali**: più fotogrammi chiave, ciascuno con la sua curva, da provare con il cursore della linea temporale;
- **al passaggio del mouse**: colori, scala, spostamento e ombra, anche quando il puntatore è sulla scheda che contiene l'elemento.

**Riproduci le animazioni**, in alto, prova la pagina come sul sito (Esc per uscire). Chi ha chiesto al proprio dispositivo di ridurre il movimento vede il sito fermo.

## Scene WebGL e 3D

L'elemento **Scena WebGL** aggiunge sfondi animati, effetti sulle immagini e oggetti 3D (forme, loghi, modelli `.glb` caricati nei Media) con materiali come cromo, vetro e oro. I file del 3D si scaricano solo nelle pagine che lo usano.

Per partire da qualcosa di pronto, in **Aggiungi** c'è la categoria **Effetti** (o cerca «webgl»): un'apertura su sfondo aurora, un'apertura con seta animata, il logo in 3D, un oggetto 3D, i numeri accanto a un globo che ruota, un'immagine che si piega al passaggio del mouse e un invito su un cielo di particelle. Nel logo 3D carica il tuo marchio in SVG; nell'oggetto 3D scegli un modello `.glb` dai Media; nell'immagine animata scegli la foto.

Due cose aiutano a tenere leggibile il testo sopra un'animazione:

- lo schema di colori **Scuro** (pannello a destra → Colori): la sezione resta scura con il testo chiaro qualunque sia il tema, come una sezione sopra una foto;
- **Oscura**, che scurisce lo sfondo animato di una sezione come già fa con le foto.

## Componenti

Un elemento, per esempio una scheda o un pulsante, può diventare un **componente** riutilizzabile, anche con più **varianti**. Il design vale per tutte le copie; testi, immagini e link restano diversi in ogni copia. Cambiando il componente, cambiano tutte le copie.

## Elenchi e pagine modello

- Un contenitore può **ripetersi per ogni voce di una raccolta** (per esempio tutti i progetti), ordinata e filtrata, con un pulsante «Mostra altri».
- Una pagina può fare da **modello** per ogni voce di una raccolta: disegni una volta la pagina «progetto» e vale per tutti i progetti. L'anteprima mostra una voce vera.
- Le **sezioni globali**, come menu e piè di pagina, valgono per tutte le pagine: si modificano una volta sola.

## La scheda Stili

Vale per tutto il sito:

- **colori** con nome, uno per il tema chiaro e uno per lo scuro;
- **caratteri**: qualsiasi Google Font (circa 2000, tutti nell'elenco: scorri o cerca per nome). Materialize li scarica una volta e li serve dal tuo sito, così i visitatori non contattano Google;
- angoli, larghezze di tablet e mobile, scorrimento morbido, cursore personalizzato, transizioni tra le pagine.

## Controlli della pagina

La scheda **Controlli** a sinistra (nella modalità Contenuto è accanto a Sezioni) controlla la pagina mentre la modifichi, in tre gruppi. Un clic su un problema seleziona l'elemento da sistemare.

- **Motori di ricerca**: titolo e descrizione, un solo titolo principale, collegamenti a pagine che non esistono, quantità di testo, immagine per la condivisione (vedi [SEO](06-seo.md)).
- **Accessibilità**, per chi usa un lettore di schermo, la tastiera o vede meno bene:
  - **testi poco leggibili** sul loro sfondo, misurati sulla pagina vera con la regola WCAG: almeno 4,5:1, oppure 3:1 per i testi grandi. I testi sopra una foto, un video o una scena 3D non si possono misurare e vanno guardati a occhio;
  - immagini senza descrizione, pulsanti e icone cliccabili senza nome, campi dei moduli senza etichetta;
  - link e pulsanti poco chiari, come «clicca qui» o «scopri di più»;
  - livelli dei titoli saltati e video che si muovono da soli senza i comandi per fermarli.
- **Prestazioni**, perché la pagina si apra in fretta anche sul telefono: immagini o video presi da altri siti (non vengono ottimizzati), GIF e video pesanti, video senza copertina, più di due scene 3D o WebGL, script esterni nel codice personalizzato, più di tre caratteri diversi, pagine con moltissimi elementi.

**Revisione AI**: in cima alla scheda, se l'AI è configurata, **Rivedi con l'AI** fa rileggere la pagina come da un correttore di bozze. Segnala refusi, errori di grammatica, frasi fuori dalla [voce del brand](09-ai-e-mcp.md#voce-del-brand), informazioni che si contraddicono (un prezzo o una data diversi in due punti) e link le cui parole promettono altro rispetto alla pagina a cui portano. Per ogni segnalazione mostra le parole esatte e la correzione: **Applica** la mette nella bozza, e ⌘Z la annulla; la crocetta la ignora. Un clic sul testo seleziona l'elemento sulla tela. La revisione parte solo quando la chiedi, perché ogni lettura è una richiesta all'AI (pochi centesimi), e resta lì finché non chiudi la pagina; se poi modifichi la pagina, un avviso ti dice che è cambiata. Per gli articoli e gli altri contenuti senza tela la trovi in **Altre azioni → Revisione AI**.

**Prima di pubblicare**, se la pagina ha problemi seri di accessibilità o di prestazioni, Materialize li elenca e chiede se pubblicare lo stesso o vederli. I consigli non fermano mai la pubblicazione.

## Esportare per il cliente

**Esporta in PDF o PNG**, in alto accanto a **Tutti i dispositivi affiancati**, crea un file della pagina com'è adesso, anche se non è ancora pubblicata: per mandarla a chi deve approvarla.

- Scegli i dispositivi: desktop, tablet, mobile.
- **PDF**: un unico file, una pagina per dispositivo, ognuna lunga quanto la pagina web, senza tagli, con in alto il nome della pagina, il dispositivo e la data.
- **PNG**: un'immagine per dispositivo. Il browser può chiedere il permesso di scaricare più file insieme.

Il file mostra la pagina ferma: senza animazioni, e le scene WebGL nella loro versione statica.

## Lavorare in squadra

- **Commenti**: su un elemento o sulla pagina, dall'icona in alto.
- **Chi c'è**: vedi chi altro ha aperta la pagina e cosa ha selezionato.
- **Annulla e ripeti**: ⌘Z e ⇧⌘Z, anche dai pulsanti in alto a destra.
- **Cronologia**: tutte le versioni della pagina, da vedere su ogni dispositivo e ripristinare (vedi [Contenuti e media](04-contenuti-e-media.md#cronologia)).

## Codice personalizzato

L'elemento **Codice** inserisce HTML scritto a mano. Per sicurezza può aggiungerlo solo un amministratore.
