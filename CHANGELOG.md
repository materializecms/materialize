# Novità di Materialize

Ogni versione, dalla più recente. Le novità in arrivo si scrivono sotto «Prossima versione»: `npm run bump` le assegna alla nuova versione.

## Prossima versione

- **Password dimenticata?** nella pagina di accesso: un link per email, valido un'ora. Senza email configurata, il comando `materialize reset-password` stampa il link sul server, anche per l'unico amministratore.
- **Cronologia per le pagine sulla tela**: ogni versione si guarda su desktop, tablet e mobile prima di ripristinarla.

- **Esporta la pagina in PDF o PNG** dall'editor, per mandarla al cliente: desktop, tablet e mobile, ognuno come un'unica immagine lunga.
- **Guida per chi usa Materialize**, in `docs/guida`: installazione, editor, contenuti, lingue, SEO, persone, aggiornamenti, backup e problemi comuni.

## 0.1.0 — 2026-10-31

La prima versione pubblica.

- **Editor visuale**: pagine disegnate su una tela, con sezioni, colonne, testi, immagini, video, icone e forme; componenti riutilizzabili con varianti; righelli, guide, allineamenti e misure; modalità Contenuti per chi modifica solo i testi.
- **Animazioni ed effetti**: animazioni allo scorrimento e con linee temporali, stati al passaggio del mouse, sfondi WebGL e oggetti 3D.
- **Contenuti**: raccolte come Progetti, Diario e Team, con pagine modello; azioni rapide e selezione multipla negli elenchi e nei Media.
- **Siti in più lingue**: traduzioni collegate tra loro, anche con l’AI, e un selettore di lingua per il sito.
- **SEO**: titoli e descrizioni, sitemap, controlli sulla pagina e reindirizzamenti automatici quando cambia un indirizzo.
- **Moduli di contatto** con invio delle email dal tuo server di posta.
- **Assistente AI e server MCP**: testi, traduzioni e modifiche alle pagine chiedendole a parole.
- **Importazione da WordPress**: pagine, articoli e immagini.
- **Statistiche e cookie**: Google Analytics, Tag Manager, Meta Pixel, Plausible, Matomo e codice personalizzato, con il banner per il consenso.
- **Installazione su VPS con un comando**: Node.js, HTTPS con Caddy, servizio che riparte da solo, firewall e link per finire nel browser.
- **Immagine Docker** con `compose.yaml` pronto per l'HTTPS: il sito sta in un volume, quindi gli aggiornamenti dal pannello restano anche ricreando il container.
- **Installazione nel browser**: controllo del server, nome e lingua del sito, account amministratore, passo per passo.
- **Aggiornamenti con un clic** da Impostazioni → Aggiornamenti, con backup prima e ritorno automatico alla versione precedente se la nuova non parte; le correzioni possono installarsi da sole.
- **Sicurezza**: verifica in due passaggi, pausa dopo i tentativi di accesso falliti, registro delle attività, backup giornalieri del database e dei media.
