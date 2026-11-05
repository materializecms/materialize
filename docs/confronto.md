# Materialize e gli altri CMS

Un confronto onesto, per capire se Materialize fa al caso tuo o se ti serve altro. Scritto a novembre 2026 e controllato sulle fonti elencate in fondo: gli altri prodotti cambiano spesso, quindi verifica sui loro siti prima di decidere. Se trovi un errore, [apri una segnalazione](https://github.com/materializecms/materialize/issues).

> Materialize è in **Alpha**: funziona e si usa su siti veri, ma non ha ancora la maturità, la comunità e le estensioni dei prodotti con cui lo confrontiamo.

## In breve

Materialize è un CMS **open source (MIT)** per agenzie e freelance che fanno siti per i clienti:

- **Lo sviluppatore definisce lo schema dei contenuti in codice** (TypeScript) e i componenti del sito in Astro.
- **Il cliente modifica la pagina vera sulla tela**, con i componenti e lo stile del sito, senza poter rompere il design.
- **Il sito pubblicato è statico**: file HTML veloci, sicuri e facili da servire.
- **Tutto in un solo programma** sul tuo server: pannello, database (SQLite incluso), immagini, backup, aggiornamenti.
- **AI dentro il pannello** (Claude, o un modello locale con Ollama), che scrive con la **voce del vostro brand**, e **MCP** per lavorare sul sito da Claude Desktop o Claude Code.

## Le famiglie di CMS

| Famiglia                           | Esempi                                         | Come funziona                                                                                      |
| ---------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| CMS tradizionali                   | WordPress, Joomla, Drupal                      | Pannello e sito nello stesso programma PHP, con temi e plugin.                                     |
| Costruttori di siti in abbonamento | Webflow, Framer, Wix, Squarespace              | Editor visuale, CMS e hosting nello stesso servizio, a pagamento.                                  |
| Headless                           | Strapi, Payload, Sanity, Contentful, Storyblok | Gestiscono i contenuti e li danno via API; il sito è un progetto separato da costruire e ospitare. |
| Per chi pubblica                   | Ghost                                          | Articoli, newsletter e abbonamenti a pagamento.                                                    |
| CMS a file                         | Statamic, Craft CMS, Decap                     | Contenuti in file o in un pannello PHP, spesso con Git.                                            |

Materialize sta in mezzo: come un headless, lo schema è codice e il sito è un progetto Astro; come un costruttore di siti, il cliente modifica visivamente la pagina vera; come un CMS tradizionale, è un solo programma che fa tutto.

## Confronto per funzione

Legenda: **Sì** di serie · **Plugin** con estensioni o servizi aggiuntivi · **Parziale** con limiti · **No** · **Non verificato** non abbiamo trovato una fonte affidabile.

|                                             | Materialize                           | WordPress                                         | Webflow / Framer                                                | Wix / Squarespace                              | Strapi / Payload                         | Sanity / Contentful / Storyblok       | Ghost                  |
| ------------------------------------------- | ------------------------------------- | ------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------- | ------------------------------------- | ---------------------- |
| Open source                                 | Sì (MIT)                              | Sì (GPL)                                          | No                                                              | No                                             | Sì                                       | No (Sanity Studio sì)                 | Sì (MIT)               |
| Ospitato da te                              | Sì                                    | Sì                                                | No                                                              | No                                             | Sì                                       | No                                    | Sì, o il loro servizio |
| Hosting condiviso economico                 | No, serve un VPS o Docker             | Sì                                                | Incluso nel prezzo                                              | Incluso nel prezzo                             | No                                       | Incluso nel prezzo                    | No                     |
| Editor visuale sulla pagina vera            | Sì                                    | Parziale (blocchi, o page builder come Elementor) | Sì                                                              | Sì                                             | No                                       | Storyblok sì, gli altri con anteprima | Parziale               |
| Schema dei contenuti in codice              | Sì                                    | Parziale (codice o plugin)                        | No                                                              | No                                             | Sì                                       | Sì                                    | No                     |
| Il cliente non può rompere il design        | Sì (solo i nomi del tema)             | Dipende dal tema                                  | Parziale (ruoli)                                                | Parziale                                       | Dipende dal sito                         | Dipende dal sito                      | Sì                     |
| Sito statico                                | Sì                                    | Plugin                                            | No                                                              | No                                             | Dipende dal sito                         | Dipende dal sito                      | No                     |
| Lingue                                      | Sì, con traduzione AI                 | Plugin                                            | Sì, a pagamento                                                 | Sì                                             | Sì                                       | Sì                                    | Parziale               |
| Pubblicazione programmata                   | Sì                                    | Sì                                                | Webflow sì, Framer con plugin                                   | Sì                                             | Payload sì, Strapi nei piani a pagamento | Sì (Storyblok dal piano Business)     | Sì                     |
| Link di anteprima per il cliente            | Sì                                    | Plugin                                            | Parziale (dominio di prova)                                     | Parziale                                       | Dipende dal sito                         | Dipende dal sito                      | Sì                     |
| Cronologia e ripristino                     | Sì                                    | Sì                                                | Sì                                                              | Parziale                                       | Payload sì, Strapi nei piani a pagamento | Sì                                    | Parziale               |
| SEO, sitemap, dati strutturati              | Sì                                    | Plugin (Yoast, Rank Math…)                        | Sì                                                              | Sì                                             | Dipende dal sito                         | Dipende dal sito                      | Sì                     |
| Controllo di accessibilità e prestazioni    | Sì, nell'editor e prima di pubblicare | Plugin                                            | Webflow sì (pannello Audit, contrasto nel selettore dei colori) | Wix sì (Accessibility Wizard)                  | Dipende dal sito                         | Dipende dal sito                      | No                     |
| `llms.txt` e pagine in Markdown per le AI   | Sì, generati da soli                  | Plugin                                            | Parziale (`llms.txt` caricato a mano)                           | Parziale (Wix lo genera su una parte dei siti) | Dipende dal sito                         | Dipende dal sito                      | Non verificato         |
| Moduli con antispam, allegati e webhook     | Sì, senza CAPTCHA                     | Plugin (Contact Form 7, Gravity Forms…)           | Sì                                                              | Sì                                             | Dipende dal sito                         | Dipende dal sito                      | No                     |
| Feed RSS                                    | Sì                                    | Sì                                                | Parziale                                                        | Sì                                             | Dipende dal sito                         | Dipende dal sito                      | Sì                     |
| Assistente AI nel pannello                  | Sì, con la tua chiave o Ollama        | Plugin                                            | Sì                                                              | Sì                                             | Parziale (Strapi AI a pagamento)         | Sì, in base al piano                  | No                     |
| Backup cifrati e aggiornamenti dal pannello | Sì                                    | Plugin                                            | Gestiti da loro                                                 | Gestiti da loro                                | No                                       | Gestiti da loro                       | Parziale               |
| Importazione da WordPress                   | Sì                                    | —                                                 | Parziale                                                        | Parziale                                       | No                                       | No                                    | Sì                     |
| Plugin ed estensioni                        | No                                    | Sì, migliaia                                      | App e integrazioni                                              | App                                            | Sì                                       | Sì                                    | Integrazioni           |
| E-commerce                                  | No                                    | Plugin (WooCommerce)                              | Webflow sì, Framer con integrazioni                             | Sì                                             | Dipende dal sito                         | Dipende dal sito                      | Abbonamenti            |
| Newsletter e iscritti                       | No (in programma)                     | Plugin                                            | No                                                              | Sì                                             | No                                       | No                                    | Sì                     |
| Più siti in un'installazione                | No                                    | Sì (multisite)                                    | Sì (un abbonamento per sito)                                    | Sì                                             | Sì                                       | Sì                                    | No                     |
| Modifica insieme in tempo reale             | No                                    | No (rinviata da WordPress 7.0 e 7.1)              | Sì (Webflow dal 2026)                                           | No                                             | No                                       | Sanity sì                             | No                     |

Le celle «Dipende dal sito» indicano che, nei CMS headless, quella parte la costruisce chi sviluppa il sito. Dove due prodotti condividono una colonna e si comportano in modo diverso, la cella lo dice.

## Quando scegliere Materialize

- Fai siti per clienti e vuoi che **modifichino da soli** testi, immagini e sezioni, senza poter rompere il design che hai fatto.
- Vuoi **un sito statico veloce** e un solo programma da tenere aggiornato, **senza abbonamenti** per sito.
- Vuoi lavorare con **Astro e TypeScript**, con lo schema dei contenuti nel repository come il resto del codice.
- Vuoi usare **l'AI sui contenuti** (scrittura, traduzioni, SEO, pagine da un'immagine di riferimento) pagando solo quello che usi, o con un modello locale.
- Hai un sito WordPress da **migrare** e vuoi portare articoli, immagini, SEO e reindirizzamenti.

## Quando scegliere altro

- **Ti serve un ecosistema di plugin**, un e-commerce completo o un hosting condiviso da pochi euro: **WordPress**.
- **Non vuoi gestire un server** e preferisci pagare un servizio che fa tutto: **Webflow**, **Framer**, **Wix** o **Squarespace**.
- **Vivi di newsletter e abbonamenti**: **Ghost**.
- **I contenuti alimentano molte app** (sito, app mobile, schermi) o un team grande lavora insieme in tempo reale: **Sanity**, **Contentful**, **Storyblok** o **Payload**.
- **Ti serve un prodotto maturo**, con supporto commerciale e anni di storia: oggi Materialize è in Alpha.
- **Il pannello deve essere in un'altra lingua**: per ora è solo in italiano (i contenuti del sito possono essere in più lingue).

## Cosa arriverà

Le novità già uscite sono nel [CHANGELOG](../CHANGELOG.md). In programma: sito da un brief, rilasci di più contenuti insieme; più avanti newsletter, vendita semplice e collaborazione in tempo reale.

## Fonti

Le caselle meno ovvie, controllate a novembre 2026:

- WordPress: la modifica in tempo reale è stata rinviata da [7.0](https://www.godaddy.com/resources/news/wordpress-7-0-real-time-collaboration-arrives-in-core) e da [7.1](https://nexterwp.com/blog/wordpress-7-1/); l'[MCP Adapter](https://developer.wordpress.org/news/2026/02/from-abilities-to-ai-agents-introducing-the-wordpress-mcp-adapter/) è un plugin separato.
- Webflow: [modifica in tempo reale per tutti i piani](https://webflow.com/updates/real-time-collaboration-completes-ga-rollout), [`llms.txt` da caricare](https://help.webflow.com/hc/en-us/articles/43240104183315-Upload-an-llms-txt-file-to-your-site), [lingue con il componente aggiuntivo Localize](https://webflow.com/localization).
- Framer: [`llms.txt` come file statico](https://www.framer.com/help/articles/llms-txt-framer/), programmazione con un [plugin](https://www.framer.com/marketplace/plugins/1531/).
- Wix: [`llms.txt` generato da solo](https://support.wix.com/es/article/understanding-your-sites-llmstxt-file), per ora [su una parte dei siti](https://support.wix.com/ja/article/seo-リクエスト：すべてのサイトで-llmstxt-を利用できるようにしたい).
- Strapi: [cronologia a pagamento](https://strapi.io/blog/draft-publish-content-history-strapi-5), [programmazione con le Releases](https://docs-next.strapi.io/user-docs/releases/managing-a-release), [anteprima gratuita, affiancata a pagamento](https://strapi.io/blog/introducing-the-free-preview-feature-growth-plan-and-sso-add-on).
- Storyblok: [programmazione dal piano Business](https://www.storyblok.com/faq/can-i-schedule-a-publishing-event).
- Accessibilità: Webflow ha il [pannello Audit](https://help.webflow.com/hc/en-us/articles/33961313088531) e il contrasto nel selettore dei colori, Wix l'[Accessibility Wizard](https://support.wix.com/en/article/accessibility-using-the-accessibility-wizard).
- Ghost: [link di anteprima per ogni bozza](https://forum.ghost.org/t/how-to-share-post-draft-privately/41785).
