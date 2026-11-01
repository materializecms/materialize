# Moduli di contatto ed email

## Un modulo sul sito

Nella scheda **Aggiungi** dell'editor ci sono sezioni **Contatti** già con il modulo. Oppure si costruisce a mano: un contenitore con dentro i **campi di un modulo** (tasto **K**) e un pulsante.

Tipi di campo: testo breve, email, telefono, messaggio lungo, scelta da un elenco (una scelta per riga), casella da spuntare. Ogni campo può essere obbligatorio.

Il modulo si invia senza ricaricare la pagina, e funziona anche nei browser senza JavaScript.

## Dove arrivano i messaggi

- Sempre in **Impostazioni → Messaggi**, con il numero dei non letti accanto alla voce.
- Anche per **email**, se l'invio delle email è configurato (qui sotto).

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
