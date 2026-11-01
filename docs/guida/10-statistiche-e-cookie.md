# Statistiche e cookie

In **Impostazioni → Tracciamento e cookie** un amministratore collega gli strumenti di statistica e marketing. Per i più comuni basta l'identificativo:

| Strumento          | Cosa scrivere                                             |
| ------------------ | --------------------------------------------------------- |
| Google Analytics 4 | l'ID di misurazione, `G-…`                                |
| Google Tag Manager | l'ID del contenitore, `GTM-…`                             |
| Meta Pixel         | l'ID del pixel                                            |
| Plausible          | il dominio, come su Plausible (per esempio `example.com`) |
| Matomo             | l'indirizzo del tuo Matomo e l'ID del sito                |

Per tutto il resto si può aggiungere **codice personalizzato**, nell'`<head>` o in fondo alla pagina, scegliendo a cosa serve: **necessario**, **statistiche** o **marketing**.

Il codice arriva in tutte le pagine pubblicate, mai nell'anteprima dell'editor: le tue visite di lavoro non finiscono nelle statistiche.

## Il banner dei cookie

Quando c'è codice di statistica o marketing, il sito mostra da solo un banner con **Rifiuta**, **Personalizza** e **Accetta tutti**.

- Finché il visitatore non accetta, quel codice resta fermo. Con Google, il Consent Mode parte da «negato».
- La scelta vale un anno.
- Il visitatore la cambia dal pulsantino in basso a sinistra, oppure da un link a `#preferenze-cookie` che puoi mettere per esempio nel piè di pagina («Preferenze cookie»).

Il codice **necessario** parte sempre, senza chiedere: usalo solo per quello che serve davvero al sito.

## Quello che resta da fare a te

Materialize gestisce il consenso, ma **privacy policy e cookie policy** vanno scritte per il tuo sito, con un professionista o un servizio dedicato, e pubblicate come pagine.

Anche i caratteri sono a posto: Materialize serve i Google Fonts dal tuo sito, quindi i visitatori non contattano Google per scaricarli.
