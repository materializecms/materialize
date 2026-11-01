# Problemi comuni

## Installazione

**Il sito non si apre in HTTPS dopo l'installazione.**
Il certificato arriva solo quando il dominio punta al server e le porte 80 e 443 sono aperte, anche nel firewall del fornitore del VPS (alcuni lo hanno nel loro pannello). Controlla il record A del dominio. Se usi Cloudflare, tieni la nuvola grigia finché il certificato non è pronto. Per vedere cosa succede: `journalctl -u caddy -f`.

**Ho perso il link di installazione.**
Su un VPS rilancia il comando di installazione: riscrive il link senza toccare niente. Con Docker: `docker compose logs materialize`.

**Lo script dice che il sistema non è supportato.**
Servono Debian 12 o Ubuntu 22.04, o più recenti, su processori x86_64 o arm64, con almeno 1 GB di memoria.

## Uso quotidiano

**Ho modificato una pagina ma sul sito non cambia.**
Le modifiche sono una bozza finché non premi **Pubblica** (o **Pubblica modifiche**). Dopo, il sito si rigenera in pochi secondi; se non le vedi ancora, ricarica la pagina del sito.

**Non riesco a pubblicare.**
Manca qualcosa di obbligatorio: il pannello lo segnala e porta al campo. Se il pulsante non c'è proprio, sei editor in un sito dove gli editor modificano solo i contenuti, oppure non hai i permessi: chiedi a un amministratore.

**Un editor non vede la modalità Design.**
In **Persone** è attivo **I redattori modificano solo i contenuti**.

**I messaggi del modulo non arrivano per email.**
Controlla **Impostazioni → Email** con **Salva e invia una prova**. I messaggi restano comunque in **Impostazioni → Messaggi**.

**L'accesso è bloccato dopo alcuni tentativi.**
È la protezione contro chi prova a indovinare le password: aspetta il tempo indicato, al massimo un'ora.

**Ho perso il telefono con l'app della verifica in due passaggi.**
Entra con uno dei **codici di riserva** che hai salvato. Se non li hai, un altro amministratore può disattivare la tua verifica in due passaggi da **Persone**.

**Ho dimenticato la password.**
**Password dimenticata?** nella pagina di accesso, se l'email è configurata. Altrimenti un amministratore, o il comando `materialize reset-password` sul server: vedi [Persone e sicurezza](08-persone-e-sicurezza.md#se-dimentichi-la-password).

## Aggiornamenti

**Impostazioni → Aggiornamenti dice che da qui non si può aggiornare.**
Il sito non è stato avviato con lo script per VPS o con Docker, oppure è in sviluppo. Il pannello mostra il comando da usare a mano.

**Un aggiornamento non è riuscito.**
Se la nuova versione non parte, Materialize torna da solo alla versione di prima e il pannello mostra il motivo, con i dettagli. Il sito non perde niente.

## Vedere cosa succede sul server

Su un VPS installato con lo script:

```bash
systemctl status materialize       # è acceso?
journalctl -u materialize -f       # il registro, in diretta
journalctl -u caddy -f             # HTTPS e certificato
```

Con Docker: `docker compose logs -f materialize`.

## Ancora problemi?

Apri una segnalazione su [GitHub](https://github.com/materializecms/materialize/issues), descrivendo cosa hai fatto, cosa ti aspettavi e cosa è successo. **Non incollare password, chiavi o token.**
