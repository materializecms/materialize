/** The supervisor of `materialize start`: data only, so it can load without any Materialize package. */
export const supervisor: Record<string, string> = {
  'La nuova versione non è stata scaricata': 'The new version was not downloaded',
  'Non c’è una versione precedente': 'There is no previous version',
  'avvio la {version}…': 'starting {version}…',
  'Con la nuova versione il sito non si compila': 'The site does not build with the new version',
  'La nuova versione non è partita in tempo': 'The new version did not start in time',
  'La nuova versione si è fermata all’avvio (codice {code})': 'The new version stopped while starting (code {code})',
  '{message}: torno alla {version}': '{message}: going back to {version}',
  'Il server si è fermato (codice {code}): riparto tra {wait} s':
    'The server stopped (code {code}): restarting in {wait} s',
}
