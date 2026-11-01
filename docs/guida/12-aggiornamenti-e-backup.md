# Aggiornamenti e backup

## Aggiornare Materialize

Una volta al giorno il server controlla se c'è una versione nuova. Quando c'è, compare un pallino su **Impostazioni**. In **Impostazioni → Aggiornamenti** un amministratore vede le novità e preme **Aggiorna ora**:

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

In **Impostazioni → Sicurezza → Backup**:

- **Backup automatici ogni giorno** del database, con **Quante copie tenere**;
- una copia di tutte le immagini caricate, che non perde i file eliminati per almeno 30 giorni;
- **Scarica tutto**: un unico archivio `.tar.gz` con database, media e caratteri. Conservane una copia **fuori dal server**, per esempio sul tuo computer o in un cloud.

Prima di ogni aggiornamento Materialize fa comunque un backup in più.

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
