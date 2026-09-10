---
titolo: Piano dettagliato — migrazione a database vero + modello proprietario/immobile
tipo: sintesi
tag: [salzillo-hospitality, architettura, database, migrazione, proprietari, piano]
fonti:
  - "conversazione diretta in Claude Code, sessione 10/09/2026 (Raffaele: «parti con il progetto database + modello proprietario, fai un piano dettagliato»)"
  - "lettura diretta del codice e degli schemi dati salzillo-hospitality, 10/09/2026"
creato: 2026-09-10
aggiornato: 2026-09-10
---

# Piano dettagliato — migrazione a database vero + modello proprietario/immobile

Nasce da [[analisi-critica-sistema-salzillo-hospitality]] (punti 1 e 2) e da [[architettura-dati-pronta-per-server-domestico]]. Obiettivo: sostituire Google Sheets come base dati con un database vero, e nello stesso passaggio introdurre le entità `Proprietario` e `Immobile` come dati — così la crescita a più immobili di più proprietari ([[piattaforma-property-management-personale]]) non richiede modifiche al codice per ogni immobile nuovo.

**Principio guida del cutover**: mai un momento in cui le prenotazioni reali sono a rischio. Google Sheets resta come copia ombra fino a fiducia piena, e il rollback è sempre una variabile d'ambiente.

---

## 0. Decisioni tecniche (con motivazione)

| Scelta | Cosa | Perché |
|---|---|---|
| **Database** | Postgres su **Neon** (piano gratuito, integrazione Vercel Marketplace) | SQL standard, gratis entro i volumi attuali e futuri prevedibili ([[infrastruttura-free-first]]), esportabile in un dump portabile su un futuro server di casa ([[architettura-dati-pronta-per-server-domestico]]). Un Postgres è *più* portabile di Google Sheets, non meno. |
| **ORM** | **Drizzle** (+ drizzle-kit per le migrazioni) | TypeScript nativo, leggero, niente client generato, niente wrapper `Proxy` (che rompono librerie di auth). Adatto al serverless. Più semplice di Prisma per questo caso. |
| **Driver** | `@neondatabase/serverless` | HTTP-based, pensato per funzioni serverless (niente pool di connessioni da gestire tra invocazioni). |
| **File dei documenti** | Restano su Google Drive | I PDF (contratti, ricevute, documenti ospiti) restano dove sono — nel DB va solo una tabella `documenti` che punta al file Drive. Migrare i blob non serve e aggiunge rischio. |
| **Strato di accesso** | Nuovo `src/lib/db/` con un modulo per entità (`prenotazioni`, `ospiti`, ...) — stessa disciplina già in uso per `src/lib/sheets.ts` | La logica applicativa (route, cron, bot) non deve sapere se sotto c'è Sheets o Postgres. |
| **Cutover** | Finestra di manutenzione "big-bang" con import ri-eseguibile e rollback via env var | I volumi sono bassi (62 prenotazioni, poche scritture al giorno) e Raffaele controlla quando arrivano. Il dual-write (scrivere su Sheets *e* DB insieme) raddoppierebbe la complessità e i modi di fallire per un guadagno che a questo volume non serve. |

---

## 1. Modello dati attuale (inventario completo)

Da migrare (oggi tab del foglio, dal 10/09 divisi in 3 file — vedi [[salzillo-hospitality]]):

| Tab | Colonne | Note |
|---|---|---|
| **DATABASE** (prenotazioni) | checkin, checkout, ospite (stringa nome intero), stanza (stringa), canale, lordo, stato, penale, eventId (Calendar), telefono | Nessun ID: **il numero di riga È l'identità**. `utile` calcolato a runtime, non salvato. |
| **OSPITI** | OspiteId, Nome, Telefono, CodiceFiscale, Note, CreatoIl, AggiornatoIl | Ha già un `OspiteId` proprio. `Nome` è una stringa unica (non nome/cognome separati). |
| **SCHEDINE** | 21 colonne: dati anagrafici ospite + codici ufficiali Alloggiati (sesso, tipo alloggiato, comune/stato nascita, cittadinanza, documento) + `PrenotazioneRow` (numero di riga!) + `Stato` ("Da inviare"/...) | Il legame con la prenotazione è un numero di riga → fragile. |
| **CONTRATTI** | Data generazione, Ospite, Stanza, Check-in, Check-out, Canale, Importo lordo, Note | Solo audit trail. Il PDF non è salvato da nessuna parte. |
| **PULIZIE** | Data, Stanza, Ospite, 7 voci checklist (bool), Operatore, CompletatoIl, Note | Legame con prenotazione: nessuno (solo data+stanza). |
| **SPESE** | Data, Categoria, Descrizione, Importo, Struttura | `Struttura` è una stringa. |
| **SCADENZE** | ID, Titolo, DataScadenza, Ricorrenza, Note, UltimoCompletamento | Ha già un ID proprio. Fiscali, non per-immobile oggi. |
| **CONTI** | Data, Banca, Saldo, Note | Snapshot saldi bancari. **Domanda aperta: finanza personale di Raffaele o della piattaforma?** |
| **ACCESSI** | Username, Nome, PasswordHash (scrypt), Ruolo (testo libero), PuoCreare, PuoCancellare, PuoVedereFinanziario, Attivo, CreatoIl | Permessi = 3 booleani. Nessun ambito per-immobile. |
| **BOT_STATE** | chat_id, updated_at, state_json | Stato conversazione bot Telegram. |
| **TELEGRAM_LOG** | ts, chat_id, role, text | Log conversazioni bot. |
| **EmailProcessate** | MessageID, Tipo, Data, Esito | Deduplica del cron sync-email. |

Fuori scope migrazione: RECAP, CONFIG, GENNAIO–DICEMBRE (contabilità manuale di Raffaele, il codice non li tocca — restano su Sheets).

---

## 2. Modello dati di destinazione (schema Postgres)

Aggiornato dopo la discovery con Raffaele (8 giri — vedi [[discovery-nuovo-sistema-salzillo-hospitality]]). Entità nuove in **grassetto**. Ogni tabella ha `id` interno (mai mostrato all'utente — regola "niente codici strani": nell'interfaccia si vedono i nomi), `creato_il`, `aggiornato_il`.

### Anagrafiche

- **`proprietari`** — `nome`, `tipo` (persona fisica | società), `codice_fiscale_piva`, `email`, `telefono`, `iban` (bonifici di rendicontazione), `note`
- **`contratti_gestione`** — `proprietario_id` → proprietari, `dal` (data), `al` (data, nullable), `percentuale_fee` (sul lordo — oggi **0%** per la famiglia), `condizioni` (testo), `documento_id` → documenti (il contratto PDF, generabile dal sistema)
- **`immobili`** — `proprietario_id` → proprietari, `nome` (es. "Via Clanio 60"), `indirizzo`, `comune`, `provincia`, `cin`, `cir`, `note`
- **`alloggi`** (stanza/appartamento affittabile) — `immobile_id` → immobili, `nome` (es. "Il Tulipano"), `attivo` (bool), `regime_fiscale` (**con cedolare** | **no tax** — cambia nel tempo per lo stesso alloggio), `costo_pulizia` (default 20€, configurabile), `ha_self_checkin`, `checkin_guide_url`, `emoji`, `wifi_ssid`, `wifi_password`, `messaggio_guida`, `promemoria_pulizia` (testo "cose da ricordare", non una checklist), `trasmette_alloggiati` (bool), `imposta_soggiorno_comune` (nullable), `calendar_id` (un calendario Google per immobile)
  - *Sostituisce `src/lib/strutture.ts` come dati. `page.tsx` e `assistantCore.ts` leggeranno da qui.*
- **`ospiti`** — `nome`, `cognome` (splittati dall'attuale campo unico), `telefono`, `email` (opzionale), `codice_fiscale`, `valutazione` (buono | neutro | problematico), `note`
  - *Migrazione: importare **tutti** i 46 storici. `Nome` unico → split euristico + revisione manuale, originale conservato in `note_import`.*

### Prenotazioni e derivati

- **`prenotazioni`** — `alloggio_id` → alloggi, `ospite_id` → ospiti (il capofamiglia), `checkin` (data), `checkout` (data), `numero_ospiti`, `canale` (Airbnb | Booking | Diretto | No Tax), `codice_conferma_canale` (**nuovo** — il codice Airbnb/Booking), `lordo`, `commissione` (**salvata**, non ricalcolata), `cedolare` (**salvata**), `costo_pulizia` (**salvata**), `fee_gestione` (**salvata**), `utile` (**salvato**), `netto_proprietario` (**salvato**), `stato` (Attiva | In attesa di conferma | Cancellata | Cancellata con penale | No-show), `penale_importo`, `calendar_event_id`, `note`, `creata_da` → utenti
  - *Ogni prenotazione fotografa i suoi importi al momento: se l'alloggio passa da No Tax a con-cedolare, le prenotazioni vecchie non cambiano.*
- **`pagamenti`** — `prenotazione_id` → prenotazioni, `tipo` (caparra | saldo | rimborso), `importo`, `data`, `metodo` (bonifico | contanti | carta | piattaforma), `note`. La prenotazione mostra "versato X su Y, manca Z".
- **`ospiti_prenotazione`** — `prenotazione_id` → prenotazioni, `ospite_id` → ospiti — gli ospiti oltre al capofamiglia, raccolti col check-in online (servono per le schedine).
- **`schedine`** — `prenotazione_id` → prenotazioni (**vera FK, non un numero di riga**), `ospite_id` → ospiti, tutti i campi anagrafici + codici Alloggiati (dietro le quinte), `stato` (Da inviare | Inviata | Errore), `scade_il` (**calcolato**: check-in + 6h se 1 notte, +24h se più lunga), `inviata_il`, `ricevuta_documento_id` → documenti (la ricevuta di trasmissione, **conservata per sempre**)
- **`documenti`** — `ospite_id` (nullable), `prenotazione_id` (nullable), `proprietario_id` (nullable), `tipo` (documento identità | contratto ospite | ricevuta | preventivo | conferma prenotazione | contratto gestione | rendiconto | ricevuta alloggiati | altro), `nome`, `drive_file_id`, `drive_url`, `mime`, `caricato_il`
  - *Le **foto dei documenti d'identità** si cancellano appena la schedina è trasmessa (privacy). Le **ricevute Alloggiati** si conservano per sempre. Contratti/ricevute/preventivi **salvati** in cartella per ospite.*
- **`pulizie`** — `prenotazione_id` → prenotazioni (**creata in automatico a ogni check-out**), `alloggio_id` → alloggi, `data`, `addetto_id` → utenti, `confermata_il` (quando l'addetto preme "pulizia terminata, stanza pronta"), `note`

### Gestione

- **`spese`** — `immobile_id` (nullable = generale) → immobili, `data`, `categoria_id` → categorie_spesa, `descrizione`, `importo`, `metodo_pagamento` (opzionale), `scontrino_documento_id` → documenti (opzionale), `da_rimborsare_proprietario` (bool — **campo previsto** per il futuro), `note`
- **`categorie_spesa`** — `nome`, `attiva` — lista fissa iniziale (Utenze, Manutenzione, Prodotti pulizia, Commercialista, Tasse, Arredamento, Marketing, Altro) + se ne aggiungono.
- **`scadenze`** — `immobile_id` (nullable = generale) → immobili, `titolo`, `data_scadenza`, `ricorrenza`, `note`, `ultimo_completamento`
- **`rendiconti`** — `proprietario_id` → proprietari, `mese`, `anno`, `documento_id` → documenti (il PDF), `totale_incassato`, `totale_spese`, `netto_proprietario`, `inviato_il`

### Sistema

- **`utenti`** — `username`, `password_hash` (scrypt, invariato), `nome`, `email`, `ruolo` (titolare | collaboratore | proprietario | pulizie), `attivo`
- **`permessi_immobile`** — `utente_id` → utenti, `immobile_id` → immobili, `puo_vedere`, `puo_vedere_finanziario`, `puo_modificare`
  - *`titolare` (Raffaele) salta la tabella, vede tutto. `proprietario` = una riga sola-lettura sul suo immobile. `collaboratore` = righe sugli immobili assegnati. `pulizie` = vede solo il calendario pulizie e le sue conferme.*
- **`bot_state`** — `chat_id`, `stato` (jsonb) — bot solo di Raffaele
- **`telegram_log`** — `ts`, `chat_id`, `ruolo`, `testo`
- **`email_processate`** — `message_id`, `tipo`, `data`, `esito`
- **`notifiche`** — `tipo` (schedina da inviare | pulizia da fare | documento mancante | scadenza vicina | ...), `riferimento` (a cosa punta), `scade_il`, `letta_il` — alimenta la sezione "cosa manca" della dashboard e i promemoria del bot.

**Fuori dal nuovo sistema**: la scheda CONTI (saldi bancari personali) — resta uno strumento privato di Raffaele in Motore Rafilu, non c'entra con la gestione immobili. *(da confermare — proposta dell'agente, Raffaele non ha ancora risposto alla domanda 14 della discovery)*

### Viste principali (non tabelle — come si legge il tutto)

- **Dashboard**: arrivi/partenze oggi-domani · incassato+utile del mese per immobile · "cosa manca" (da `notifiche`) · occupazione.
- **Calendario stile Airbnb**: griglia giorni × alloggi, barre colorate per prenotazione, click → dettaglio. *(Raffaele manda uno screenshot Airbnb come riferimento.)*
- **Scheda proprietario**: i suoi immobili, rendiconti, calendario, documenti — filtrata, sola lettura.

---

## 3. Fasi (ognuna è un incremento consegnabile e verificato)

### Fase 0 — Il progetto su GitHub (~1 ora, richiede 2-3 azioni di Raffaele)
- Oggi `salzillo-hospitality` **non è un repository git** — nessuna cronologia, nessun rollback. Prima di toccare l'architettura va messo sotto controllo di versione.
- `git init` locale, primo commit di tutto lo stato attuale (= punto di ripristino "prima della migrazione").
- Raffaele crea un repository privato sul suo GitHub, poi si collega a Vercel: da lì ogni `push` sul ramo principale fa il deploy da solo (niente più `vercel deploy` dal PC dell'agente).
- **Verifica**: un commit di prova pushato → Vercel builda e pubblica da solo.

### Fase 1 — Fondamenta database, nessun cambiamento visibile (~mezza giornata)
- Provisioning Neon via Vercel Marketplace ([[infrastruttura-free-first]]: piano gratuito). Env var `DATABASE_URL` iniettata automaticamente. *(azione di Raffaele: 2 clic sul dashboard Vercel)*
- `npm i drizzle-orm @neondatabase/serverless` + `drizzle-kit` (dev).
- `src/lib/db/schema.ts` — tutto lo schema della sez. 2 in Drizzle, con **nomi di colonna in italiano leggibile** (regola "niente codici strani" fin dentro il database).
- `src/lib/db/index.ts` — client lazy (niente `Proxy`, vedi skill vercel-storage).
- Prima migrazione `drizzle-kit` → tabelle vuote create su Neon.
- **Verifica**: `drizzle-kit push` pulito, una query di prova da una route diagnostica temporanea.
- *Nessun deploy che cambia comportamento. Sheets ancora unica fonte.*

### Fase 2 — Strato dati parallelo (~1 giorno)
- `src/lib/db/` — un modulo per entità con le stesse firme dei lib attuali (`leggiPrenotazioni()`, `trovaOCreaOspite()`, ecc.) ma che leggono/scrivono Postgres.
- Non ancora collegato a niente. Testabile in isolamento.
- **Verifica**: primi test unitari veri del progetto — sulla matematica dei soldi (`calcUtile`) e su un paio di query.

### Fase 3 — Script di import Sheets → Postgres, ri-eseguibile (~1 giorno)
- `scripts/import-da-sheets.ts`: legge i 3 file Google, popola Postgres.
- **Le entità nuove**: crea 1 `proprietario` "Raffaele/famiglia" + gli `immobili` (Via Clanio, Via Campania) + le `unita` (5 stanze attuali) da `strutture.ts`. Ogni prenotazione/spesa collegata all'unità/immobile giusto per nome.
- Ospiti: split `Nome` → nome/cognome (euristica + file di eccezioni da rivedere a mano).
- Schedine: `PrenotazioneRow` → risolto in `prenotazione_id` vero al momento dell'import.
- Idempotente: ri-eseguibile, `TRUNCATE` + reimport (finché Sheets è la fonte, l'import si può rifare quante volte serve).
- **Verifica**: conteggi riga per riga Sheets vs DB per ogni entità; totali economici (somma lordo, somma utile) identici; 10 prenotazioni a campione confrontate campo per campo.

### Fase 4 — Lettura dal DB dietro un interruttore (~1 giorno + settimana di osservazione)
- Env var `USE_DB=true|false`. Ogni lib (`prenotazioni`, `ospiti`, ...) sceglie la fonte in base a quella.
- Le **scritture** continuano ad andare *anche* su Sheets in questa fase (l'unico pezzo di dual-write, temporaneo e solo in scrittura) — così se si torna indietro, Sheets è aggiornato.
- Deploy con `USE_DB=true`. Import rifatto subito prima del deploy per allineare.
- **Verifica**: una settimana di uso reale. Ogni sera, script di confronto DB vs Sheets — devono restare identici. Digest, promemoria, bot, dashboard, sito prenotazioni: tutti controllati.
- **Rollback**: `USE_DB=false` + redeploy. Sheets è ancora aggiornato perché le scritture ci sono andate lo stesso.

### Fase 5 — Modello proprietario attivo (~2-3 giorni)
- UI: gestione proprietari / immobili / alloggi / contratti di gestione (nuovo pannello in Motore Rafilu).
- `permessi_immobile` + torna il login (fatto bene: utenti/ruoli/ambiti).
- **Rendiconto mensile proprietario**: generazione PDF + pagina web sola-lettura per il proprietario.
- Calcolo `netto_proprietario` per prenotazione (lordo − commissione − cedolare − pulizia − fee di gestione).
- Vista calendario stile Airbnb.
- **Verifica**: un proprietario di prova vede solo il suo immobile, i numeri tornano, non vede gli altri; un rendiconto di prova quadra con la somma delle prenotazioni del mese.

### Fase 6 — Sheets in sola lettura (dopo settimane di fiducia)
- Le scritture smettono di andare su Sheets.
- Un cron settimanale esporta il DB in un Google Sheet di sola lettura "Backup" — così Raffaele ha sempre una copia consultabile a colpo d'occhio, senza che sia più la fonte.
- I 3 file operativi diventano l'archivio storico del "prima".

---

## 4. Rischi e mitigazioni

| Rischio | Mitigazione |
|---|---|
| Perdere/corrompere prenotazioni reali durante il cutover | Sheets resta aggiornato (scritture doppie) per tutta la fase 4. Rollback = 1 env var. Import ri-eseguibile. |
| Neon free tier: limiti (storage, ore di compute, "scale to zero" con cold start) | Volumi attuali lontanissimi dai limiti. Cold start ~500ms sul primo hit: accettabile per un gestionale interno. Se un giorno stringe → è il caso (c) di [[infrastruttura-free-first]]. |
| Lo split nome/cognome degli ospiti sbaglia | File di eccezioni rivisto a mano da Raffaele prima della fase 4. Nessun dato perso: `Nome` originale conservato in un campo `note_import`. |
| `calendar_event_id` e i legami con Google Calendar | Restano identici — il DB salva lo stesso campo. Calendar non è toccato da questa migrazione. |
| Drizzle/Neon: knowledge del modello non aggiornata | Prima di scrivere codice Drizzle/Neon, consultare la skill `vercel-storage` (già nota: niente `Proxy`, driver serverless, migrazioni drizzle-kit non caricano `.env.local` da sole). |
| Raffaele senza internet di casa (situazione attuale) | Neon è cloud, gestibile da qualunque connessione. Nessun blocco. |

---

## 5. Cosa NON fa questo piano

- Non tocca Google Calendar, Gmail, Drive (i file) — restano.
- Non tocca i fogli mensili di contabilità manuale.
- Non costruisce il server domestico — prepara il terreno (un dump Postgres è portabile), ma quello è un progetto a sé quando l'hardware esiste.
- Non attiva `Send()` reale verso Alloggiati Web/Sinfonia (resta manuale/supervisionato per scelta).

---

## Stato

- **10/09/2026**: piano scritto, poi discovery completata con Raffaele (8 giri di domande — vedi [[discovery-nuovo-sistema-salzillo-hospitality]]) e schema della sez. 2 aggiornato di conseguenza. Raffaele ha deciso: si finisce la raccolta requisiti, poi si parte con tutte le fasi in sequenza. Attesi ancora: la correzione sui proprietari e lo screenshot del calendario Airbnb. Prossimo passo operativo: **Fase 0 — GitHub**.
