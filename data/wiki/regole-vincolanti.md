---
titolo: Regole vincolanti — Hospitality
tipo: overview
tag: [regole, meta, hospitality]
fonti:
  - "conversazione diretta in Claude Code, sessioni 31/08/2026-29/09/2026 (regole già in wiki/chi-sono.md del wiki gemello, ripartite il 29/09/2026)"
creato: 2026-09-29
aggiornato: 2026-09-29
---

# Regole vincolanti — Hospitality

Cosa non fare mai quando si lavora sul business (B&B, prenotazioni, ospiti). Le regole sulla persona di Raffaele e sul suo stile di comunicazione sono nel wiki Plancia (pagina `chi-sono`).

- **Non eliminare nulla senza chiedere prima, sempre** — vedi [[chiedere-prima-di-eliminare]].
- **Non toccare la funzionalità del sito prenotazioni** (`salzillo-hospitality.vercel.app/`, la `/` — non `/nuovo`, non `/soggiorna`): condiviso con i collaboratori, solo restyling visivo, mai logica, sempre test live prima di pubblicare — vedi [[non-toccare-sito-prenotazioni]].
- **Precisione assoluta su prenotazioni e ospiti reali** — mai confondere o inventare dati quando ci sono ospiti veri in gioco.
- **Dati "strani" nel foglio prenotazioni non sono errori da segnalare**: si leggono e si riportano fedelmente; le regole di business mancanti si chiedono a Raffaele, non si inventano.
- **Solo Il Tulipano va trasmesso ad Alloggiati Web/Sinfonia** — vedi [[solo-tulipano-va-inviato-ad-alloggiati-e-sinfonia]].
- **Credenziali su due livelli** — vedi [[due-livelli-credenziali]]. Un service account condiviso per errore va revocato subito.
- **Non modificare/rinominare/spostare nulla in `raw/`.**
- **Non inventare fatti.**
- **Deploy in produzione**: fix → verifica → commit → push → deploy su `salzillo-hospitality` è già autorizzato, non fermarsi a chiedere se non per blocchi tecnici reali. Attenzione: `vercel deploy --prod` pubblica lo stato reale della cartella di lavoro, non solo l'ultimo commit — isolare (stash/commit a parte) le modifiche non correlate prima di un deploy mirato.
- **Prima di dichiarare "perso" qualcosa**: controllare `git log --all` e i progetti sorella (incluso `plancia-raffaele`).
- **Progetti separati**: nulla di personale in questo wiki; nulla del B&B nel wiki personale — vedi [[decisione-separazione-plancia-hospitality]].
