# Assistente AI e MCP

L'AI in Materialize è facoltativa: tutto funziona anche senza. Quando è configurata, aiuta a scrivere, tradurre e modificare le pagine.

## Configurare

In **Impostazioni → AI e MCP**, sezione **Modello AI**, un amministratore sceglie il **fornitore**:

- **Claude (Anthropic)**: serve una **chiave API**, da [console.anthropic.com](https://console.anthropic.com) → API Keys. Il modello predefinito è Claude Opus 5.5.
- **Compatibile OpenAI**: OpenAI stessa o un server compatibile, anche sul tuo computer come Ollama. Si indicano indirizzo del server e nome del modello.

La chiave resta sul server: una volta salvata, il pannello non la mostra più. Sul server si può anche impostare la variabile d'ambiente `ANTHROPIC_API_KEY` (su un VPS installato con lo script va in `/etc/materialize/env`, poi `systemctl restart materialize`).

L'uso dell'AI si paga al fornitore, in base a quanto si usa.

## Cosa fa

- **Testi**: dal pulsante ✨ accanto a un testo (nell'editor, in modalità Contenuto e nei campi, compreso il testo formattato degli articoli): **Riscrivi meglio**, **Accorcia**, **Allunga**, **Correggi errori**, **Più formale**, **Più colloquiale**, oppure una richiesta a parole. Nel testo formattato restano titoli, elenchi, grassetti, link e immagini. Se il campo ha una lunghezza massima, il risultato la rispetta.
- **SEO**: propone titolo e descrizione della pagina.
- **Testo alternativo**: descrive un'immagine guardandola. Se c'era già un credito, per esempio «foto di … su Unsplash», lo mantiene in fondo.
- **Traduzioni**: crea una pagina in un'altra lingua (vedi [Siti in più lingue](05-lingue.md)).
- **Assistente nell'editor**: dall'icona in alto nell'editor gli chiedi a parole, per esempio «aggiungi una sezione con tre servizi» o «rendi più grandi i titoli». Le modifiche arrivano sulla pagina come bozza, e un solo **⌘Z** le annulla tutte.

## MCP: collegare un client AI esterno

MCP è un modo standard con cui un'applicazione AI (Claude Desktop, Claude Code, altri client) può lavorare sul tuo sito: leggere e modificare pagine, raccolte e media, come farebbe una persona dal pannello.

1. In **Impostazioni → AI e MCP → Token di accesso** crea un token. L'AI agirà **con i tuoi permessi**: se sei editor, non potrà fare cose da amministratore.
2. Copia il token: si vede una volta sola.
3. Segui le istruzioni nella stessa pagina, che sono già compilate con l'indirizzo del tuo sito:
   - **via HTTP**: l'indirizzo è `https://example.com/mcp` con il token;
   - **Claude Code**: un comando da copiare;
   - **Claude Desktop e client locali**: le righe da mettere nel file di configurazione del client.

Un token si può **revocare** in qualsiasi momento dalla stessa pagina. In **Impostazioni → Sicurezza** compaiono i token non usati da tempo.
