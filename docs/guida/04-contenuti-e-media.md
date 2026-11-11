# Contenuti e media

## Raccolte

Le voci del menu **Contenuti** sono le **raccolte** del sito. Ogni sito nuovo ne ha due: **Pagine** e **Articoli**, il blog. A seconda del sito ce ne possono essere altre, come Progetti o Team. Ogni voce di una raccolta ha i suoi campi: titolo, testi, immagini, date, collegamenti ad altre voci.

Raccolte e campi oltre a Pagine e Articoli li aggiunge chi sviluppa il sito, in `materialize.config.ts` (vedi il [README](../../README.md#lo-schema-è-codice)). Chi scrive i contenuti li trova già pronti nel pannello.

## Articoli

Un articolo ha titolo, data, sommario, copertina e testo, e si pubblica all'indirizzo `/articoli/…`. Finché non ne disegni l'aspetto, ogni articolo esce come una pagina semplice e leggibile, con i colori e i caratteri del sito.

Per dargli menu, piè di pagina e il tuo stile:

1. crea una pagina, per esempio «Articolo», e disegnala sulla tela; i testi e le immagini collegati ai campi (titolo, data, copertina…) si riempiono con l'articolo vero;
2. nel pannello a destra, alla voce **Modello**, scegli **Articoli**: da quel momento ogni articolo usa questa pagina.

Per l'elenco degli articoli, in una pagina come «Blog», usa un contenitore che si ripete per ogni articolo (vedi [Elenchi e pagine modello](03-editor.md#elenchi-e-pagine-modello)). Gli articoli finiscono anche nel feed RSS del sito.

Negli elenchi:

- **Cerca** e il filtro **Stato** trovano le voci;
- selezionando più voci si possono pubblicare, togliere dal sito, duplicare o eliminare insieme;
- il menu **⋯** di una voce offre le stesse azioni una alla volta, più la copia dell'indirizzo.

## Bozze e pubblicazione

- Mentre scrivi, tutto si salva da solo come **bozza**, anche una pagina a metà.
- **Pubblica** porta la bozza sul sito. Se mancano campi obbligatori, il pannello te lo dice e ti porta al campo.
- **Togli dal sito** riporta una pagina pubblicata a bozza: sparisce dal sito ma resta nel pannello.
- Se cambi l'indirizzo di una pagina già pubblicata, il vecchio indirizzo **reindirizza** da solo al nuovo, così i link esterni e Google non trovano errori.

## Pubblicazione programmata

Per far uscire una pagina o un articolo più tardi, usa il pulsante con il **calendario** accanto a **Pubblica**:

- In **Pubblica il** scegli giorno e ora, oppure una scorciatoia come **Domani alle 9**, e premi **Programma**. Nell'intestazione compare la data, per esempio «Esce lun 10 nov, 09:00»; la stessa data si vede negli elenchi.
- Puoi continuare a modificare la bozza: al momento giusto esce la versione com'è in quel momento.
- In **Togli dal sito il** scegli quando la pagina torna bozza da sola, per un'offerta o un evento che scade.
- Per cambiare la data apri di nuovo il calendario; **Annulla** toglie la programmazione. Se pubblichi a mano prima, la programmazione non serve più e si annulla da sola.
- I campi obbligatori vengono controllati subito. Se al momento di uscire la pagina non è più completa (hai svuotato un campo nel frattempo), resta bozza e il pulsante diventa rosso: **Programmazione non riuscita**, con il motivo. Sistema e programma di nuovo, oppure pubblica.
- Se il server è spento all'ora scelta, la pagina esce appena riparte.

Il **Registro attività** (Impostazioni → Registro attività) mostra ogni pubblicazione programmata, a nome di chi l'ha programmata.

## Rilasci: più pagine che escono insieme

Per un lancio, una nuova collezione o una campagna servono spesso più pagine online nello stesso momento, e magari una vecchia da togliere. Un **rilascio** le raccoglie:

- Da una pagina: **Altre azioni → Aggiungi a un rilascio**, scegli un rilascio o creane uno nuovo e cosa succede alla pagina: **Pubblica questa bozza** o **Togli dal sito**. Nell'intestazione compare il nome del rilascio, o la data di uscita.
- Dalla barra laterale, **Rilasci** mostra i rilasci in preparazione: con **Aggiungi** cerchi pagine e articoli, il menu di ogni riga cambia l'azione e la crocetta la toglie dal rilascio. Il nome si cambia cliccandoci sopra.
- **Pubblica tutto ora** fa uscire tutto subito. **Programma** sceglie giorno e ora, come per una pagina singola: escono le bozze come sono in quel momento, a nome di chi l'ha programmato.
- **Tutto o niente**: se una pagina non è pronta (un campo obbligatorio vuoto, per esempio), non esce niente. Le pagine con un problema sono segnalate in rosso, e un rilascio programmato che non riesce resta lì con il motivo: sistema e programma di nuovo.
- Una pagina sta in un solo rilascio alla volta: aggiungerla a un altro la sposta. Fino all'uscita resta com'è, e puoi continuare a modificarla.
- Il cestino annulla il rilascio: le pagine restano come sono, si scioglie solo il gruppo. I rilasci usciti restano in fondo alla schermata, in **Già usciti**.

Anche l'AI può usarli, con gli strumenti MCP `list_releases`, `create_release`, `add_to_release`, `publish_release` e `schedule_release`.

## Link di anteprima

Per far vedere una bozza a qualcuno che non entra nel pannello, come un cliente o un collega, apri **Altre azioni** (i tre puntini in alto) → **Condividi anteprima**:

- Scegli quanto vale il link: **1 giorno**, **7 giorni**, **30 giorni** o **Senza scadenza**, poi premi **Crea e copia il link** e mandalo come preferisci.
- Chi lo apre vede la pagina con il design vero del sito, anche se non è ancora pubblicata, con una piccola etichetta «Anteprima · non ancora pubblicata».
- Il link segue le modifiche: mostra sempre l'ultima versione salvata. Non serve crearne uno nuovo dopo ogni correzione.
- In **Link attivi** vedi chi l'ha creato, quando scade e quante volte è stato aperto. Il cestino lo **revoca**: da quel momento non si apre più.
- I motori di ricerca non vedono queste pagine e le visite non contano nelle statistiche.

Chiunque abbia il link può vedere la bozza: mandalo solo a chi deve vederla e revocalo quando non serve più.

## Cronologia

Ogni salvataggio crea una versione, con la data e il nome di chi l'ha fatta (**Persona rimossa** se nel frattempo il suo account è stato eliminato).

- **Voci delle raccolte** (per esempio un articolo o un progetto, modificati con i campi): il pulsante **Pannello documento**, in alto, mostra stato, indirizzo, lingua e la **Cronologia**. **Ripristina** riporta la voce com'era. Anche il ripristino è una bozza: arriva sul sito solo quando pubblichi.
- **Pagine composte sulla tela**: il pulsante **Cronologia**, in alto, apre l'elenco delle versioni. Cliccane una per **vederla su desktop, tablet e mobile**, senza toccare la bozza. **Ripristina questa versione** la riporta nella bozza (e **⌘Z** annulla il ripristino), **Chiudi** torna alla pagina com'era. Il ripristino arriva sul sito solo quando pubblichi.

Le versioni usano menu, piè di pagina e componenti di oggi: quelli sono condivisi da tutte le pagine e hanno la loro storia.

## Testo formattato

I campi di testo lungo hanno titoli, grassetto, corsivo, elenchi, link, citazioni e immagini dentro il testo. Si scrive come in un normale programma di scrittura.

## Media

In **Media** ci sono tutti i file caricati.

- **Caricare**: trascina i file nella pagina, oppure usa il pulsante. Si può caricare anche direttamente da un campo immagine.
- **Guardare in grande**: clicca un file per vederne i dettagli accanto all'elenco; clicca l'anteprima per vedere l'immagine a tutto schermo (Esc per chiudere).
- **Testo alternativo**: per ogni immagine descrivi cosa mostra. Serve a chi non vede e ai motori di ricerca. L'assistente AI può suggerirlo (vedi [Assistente AI](09-ai-e-mcp.md)).
- **Punto focale**: nelle immagini che lo prevedono, clicca il punto più importante; quando l'immagine viene ritagliata, resta al centro.
- **Dove è usata**: ogni immagine mostra quante pagine la usano, così sai cosa tocchi prima di eliminarla.

Le immagini caricate perdono i dati della fotocamera (posizione GPS compresa) e vengono raddrizzate. Il sito le serve da solo nei formati moderni (AVIF, WebP) e nelle dimensioni giuste per ogni dispositivo: puoi caricare la foto originale senza preoccuparti del peso.

I modelli 3D (`.glb`) caricati in Media si usano nelle scene WebGL dell'editor.
