# Novità di Materialize

Ogni versione, dalla più recente. Le novità in arrivo si scrivono sotto «Prossima versione»: `npm run bump` le assegna alla nuova versione.

## Prossima versione

- **Pubblicazione programmata**: scegli quando una pagina o un articolo esce, e se vuoi quando torna bozza da solo (offerte, eventi). Dal pulsante con il calendario accanto a «Pubblica», con scorciatoie come «Domani alle 9». Esce la bozza com'è in quel momento; i campi mancanti vengono segnalati subito, e se al momento di uscire qualcosa non va la pagina resta bozza e il pannello dice perché. Le date compaiono anche negli elenchi.
- **Link di anteprima da condividere**: un link segreto per far vedere una bozza a un cliente o a un collega senza account, con il design vero del sito. Scade dopo 1, 7 o 30 giorni o quando lo revochi, segue le modifiche, non finisce su Google e mostra un'etichetta «Anteprima». Da «Altre azioni» → «Condividi anteprima».

## 0.4.0 — 2026-11-03

- **Immagini di riferimento nell'assistente**: allega, incolla (⌘V) o trascina nella chat lo screenshot di un sito che ti piace, un mockup o uno schizzo, e l'assistente ne riprende impaginazione e atmosfera con le sezioni e lo stile del tuo sito. Fino a 4 immagini per messaggio; non vanno nella libreria e non finiscono sulla pagina.
- **Conversazioni con l'assistente più solide**: un secondo messaggio dopo aver cambiato la selezione sulla tela non fallisce più, e ogni nuovo messaggio rilegge dalla cache tutta la conversazione precedente, così costa una frazione.
- **L'assistente costa meno**: con Claude usa la cache dei prompt, così istruzioni, strumenti e pagina, rimandati a ogni passaggio, si pagano a una frazione del prezzo dopo il primo.
- **Azioni rapide più economiche**: ✨ sui testi, SEO e testo alternativo usano Claude Haiku 5.5, molto più economico di Opus; l'assistente e le traduzioni delle pagine restano sul modello principale. Si può scegliere un altro modello in Impostazioni → AI e MCP.
- **Uso dell'AI del mese** in Impostazioni → AI e MCP: richieste, token letti (e quanti dalla cache) e scritti, per tenere d'occhio la spesa.
- **AI sul testo formattato**: il pulsante ✨ c'è anche nel corpo degli articoli, e riscrive, accorcia o traduce mantenendo titoli, elenchi, grassetti, link e immagini.
- **✨ sulla tela mantiene grassetti, corsivi e link** di un testo, nell'Inspector e in modalità Contenuto.
- **Accorcia e Allunga più affidabili**: chiedono una lunghezza precisa (circa un terzo in meno, circa la metà in più), così un testo breve non torna quasi uguale e uno da allungare non diventa sette volte più lungo.
- **L'AI rispetta la lunghezza dei campi**: un testo riscritto non supera più il massimo del campo (prima, per esempio, un sommario di 220 caratteri poteva arrivare a 234 e bloccare la pubblicazione).
- **Descrivi con l'AI conserva i crediti**: il testo alternativo nuovo mantiene il credito della foto già scritto, come «foto di … su Unsplash», e la sua lingua.
- **Nastri con i bordi sfumati**: le lettere che scendono sotto la riga (g, p, y) non vengono più tagliate in basso.
- **Indirizzi del pannello scritti a mano**: `/admin/media`, `/admin/persone` e `/admin/impostazioni` portano alla sezione giusta, se nessuna raccolta ha quel nome.

## 0.3.0 — 2026-11-01

- **Backup fuori dal server**, ogni notte e cifrati, su uno spazio S3 compatibile (Cloudflare R2, Backblaze B2, Hetzner, Amazon S3…) o in una cartella WebDAV (Nextcloud, NAS Synology e QNAP…). Si attiva in Impostazioni → Backup; `materialize decrypt` rende di nuovo leggibili i file scaricati.
- **Email più facile da configurare**: si sceglie il fornitore (Brevo, Postmark, Mailgun, Amazon SES, Gmail…) e il server si compila da solo; se la prova non riesce, il pannello spiega perché (porta bloccata, password rifiutata, mittente non verificato…); **Controlla il dominio** verifica SPF, DKIM e DMARC.
- **Pannello più chiaro**: Impostazioni → Protezione divisa in Sicurezza, Backup e Registro attività; barra dell'editor a gruppi, con gli elementi meno usati in **⋯**; pannello sinistro dell'editor allargabile; menu a tendina, intestazioni e testi d'aiuto uniformi e più leggibili; pagina dedicata per gli indirizzi del pannello che non esistono; in Persone, chi entra con la sola password si riconosce a colpo d'occhio; accesso e installazione con l'aspetto del pannello.
- **Chi ha fatto ogni versione**: la cronologia mostra il nome dell'autore accanto alla data.
- **Informazioni su Materialize** in Impostazioni: versione, autore, licenza, novità, guida e licenze di terzi.

## 0.2.0 — 2026-11-01

- **Password dimenticata?** nella pagina di accesso: un link per email, valido un'ora. Senza email configurata, il comando `materialize reset-password` stampa il link sul server, anche per l'unico amministratore.
- **Cronologia per le pagine sulla tela**: ogni versione si guarda su desktop, tablet e mobile prima di ripristinarla.
- **Esporta la pagina in PDF o PNG** dall'editor, per mandarla al cliente: desktop, tablet e mobile, ognuno come un'unica immagine lunga.
- **Guida per chi usa Materialize**, in `docs/guida`: installazione, editor, contenuti, lingue, SEO, persone, aggiornamenti, backup e problemi comuni.
- **Sicurezza**: i link degli inviti e delle nuove password puntano sempre all'indirizzo pubblico del sito, mai a quello dichiarato da chi fa la richiesta. Consigliato aggiornare.

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
