---
titolo: Due livelli di sensibilità per le credenziali
tipo: decisione
tag: [decisioni, sicurezza, credenziali]
fonti:
  - "conversazione diretta in Claude Code, sessioni 31/08/2026-02/09/2026"
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-09-07
aggiornato: 2026-09-09
---

# Due livelli di sensibilità per le credenziali

**Decisione**: le credenziali si trattano in due modi diversi a seconda del tipo.

- **Credenziali cloud "vive"** (service account, API key con accesso in scrittura a infrastruttura reale — es. Google Sheets/Calendar API): standard stretti, mai condivise in chat, mai esposte online. Se capita per errore, revoca/rigenerazione immediata.
- **Credenziali statiche di documenti personali** (carte d'identità, accessi bancari, portali OTA, ecc.): restano in chiaro nel wiki locale, per scelta esplicita di Raffaele — comodità di accesso più importante della segretezza in un vault che vive solo sul suo PC.

**Perché**: sono due categorie di rischio diverse, non un'incoerenza — le prime danno accesso a sistemi che agiscono nel mondo reale (prenotazioni, calendario), le seconde sono dati di riferimento personale.

**Come si applica**: quando una copia del wiki esce dal PC locale (es. bundle per il bot cloud su Vercel, dashboard online), **tutte** le tabelle di credenziali/login/password — anche quelle statiche normalmente in chiaro — vanno rimosse dalla copia esposta, perché quella non ha un login a protezione. Fatto per la prima volta il 02/09/2026 con [[raffaele-salzillo]], [[bb-il-tulipano]], [[trasferimento-feltre-raffaele]], [[tfa-sostegno-raffaele]], [[documentazione-apertura-tulipano]].

**Errore ricorrente da evitare (annotato 07/09/2026)**: capitato due volte nella stessa sessione di risincronizzare la copia cloud con un `cp` diretto dal file locale, sovrascrivendo per errore una redazione già fatta e rimettendo le credenziali in chiaro online. La seconda volta ha esposto anche una password reale (portale TFA Link Campus) rimasta per mesi in `log.md` lato cloud, mai notata prima. **Regola pratica**: prima di sincronizzare `raffaele-salzillo.md` o `bb-il-tulipano.md` verso `data/wiki`, controllare sempre se la copia cloud ha già una redazione attiva (cercare "🔒") — se sì, non sovrascrivere con `cp`, applicare solo il diff non sensibile a mano. Su `log.md` in particolare, dato che accumula dettagli storici nel tempo, rifare periodicamente una scansione `assword` sull'intera copia cloud, non solo sui file appena toccati.

**Eccezione esplicita e consapevole (09/09/2026) — duplicazione completa su Google Drive personale**: Raffaele ha proposto di duplicare l'intero wiki personale (non solo una copia redatta) sul suo Google Drive, per dare al bot accesso continuo anche a PC spento e come base per il futuro server domestico (vedi [[architettura-dati-pronta-per-server-domestico]]). Segnalato esplicitamente che questo va contro il principio di base qui sopra — un Drive è raggiungibile da qualunque dispositivo con quel login, non ha la protezione fisica di un PC locale — ed era esattamente lo scenario che [[infrastruttura-free-first]] aveva rimandato apposta. Messo di fronte alla scelta esplicita (copia redatta vs copia completa in chiaro), **Raffaele ha scelto consapevolmente la copia completa**, incluse le tabelle di credenziali. Non è una revoca della regola generale — resta valida per tutte le altre copie cloud (bot Vercel, dashboard online) — è un'eccezione mirata e voluta per questa specifica destinazione (il suo Google Drive personale), stesso schema delle eccezioni già approvate altrove in questo vault (vedi [[non-toccare-sito-prenotazioni]] per il precedente di metodo). **Account confermato**: `raffaele.salzillo02@gmail.com` — non un refuso, è lo stesso account già usato per Google Calendar in questo progetto (chiarito il 09/09/2026). Cartella creata da Raffaele e condivisa: id `1r3SeANiVTdjbOuVmRHy96OozV-AXtntg`.

**Meccanismo tecnico, corretto dopo un primo tentativo fallito**: la prima idea (condividere la cartella come Editor col service account già in uso per Sheets) **non funziona** — verificato con un test reale, un service account non può scrivere file veri nemmeno dentro una cartella condivisa da un utente vero (vedi [[salzillo-hospitality]] per i dettagli). Serve OAuth utente reale, stesso pattern già in uso per Calendar — vedi `src/app/api/oauth/drive-start`.

**Autorizzazione OAuth completata e verificata (09/09/2026 notte)**: `DRIVE_REFRESH_TOKEN` ottenuto e salvato su Vercel, testato con una scrittura reale nella cartella "Il mio cervello" (creata da Raffaele, id `1r3SeANiVTdjbOuVmRHy96OozV-AXtntg`) — confermato che la scrittura funziona per davvero, non solo in teoria.

**Duplicazione completata (09/09/2026 notte)**: caricati **450 file** (`wiki/` + `raw/` + `CLAUDE.md`, struttura a cartelle replicata identica) per un totale di **~716 MB (0.72 GB)**. Meccanismo: una route temporanea su Vercel apriva una sessione di upload "resumable" con Drive (autenticata), poi un caricamento diretto da locale a Google, mai passando dal server per il contenuto vero — necessario perché alcuni file in `raw/` superano i 60MB. 5 file sono falliti al primo giro per un problema di come il terminale passa a `curl` nomi file con apostrofi/emoji (non un problema di Google) — risolto passando il contenuto via stdin invece che come argomento file, poi ricaricati con successo tutti e 5. Idempotente: rilanciabile in sicurezza, salta i file già presenti. Route temporanea eliminata a caricamento completato, cartella di test ripulita. **Non ancora costruito**: un modo per tenere la copia aggiornata nel tempo (oggi è un caricamento una tantum, non un sync continuo) — da affrontare quando servirà davvero, non prima.
