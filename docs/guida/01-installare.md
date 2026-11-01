# Installare Materialize

Materialize è un programma sempre acceso, che fa funzionare il pannello e genera il sito. Per questo serve un **server tuo**:

| Dove                                                                                          | Adatto?                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| **VPS** (Hetzner, DigitalOcean, OVH, Aruba Cloud…) con Debian 12 o Ubuntu 22.04 o più recenti | ✓ il modo più semplice, con un comando                        |
| **Server con Docker**                                                                         | ✓                                                             |
| **Il tuo computer**                                                                           | ✓ per provarlo o sviluppare un sito                           |
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

Il file `.env` ricorda il dominio: Docker lo legge da solo a ogni comando, nella stessa cartella. L'ultimo comando mostra il link per finire l'installazione. Il sito e i contenuti stanno nel volume `site`: puoi fermare, aggiornare o ricreare i container senza perdere niente.

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

e apri `http://localhost:4321/admin`. Sul tuo computer non serve il link di installazione.

## Finire l'installazione nel browser

Apri il link che ti ha dato l'installazione: finisce con `/admin/?installa=` seguito da un codice. Il codice serve perché nessun altro possa «prendersi» un server appena messo online.

L'installazione ha tre passi:

1. **Controllo**: Materialize verifica il server (Node.js, cartelle, sito, HTTPS, aggiornamenti). Quello in rosso va sistemato prima di continuare.
2. **Il sito**: nome e lingua principale. Si possono cambiare dopo.
3. **Il tuo account**: nome, email e una password di almeno 10 caratteri. Sarai l'amministratore.

Alla fine premi **Entra nel pannello**.

> Se perdi il link: su un VPS rilancia il comando di installazione, che lo riscrive; con Docker `docker compose logs materialize`. Il codice resta valido finché l'installazione non è finita.

Prossimo passo: [Primi passi](02-primi-passi.md).
