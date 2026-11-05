# Importare da WordPress

In **Impostazioni → Importa** si portano in Materialize articoli, pagine, immagini, categorie e dati SEO di un sito WordPress. Funziona con Gutenberg, Elementor, WPBakery, Divi e gli altri editor.

## Due modi

- **Dall'indirizzo del sito**: scrivi l'indirizzo, per esempio `https://www.example.com`, e premi **Leggi il sito**. Senza password importa i contenuti pubblicati. Con una **password applicativa** (WordPress → Utenti → Profilo → Password applicative) importa anche le bozze.
- **Dal file di esportazione**: in WordPress, **Strumenti → Esporta → Tutti i contenuti**, poi carichi il file `.xml`. Utile se il sito non è raggiungibile.

## Scegliere cosa importare

Dopo la lettura, il pannello mostra cosa ha trovato e propone dove metterlo: articoli in una raccolta, pagine in un'altra. Per ogni tipo scegli i campi da portare (titolo, testo, indirizzo, immagine in evidenza, titolo e descrizione SEO) e se:

- **Pubblica**: pubblicare subito le voci complete, oppure lasciarle bozze;
- **Reindirizza**: aggiungere i reindirizzamenti dai vecchi indirizzi di WordPress ai nuovi.

## Cosa succede

1. **Le immagini** vengono scaricate nella libreria Media, una volta sola anche se usate più volte, nella dimensione originale.
2. **I contenuti** vengono creati, con il testo formattato e le immagini al loro posto.
3. **I link interni** puntano alle nuove pagine.
4. **I vecchi indirizzi** reindirizzano ai nuovi con un 301, così Google e i link esterni non si perdono.

Gli indirizzi che esistono già in Materialize non vengono sovrascritti.

## Cosa resta da fare

Le pagine arrivano con i **contenuti in ordine**, una sezione per ogni titolo principale, ma con un'impaginazione semplice. Il design si rifà sulla tela con l'editor, partendo dalle sezioni della libreria.

### Impaginazione con l'AI

Se l'AI è configurata (Impostazioni → AI e MCP), prima di importare puoi accendere **Rifai l'impaginazione delle pagine con l'AI**. Dopo l'import, l'AI ricompone ogni pagina con le sezioni della libreria: un'apertura con titolo e immagine, i servizi in colonne, gli elenchi come schede o spunte, gli inviti all'azione.

- **Stessi testi e stesse immagini**: l'AI non riscrive e non aggiunge niente, sposta solo il contenuto nelle sezioni. Un controllo confronta le parole e le immagini prima e dopo: se ne mancano o ne compaiono di nuove, la pagina resta con l'impaginazione semplice e il resoconto dice perché. Le descrizioni delle immagini restano.
- **Nella bozza**: se hai scelto di pubblicare, online va la versione semplice; quella dell'AI è nella bozza, segnata «Modifiche da pubblicare», da rivedere e pubblicare quando ti convince.
- Una pagina alla volta, con il modello principale: per un sito di qualche pagina servono pochi minuti. Il consumo lo vedi in Impostazioni → AI e MCP.

Le immagini SVG non vengono importate, per sicurezza: il pannello lo dice e spiega perché.
