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
- **Motori di ricerca e AI**: blocca i crawler che addestrano modelli AI, percorsi da non far visitare, codici di verifica di Google Search Console e Bing Webmaster.
- **Reindirizzamenti**: vecchio indirizzo → nuovo indirizzo.

Le modifiche valgono dalla prossima pubblicazione.

## Reindirizzamenti automatici

Se cambi l'indirizzo di una pagina già pubblicata, Materialize aggiunge da solo un reindirizzamento permanente (301) dal vecchio al nuovo. Lo stesso succede con le pagine importate da WordPress. Li trovi tutti in **Impostazioni → SEO → Reindirizzamenti**, dove puoi aggiungerne o toglierne.

## Sitemap

La sitemap è su `/sitemap.xml` e si aggiorna a ogni pubblicazione. Da indicare una volta in Google Search Console.
