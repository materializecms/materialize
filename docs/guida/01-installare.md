# Installare Materialize

Materialize è un programma sempre acceso, che fa funzionare il pannello e genera il sito. Per questo serve un **server tuo**:

| Dove                                                                                          | Adatto?                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **VPS** (Hetzner, DigitalOcean, OVH, Aruba Cloud…) con Debian 12 o Ubuntu 22.04 o più recenti | ✓ il modo più semplice, con un comando                        |
| **Server con Docker**                                                                         | ✓                                                             |
| **Il tuo computer**, con Node.js o Docker Desktop                                             | ✓ per provarlo o sviluppare un sito                           |
| Hosting condiviso PHP (anche con Node nel cPanel)                                             | ✗ memoria scarsa e processi sospesi quando non ci sono visite |

Il sito che Materialize genera è fatto di file statici: se un giorno vorrai, quei file si possono pubblicare anche su un hosting qualsiasi. Il pannello, invece, ha bisogno del server.

**Requisiti minimi**: 1 GB di memoria (2 GB consigliati), 2 GB di spazio libero, un dominio o sottodominio.

## Su un VPS, con un comando

Prima di iniziare, nel pannello del tuo dominio crea un **record A** che punti all'indirizzo IP del VPS (per esempio `example.com` → `203.0.113.10`). Il certificato HTTPS arriva solo quando il dominio punta al server.

Poi collegati al VPS (con `ssh`) e lancia:

```bash
curl -fsSL https://cdn.jsdelivr.net/npm/@materializecms/cli/install.sh | sudo bash -s -- --domain example.com
```

Sostituisci `example.com` con il tuo dominio. In qualche minuto lo script:

1. controlla il sistema, la memoria, il disco e che il dominio punti al server;
2. installa Node.js e **Caddy**, che serve il sito in HTTPS con un certificato Let's Encrypt rinnovato da solo;
3. crea il sito in `/srv/materialize` e lo avvia come servizio, che riparte da solo dopo un riavvio o un errore;
4. apre nel firewall solo SSH, HTTP e HTTPS;
5. attiva gli aggiornamenti di sicurezza del sistema e, sui server con poca memoria, aggiunge memoria di scambio;
6. scrive il **link per finire l'installazione** nel browser.

Opzioni utili (`--help` le elenca tutte):

| Opzione                    | A cosa serve                                         |
| -------------------------- | ---------------------------------------------------- |
| `--email nome@example.com` | Ricevere da Let's Encrypt gli avvisi sul certificato |
| `--version 0.1.0`          | Installare una versione precisa invece dell'ultima   |
| `--no-firewall`            | Lasciare il firewall com'è                           |

Se qualcosa va storto, lo script dice cosa e dove guardare. Sistemato il problema, rilancia lo stesso comando: riprende da dove si era fermato. Rilanciato a installazione finita, ripara la configurazione senza toccare il sito.

## Con Docker

Su un server con Docker, con il dominio che già punta al server:

```bash
mkdir materialize && cd materialize
curl -fsSLO https://cdn.jsdelivr.net/npm/@materializecms/cli/compose.yaml
echo "DOMAIN=example.com" > .env
docker compose up -d
docker compose logs materialize
```

Il file `.env` ricorda il dominio: Docker lo legge da solo a ogni comando, nella stessa cartella. L'ultimo comando mostra il link per finire l'installazione, con l'indirizzo del dominio. I messaggi del server sono in italiano; per averli in inglese aggiungi `MATERIALIZE_LANG=en` al file `.env`. Il sito e i contenuti stanno nel volume `site`: puoi fermare, aggiornare o ricreare i container senza perdere niente.

## Sul tuo computer

Serve [Node.js](https://nodejs.org) 24 o più recente. Poi:

```bash
npm create materialize@latest
```

Il comando chiede il nome della cartella e prepara il sito. Poi:

```bash
cd il-mio-sito
npm run dev
```

e apri `http://localhost:4321/admin`. Sul tuo computer non serve il link di installazione: in sviluppo il sito si raggiunge solo da lì, così su una Wi-Fi condivisa nessun altro può aprirlo e creare per primo l'amministratore. Per provarlo dal telefono sulla stessa rete, avvialo con `npm run dev -- --host 0.0.0.0`.

Il terminale parla la lingua del sistema: italiano su un computer in italiano, inglese negli altri casi. Per sceglierla a mano, aggiungi `MATERIALIZE_LANG=it` (o `en`) all'ambiente, per esempio con `export MATERIALIZE_LANG=it` nel file `~/.zshrc`.

## Sul tuo computer, con Docker Desktop

Per provare Materialize com'è su un server, senza installare Node.js: serve solo [Docker Desktop](https://www.docker.com/products/docker-desktop/), per Mac, Windows e Linux.

1. Installa Docker Desktop e aprilo: deve restare acceso.
2. Apri il Terminale (su Windows, PowerShell) e lancia:

   ```bash
   docker run -d --name materialize -p 127.0.0.1:4321:4321 -v materialize:/site -e MATERIALIZE_LANG=it --restart unless-stopped --pull always ghcr.io/materializecms/materialize:latest
   ```

   Al primo avvio Docker scarica l'immagine e prepara il sito: ci vuole qualche minuto.

3. Chiedi il link per finire l'installazione:

   ```bash
   docker logs materialize
   ```

   Nella riga **Installazione** c'è un indirizzo come `http://localhost:4321/admin/?installa=…`: aprilo nel browser e prosegui come in [Finire l'installazione nel browser](#finire-linstallazione-nel-browser). Sul tuo computer non serve HTTPS.

Cosa fa il comando:

| Parte                      | A cosa serve                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `--name materialize`       | Il nome del container, come lo vedi in Docker Desktop                                      |
| `-p 127.0.0.1:4321:4321`   | Il sito su `http://localhost:4321`, raggiungibile solo da questo computer                  |
| `-v materialize:/site`     | Il volume dove restano sito, contenuti, immagini e backup                                  |
| `-e MATERIALIZE_LANG=it`   | I messaggi del server in italiano (`en` per l'inglese)                                     |
| `--restart unless-stopped` | Riparte da solo quando riapri Docker Desktop, se non l'avevi fermato tu                    |
| `--pull always`            | Scarica l'immagine più recente: senza, Docker userebbe quella che ha già, anche se vecchia |

Poi:

- **Fermarlo e riavviarlo**: in Docker Desktop, sezione **Containers**, i pulsanti ■ e ▶ accanto a `materialize`; oppure `docker stop materialize` e `docker start materialize`. I contenuti restano.
- **Aggiornarlo**: dal pannello, in **Impostazioni → Aggiornamenti**, come su un server.
- **La porta 4321 è già occupata**, per esempio da un altro sito avviato con `npm run dev`: nel comando scrivi `-p 127.0.0.1:4322:4321`, e nel link `4322` al posto di `4321`.
- **Toglierlo**: `docker rm -f materialize` elimina il container ma non il volume, quindi lo stesso comando di prima riparte dal sito com'era. Per cancellare anche sito e contenuti c'è `docker volume rm materialize`, e non si torna indietro.
- **Metterlo online**: questa installazione è pensata per il tuo computer. Per un sito con il suo dominio usa [Docker su un server](#con-docker) o [un VPS](#su-un-vps-con-un-comando).

## Finire l'installazione nel browser

Apri il link che ti ha dato l'installazione: finisce con `/admin/?installa=` seguito da un codice. Il codice serve perché nessun altro possa «prendersi» un server appena messo online.

L'installazione ha tre passi:

1. **Controllo**: Materialize verifica il server (Node.js, cartelle, sito, HTTPS, aggiornamenti). Quello in rosso va sistemato prima di continuare.
2. **Il sito**: nome e lingua principale. Si possono cambiare dopo.
3. **Il tuo account**: nome, email e una password di almeno 10 caratteri. Sarai l'amministratore.

Alla fine premi **Entra nel pannello**.

> Se perdi il link: su un VPS rilancia il comando di installazione, che lo riscrive; con Docker `docker compose logs materialize` (con Docker Desktop `docker logs materialize`). Il codice resta valido finché l'installazione non è finita.

Prossimo passo: [Primi passi](02-primi-passi.md).
