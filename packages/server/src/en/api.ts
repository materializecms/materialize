/** The server's API (app.ts): errors and checks the panel shows, emails to the team. */
export const api: Record<string, string> = {
  'Codice lingua non valido': 'Not a valid language code',
  'Backup fuori dal server non riuscito': 'Off-server backup failed',
  'La copia dei backup di {site} fuori dal server non è riuscita: {message}':
    'The off-server copy of the {site} backups failed: {message}',
  'Controlla in Impostazioni → Sicurezza → Backup. Ti scriviamo di nuovo solo quando torna a funzionare e si ferma di nuovo.':
    'Check Settings → Security → Backups. We will write again only if it starts working and then stops again.',
  'Solo un amministratore può modificare il codice personalizzato e dove arrivano i messaggi dei moduli':
    'Only an administrator can change custom code and where form messages go',
  'Puoi modificare testi, collegamenti e immagini, non il layout della pagina':
    'You can change texts, links and images, not the page layout',
  'Versione adatta.': 'Supported version.',
  'Serve Node 24 o più recente.': 'Node 24 or later is required.',
  'Cartella dei file': 'Files folder',
  'Database e immagini si possono salvare.': 'The database and images can be saved.',
  'Il programma non può scrivere in {dir}: dagli i permessi su quella cartella.':
    'The program cannot write to {dir}: give it permission on that folder.',
  Sito: 'Site',
  'Il sito si genera da solo a ogni pubblicazione.': 'The site builds itself every time you publish.',
  'Solo il CMS: in questa cartella non c’è un sito Astro.': 'CMS only: there is no Astro site in this folder.',
  'Connessione sicura': 'Secure connection',
  'HTTPS attivo.': 'HTTPS is on.',
  'In locale non serve HTTPS.': 'HTTPS is not needed locally.',
  'Senza HTTPS la password viaggia in chiaro: attivalo prima di metterlo online (guida in docs/sicurezza.md).':
    'Without HTTPS the password travels in plain text: turn it on before going online (guide in docs/sicurezza.md).',
  Aggiornamenti: 'Updates',
  'Si installano dal pannello, con un clic.': 'They install from the panel, in one click.',
  'Si installano da terminale.': 'They install from the terminal.',
  'Per installare serve il link stampato all’avvio del server (materialize start), con il suo codice':
    'To install, use the link printed when the server starts (materialize start), with its code',
  'Troppi tentativi: riprova tra un minuto': 'Too many attempts: try again in a minute',
  'Troppi tentativi: riprova tra {n} minuti': 'Too many attempts: try again in {n} minutes',
  'Tentativi di accesso non riusciti': 'Failed sign-in attempts',
  'Qualcuno ha provato {n} volte di fila a entrare nel pannello del sito con il tuo indirizzo, senza la password giusta. Per sicurezza gli accessi con il tuo indirizzo sono in pausa per qualche minuto.':
    'Someone tried {n} times in a row to sign in to the site’s panel with your address, without the right password. To be safe, sign-ins with your address are paused for a few minutes.',
  'Se eri tu, aspetta e riprova. Se non eri tu, la tua password è ancora al sicuro: per più protezione attiva la verifica in due passaggi dal tuo profilo.':
    'If it was you, wait and try again. If it was not you, your password is still safe: for more protection, turn on two-step verification in your profile.',
  'Nuova password': 'New password',
  'Qualcuno ha chiesto una nuova password per il tuo account su {site}.':
    'Someone asked for a new password for your account on {site}.',
  'Se non sei stato tu, ignora questa email: la password resta quella di prima.':
    'If it was not you, ignore this email: your password stays the same.',
  'Per sceglierne una nuova, apri questo link entro un’ora:': 'To choose a new one, open this link within an hour:',
  'La password non è corretta': 'The password is wrong',
  'Il codice non è corretto': 'The code is wrong',
  'Un amministratore entra con la sola password': 'One administrator signs in with a password only',
  '{n} amministratori entrano con la sola password': '{n} administrators sign in with a password only',
  '{names}: chi ruba quella password controlla tutto il sito. Attivate la verifica in due passaggi dal profilo → Sicurezza.':
    '{names}: whoever steals that password controls the whole site. Turn on two-step verification in your profile → Security.',
  'Gli amministratori usano la verifica in due passaggi': 'Administrators use two-step verification',
  'Per entrare servono password e codice dal telefono.': 'Signing in takes a password and a code from the phone.',
  'Verifica in due passaggi richiesta a tutti': 'Two-step verification required for everyone',
  'Una persona la attiverà al prossimo accesso.': 'One person will turn it on at their next sign-in.',
  '{n} persone la attiveranno al prossimo accesso.': '{n} people will turn it on at their next sign-in.',
  'Tutti l’hanno attivata.': 'Everyone has turned it on.',
  'Una persona entra con la sola password': 'One person signs in with a password only',
  '{n} persone entrano con la sola password': '{n} people sign in with a password only',
  'Tutti usano la verifica in due passaggi': 'Everyone uses two-step verification',
  'Potete richiederla a tutti da Persone: chi non l’ha la attiverà al prossimo accesso.':
    'You can require it for everyone in People: whoever does not have it will turn it on at their next sign-in.',
  'Potete anche richiederla a tutti da Persone, per chi entrerà in futuro.':
    'You can also require it for everyone in People, for whoever joins later.',
  'Gli avvisi arrivano per email': 'Alerts arrive by email',
  'Tentativi di accesso falliti, cambi di indirizzo e di verifica vengono segnalati a chi riguardano.':
    'Failed sign-ins and changes of address or verification are reported to the people they concern.',
  'L’invio delle email non è configurato': 'Email is not set up',
  'Nessuno viene avvisato di tentativi di accesso falliti o di un indirizzo cambiato, e i link per una nuova password vanno mandati a mano.':
    'Nobody is told about failed sign-ins or a changed address, and links for a new password must be sent by hand.',
  'Pannello aperto in locale': 'Panel open locally',
  'Online, il sito va servito in HTTPS: password e sessioni viaggiano cifrate.':
    'Online, the site must be served over HTTPS: passwords and sessions travel encrypted.',
  'Connessione cifrata (HTTPS)': 'Encrypted connection (HTTPS)',
  'Password e sessioni viaggiano cifrate.': 'Passwords and sessions travel encrypted.',
  'Il pannello non usa HTTPS': 'The panel does not use HTTPS',
  'Password e sessioni viaggiano in chiaro: attiva HTTPS sull’hosting (Let’s Encrypt è gratuito) o metti il sito dietro Cloudflare.':
    'Passwords and sessions travel in plain text: turn on HTTPS at your host (Let’s Encrypt is free) or put the site behind Cloudflare.',
  'Il sito è dietro un proxy, ma non lo sa': 'The site is behind a proxy, but does not know it',
  'Tutte le richieste sembrano arrivare dallo stesso indirizzo, quindi i limiti agli accessi per indirizzo non funzionano. Imposta server: {code} in materialize.config.ts.':
    'All requests seem to come from the same address, so sign-in limits per address do not work. Set server: {code} in materialize.config.ts.',
  'trustProxy è acceso, ma non arriva nessun proxy': 'trustProxy is on, but no proxy is in front',
  'Senza un proxy davanti, chiunque può dichiarare un indirizzo falso e aggirare i limiti agli accessi. Se il sito non è dietro un proxy, spegnilo in materialize.config.ts.':
    'Without a proxy in front, anyone can claim a false address and get around sign-in limits. If the site is not behind a proxy, turn it off in materialize.config.ts.',
  'Un accesso fallito nelle ultime 24 ore': 'One failed sign-in in the last 24 hours',
  '{n} accessi falliti nelle ultime 24 ore': '{n} failed sign-ins in the last 24 hours',
  'Nessun accesso fallito nelle ultime 24 ore': 'No failed sign-ins in the last 24 hours',
  'In pausa adesso: {list}. Le pause finiscono da sole.': 'Paused now: {list}. Pauses end by themselves.',
  'indirizzo {ip}': 'address {ip}',
  'un codice di verifica': 'a verification code',
  'Dopo 5 errori un’email va in pausa, dopo 20 un indirizzo: la pausa raddoppia a ogni nuovo errore.':
    'After 5 failures an email is paused, after 20 an address: the pause doubles with each new failure.',
  'Database ospitato da un fornitore': 'Database hosted by a provider',
  'I backup del database li fa il fornitore (Turso, libSQL): controlla che siano attivi nel suo pannello.':
    'The provider (Turso, libSQL) backs up the database: check that backups are on in its dashboard.',
  'Backup automatici spenti': 'Automatic backups are off',
  'L’ultima copia è di un giorno fa. Riaccendili qui sotto.': 'The last copy is a day old. Turn them back on below.',
  'L’ultima copia è di {n} giorni fa. Riaccendili qui sotto.':
    'The last copy is {n} days old. Turn them back on below.',
  'Non c’è nessuna copia del database. Riaccendili qui sotto.':
    'There is no copy of the database. Turn them back on below.',
  'L’ultimo backup è vecchio': 'The last backup is old',
  'Il primo backup arriva a breve': 'The first backup is coming soon',
  'Il server fa una copia al giorno mentre è acceso: se resta spento a lungo, scaricane una a mano.':
    'The server makes one copy a day while it is running: if it stays off for long, download one by hand.',
  'Il server fa una copia del database poco dopo l’avvio, poi una al giorno.':
    'The server copies the database soon after it starts, then once a day.',
  'Backup del database ogni giorno': 'Daily database backup',
  'Ultima copia {when}, immagini comprese; ne restano {keep}.': 'Last copy {when}, images included; {keep} are kept.',
  'I backup restano sul server': 'Backups stay on the server',
  'Se il server si rompe, si perdono anche le copie. Attiva la copia fuori dal server (S3 o WebDAV), oppure scarica ogni tanto l’archivio completo.':
    'If the server breaks, the copies are lost too. Turn on the off-server copy (S3 or WebDAV), or download the full archive from time to time.',
  'La copia fuori dal server non riesce': 'The off-server copy is failing',
  'Controlla il collegamento.': 'Check the connection.',
  'Copia cifrata fuori dal server': 'Encrypted off-server copy',
  'Ultima copia {when}, su {where}.': 'Last copy {when}, on {where}.',
  'La prima copia parte entro un’ora.': 'The first copy starts within an hour.',
  'Un token di accesso per i client AI': 'One access token for AI clients',
  '{n} token di accesso per i client AI': '{n} access tokens for AI clients',
  'Uno non è usato da più di 90 giorni: chi li ha creati può revocarli da Impostazioni → AI e MCP.':
    'One has not been used in over 90 days: whoever created it can revoke it in Settings → AI and MCP.',
  '{n} non sono usati da più di 90 giorni: chi li ha creati può revocarli da Impostazioni → AI e MCP.':
    '{n} have not been used in over 90 days: whoever created them can revoke them in Settings → AI and MCP.',
  'Tutti usati di recente. Ognuno può revocare i propri da Impostazioni → AI e MCP.':
    'All used recently. Everyone can revoke their own in Settings → AI and MCP.',
  'Questo server non è avviato da materialize start: aggiorna da terminale.':
    'This server was not started with materialize start: update from the terminal.',
  'Gli aggiornamenti dal pannello non sono disponibili qui': 'Updates from the panel are not available here',
  'Il tuo indirizzo email è cambiato': 'Your email address has changed',
  'Hai cambiato l’indirizzo con cui entri nel pannello del sito: da {before} a {after}.':
    'You changed the address you use to sign in to the site’s panel: from {before} to {after}.',
  '{by} ha cambiato l’indirizzo con cui entri nel pannello del sito: da {before} a {after}.':
    '{by} changed the address you use to sign in to the site’s panel: from {before} to {after}.',
  'Se non te lo aspettavi, rispondi a questa email o avvisa un amministratore del sito.':
    'If you did not expect this, reply to this email or tell an administrator of the site.',
  'La password attuale non è corretta': 'The current password is wrong',
  'Il tuo invito': 'Your invitation',
  '{name} ti ha invitato a lavorare sul sito con Materialize.':
    '{name} invited you to work on the site with Materialize.',
  'Apri questo link per scegliere la tua password ed entrare:': 'Open this link to choose your password and sign in:',
  'Verifica in due passaggi disattivata': 'Two-step verification turned off',
  '{name} ha disattivato la verifica in due passaggi del tuo account: per entrare nel pannello ora basta la password.':
    '{name} turned off two-step verification on your account: signing in to the panel now takes only the password.',
  'Riattivala dal tuo profilo appena puoi. Se non te lo aspettavi, avvisa un amministratore.':
    'Turn it back on in your profile as soon as you can. If you did not expect this, tell an administrator.',
  'È stata chiesta una nuova password per il tuo account. Il link vale 24 ore:':
    'A new password was requested for your account. The link is valid for 24 hours:',
  'La sezione è ancora in {pages}: toglila prima dalle pagine':
    'The section is still in {pages}: remove it from those pages first',
  '{name} sta modificando questo documento: le tue modifiche non sono state salvate':
    '{name} is editing this document: your changes were not saved',
  'Questo documento è aperto in un’altra scheda: le modifiche di qui non sono state salvate':
    'This document is open in another tab: the changes made here were not saved',
  'Prova di invio da Materialize': 'Test email from Materialize',
  'Se leggi questo messaggio, l’invio delle email dal sito funziona.':
    'If you are reading this, the site can send email.',
  'L’AI non è configurata: Impostazioni → AI e MCP': 'AI is not set up: Settings → AI and MCP',
  'Troppe richieste: aspetta un minuto': 'Too many requests: wait a minute',
  'Il sito ha ancora pochi testi pubblicati: scrivi la voce a mano':
    'The site has too little published text yet: write the voice by hand',
  'L’AI non ha risposto come doveva: riprova': 'The AI did not reply as expected: try again',
  'Non c’è testo da rivedere': 'There is no text to review',
  'Quel testo è cambiato: rifai la revisione': 'That text has changed: run the review again',
  'Scegli prima un’immagine della libreria': 'Choose an image from the library first',
  'Non c’è testo su cui lavorare': 'There is no text to work on',
  'Puoi cambiare solo i contenuti: le modifiche al layout non sono state applicate.':
    'You can change only the contents: the layout changes were not applied.',
  Errore: 'Error',
  'Scrivi qualche riga in più sull’attività': 'Write a few more lines about the business',
  'Scrivi il brief': 'Write the brief',
  'Questa conversazione non c’è più: parti da un nuovo brief': 'This conversation is gone: start from a new brief',
  'Il sito non ha una raccolta di pagine costruite sulla tela':
    'The site has no collection of pages built on the canvas',
  'Messaggio ripetuto': 'Repeated message',
  'Allegati ({files}): li trovi in Impostazioni → Messaggi.':
    'Attachments ({files}): find them in Settings → Messages.',
  'Nuovo messaggio dal sito: {subject}': 'New message from the site: {subject}',
  'Nuovo messaggio dal sito': 'New message from the site',
  Data: 'Date',
  Modulo: 'Form',
  Pagina: 'Page',
  'Segnato a mano': 'Marked by hand',
  'File non trovato': 'File not found',
  'Il file non c’è più': 'The file is gone',
  'Un ID di Google Analytics 4 inizia con G-': 'A Google Analytics 4 ID starts with G-',
  'Un ID di Tag Manager inizia con GTM-': 'A Tag Manager ID starts with GTM-',
  'L’ID del Pixel è fatto di sole cifre': 'The Pixel ID is made of digits only',
  'Scrivi il dominio come su Plausible, per esempio example.com':
    'Write the domain as on Plausible, for example example.com',
  'Un indirizzo https://': 'An https:// address',
  'L’indirizzo di Matomo, con https://': 'The Matomo address, with https://',
  'Il numero del sito su Matomo': 'The site’s number on Matomo',
  'Il codice non può contenere </template>': 'The code cannot contain </template>',
  'Un indirizzo che inizia con / o https://': 'An address starting with / or https://',
  'Scegli un momento nel futuro, almeno tra un minuto': 'Choose a time in the future, at least a minute from now',
  'La pagina non è sul sito: programma prima la pubblicazione':
    'The page is not on the site: schedule its publication first',
  'La pagina verrebbe tolta prima di essere pubblicata': 'The page would be removed before it is published',
  'La pubblicazione verrebbe dopo il momento in cui la pagina va tolta':
    'The publication would come after the time the page is removed',
  'La raccolta non esiste più': 'The collection no longer exists',
  'Alcuni campi vanno completati: {fields}': 'Some fields need to be completed: {fields}',
  'Alcuni campi vanno completati': 'Some fields need to be completed',
  'La pagina non esiste più': 'The page no longer exists',
  'Errore imprevisto': 'Unexpected error',
  'Il rilascio è vuoto': 'The release is empty',
  '{why} (già uscite: {done})': '{why} (already out: {done})',
  'Questo rilascio non esiste': 'This release does not exist',
  'Questo rilascio è già uscito o è stato annullato': 'This release is already out or was canceled',
  'La pagina non è sul sito: non c’è niente da togliere': 'The page is not on the site: there is nothing to remove',
  'Alcune pagine non sono pronte: non è uscito niente': 'Some pages aren’t ready: nothing went out',
  'Il rilascio non è uscito': 'The release did not go out',
  'Aggiungi prima qualcosa al rilascio': 'Add something to the release first',
  'Questo iscritto non esiste': 'This subscriber does not exist',
  'Nel file non ho trovato indirizzi email': 'No email addresses found in the file',
  'Questa newsletter non esiste': 'This newsletter does not exist',
  'Questa newsletter è già partita: non si può più cambiare':
    'This newsletter has already gone out: it can no longer change',
  'La newsletter sta partendo: aspetta che finisca': 'The newsletter is being sent: wait for it to finish',
  'Per inviare la newsletter serve l’email: Impostazioni → Email':
    'Sending the newsletter needs email: Settings → Email',
  '[Prova] {subject}': '[Test] {subject}',
  'Non ci sono ancora iscritti attivi': 'There are no active subscribers yet',
  'Non ci sono ancora articoli pubblicati da raccontare': 'There are no published articles to write about yet',
  'La risposta dell’AI non era leggibile: riprova': 'The AI’s reply could not be read: try again',
  'L’email non è configurata': 'Email is not set up',
  'Non più iscritto': 'No longer subscribed',
  'Nessun invio riuscito: controlla Impostazioni → Email': 'No email went out: check Settings → Email',
  'Questo sito non ha pagine da mostrare in anteprima': 'This site has no pages to preview',
  'Questo contenuto non ha una pagina sul sito': 'This content has no page on the site',
  'Link non trovato': 'Link not found',
  'La lingua principale deve essere tra quelle del sito': 'The main language must be one of the site’s languages',
  'Questa lingua esiste già: aprila dall’elenco delle lingue':
    'This language already exists: open it from the list of languages',
  '"{label}" esiste già in questa lingua': '"{label}" already exists in this language',
  'Questa è la versione originale': 'This is the original version',
  'Il sito non risponde: {message}': 'The site does not answer: {message}',
  'la pagina non c’è più': 'the page is gone',
  'la pagina è vuota': 'the page is empty',
  'troppo grandi (oltre 25 MB)': 'too large (over 25 MB)',
  'non raggiungibili': 'not reachable',
  'non trovate sul sito ({status})': 'not found on the site ({status})',
  'SVG: la libreria non li accetta, perché possono contenere codice':
    'SVG: the library does not accept them, since they can contain code',
  'in un formato che la libreria non legge': 'in a format the library cannot read',
  'La richiesta è troppo grande': 'The request is too large',
  'Troppe prove: riprova tra un’ora': 'Too many tries: try again in an hour',
  'L’indirizzo del sito non è impostato': 'The site address is not set',
  'Senza, “Password dimenticata?” non manda il link: la richiesta può dichiarare un indirizzo falso. Imposta {env} nell’ambiente del server, o site.url in materialize.config.ts.':
    'Without it, “Forgot password?” sends no link: the request could claim a false address. Set {env} in the server’s environment, or site.url in materialize.config.ts.',
  // Pieces of saved messages (a release that did not go out)
  '{list}': '{list}',
  '{title}: {message}': '{title}: {message}',
}
