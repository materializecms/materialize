# Moduli di contatto ed email

## Un modulo sul sito

Nella scheda **Aggiungi** dell'editor ci sono sezioni **Contatti** già con il modulo. Oppure si costruisce a mano: un contenitore con dentro i **campi di un modulo** (tasto **K**) e un pulsante.

Tipi di campo: testo breve, email, telefono, messaggio lungo, scelta da un elenco (una scelta per riga), casella da spuntare, **file allegato**. Ogni campo può essere obbligatorio.

Il modulo si invia senza ricaricare la pagina, e funziona anche nei browser senza JavaScript. Il server ricontrolla tutto: se un campo obbligatorio è vuoto, un'email non è valida o un file è del tipo sbagliato, il motivo compare accanto al campo.

### Le impostazioni del modulo

Seleziona il contenitore del modulo: nell'inspector, sotto **Modulo di contatto**, trovi:

- **Nome**: come lo riconosci tra i messaggi, per esempio «Contatti» o «Preventivo».
- **Oggetto** dell'email che ricevi e **Dopo l'invio**, il messaggio che vede chi ha scritto.
- **Invia a**: uno o più indirizzi separati da virgole. Vuoto, i messaggi vanno al destinatario di Impostazioni → Email.
- **Risposta automatica a chi scrive**: un'email con oggetto e testo tuoi, mandata all'indirizzo scritto nel modulo. Non ripete mai ciò che è stato inviato.
- **Webhook**: ogni messaggio arriva anche a questo indirizzo, in JSON, per collegarlo a Zapier, Make, n8n o a un CRM.

**Invia a**, **Webhook** e la **risposta automatica** li cambia solo un amministratore, perché decidono dove finiscono i dati di chi scrive e cosa parte a nome del sito. Il webhook deve essere un indirizzo pubblico: Materialize rifiuta gli indirizzi della rete interna (per esempio `127.0.0.1` o `192.168.…`). Per un n8n o un altro servizio sullo stesso server, avvialo con `MATERIALIZE_PRIVATE_WEBHOOKS=1`.

### File allegati

Il campo **File allegato** accetta documenti (PDF, Word, Excel, OpenDocument, testo), immagini (JPG, PNG, WebP, HEIC) o entrambi, fino a 10 MB per file. I file restano privati: non stanno nella libreria media e non sono raggiungibili dal sito. Li scarichi aprendo il messaggio; l'email ti avvisa che ci sono.

### Consenso privacy

Aggiungi un campo **Casella da spuntare**, obbligatorio, con un'etichetta come «Ho letto l'informativa privacy», e nel campo **Link** l'indirizzo della pagina dell'informativa (per esempio `/privacy`): l'etichetta la apre in una nuova scheda.

## Spam

Materialize ferma lo spam senza CAPTCHA, quindi senza far perdere tempo a chi scrive davvero:

- un **campo nascosto** che solo i bot compilano: questi messaggi vengono scartati;
- un modulo compilato in **meno di 3 secondi**;
- messaggi con **più di tre link** o con **link nascosti** nel testo;
- lo **stesso messaggio** arrivato due volte nello stesso giorno;
- al massimo **5 invii al minuto** dallo stesso indirizzo.

Tranne quelli del campo nascosto, i messaggi sospetti vanno nella cartella **Spam** di Impostazioni → Messaggi, con il motivo. Non arrivano per email e non partono verso il webhook. Se uno è finito lì per errore, il pulsante con lo scudo lo rimette tra i messaggi.

## Dove arrivano i messaggi

- Sempre in **Impostazioni → Messaggi**, con il numero dei non letti accanto alla voce. Qui li filtri per modulo, **Da leggere** o **Spam**, li cerchi per parola e li esporti in un foglio di calcolo con **CSV** (si apre con Excel, Numbers o Fogli Google).
- Anche per **email**, se l'invio delle email è configurato (qui sotto).
- Al **webhook** del modulo, se l'hai indicato.

### Per quanto restano

In fondo a Impostazioni → Messaggi scegli se cancellare da soli i messaggi più vecchi di **6 mesi**, **1 anno** o **2 anni**, con i loro allegati. Il GDPR chiede di conservare i dati personali solo per il tempo che serve.

### Webhook, per chi sviluppa

Il webhook riceve una `POST` con un JSON: `id`, `form` (`id` e `name`), `page`, `data` (i campi), `files` (nome e peso degli allegati, che restano nel pannello) e `createdAt`. L'intestazione `X-Materialize-Signature: sha256=…` è l'HMAC SHA-256 del corpo con la **chiave dei webhook** mostrata agli amministratori in Impostazioni → Messaggi: confrontala per essere sicuro che la chiamata arrivi dal tuo sito. Se il destinatario non risponde, Materialize riprova due volte nei minuti successivi; il messaggio indica se il webhook non è riuscito.

## Configurare l'email

Un amministratore la configura in **Impostazioni → Email**. Serve un server di posta in uscita (SMTP): quello della tua casella o di un servizio come Brevo, Postmark, Amazon SES.

**Il tuo fornitore**: sceglilo dall'elenco (Brevo, Postmark, Resend, Mailgun, Amazon SES, SendGrid, Mailjet, SMTP2GO, Aruba, Register.it, Gmail, Microsoft 365). Server, porta e sicurezza si compilano da soli, e sotto **Utente** e **Password** compare dove trovarli nel pannello del fornitore. Se il tuo non c'è, scegli **Altro** e inserisci i dati a mano.

| Campo                       | Cosa scrivere                                                           |
| --------------------------- | ----------------------------------------------------------------------- |
| **Server**                  | per esempio `smtp.example.com`, lo trovi nelle istruzioni del fornitore |
| **Porta** e **Sicurezza**   | di solito 587 con STARTTLS, oppure 465 con TLS                          |
| **Utente** e **Password**   | quelli della casella o del servizio                                     |
| **Mittente**                | come appare a chi riceve, per esempio `Studio Rossi <sito@example.com>` |
| **Destinatario dei moduli** | dove arrivano i messaggi del sito                                       |

**Salva e invia una prova** controlla subito che funzioni. Se non funziona, il pannello dice perché e cosa fare:

- **il server non esiste**: un errore di battitura nel nome;
- **il server non risponde sulla porta**: spesso il fornitore del VPS blocca le porte della posta in uscita. Il pannello prova da solo le altre porte e ti dice quale risponde; altrimenti chiedi al supporto del VPS di sbloccarle, o usa un servizio che accetta la porta 2525;
- **la sicurezza non corrisponde alla porta**: 587 con STARTTLS, 465 con TLS;
- **utente o password rifiutati**: con il promemoria di dove trovarli;
- **mittente non accettato**: va verificato presso il fornitore;
- **invio rimandato**: spesso un limite di messaggi raggiunto.

## Perché le email non finiscano nello spam

**Controlla il dominio** legge il DNS del dominio del mittente, come fanno Gmail, Outlook e gli altri prima di fidarsi di un messaggio:

- **SPF** dice quali server possono inviare per il dominio. Il pannello controlla che ci sia, che non ce ne siano due (si annullano) e che autorizzi il tuo fornitore;
- **DKIM** firma i messaggi. Per molti fornitori il pannello lo cerca da solo; per altri (Postmark, Amazon SES, SMTP2GO) i nomi cambiano per ogni account, e si controlla nel loro pannello;
- **DMARC** dice cosa fare con i messaggi che non passano. Gmail e Yahoo lo chiedono a chi invia molte email: per iniziare basta un record che osserva soltanto.

Questi record si aggiungono nel pannello DNS del dominio, dove li indica il fornitore della posta. Le modifiche possono metterci qualche ora ad arrivare.

## Cosa cambia con l'email configurata

Oltre ai messaggi dei moduli, arrivano per posta:

- gli **inviti** alle nuove persone e i link per una **nuova password**, invece di doverli copiare e mandare a mano;
- gli **avvisi di sicurezza**: tentativi di accesso falliti, email del profilo cambiata.

Senza email Materialize funziona lo stesso, ma è consigliata: **Impostazioni → Sicurezza** la segnala finché non è configurata.
