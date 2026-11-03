# Contenuti e media

## Raccolte

Le voci del menu **Contenuti** sono le **raccolte** del sito: Pagine e, a seconda del sito, altre come Progetti, Diario o Team. Ogni voce di una raccolta ha i suoi campi: titolo, testi, immagini, date, collegamenti ad altre voci.

Quali raccolte e quali campi esistono lo decide chi sviluppa il sito, in `materialize.config.ts` (vedi il [README](../../README.md#lo-schema-è-codice)). Chi scrive i contenuti li trova già pronti nel pannello.

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
- **Testo alternativo**: per ogni immagine descrivi cosa mostra. Serve a chi non vede e ai motori di ricerca. L'assistente AI può suggerirlo (vedi [Assistente AI](09-ai-e-mcp.md)).
- **Punto focale**: nelle immagini che lo prevedono, clicca il punto più importante; quando l'immagine viene ritagliata, resta al centro.
- **Dove è usata**: ogni immagine mostra quante pagine la usano, così sai cosa tocchi prima di eliminarla.

Le immagini caricate perdono i dati della fotocamera (posizione GPS compresa) e vengono raddrizzate. Il sito le serve da solo nei formati moderni (AVIF, WebP) e nelle dimensioni giuste per ogni dispositivo: puoi caricare la foto originale senza preoccuparti del peso.

I modelli 3D (`.glb`) caricati in Media si usano nelle scene WebGL dell'editor.
