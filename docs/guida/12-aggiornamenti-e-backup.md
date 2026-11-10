# Aggiornamenti e backup

## Aggiornare Materialize

Una volta al giorno il server controlla se c'è una versione nuova. Quando c'è, gli amministratori la vedono subito: in alto a destra compare una pillola con il numero della versione (al passaggio del mouse, le prime novità), nella Panoramica una scheda **Aggiornamento**, e un pallino su **Impostazioni**. La pillola si chiude con la crocetta e torna alla versione successiva. In **Impostazioni → Aggiornamenti** un amministratore vede le novità e preme **Aggiorna ora**:

1. Materialize fa un **backup** del database e dei media;
2. scarica la nuova versione **mentre il sito resta online**;
3. si riavvia sulla nuova versione, in pochi secondi; la pagina si ricarica da sola e mostra «Aggiornato dalla … alla …».

Se la nuova versione **non parte**, torna da sola quella di prima e il pannello spiega cosa è successo. Il sito resta fermo al massimo pochi secondi.

**Tornare indietro**: dopo un aggiornamento, nella stessa pagina c'è **Torna alla** versione precedente. I contenuti restano come sono.

**Correzioni automatiche**: l'interruttore **Installa da sola le correzioni** lascia installare da sole le versioni che correggono problemi, per esempio dalla 0.2.0 alla 0.2.1. Le versioni con novità, per esempio la 0.3.0, le decidi sempre tu.

Gli aggiornamenti non toccano mai i contenuti né i file del sito (layout, blocchi, configurazione).

> Gli aggiornamenti dal pannello funzionano sui siti installati con lo script per VPS o con Docker. Su un sito avviato in modo diverso il pannello mostra il comando da usare a mano. Sul tuo computer, in sviluppo, si aggiorna da terminale con `npm install`.

### Aggiornare il sistema del VPS

Gli aggiornamenti di sicurezza di Debian o Ubuntu si installano da soli: l'installazione li ha attivati. Gli aggiornamenti più grandi del sistema restano da fare a te, ogni tanto.

## Backup

In **Impostazioni → Backup**:

- **Backup automatici ogni giorno** del database, con **Quante copie tenere**;
- una copia di tutte le immagini caricate, che non perde i file eliminati per almeno 30 giorni;
- **Scarica tutto**: un unico archivio `.tar.gz` con database, media e caratteri, da tenere sul tuo computer;
- **Copia fuori dal server**: la protezione vera, vedi sotto.

Prima di ogni aggiornamento Materialize fa comunque un backup in più.

## Copia fuori dal server

I backup normali restano sullo stesso server del sito: se il server si rompe, si perdono anche loro. La **copia fuori dal server** li manda ogni notte su uno spazio esterno, cifrati prima di uscire.

Due tipi di spazio:

- **S3 compatibile**: Cloudflare R2, Backblaze B2, Hetzner Object Storage, Amazon S3, Scaleway, OVH, Wasabi e altri. Per un sito normale costano pochi centesimi al mese. Crei un «bucket» e una chiave di accesso nel pannello del servizio, poi copi in Materialize indirizzo, bucket, regione e chiave.
- **WebDAV**: Nextcloud, ownCloud, NAS Synology o QNAP in ufficio, pCloud, kDrive. Servono l'indirizzo della cartella, l'utente e la password (con Nextcloud, meglio una password per app).

Come si attiva, in **Impostazioni → Backup → Copia fuori dal server**:

1. scegli **S3 compatibile** o **WebDAV** e compila i campi;
2. **Prova il collegamento**: Materialize scrive, rilegge ed elimina un file di prova;
3. **Salva**: compare la **chiave di ripristino**.

### La chiave di ripristino

Tutto è cifrato con una chiave che Materialize crea per te. Chi apre lo spazio esterno, compreso il fornitore, vede solo dati illeggibili. **Senza la chiave i backup non si possono rimettere**: copiala o scaricala come file e conservala lontano dal server, per esempio nel gestore di password. Si può rivedere con **Mostra la chiave di ripristino**, confermando la password.

### Cosa succede ogni notte

- Parte la copia più recente del database. Tieni quante copie vuoi (7, 14, 30, 90 o 365): le più vecchie si cancellano.
- Partono le immagini e i caratteri nuovi, solo quelli non ancora inviati. Sullo spazio esterno le immagini non si cancellano mai, perché una copia vecchia del database potrebbe usarle.
- Se una notte non riesce, gli amministratori ricevono un'email e **Impostazioni → Sicurezza** lo segnala. Materialize riprova ogni ora finché non funziona.

**Esegui ora** fa subito una copia, per esempio dopo aver caricato molte immagini.

## Ripristinare un backup

Il ripristino si fa dal terminale del server, con il sito **fermo**. Materialize tiene sempre una copia del database di prima, così anche un ripristino si può annullare.

**Su un VPS installato con lo script:**

```bash
sudo systemctl stop materialize
cd /srv/materialize
sudo -u materialize node_modules/.bin/materialize restore percorso/del/backup
sudo systemctl start materialize
```

**Con Docker**, nella cartella di `compose.yaml` e `.env`:

```bash
docker compose stop materialize
docker compose run --rm materialize restore percorso/del/backup
docker compose start materialize
```

Il file può essere un backup del database (`content-….db`, nella cartella `.materialize/backups` del sito) oppure un archivio completo scaricato con **Scarica tutto** (`materialize-….tar.gz`). Con Docker il file deve essere nel volume del sito.

### Dalla copia fuori dal server

Se il server è perso, installa Materialize su un server nuovo, poi:

1. **Scarica** la cartella dei backup dallo spazio esterno: dalla console del servizio, dal client di Nextcloud, oppure con [rclone](https://rclone.org).
2. **Decifrala**, nella cartella del sito: `npx materialize decrypt <cartella scaricata> --key mzk1-…`. I file decifrati compaiono accanto a quelli cifrati, e il comando dice quale database rimettere.
3. **Rimetti il database** con `npx materialize restore …/database/content-….db`, a server fermo.
4. **Copia** le cartelle `media` e `fonts` decifrate dentro `.materialize/` del sito.
