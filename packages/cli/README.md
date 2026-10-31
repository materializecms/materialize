# @materializecms/cli

Il comando materialize: sviluppo, produzione con aggiornamenti dal pannello, generazione del sito, backup, MCP.

```bash
materialize dev      # sviluppo, con lo schema ricaricato a ogni salvataggio
materialize start    # produzione, con il supervisore che applica gli aggiornamenti
materialize build    # il sito statico in dist/client
```

Contiene anche `install.sh`, l'installazione su un VPS con un comando, e `compose.yaml` per Docker.

## Materialize

CMS open source con editor visuale: le pagine si disegnano sulla tela, il sito è fatto di file statici veloci. Per un nuovo sito (serve Node 24):

```bash
npm create materialize@latest
```

Documentazione e codice: https://github.com/materializecms/materialize · Licenza MIT.
