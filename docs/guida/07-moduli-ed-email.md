# Moduli di contatto ed email

## Un modulo sul sito

Nella scheda **Aggiungi** dell'editor ci sono sezioni **Contatti** già con il modulo. Oppure si costruisce a mano: un contenitore con dentro i **campi di un modulo** (tasto **K**) e un pulsante.

Tipi di campo: testo breve, email, telefono, messaggio lungo, scelta da un elenco (una scelta per riga), casella da spuntare. Ogni campo può essere obbligatorio.

Il modulo si invia senza ricaricare la pagina, e funziona anche nei browser senza JavaScript.

## Dove arrivano i messaggi

- Sempre in **Impostazioni → Messaggi**, con il numero dei non letti accanto alla voce.
- Anche per **email**, se l'invio delle email è configurato (qui sotto).

## Configurare l'email

Un amministratore la configura in **Impostazioni → Email**. Serve un server di posta in uscita (SMTP): quello della tua casella o di un servizio come Postmark, Brevo, Amazon SES.

| Campo                       | Cosa scrivere                                                           |
| --------------------------- | ----------------------------------------------------------------------- |
| **Server**                  | per esempio `smtp.example.com`, lo trovi nelle istruzioni del fornitore |
| **Porta** e **Sicurezza**   | di solito 587 con STARTTLS, oppure 465 con TLS                          |
| **Utente** e **Password**   | quelli della casella o del servizio                                     |
| **Mittente**                | come appare a chi riceve, per esempio `Studio Rossi <sito@example.com>` |
| **Destinatario dei moduli** | dove arrivano i messaggi del sito                                       |

**Salva e invia una prova** controlla subito che funzioni.

## Cosa cambia con l'email configurata

Oltre ai messaggi dei moduli, arrivano per posta:

- gli **inviti** alle nuove persone e i link per una **nuova password**, invece di doverli copiare e mandare a mano;
- gli **avvisi di sicurezza**: tentativi di accesso falliti, email del profilo cambiata.

Senza email Materialize funziona lo stesso, ma è consigliata: **Impostazioni → Sicurezza** la segnala finché non è configurata.
