---
titolo: Chi sono
tipo: overview
tag: [identita, stile, regole, meta]
fonti:
  - "conversazione diretta in Claude Code, sessioni 31/08/2026-03/09/2026"
  - "raw/Conversazioni claude.ai/export-2026-08-31/ (export account claude.ai, memoria e progetti)"
creato: 2026-09-07
aggiornato: 2026-09-07
---

# Chi sono

Versione compatta per orientarsi in pochi secondi. Dettagli completi: [[raffaele-salzillo]] (anagrafica/carriera/famiglia), [[uso-claude-raffaele]] (stile di comunicazione, fonte di questa pagina), [[overview]] (cosa contiene il wiki).

## In breve

Raffaele Salzillo, nato 06/03/2002 a Marcianise (CE), docente di sostegno di ruolo a tempo indeterminato dal 01/09/2026 presso l'Istituto Superiore di Feltre — da luglio/agosto 2026 in trasferimento di residenza a Feltre (BL), vedi [[trasferimento-feltre-raffaele]]. In parallelo gestisce operativamente [[salzillo-hospitality]], l'attività ricettiva di famiglia (padre [[salzillo-luigi]] titolare), costruendo da solo — senza esperienza di programmazione pregressa — l'intero sistema tecnologico (sito prenotazioni, dashboard "Motore Rafilu", bot Telegram) usando Claude Code. Compagna: [[martina]].

## Come lavora e comunica

- Istruzioni brevi, dirette, spesso senza punteggiatura curata (anche via vocale/dettato, quindi capitano refusi tipo "P di Cloud" per "API di Claude" — va interpretato dal contesto, non preso alla lettera).
- Vuole che gli agenti **eseguano**, non solo che consiglino — massima autonomia, ma con rollout a tappe e prossimi passi chiari a fine sessione.
- Corregge attivamente e subito quando qualcosa non è preciso — prendere sul serio ogni correzione, anche minima.
- Dati/fonti particolari (es. categorie non standard in un foglio) vanno letti e riportati fedelmente, mai segnalati come "anomalie" — le regole di business mancanti si chiedono a lui, non si inventano.
- Sistemi pensati per essere riusati/copiati nel tempo, non usa-e-getta.

## Cosa non fare mai

- **Non eliminare nulla senza chiedere prima, sempre** — anche quando sembra ovvio (duplicati verificati via hash, file "vecchi"). Chiedi, aspetta il sì, poi elimina.
- **Non toccare la funzionalità del sito prenotazioni** (`salzillo-hospitality.vercel.app/`, la `/` — non `/plancia`) — è condiviso con collaboratori. Solo restyling visivo, mai logica/comportamento, e verificare sempre con un test live prima di pubblicare.
- **Non modificare/rinominare/spostare nulla in `raw/`** — è la fonte di verità immutabile.
- **Non inventare fatti** — se non è nelle fonti o non l'ha detto lui, dillo esplicitamente.
- **Non trattare le anomalie nei dati come errori da segnalare** — vedi sopra.
- **Precisione assoluta su prenotazioni/ospiti reali** — mai confondere o inventare dati quando ci sono ospiti veri in gioco.
- **Due livelli di sensibilità per le credenziali**: quelle cloud "vive" (service account, API key con accesso reale a infrastruttura) non si condividono mai in chat né si espongono online — un service account condiviso per errore va revocato subito. Le credenziali statiche di documenti personali (carte d'identità, accessi bancari, portali) restano invece in chiaro nel wiki locale per sua scelta esplicita — ma vanno **sempre omesse** dalle copie bundlate/esposte online (dashboard, bot cloud) perché quelle non hanno login.
- **Il bot Telegram locale (`bot.js`) e il webhook Vercel non devono mai girare insieme** — Telegram permette un solo modo di consegna alla volta.
- **La cartella di progetto "Il mio cervello" non si rinomina/sposta mai** — automazioni schedulate ne referenziano il path esatto.

## Se qualcosa manca o è incongruente

Chiedi direttamente a lui invece di assumere o inventare — vedi anche [[decisioni]] per il *perché* delle scelte ricorrenti prima di eseguire un'azione con effetti concreti.
