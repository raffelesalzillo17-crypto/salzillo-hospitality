---
titolo: Analisi critica del sistema Salzillo Hospitality (10/09/2026)
tipo: sintesi
tag: [salzillo-hospitality, architettura, debito-tecnico, crescita, analisi]
fonti:
  - "conversazione diretta in Claude Code, sessione 10/09/2026 (Raffaele: «fai un'analisi per migliorare il sistema, sii molto critico conoscendo i miei obiettivi»)"
  - "lettura diretta del codice salzillo-hospitality, 10/09/2026"
creato: 2026-09-10
aggiornato: 2026-09-10
---

# Analisi critica del sistema Salzillo Hospitality (10/09/2026)

Richiesta da Raffaele dopo lo split dell'archivio Google Sheets. Metro di giudizio: gli obiettivi dichiarati — [[piattaforma-property-management-personale]] (più immobili, tempo umano per immobile → zero, Raffaele ora è property manager), [[architettura-dati-pronta-per-server-domestico]], [[infrastruttura-free-first]], eventuale vendita del prodotto ad altri host.

## Il tetto strutturale: Google Sheets come database

È l'unico problema che, non risolto, blocca tutti gli obiettivi. In dettaglio:

- **Nessuna sicurezza di concorrenza.** Creare una prenotazione = "leggi l'ultima riga libera, poi scrivi lì" (`findFirstFreeRow` + `update`, due chiamate separate). Due scritture nello stesso secondo — es. il cron che importa una prenotazione Airbnb da email mentre un collaboratore ne inserisce una a mano — prendono la stessa riga: una sovrascrive l'altra, silenziosamente. Oggi il volume basso nasconde il problema; con più immobili e più persone è perdita di prenotazioni reali.
- **Il numero di riga È l'identità.** Cancellazione, modifica, e la colonna `PrenotazioneRow` di SCHEDINE identificano una prenotazione col suo numero di riga sul foglio. Stabile solo finché nessuno cancella mai una riga. Una sola cancellazione sposta tutte le righe sotto e corrompe silenziosamente ogni riferimento (schedine, tab del browser ancora aperte che cancellerebbero la prenotazione sbagliata). Fragilità toccata con mano il 10/09 pulendo la riga di test.
- **Nessuno schema, nessun tipo allo strato dati.** Un refuso in una colonna, una modifica manuale, una data che Sheets auto-converte: tutto corrompe le letture senza errori. Successo il 10/09 (hash password sovrascritto a mano con la password in chiaro → login rotto).
- **Tetti di lettura.** `readAllRows` legge max 1000 righe. SCHEDINE cresce per-ospite-per-soggiorno: a 5 immobili con ricambio è questione di mesi.
- **Modello di query.** Tutto è "leggi tutte le righe, filtra in JavaScript". Costo lineare per sempre.
- **Non vendibile.** Nessun secondo cliente può girare sui fogli del tuo account Google.

**Raccomandazione**: migrare a un database vero — Postgres su Neon (piano gratuito, già nell'ecosistema Vercel, rispetta [[infrastruttura-free-first]]). Un DB vero è *più* portabile su un futuro server domestico di quanto lo sia Google Sheets, non meno — [[architettura-dati-pronta-per-server-domestico]] lo prevede già. La disciplina "ogni accesso passa da un modulo di libreria" c'è già (`src/lib/sheets.ts`, i lib per dominio) → è una sostituzione dello strato di storage, non una riscrittura. **Ma è una migrazione vera** (prenotazioni, ospiti, schedine, contratti, spese, scadenze, conti), su dati di prenotazione veri, con un piano di cutover: progetto dedicato, non un lavoro di una notte.

## Nessun modello proprietario/immobile, mentre Raffaele è già property manager

- `src/lib/strutture.ts` ha `scia: 'tulipano' | 'altro'` — un enum a 2 valori hardcoded che fa le veci di "quale entità fiscale / quale proprietario". Come property manager gestirai immobili di *altre persone*: non esiste un'entità `Proprietario`, né un proprietario per immobile, né un riepilogo economico per proprietario, né un modo di mostrare a un proprietario "ecco i numeri del tuo immobile".
- Le stanze sono una lista piatta nel codice (in 3 punti: `strutture.ts`, `page.tsx`, di riflesso `assistantCore.ts`). Aggiungere un immobile = modifica al codice + deploy. [[piattaforma-property-management-personale]] segnala già "nomi di stanza hardcoded nel codice invece che dati" come debito da sciogliere alla crescita. La crescita è adesso.
- **Raccomandazione**: `Struttura` e `Proprietario` come dati (nel DB), ogni prenotazione/spesa legata a un immobile, ogni immobile a un proprietario. Una vista per il proprietario diventa un filtro, non una ricostruzione. Da fare *insieme* alla migrazione DB — è il momento giusto per modellare le entità bene. Richiede però decisioni di business da Raffaele (cosa vede un proprietario? gli si dà un accesso? che percentuale di gestione?).

## L'autenticazione è tre sistemi ad hoc sovrapposti

- `PLANCIA_ACCESS_KEY` (una chiave condivisa, per `/plancia`)
- `accessi` (scrypt + token HMAC, per i collaboratori sul sito prenotazioni)
- `isAuthorizedCron` (`CRON_SECRET` / `EXTERNAL_PING_SECRET`)
- più i refresh token OAuth per Gmail/Calendar/Drive

Il 10/09 ho dovuto innestare "chiave plancia = permessi pieni" dentro `requireAccesso` per far ripartire dashboard e avvisi. Funziona ma si accumula. Un sistema che avrà proprietari + staff + collaboratori con visibilità diverse ha bisogno di *un* modello coerente (utenti, ruoli, ambiti per-immobile), non tre tipi di chiave in crescita. Da affrontare con o dopo il lavoro sul DB.

## Il serverless + Sheets fa ricomparire la stessa classe di bug ("gli avvisi non arrivavano")

Terza volta che un cron/notifica si ferma in silenzio: 08/09 (le scritture Telegram mai migrate da locale a Vercel), 09/09 (il gate di autenticazione), più il buco iniziale sull'heartbeat. L'heartbeat aiuta ma la radice è: tante parti in movimento (4 cron, webhook, sync email), ognuna che chiama route HTTP interne, ognuna capace di rompersi da sola. L'estrazione di `leggiPrenotazioni()` fatta il 10/09 è la direzione giusta — i consumatori interni devono chiamare le librerie, non l'HTTP. **Da completare ovunque**: `/api/calendario`, `/api/notizie`, `/api/mercati` sono ancora chiamate via HTTP da dentro il digest e da `assistantCore.ts`.

## Monoliti e zero test

- `src/app/plancia/page.tsx` 1288 righe, `src/app/page.tsx` 902. Difficili da modificare in sicurezza.
- Nessun test, da nessuna parte. Per la matematica di business (`calcUtile` — commissioni, cedolare) e per il tracciato Alloggiati a 168 caratteri, una manciata di test unitari intercetterebbe esattamente il tipo di deriva silenziosa che ha già morso (il `calcUtile` era copiato identico in 2 file — deduplicato il 10/09, un test lo bloccherebbe).

## Problemi minori ma reali

- `calcUtile`: "No Tax" salta commissione *e* cedolare (fa solo −20 pulizia). Confermare con il commercialista che la logica fiscale nel codice è giusta — è codificata senza una traccia documentale del perché.
- I PDF di contratti/ricevute non vengono salvati da nessuna parte (solo una riga di audit trail per i contratti). `src/lib/documenti.ts` (storage Drive per ospite) esiste ma `contratto`/`ricevuta` non lo usano. I "documenti vicino alla ricevuta" che Raffaele vuole non esistono ancora.
- Inventario dei segreti: ~15+ variabili d'ambiente, refresh token OAuth che possono scadere/essere revocati. Manca un elenco unico di cosa fa ciascuno e come si rigenera (in parte nel wiki, sparso).

## Cosa è già stato fatto il 10/09

- Deduplicato `calcUtile` + tariffe in un solo posto (`src/lib/prenotazioni.ts`).
- Estratto `leggiPrenotazioni()` — i cron e il bot leggono le prenotazioni senza HTTP.
- Split dell'archivio in 3 file + `fileIdForTab`.
- Corretti i 3 effetti collaterali del gate di autenticazione.

## Priorità proposta (rispetta free-first e "non rompere le operazioni vive")

1. **Migrazione DB (Sheets → Postgres/Neon)** — quella che sblocca tutto il resto. Sforzo maggiore, ritorno maggiore. Progetto dedicato con piano di cutover.
2. **Proprietario + Immobile come dati** — da fare *dentro* la migrazione DB. Richiede decisioni di business da Raffaele.
3. **Unificare l'autenticazione** in utenti/ruoli/ambiti per-immobile — con o dopo il punto 1.
4. **Finire il refactor "le chiamate interne passano dalle librerie"** — piccolo, da fare presto, riduce la classe di bug ricorrente.
5. **Suite di test per la matematica dei soldi + il tracciato Alloggiati** — piccola, alto valore, da fare presto.
6. **Collegare contratto/ricevuta a `documenti.ts`** (storage Drive) — medio, chiude un buco noto.

I punti 1–3 non sono stati fatti in autonomia: sono multi-giorno, toccano dati di prenotazione veri, e il modello dei proprietari è una scelta di business di Raffaele. 4–6 sono candidati per la prossima sessione.
