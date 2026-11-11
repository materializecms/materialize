/** What the terminal prints: `materialize` commands, the supervisor, site builds, and updates. */
export const terminal: Record<string, string> = {
  // --help
  'Avvia CMS e sito, ricarica lo schema a ogni salvataggio':
    'Starts the CMS and the site, reloads the schema on every save',
  'Genera il sito statico in dist/client, immagini comprese':
    'Builds the static site into dist/client, images included',
  'Avvia CMS e sito in produzione (il sito si rigenera a ogni pubblicazione); un supervisore lo tiene acceso e applica gli aggiornamenti dal pannello':
    'Starts the CMS and the site in production (the site rebuilds on every publish); a supervisor keeps it running and applies the updates from the panel',
  'Server MCP su stdio per i client AI locali (serve il CMS avviato)':
    'MCP server on stdio for local AI clients (needs the CMS running)',
  'Rimette un backup (content-….db, o l’archivio completo materialize-….tar.gz); il server va fermato':
    'Restores a backup (content-….db, or the full materialize-….tar.gz archive); stop the server first',
  'Un link per una nuova password, valido un’ora: per chi non può riceverlo per email (per esempio l’unico amministratore, senza email configurata)':
    'A link to set a new password, valid for one hour: for someone who cannot get it by email (for example the only administrator, with no email set up)',
  'cartella o file': 'folder or file',
  chiave: 'key',
  'Decifra i backup scaricati dallo spazio esterno (S3, WebDAV); la chiave di ripristino si può dare anche con MATERIALIZE_BACKUP_KEY':
    'Decrypts the backups downloaded from offsite storage (S3, WebDAV); the recovery key can also be given with MATERIALIZE_BACKUP_KEY',
  'Mostra questo aiuto': 'Shows this help',
  Opzioni: 'Options',
  numero: 'number',
  'Porta del server (predefinita: quella del config, 4321)': 'Server port (default: the one in the config, 4321)',
  indirizzo: 'address',
  'Indirizzo su cui ascoltare. Con dev: solo questo computer (0.0.0.0 per provarlo dal telefono sulla stessa rete). Con start: tutti (127.0.0.1 dietro un proxy)':
    'Address to listen on. With dev: this computer only (0.0.0.0 to try it from a phone on the same network). With start: all (127.0.0.1 behind a proxy)',
  'Con mcp: il CMS a cui collegarsi (predefinito: http://localhost:<porta>)':
    'With mcp: the CMS to connect to (default: http://localhost:<port>)',
  'Con start: senza supervisore (se il server lo tiene acceso un altro programma)':
    'With start: no supervisor (when another program keeps the server running)',
  'Il server MCP usa un token personale (Impostazioni → AI e MCP) in MATERIALIZE_TOKEN.':
    'The MCP server uses a personal token (Settings → AI and MCP) in MATERIALIZE_TOKEN.',

  // dev, start, build
  'Non trovo materialize.config.ts in questa cartella.': 'Cannot find materialize.config.ts in this folder.',
  'Crea un nuovo progetto con: npm create materialize@latest':
    'Create a new project with: npm create materialize@latest',
  'Non c’è un sito da generare: manca astro.config.ts in questa cartella.':
    'There is no site to build: astro.config.ts is missing from this folder.',
  'Sito generato in dist/client': 'Site built in dist/client',
  'un’immagine': '1 image',
  '{n} immagini': '{n} images',
  Sito: 'Site',
  Locale: 'Local',
  Pannello: 'Panel',
  Collezioni: 'Collections',
  'In ascolto su': 'Listening on',
  'Raggiungibile solo da questo computer. Per provarlo dal telefono: --host 0.0.0.0':
    'Reachable from this computer only. To try it from a phone: --host 0.0.0.0',
  Installazione: 'Setup',
  'apri {url}': 'open {url}',
  'online: lo stesso indirizzo dal tuo dominio, {url}': 'online: the same address on your domain, {url}',
  'In ascolto delle modifiche a {file}…': 'Watching {file} for changes…',
  'Schema ricaricato': 'Schema reloaded',
  'Lo schema ha un problema, resto sulla versione precedente:':
    'The schema has a problem, keeping the previous version:',
  'Sito aggiornato in {ms} ms': 'Site updated in {ms} ms',
  'Il sito non si è aggiornato: {error}': 'The site was not updated: {error}',

  // mcp
  'Manca MATERIALIZE_TOKEN: crea un token in Impostazioni → AI e MCP e passalo al client.':
    'MATERIALIZE_TOKEN is missing: create a token in Settings → AI and MCP and give it to the client.',
  'Il CMS non risponde su {url}: avvialo con materialize dev (o start), oppure indica --url.':
    'The CMS is not answering at {url}: start it with materialize dev (or start), or give --url.',

  // restore
  'Indica il file del backup: materialize restore <file>': 'Give the backup file: materialize restore <file>',
  'Non trovo il file {file}': 'Cannot find the file {file}',
  '{file} non è un backup: serve un content-….db o un materialize-….tar.gz.':
    '{file} is not a backup: it takes a content-….db or a materialize-….tar.gz.',
  'Il database è ospitato da un fornitore: ripristina il backup dal suo pannello.':
    'The database is hosted by a provider: restore the backup from its dashboard.',
  'Il server è acceso sulla porta {port}: fermalo, poi ripeti il comando.':
    'The server is running on port {port}: stop it, then run the command again.',
  'Archivio ripristinato: {file}': 'Archive restored: {file}',
  'un file dei media': '1 media file',
  '{n} file dei media': '{n} media files',
  'un file dei caratteri': '1 font file',
  '{n} file dei caratteri': '{n} font files',
  'un allegato dei moduli': '1 form attachment',
  '{n} allegati dei moduli': '{n} form attachments',
  'Backup ripristinato: {file}': 'Backup restored: {file}',
  'Un’immagine è tornata dalla copia dei media.': '1 image came back from the media copy.',
  '{n} immagini sono tornate dalla copia dei media.': '{n} images came back from the media copy.',
  'Il database di prima è in {file}, se servisse tornare indietro.':
    'The previous database is in {file}, in case you need to go back.',

  // reset-password
  'Indica l’email: materialize reset-password <email>': 'Give the email: materialize reset-password <email>',
  'Non trovo materialize.config.ts in questa cartella: lancia il comando dalla cartella del sito.':
    'Cannot find materialize.config.ts in this folder: run the command from the site’s folder.',
  'Nessun account con l’email {email}.': 'No account with the email {email}.',
  'Link per una nuova password di {name} ({email}), valido un’ora:':
    'Link to a new password for {name} ({email}), valid for one hour:',
  'Chi lo apre sceglie la password. La verifica in due passaggi, se attiva, resta.':
    'Whoever opens it chooses the password. Two-step verification, if on, stays on.',

  // decrypt
  'Indica la cartella (o il file) da decifrare: materialize decrypt <cartella> --key <chiave>':
    'Give the folder (or file) to decrypt: materialize decrypt <folder> --key <key>',
  'Manca la chiave di ripristino: --key mzk1-… oppure MATERIALIZE_BACKUP_KEY.':
    'The recovery key is missing: --key mzk1-… or MATERIALIZE_BACKUP_KEY.',
  'Un file decifrato, accanto all’originale.': '1 file decrypted, next to the original.',
  '{n} file decifrati, accanto agli originali.': '{n} files decrypted, next to the originals.',
  'Per rimettere il database (a server fermo): {command}':
    'To restore the database (with the server stopped): {command}',

  // Updates from the panel
  'npm non si avvia: {error}': 'npm does not start: {error}',
  'npm si è fermato con un errore (codice {code})': 'npm stopped with an error (code {code})',
  'In sviluppo (materialize dev) si aggiorna da terminale: gli aggiornamenti dal pannello funzionano con materialize start.':
    'In development (materialize dev) you update from the terminal: updates from the panel work with materialize start.',
  'Il server è avviato senza il suo supervisore: aggiorna da terminale, oppure avvialo con materialize start.':
    'The server was started without its supervisor: update from the terminal, or start it with materialize start.',
  'Materialize è collegato dal codice sorgente: si aggiorna con git.':
    'Materialize is linked from its source code: update it with git.',
  'Il package.json del sito non ha {name} tra le dipendenze.':
    'The site’s package.json does not have {name} among its dependencies.',
  'Il programma non può scrivere nella cartella del sito: aggiorna da terminale, con l’utente che la possiede.':
    'The program cannot write to the site’s folder: update from the terminal, as the user who owns it.',
  'Nessuna versione pubblicata da controllare.': 'No published version to check.',
  'Non riesco a raggiungere il registro dei pacchetti: riprova più tardi.':
    'Cannot reach the package registry: try again later.',
  'Preparo il sito con la nuova versione': 'Preparing the site with the new version',
  Riavvio: 'Restarting',
  'C’è già un aggiornamento in corso': 'An update is already in progress',
  'Versione non valida': 'Invalid version',
  'Backup del database e dei media': 'Backing up the database and the media',
  'Scarico Materialize {version}': 'Downloading Materialize {version}',
  'Controllo la nuova versione': 'Checking the new version',
  'Installata la {installed} invece della {version}': 'Installed {installed} instead of {version}',
  'Non c’è una versione precedente a cui tornare': 'There is no previous version to go back to',
  'In sviluppo (materialize dev) il ripristino si fa da terminale, con materialize restore.':
    'In development (materialize dev), restore from the terminal with materialize restore.',
  'Il server è avviato senza il suo supervisore: ripristina da terminale con materialize restore, oppure avvialo con materialize start.':
    'The server was started without its supervisor: restore from the terminal with materialize restore, or start it with materialize start.',
  'Ripristino l’archivio caricato dal pannello…': 'Restoring the archive uploaded from the panel…',
  'Archivio ripristinato': 'Archive restored',
  'Il ripristino non è riuscito: {error}': 'The restore failed: {error}',
  'Il ripristino si è interrotto a metà.': 'The restore stopped halfway.',
}
