# Novità di Materialize

Ogni versione, dalla più recente. Le novità in arrivo si scrivono sotto «Prossima versione»: `npm run bump` le assegna alla nuova versione.

## Prossima versione

- **Sicurezza, dal controllo generale.** Le pagine salvate vengono ripulite prima di diventare HTML: un tipo di elemento, un valore CSS, un'icona SVG o una copia di un componente non possono più portare codice nel sito (prima un editor poteva farlo, e lo script sarebbe girato anche per gli amministratori che aprivano la pagina). Le icone SVG personalizzate vengono ricostruite da zero con i soli elementi da disegno.
- Le copie dei componenti cambiano solo i propri contenuti; ripristinare una versione segue le stesse regole del salvataggio; la risposta automatica dei moduli la cambia solo un amministratore, come destinatari e webhook.
- Gli indirizzi interni sono bloccati anche nelle forme IPv6 e dopo un cambio di DNS, sia nelle importazioni da URL sia nei webhook dei moduli (`MATERIALIZE_PRIVATE_WEBHOOKS=1` per un servizio sullo stesso server).
- Limiti di dimensione sulle richieste al server e sulle password; più limiti ai messaggi dei moduli per indirizzo; gli allegati dei messaggi di spam non vengono salvati.
- «Password dimenticata?» online usa solo l'indirizzo configurato del sito (senza, il link non parte e Impostazioni → Sicurezza lo segnala) e risponde sempre negli stessi tempi; il reset con il link chiude le sessioni e revoca i token personali.
- L'API pubblica dei contenuti non mostra più destinatari, webhook e risposte automatiche dei moduli. Il cookie di sessione è `Secure` anche dietro un proxy HTTPS. Le prove di invio della newsletter sono limitate. Cambiando il server dell'AI, dell'email o dei backup esterni, la chiave salvata va scritta di nuovo.
- **Avviso di aggiornamento**: quando esce una nuova versione di Materialize, gli amministratori vedono in alto a destra una pillola con il numero della versione (al passaggio del mouse, le prime novità) e una scheda **Aggiornamento** nella Panoramica, che portano a Impostazioni → Aggiornamenti. La pillola si chiude e torna con la versione successiva. Si vede anche in sviluppo, dove si aggiorna dal terminale.
- **Scorrimento fluido verso le sezioni**: i link a una sezione della stessa pagina, come le voci del menu, non saltano più di colpo: la pagina scorre in modo morbido (al massimo un secondo) e la sezione si ferma sotto il menu fisso, anche se intanto finiscono di caricarsi immagini più in alto. La rotella o un tocco fermano lo scorrimento; chi ha chiesto meno movimento vede il salto di sempre.
- **Materialize in inglese, completo.** Oltre al pannello, sono in inglese i messaggi del server, le email a chi ha un account, i controlli SEO, di accessibilità e di prestazioni, i nomi delle sezioni della libreria e degli stili, il terminale (`materialize` e `create-materialize`), la guida (`docs/guide`) e il README (`README.en.md`).
- Ognuno sceglie la lingua per sé, nel profilo o nella pagina di accesso; prima di scegliere, il pannello segue la lingua del browser. Due persone possono usare lo stesso sito una in italiano e una in inglese: il server risponde a ognuna nella sua lingua, e le email partono nella lingua del profilo di chi le riceve.
- Il terminale parla la lingua del sistema; `MATERIALIZE_LANG=it` o `en` la sceglie a mano.
- Restano nella lingua del sito i testi che vedono i visitatori: pagine, moduli, banner dei cookie, newsletter.
- Anche i testi che il server salva per dopo si leggono nella lingua di chi guarda: motivi dello spam, errori delle pubblicazioni programmate, dei rilasci e delle newsletter, e gli stessi messaggi nel registro attività. Quelli salvati prima di questa versione restano come sono.
- **Pannello in inglese, terza parte: tutto il resto del pannello.** Documenti, liste e rilasci, ricerca ⌘K, campi e libreria media, newsletter, persone e verifica in due passaggi, tutte le impostazioni, l'installazione iniziale (con il selettore della lingua) e i tour.
- **Pannello in inglese, seconda parte: l'editor.** Tela, livelli, libreria, stili, controlli, pannello delle proprietà, animazioni, interazioni, assistente, commenti, tour e scorciatoie, esportazione e modalità Design delle raccolte a blocchi. I nuovi elementi prendono nome e testo segnaposto nella lingua del pannello.
- **`materialize dev` resta sul tuo computer**: prima si poteva raggiungere da tutta la rete, e su una Wi-Fi condivisa qualcun altro avrebbe potuto aprire un sito nuovo e crearne l'amministratore. Per provarlo dal telefono: `--host 0.0.0.0`. `materialize start` non cambia.
- **Nuovo aspetto del pannello**: menu, area di lavoro e pannelli dell'editor sono superfici arrotondate su un fondo più scuro; pulsanti, filtri e selettori sono a pillola.
- Ricerca, tema e profilo si sono spostati in alto a destra, in un incavo dell'area di lavoro (sul telefono, nella barra in alto). La lingua dei contenuti resta in basso a sinistra.
- Nell'editor i comandi sopra la tela stanno in tre incavi del suo bordo, e lo zoom è una pillola in basso a destra sulla tela. Sulle tele strette i comandi meno usati passano in un menu ⋯, così la barra non viene tagliata.

## 0.8.0 — 2026-11-07

- **Un documento alla volta**: se un'altra persona sta modificando la pagina che apri, la vedi in sola lettura con chi ci lavora e da quanto, e puoi prendere il controllo. Nessuno sovrascrive più il lavoro di un altro senza saperlo, nemmeno da due schede.
- **Sezioni con effetti**: nuova categoria **Effetti** nella libreria, con 7 sezioni pronte che usano le scene WebGL e il 3D: apertura su aurora, apertura con seta, logo 3D (carica il tuo SVG), oggetto 3D (scegli un modello `.glb`), numeri sul globo, immagine animata e invito con particelle. Si trovano anche cercando «webgl».
- Nuovo schema di colori **Scuro** per le sezioni: resta scuro con il testo chiaro in qualsiasi tema.
- **Oscura** ora funziona anche sugli sfondi animati delle sezioni, non solo sulle foto.
## 0.7.0 — 2026-11-06

- **Tour del pannello**: la prima volta che entri, un tour mostra il pannello una zona alla volta, come quello dell'editor. Si rifà dal menu del profilo (**Tour del pannello**) o cercando «tour» con ⌘K.
- **Newsletter**: raccogli iscritti dal sito con doppia conferma via email, importali da Mailchimp o Brevo, scrivi la newsletter da zero, da un articolo o con l'AI dagli ultimi articoli, provala su di te e mandala subito o a un'ora stabilita. Ogni email ha il link per disiscriversi; per ogni invio vedi aperture e clic. Nuova voce **Newsletter** nella barra laterale.
- Le sezioni «Invito → Newsletter» e «Footer → Con iscrizione» della libreria hanno un modulo vero, collegato alla newsletter.
- **Pannello in inglese, prima parte**: ognuno può scegliere l'inglese nel profilo (o nella pagina di accesso); per ora sono tradotti accesso, barra laterale, panoramica e profilo. Finché la traduzione non è completa il pannello parte in italiano per tutti.
## 0.6.0 — 2026-11-06

- **Panoramica rinnovata**: si apre su quello che c'è da fare (documenti da pubblicare, il rilascio in preparazione, la prossima uscita programmata, i messaggi nuovi), con un riepilogo in una frase, le ultime modifiche e il sito a colpo d'occhio.
- **Cosa facciamo oggi sul sito?**: in cima alla panoramica chiedi all'AI qualcosa che riguarda tutto il sito, come le descrizioni per Google mancanti o la traduzione delle pagine. Lavora solo in bozza, senza pubblicare né toccare tema e sezioni condivise, e ti elenca le bozze da rivedere.
- **Barra sopra l'elemento selezionato** nell'editor: AI sul testo, cambia immagine, duplica, sposta su e giù, com'è su mobile, altre azioni ed elimina, senza andare nel pannello a destra.
- **Import da WordPress con impaginazione AI**: un'opzione in più rifà l'impaginazione di ogni pagina importata con le sezioni della libreria (apertura, colonne, elenchi, inviti all'azione), con gli stessi testi e le stesse immagini, nella bozza. Un controllo confronta parole e immagini prima e dopo: se cambierebbero, la pagina resta com'era.
- L'import da WordPress conserva le descrizioni (testo alternativo) delle immagini nei contenuti: prima andavano perse.
- **Tour dell'editor rifatto**: 14 passi invece di 4, e ognuno illumina la zona vera di cui parla (le schede a sinistra si aprono da sole): Contenuto e Design, Livelli, Aggiungi, Stili, Controlli, la tela, le proprietà, i dispositivi, zoom e anteprima, l'assistente AI, cronologia e pubblicazione. Frecce per spostarsi, Esc per uscire, e si rifà da **?** → **Rifai il tour**.
- **Rilasci**: raccogli più pagine e articoli che devono uscire insieme, per un lancio o una campagna, e pubblicali con un clic o a un'ora stabilita. Nello stesso momento si possono togliere dal sito le pagine vecchie. Tutto o niente: se una pagina non è pronta non esce niente, e il pannello dice quale e perché. Dalla nuova voce **Rilasci** nella barra laterale, o da Altre azioni → Aggiungi a un rilascio.
- Nelle finestre il cursore va subito nel campo da compilare.
- Le icone di alcuni pulsanti (Rivedi con l'AI, Ricavala dai testi del sito, Copia, Applica, Crea e copia il link) avevano una misura sbagliata e riempivano il pulsante.
- **Il sito da un brief**: dalla Panoramica, **Sito da un brief**. Descrivi l'attività in poche righe, se vuoi con un'immagine di riferimento, e l'AI prepara le pagine con le sezioni della libreria, con menu, piè di pagina, testi e descrizioni per Google. Tutto resta in bozza; le pagine esistenti, i menu condivisi e il sito online non vengono toccati. Colori, caratteri e voce del brand arrivano come proposta da applicare con un clic. Dove mancano informazioni (prezzi, indirizzo, telefono) lascia un segnaposto tra parentesi quadre invece di inventare, e puoi rispondere all'AI per chiedere altro.
- Le risposte dell'assistente mostrano grassetti ed elenchi, invece di asterischi e trattini.
- **Revisione AI prima di pubblicare**: nella scheda Controlli (e in Altre azioni per gli articoli) **Rivedi con l'AI** rilegge la pagina e segnala refusi, grammatica, frasi fuori dalla voce del brand, incoerenze e link che non portano dove dicono. Ogni segnalazione ha la correzione, da applicare con un clic e annullare con ⌘Z.
- **Voce del brand per l'AI**: in Impostazioni → Voce del brand scrivi chi siete, il tono, come vi rivolgete a chi legge, le parole da usare ed evitare e un testo d'esempio. L'AI la segue in ogni testo che scrive: pulsante ✨, assistente, traduzioni e client MCP. Il pulsante **Ricavala dai testi del sito** la propone leggendo le pagine pubblicate.
## 0.5.0 — 2026-11-05

- **Nuovo logo**: una M fatta di blocchi che passano da trasparenti a pieni, perché i contenuti prendono forma. Il nome è in Geist. Lo trovi nel pannello, nella favicon, nella pagina di accesso e nel README; i file sono in `docs/assets`.
- **Pubblicazione programmata**: scegli quando una pagina o un articolo esce, e se vuoi quando torna bozza da solo (offerte, eventi). Dal pulsante con il calendario accanto a «Pubblica», con scorciatoie come «Domani alle 9». Esce la bozza com'è in quel momento; i campi mancanti vengono segnalati subito, e se al momento di uscire qualcosa non va la pagina resta bozza e il pannello dice perché. Le date compaiono anche negli elenchi.
- **Link di anteprima da condividere**: un link segreto per far vedere una bozza a un cliente o a un collega senza account, con il design vero del sito. Scade dopo 1, 7 o 30 giorni o quando lo revochi, segue le modifiche, non finisce su Google e mostra un'etichetta «Anteprima». Da «Altre azioni» → «Condividi anteprima».
- **Pronto per le ricerche AI**: il sito pubblica `llms.txt`, l'indice per ChatGPT, Claude, Perplexity e gli altri assistenti, e una copia in Markdown di ogni pagina (per esempio `/chi-siamo.md`), più facile da leggere e citare. Si spegne in Impostazioni → SEO.
- **Feed RSS** su `/rss.xml` con gli ultimi articoli, annunciato in ogni pagina; in Impostazioni → SEO si scelgono le raccolte.
- **Blocco dei crawler AI più preciso**: blocca solo chi addestra modelli; le ricerche AI (ChatGPT Search, Claude, Perplexity) restano libere, perché portano visitatori. Prima PerplexityBot veniva bloccato.
- **Controllo di accessibilità e prestazioni**: la scheda SEO dell'editor diventa **Controlli**, con tre gruppi. Accessibilità: contrasto dei testi misurato sulla pagina vera (WCAG), immagini senza descrizione, pulsanti e icone senza nome, campi senza etichetta, link poco chiari, titoli saltati, video senza pausa. Prestazioni: file da altri siti, GIF e video pesanti, video senza copertina, troppe scene 3D, script esterni, troppi caratteri. Prima di pubblicare, i problemi seri vengono elencati.
- **Moduli più robusti**: antispam senza CAPTCHA (lo spam va in una cartella recuperabile), controlli dei campi anche sul server con il motivo accanto al campo, **file allegati** privati, destinatari per modulo, **risposta automatica** a chi scrive, **webhook** firmato per Zapier, Make e n8n. In Impostazioni → Messaggi: filtri per modulo, da leggere e spam, ricerca, **esportazione CSV** e cancellazione automatica dei messaggi vecchi. La casella da spuntare può aprire l'informativa privacy.
- Una pagina riportata com'è sul sito (per esempio con ⌘Z) non risulta più «Modifiche da pubblicare».

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
