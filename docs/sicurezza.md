# Mettere online Materialize in sicurezza

Materialize protegge da solo il pannello:
- limiti agli accessi falliti, per email e per indirizzo;
- verifica in due passaggi;
- regole di sicurezza del browser (CSP) sul pannello;
- registro delle attività;
- backup giornalieri del database.

Alcune cose però spettano a chi lo mette online. Questa guida le elenca nell'ordine in cui farle.

Lo stato del tuo sito si vede in **Impostazioni → Sicurezza**: ogni punto da sistemare ha il suo pulsante.

## 1. HTTPS

Il pannello va servito solo in HTTPS, altrimenti password e sessioni viaggiano in chiaro. Le strade più semplici:

- **Hosting con HTTPS incluso** (Render, Railway, Fly.io, un VPS con un pannello): attivalo dalle sue impostazioni.
- **Caddy** davanti a Materialize: ottiene e rinnova da solo i certificati di Let's Encrypt.
- **Cloudflare** (vedi sotto): imposta la cifratura su _Full (strict)_, non su _Flexible_.

Nella configurazione indica l'indirizzo pubblico, che serve anche per SEO e sitemap:

```ts
site: { name: 'Studio Rossi', url: 'https://www.studiorossi.it' },
```

## 2. Dietro un proxy: `trustProxy`

Quasi sempre Materialize sta dietro qualcosa che riceve le richieste per lui: Cloudflare, Nginx, Caddy, o il bilanciatore dell'hosting. In quel caso tutte le richieste sembrano arrivare dall'indirizzo del proxy. Il vero indirizzo di chi si collega sta nell'intestazione `X-Forwarded-For`.

Va detto a Materialize di leggerla:

```ts
// materialize.config.ts
export default defineConfig({
  // …
  server: { port: 4321, trustProxy: true },
})
```

- **Con un proxy e `trustProxy` spento**, i limiti per indirizzo vedono un solo indirizzo, quello del proxy. Venti errori di chiunque bloccano tutti.
- **Senza proxy e `trustProxy` acceso**, chiunque può scrivere un indirizzo falso nell'intestazione e aggirare quei limiti.

Impostazioni → Sicurezza avvisa in entrambi i casi.

### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name www.studiorossi.it;
  # certificati: certbot --nginx

  client_max_body_size 30m;   # caricamento di immagini fino a 25 MB

  location / {
    proxy_pass http://127.0.0.1:4321;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    # l'assistente AI risponde a flusso (server-sent events)
    proxy_buffering off;
  }
}
```

Nota `X-Forwarded-For $remote_addr`, non `$proxy_add_x_forwarded_for`. Così Nginx scrive l'indirizzo che vede davvero e non aggiunge quello dichiarato dal visitatore.

### Caddy

```caddy
www.studiorossi.it {
  reverse_proxy 127.0.0.1:4321
}
```

Caddy imposta da solo HTTPS e `X-Forwarded-For`.

## 3. Cloudflare

Con il dominio su Cloudflare, il traffico passa dai suoi server prima di arrivare al tuo. Lì si fermano molti attacchi, prima che consumino risorse.

1. **SSL/TLS → Overview**: _Full (strict)_. Sul server serve un certificato valido; va bene anche un _Origin Certificate_ di Cloudflare.
2. **SSL/TLS → Edge Certificates**: attiva _Always Use HTTPS_ e _HSTS_.
3. **Security → WAF → Rate limiting rules**: una regola per i tentativi di accesso, come secondo argine oltre ai limiti di Materialize:
   - _URI Path_ uguale a `/api/auth/login`, metodo `POST`;
   - 10 richieste in 1 minuto per indirizzo → _Block_ per 10 minuti.
4. **Security → Bots**: _Bot Fight Mode_ attivo.
5. **Caching → Cache Rules**: escludi dalla cache `/admin*` e `/api*`. Materialize risponde già con `no-store`, ma una regola esplicita evita sorprese.
6. Sul server, accetta connessioni solo da Cloudflare: [elenco degli indirizzi](https://www.cloudflare.com/ips/), nel firewall o nella configurazione di Nginx. Altrimenti si può aggirare Cloudflare chiamando direttamente l'indirizzo del server.

Con Cloudflare davanti, in `materialize.config.ts` imposta `trustProxy: true`. Con Nginx dietro Cloudflare, invece di `$remote_addr` usa il modulo `real_ip` con gli indirizzi di Cloudflare e l'intestazione `CF-Connecting-IP`.

## 4. Firewall del server

Su un VPS lascia aperte solo le porte che servono:

```bash
ufw default deny incoming
ufw allow 22/tcp     # SSH (meglio con chiavi, senza password)
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

La porta di Materialize (4321) non deve essere raggiungibile da fuori: ci arriva solo il proxy, in locale.

## 5. Persone e accessi

- Attiva la **verifica in due passaggi** per te (Il tuo profilo → Sicurezza). Poi richiedila a tutti, da **Persone**.
- Configura l'**invio delle email** (Impostazioni → Email). Così le persone ricevono gli avvisi di tentativi falliti e di cambi di indirizzo, e i link per una nuova password arrivano da soli.
- Dai il ruolo di amministratore solo a chi deve gestire persone, impostazioni e codice personalizzato. A tutti gli altri basta quello di redattore.
- Ogni tanto guarda il registro in Impostazioni → Sicurezza, e i token in Impostazioni → AI e MCP: revoca quelli che non servono più.

## 6. Backup

Ogni giorno il server salva nella cartella `backups`, accanto al database (per esempio `.materialize/backups`):

- **una copia del database**. Tiene le ultime 14 copie; il numero si cambia in Impostazioni → Sicurezza;
- **una copia delle immagini** in `backups/media`. Aggiunge solo i file nuovi, perché un originale caricato non cambia mai. Le versioni ridimensionate non servono: il server le rifà. Un'immagine eliminata dalla libreria resta nella copia almeno 30 giorni, e comunque finché c'è un backup del database più vecchio dell'eliminazione.

Queste copie stanno sullo stesso server: se il server si rompe, si perdono con lui. Per questo in Impostazioni → Sicurezza c'è **Scarica tutto**: un unico archivio `.tar.gz` con il database, tutte le immagini originali e i caratteri. Si prepara mentre lo scarichi, quindi non occupa spazio sul server anche con molti GB. Tienine una copia altrove, per esempio sul tuo computer o in un cloud.

In alternativa, una copia automatica da un altro computer:

```bash
# ogni notte
rsync -a server:/srv/sito/.materialize/backups/ ~/backup-sito/
```

Per rimettere un backup, ferma il server e, nella cartella del sito:

```bash
# una copia del database: le immagini che mancano tornano da backups/media
npx materialize restore .materialize/backups/content-20261030-031500-auto.db

# oppure l'archivio completo: database, immagini e caratteri
npx materialize restore ~/Scaricati/materialize-2026-10-30.tar.gz
```

Prima di sostituirlo, il database attuale viene salvato a sua volta tra i backup. Così anche un ripristino si può annullare. L'archivio serve anche per spostare il sito su un altro server: installa Materialize, copia il progetto, poi `restore` dell'archivio.

Con un database ospitato (Turso, libSQL), i backup del database li fa il fornitore: controlla che siano attivi nel suo pannello. L'archivio completo contiene comunque immagini e caratteri.

## 7. Aggiornamenti

- **Aggiorna Materialize:** le correzioni di sicurezza arrivano con le nuove versioni.
- **Controlla le dipendenze:** `npm run audit` cerca vulnerabilità note. Nel repository di Materialize lo fa anche GitHub ogni settimana (`.github/workflows/check.yml`), e Dependabot propone gli aggiornamenti.
- **Aggiorna Node.js:** usa una versione ancora supportata (Materialize richiede Node 24 o superiore).

## Cosa fa già Materialize

| Protezione                                                                                             | Dove                         |
| ------------------------------------------------------------------------------------------------------ | ---------------------------- |
| Password cifrate con scrypt                                                                            | sempre                       |
| Pausa dopo 5 errori per email e 20 per indirizzo, che raddoppia fino a un'ora                          | sempre, salvata nel database |
| Verifica in due passaggi (app di autenticazione) e codici di riserva                                   | Il tuo profilo → Sicurezza   |
| Sessioni che scadono dopo 14 giorni di inattività, elenco dei dispositivi                              | Il tuo profilo → Sicurezza   |
| Avvisi per email: tentativi falliti, cambi di indirizzo, verifica disattivata                          | con l'email configurata      |
| Regole del browser (CSP) sul pannello: niente script estranei, dati inviati solo al proprio server     | sempre                       |
| Protezione CSRF, cookie di sessione `HttpOnly` e `SameSite`                                            | sempre                       |
| Codice personalizzato solo dagli amministratori, in anteprima isolata                                  | sempre                       |
| Immagini ricaricate e riconvertite; indirizzi interni bloccati quando si importa un'immagine da un URL | sempre                       |
| Registro delle attività, conservato un anno                                                            | Impostazioni → Sicurezza     |
| Backup giornalieri del database                                                                        | Impostazioni → Sicurezza     |
