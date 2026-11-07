# Persone e sicurezza

## Ruoli

| Ruolo              | Cosa può fare                                                                    |
| ------------------ | -------------------------------------------------------------------------------- |
| **Amministratore** | Tutto, comprese le persone, le impostazioni, gli aggiornamenti e le eliminazioni |
| **Editor**         | Crea, modifica e pubblica i contenuti                                            |

C'è sempre almeno un amministratore: l'ultimo non si può togliere né declassare.

**I redattori modificano solo i contenuti**: con questo interruttore, in **Persone**, gli editor possono cambiare testi e immagini ma non l'impaginazione. Il controllo vale anche sul server, non solo nel pannello.

## Invitare una persona

In **Persone** un amministratore preme **Invita una persona**, scrive l'email e sceglie il ruolo.

- Con l'email configurata, l'invito arriva per posta. Senza, il pannello mostra il link da mandare tu.
- Il link vale **7 giorni** e si usa una volta sola: chi lo apre sceglie nome e password.

Dal menu **⋯** di una persona un amministratore può cambiare ruolo, correggere nome o email, creare un **link per una nuova password** (vale 24 ore), disattivare la sua verifica in due passaggi o toglierle l'accesso.

## Il tuo profilo

Dal tuo nome, in basso a sinistra, apri **Il tuo profilo**: nome, email (per cambiarla serve la password attuale) e password, di almeno 10 caratteri.

## Verifica in due passaggi

Oltre alla password, un codice di 6 cifre da un'app sul telefono (Google Authenticator, 1Password, Authy…). Anche chi scopre la tua password non può entrare.

1. **Il tuo profilo → Sicurezza** → attiva la verifica.
2. Inquadra il codice QR con l'app e scrivi il codice che mostra.
3. **Salva i codici di riserva** in un posto sicuro: ognuno vale una volta e serve se perdi il telefono.

Un amministratore può **richiedere la verifica in due passaggi a tutti** (in **Persone**): chi non l'ha la attiva al prossimo accesso.

Nella stessa scheda vedi i **dispositivi** collegati al tuo account e puoi disconnetterli. Una sessione non usata per 14 giorni si chiude da sola.

## Protezioni automatiche

- Dopo 5 tentativi di accesso sbagliati per la stessa email, o 20 dallo stesso indirizzo, l'accesso si **ferma per un po'**: un minuto, poi due, quattro… fino a un'ora. Vale anche per le email che non esistono, così nessuno può scoprire chi è registrato.
- Il pannello blocca le richieste che arrivano da altri siti e protegge le password con un algoritmo lento da decifrare.

## Impostazioni → Protezione

Tre sezioni, solo per gli amministratori:

- **Sicurezza**: quello che va sistemato, per esempio amministratori senza verifica in due passaggi, email non configurata, sito senza HTTPS, accessi falliti nelle ultime 24 ore. Ogni punto ha il suo pulsante. Quando non c'è niente: **Tutto in ordine**.
- **Backup**: vedi [Aggiornamenti e backup](12-aggiornamenti-e-backup.md).
- **Registro attività**: chi è entrato, chi ha pubblicato, invitato, cambiato impostazioni o installato aggiornamenti, e da dove. Si conserva per un anno.

In **Persone**, la colonna della verifica dice per ognuno **Due passaggi** oppure **Solo password**.

## Se dimentichi la password

Nella pagina di accesso premi **Password dimenticata?** e scrivi la tua email: arriva un link per sceglierne una nuova, valido **un'ora**. Se non arriva, guarda nello spam. Per sicurezza la pagina risponde allo stesso modo per qualsiasi indirizzo, e dopo alcune richieste si ferma per un po'.

Serve l'email configurata (vedi [Moduli di contatto ed email](07-moduli-ed-email.md)). Senza:

- un **amministratore** crea per te il link, in **Persone**, menu **⋯**;
- se sei l'**unico amministratore**, chi gestisce il server lo crea con un comando, dalla cartella del sito:

  ```bash
  # su un VPS installato con lo script
  cd /srv/materialize && sudo -u materialize node_modules/.bin/materialize reset-password nome@example.com

  # con Docker, nella cartella di compose.yaml
  docker compose run --rm materialize reset-password nome@example.com
  ```

  Il comando stampa il link, valido un'ora.

Se hai la verifica in due passaggi, dopo la nuova password ti chiede comunque il codice: una password nuova non la scavalca.

Per mettere in sicurezza il server (HTTPS, proxy, firewall) c'è la [guida alla sicurezza](../sicurezza.md).

## Un documento alla volta

Due persone non possono modificare insieme lo stesso documento: chi salva per ultimo cancellerebbe il lavoro dell'altro. Per questo si lavora a turni.

- Chi apre una pagina, un articolo o una scheda delle impostazioni mentre un'altra persona la sta modificando vede un riquadro: chi sta lavorando e da quanto. Può **tornare indietro**, **aprire il sito** per guardare la pagina pubblicata, oppure **prendere il controllo**.
- **Prendi il controllo** serve quando l'altra persona si è allontanata o ha dimenticato la scheda aperta. Lei passa subito in sola lettura e vede chi ha preso il controllo; le sue modifiche fino all'ultimo salvataggio restano, solo quelle degli ultimi secondi potrebbero perdersi. Nel Registro attività resta scritto.
- Il turno si libera da solo quando chi modifica chiude il documento o la scheda, o dopo meno di un minuto senza segni di vita.
- Vale anche per la stessa persona in due schede: si modifica da una, l'altra resta in sola lettura (con **Continua da qui**).
- Lo controlla anche il server: un salvataggio da chi non ha il turno viene rifiutato, con un messaggio, invece di sovrascrivere. Su documenti diversi si lavora insieme come sempre.
