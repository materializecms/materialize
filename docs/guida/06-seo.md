# SEO

Materialize prepara da solo quello che serve ai motori di ricerca: titoli e descrizioni, sitemap, `robots.txt`, dati strutturati, anteprime per i social, indirizzi puliti e reindirizzamenti. Le immagini sono leggere e il sito è fatto di file statici, quindi veloce.

## Per ogni pagina

Nell'editor, la scheda **SEO** a sinistra:

- **controlli** sulla pagina: titolo e descrizione della lunghezza giusta, immagine di condivisione, un solo titolo principale, testi alternativi delle immagini e altro. Quando è tutto in ordine compare **Tutto a posto**;
- **titolo** e **descrizione** che compaiono su Google, con l'anteprima di come appariranno su Google e quando la pagina viene condivisa;
- **immagine per la condivisione** per WhatsApp, LinkedIn, Facebook.

Gli stessi campi sono anche nel pannello **Pagina** a destra, quando non hai selezionato niente.

L'assistente AI può proporre titolo e descrizione partendo dal contenuto della pagina.

## Per tutto il sito

In **Impostazioni → SEO**:

- **Il sito sui motori di ricerca**: nome del sito, schema del titolo delle pagine (per esempio `%s · Studio Rossi`, dove `%s` è il titolo della pagina), descrizione e immagine di condivisione predefinite, icona del sito, account su X.
- **Chi c'è dietro il sito**: tipo (azienda, attività locale, persona), nome, contatti, logo, indirizzo, orari, profili sui social. Google lo usa per le schede delle attività.
- **Motori di ricerca e AI**: pronto per le ricerche AI, blocco dei crawler che addestrano modelli AI, feed RSS, percorsi da non far visitare, codici di verifica di Google Search Console e Bing Webmaster.
- **Reindirizzamenti**: vecchio indirizzo → nuovo indirizzo.

Le modifiche valgono dalla prossima pubblicazione.

## Reindirizzamenti automatici

Se cambi l'indirizzo di una pagina già pubblicata, Materialize aggiunge da solo un reindirizzamento permanente (301) dal vecchio al nuovo. Lo stesso succede con le pagine importate da WordPress. Li trovi tutti in **Impostazioni → SEO → Reindirizzamenti**, dove puoi aggiungerne o toglierne.

## Sitemap

La sitemap è su `/sitemap.xml` e si aggiorna a ogni pubblicazione. Da indicare una volta in Google Search Console.

## Ricerche AI

Sempre più persone cercano chiedendo a ChatGPT, Claude o Perplexity. Con **Pronto per le ricerche AI** acceso (lo è di serie) il sito pubblica:

- **`/llms.txt`**: l'indice del sito per gli assistenti AI, con il nome, la descrizione, i contatti dell'attività e l'elenco delle pagine con il loro riassunto.
- **Una copia in testo semplice di ogni pagina**: aggiungi `.md` all'indirizzo (`/chi-siamo.md`, `/index.md` per la home). Contiene solo il contenuto, senza menu, piè di pagina e moduli, quindi un assistente lo legge e lo cita meglio.

Le pagine segnate «non indicizzare» restano fuori da entrambi.

**Blocca i crawler che addestrano modelli AI** ferma GPTBot, ClaudeBot, Google-Extended, CCBot e simili, che leggono il sito per addestrare i modelli. Non blocca le ricerche AI (ChatGPT Search, Claude, Perplexity), che leggono una pagina per rispondere a qualcuno e linkano il tuo sito, come fa Google.

## Feed RSS

Il feed è su `/rss.xml`, con gli ultimi 50 contenuti pubblicati, il riassunto e l'immagine. Serve ai lettori di feed, ai servizi di newsletter che inviano gli articoli nuovi da soli e alle ricerche AI. Ogni pagina lo annuncia, così i browser e i lettori lo trovano.

Di serie contiene le raccolte con una data, come il Diario o le notizie. In **Impostazioni → SEO → Feed RSS** scegli tu quali raccolte includere; senza nessuna casella il feed non c'è.
