# Assistente AI e MCP

L'AI in Materialize è facoltativa: tutto funziona anche senza. Quando è configurata, aiuta a scrivere, tradurre e modificare le pagine.

## Configurare

In **Impostazioni → AI e MCP**, sezione **Modello AI**, un amministratore sceglie il **fornitore**:

- **Claude (Anthropic)**: serve una **chiave API**, da [console.anthropic.com](https://console.anthropic.com) → API Keys. Il modello predefinito è Claude Opus 5.5.
- Il **modello per le azioni rapide** (✨, SEO, testo alternativo) è, se lasci vuoto, **Claude Haiku 5.5**: per testi brevi va benissimo e costa molto meno. L'assistente dell'editor e le traduzioni delle pagine usano il modello principale. «Salva e prova» controlla entrambi.
- **Compatibile OpenAI**: OpenAI stessa o un server compatibile, anche sul tuo computer come Ollama. Si indicano indirizzo del server e nome del modello.

La chiave resta sul server: una volta salvata, il pannello non la mostra più. Sul server si può anche impostare la variabile d'ambiente `ANTHROPIC_API_KEY` (su un VPS installato con lo script va in `/etc/materialize/env`, poi `systemctl restart materialize`).

L'uso dell'AI si paga al fornitore, in base a quanto si usa. Sotto il modulo, **Uso di questo mese** conta le richieste e i token letti e scritti: il costo esatto è sul sito del fornitore (per Claude, console.anthropic.com → Utilizzo). La parte più cara è l'assistente dell'editor, che a ogni passaggio rilegge la pagina: con Claude la rilettura passa dalla cache dei prompt e costa molto meno.

## Cosa fa

- **Testi**: dal pulsante ✨ accanto a un testo (nell'editor, in modalità Contenuto e nei campi, compreso il testo formattato degli articoli): **Riscrivi meglio**, **Accorcia**, **Allunga**, **Correggi errori**, **Più formale**, **Più colloquiale**, oppure una richiesta a parole. Nel testo formattato restano titoli, elenchi, grassetti, link e immagini; sulla tela, grassetti, corsivi e link del testo. **Accorcia** toglie circa un terzo, **Allunga** aggiunge circa la metà. Se il campo ha una lunghezza massima, il risultato la rispetta.
- **SEO**: propone titolo e descrizione della pagina.
- **Testo alternativo**: descrive un'immagine guardandola. Se c'era già un credito, per esempio «foto di … su Unsplash», lo mantiene in fondo.
- **Revisione prima di pubblicare**: rilegge la pagina e segnala refusi, grammatica, frasi fuori dalla voce del brand, incoerenze e link che non portano dove dicono, con la correzione da applicare con un clic (vedi [Controlli della pagina](03-editor.md#controlli-della-pagina)).
- **Traduzioni**: crea una pagina in un'altra lingua (vedi [Siti in più lingue](05-lingue.md)).
- **Assistente nell'editor**: dall'icona in alto nell'editor gli chiedi a parole, per esempio «aggiungi una sezione con tre servizi» o «rendi più grandi i titoli». Le modifiche arrivano sulla pagina come bozza, e un solo **⌘Z** le annulla tutte.
- **Immagini di riferimento**: con il pulsante 🖼 accanto al campo, incollando (⌘V) o trascinando un file nella chat, alleghi fino a 4 immagini, per esempio lo screenshot di un sito che ti piace, un mockup o la foto di uno schizzo. L'assistente ne riprende impaginazione, gerarchia e atmosfera, ma usa le sezioni, i colori e i testi del tuo sito: non copia marchi o testi e non mette l'immagine sulla pagina. Le immagini vengono rimpicciolite prima dell'invio, così costano poco.

## Voce del brand

In **Impostazioni → Voce del brand** scrivi come parla il sito, così l'AI scrive come voi e non come chiunque:

- **Chi siamo e per chi scriviamo**: una o due frasi su cosa fate, per chi e cosa vi distingue.
- **Tono**: fino a tre tra professionale, amichevole, diretto, ispirazionale, tecnico, elegante, rassicurante, ironico.
- **Come vi rivolgete a chi legge**: tu, voi o lei.
- **Parole da usare** e **parole da evitare**, separate da virgole.
- **Altre regole**, per esempio «Frasi brevi. Niente punti esclamativi».
- **Un testo che suona come voi**: un paragrafo vostro, di cui l'AI prende lo stile, mai il contenuto.

Non sai da dove partire? **Ricavala dai testi del sito** legge le pagine già pubblicate e compila il modulo: controllalo, correggilo e salva. Finché non salvi non cambia niente.

L'AI la usa in due modi:

- **Quando scrive da zero**, cioè titolo e descrizione per Google, una richiesta a parole dal pulsante ✨, l'assistente dell'editor e i client collegati con MCP, usa tutta la voce: anche chi siete e le parole che preferite, come materiale per scrivere.
- **Quando cambia un testo che hai scritto**, cioè Riscrivi, Accorcia, Allunga, Più formale, Più colloquiale e le traduzioni, usa solo lo stile: tono, modo di rivolgersi, parole da evitare, regole ed esempio. Il contenuto resta il tuo: l'AI non aggiunge fatti, servizi o promesse che il testo non aveva.

Non la usa per **Correggi errori** e per i testi alternativi delle immagini, che descrivono e basta. Una conversazione già aperta con l'assistente continua con la voce che aveva all'inizio: quella nuova vale dalla prossima.

La voce la cambia un amministratore; tutti la vedono.

## MCP: collegare un client AI esterno

MCP è un modo standard con cui un'applicazione AI (Claude Desktop, Claude Code, altri client) può lavorare sul tuo sito: leggere e modificare pagine, raccolte e media, come farebbe una persona dal pannello.

1. In **Impostazioni → AI e MCP → Token di accesso** crea un token. L'AI agirà **con i tuoi permessi**: se sei editor, non potrà fare cose da amministratore.
2. Copia il token: si vede una volta sola.
3. Segui le istruzioni nella stessa pagina, che sono già compilate con l'indirizzo del tuo sito:
   - **via HTTP**: l'indirizzo è `https://example.com/mcp` con il token;
   - **Claude Code**: un comando da copiare;
   - **Claude Desktop e client locali**: le righe da mettere nel file di configurazione del client.

Un token si può **revocare** in qualsiasi momento dalla stessa pagina. In **Impostazioni → Sicurezza** compaiono i token non usati da tempo.
