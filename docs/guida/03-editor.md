# L'editor delle pagine

L'editor mostra la pagina vera, come apparirà sul sito, e la modifichi direttamente lì. Si apre con **Design** in alto nella pagina.

## Com'è fatto

- **A sinistra**, quattro schede:
  - **Livelli**: l'elenco di tutto ciò che c'è nella pagina, uno dentro l'altro;
  - **Aggiungi**: sezioni pronte ed elementi da mettere sulla pagina;
  - **Stili**: colori, caratteri e impostazioni di tutto il sito;
  - **SEO**: i controlli della pagina per i motori di ricerca (vedi [SEO](06-seo.md)).

  Il pannello si allarga trascinandone il bordo destro, fino a 440 px, e il browser se lo ricorda; un doppio clic sul bordo lo riporta com'era.
- **Al centro**, la **tela**: la pagina.
- **A destra**, il pannello dell'elemento selezionato: cambia con l'elemento (disposizione, dimensioni, colori, testo, animazioni…). Senza niente selezionato mostra **Pagina**: titolo, indirizzo, modello e motori di ricerca.
- **Sopra la tela**, una barra a gruppi:
  - a sinistra, **Aggiungi**: contenitore, testo, immagine, pulsante, icona o forma; **⋯** apre gli altri (video, codice, scena WebGL, campo di un modulo);
  - al centro, il dispositivo (desktop, tablet, mobile), la larghezza, tutti affiancati ed **Esporta**;
  - a destra, lo zoom, **?** per le scorciatoie, i righelli, l'assistente AI, i commenti, la prova delle animazioni e **Anteprima**, per provare la pagina come sul sito.

La prima volta un breve tour presenta l'editor.

## Aggiungere

Dalla scheda **Aggiungi**:

- **Sezioni**: oltre 100 sezioni pronte in 24 categorie (navigazione, hero, chi siamo, servizi, progetti, testimonianze, team, FAQ, contatti, footer…). Si trascinano sulla tela o si aggiungono con un clic. Prendono i colori e i caratteri del tuo sito.
- **Elementi**: contenitore, testo, immagine, pulsante, video, icona o forma, campo di un modulo, scena WebGL, codice, selettore della lingua.

Ogni elemento ha anche un tasto rapido: **F** contenitore, **T** testo, **I** immagine, **B** pulsante, **V** video, **O** icona o forma, **K** campo di un modulo, **G** scena WebGL, **C** codice, **L** selettore della lingua.

## Selezionare e modificare

- **Clic** seleziona, **doppio clic** su un testo per scriverci, **trascina** per spostare.
- **⇧ clic**, oppure un riquadro trascinato dal vuoto, seleziona più elementi: le modifiche di stile valgono per tutti.
- **Invio** entra in un contenitore, **Esc** torna al contenitore che lo contiene, **Tab** passa all'elemento successivo.
- **⌘D** duplica, **⌫** elimina, **⌘G** raggruppa in un contenitore, **⇧⌘G** separa, **⌥↑ ⌥↓** sposta su e giù.
- **⌘Z** annulla, **⇧⌘Z** ripete.
- **⌥⌘C** e **⌥⌘V** copiano e incollano lo stile da un elemento all'altro.
- Il clic destro apre il menu dell'elemento, con **Blocca** per non spostarlo per sbaglio.

Su Windows usa **Ctrl** al posto di **⌘** e **Alt** al posto di **⌥**.

## Disposizione e misure

Un contenitore dispone i suoi elementi **in riga**, **in colonna** o **a griglia**, con spaziature e allineamenti. Un elemento può anche stare in **posizione libera**, sopra gli altri.

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

## Componenti

Un elemento, per esempio una scheda o un pulsante, può diventare un **componente** riutilizzabile, anche con più **varianti**. Il design vale per tutte le copie; testi, immagini e link restano diversi in ogni copia. Cambiando il componente, cambiano tutte le copie.

## Elenchi e pagine modello

- Un contenitore può **ripetersi per ogni voce di una raccolta** (per esempio tutti i progetti), ordinata e filtrata, con un pulsante «Mostra altri».
- Una pagina può fare da **modello** per ogni voce di una raccolta: disegni una volta la pagina «progetto» e vale per tutti i progetti. L'anteprima mostra una voce vera.
- Le **sezioni globali**, come menu e piè di pagina, valgono per tutte le pagine: si modificano una volta sola.

## La scheda Stili

Vale per tutto il sito:

- **colori** con nome, uno per il tema chiaro e uno per lo scuro;
- **caratteri**: qualsiasi Google Font (circa 2000). Materialize li scarica una volta e li serve dal tuo sito, così i visitatori non contattano Google;
- angoli, larghezze di tablet e mobile, scorrimento morbido, cursore personalizzato, transizioni tra le pagine.

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
