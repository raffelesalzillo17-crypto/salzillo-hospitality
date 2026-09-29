---
titolo: Architettura di Salzillo Hospitality — cosa fa, come funziona
tipo: sintesi
tag: [salzillo-hospitality, architettura, query]
fonti:
  - "codice sorgente locale, C:\\Users\\salzi\\salzillo-hospitality\\ e C:\\Users\\salzi\\plancia-raffaele\\, letto direttamente il 29/09/2026"
  - "conversazione diretta in Claude Code, sessione 29/09/2026"
creato: 2026-09-29
aggiornato: 2026-09-29
---

# Architettura di Salzillo Hospitality

Sintesi tecnica richiesta da Raffaele il 29/09/2026, scritta leggendo direttamente il codice sorgente (non solo la storia in [[salzillo-hospitality]]). Estratta il 29/09/2026 dalla pagina unica precedente, quando i due progetti sono stati divisi.

## Il business

Sistema di gestione reale delle 5 strutture ricettive di famiglia a Marcianise ([[bb-il-tulipano]], Stanza Rosa, Piano Terra, Primo Piano, Secondo Piano). Next.js su Vercel, Postgres (Neon) come fonte di verità, foglio Google `SalzilloFlow_2026` tenuto sincronizzato in parallelo.

**Modello dati** (34 tabelle): gerarchia `Proprietario → Immobile → Alloggio → Prenotazione → Ospite/Pagamenti/Schedina/Documenti`. Ogni prenotazione fotografa gli importi (lordo, commissione, cedolare, costo pulizia, utile) al momento della creazione, senza ricalcolarli mai a posteriori.

**Superfici**:
- `/nuovo` — il gestionale vero: login a ruoli, calendario drag-and-drop, prenotazioni, preventivi (PDF + WhatsApp), rendiconto proprietario, pulizie con checklist, scadenze fiscali, Alloggiati Web/Sinfonia.
- `/` — sito prenotazioni condiviso con i collaboratori (vedi [[non-toccare-sito-prenotazioni]]).
- `/soggiorna` — vetrina pubblica, richiesta diretta → preventivo, senza commissioni OTA.
- Pagine di check-in digitale per stanza, con OCR documenti (Gemini) e notifica Telegram di revisione.

**Automatismi**: sync notturno dal foglio (5:45), digest mattutino (check-in/pulizie/schedine) e serale (sync email Airbnb/Booking + eventi locali il lunedì) uniti in due soli messaggi Telegram al giorno.

**Aggiunte future note**: invio reale Alloggiati Web/Sinfonia (pronto, manca solo il primo test supervisionato), channel manager per sincronizzare i prezzi tra piattaforme (ricerca fatta, decisione di budget in sospeso), contratti di locazione generati automaticamente (da far rivedere da un legale), collegamento conti bancari reali (Enable Banking, richiede azione diretta di Raffaele), domotica/serrature smart (pianificata, mai iniziata).

## Rapporto con Plancia Raffaele

Il progetto sorella `plancia-raffaele` (vita personale di Raffaele, dashboard + bot Telegram personale) è separato da questo: repo, Vercel, database e — dal 29/09/2026 — anche wiki propri. Stesso stack e stessa filosofia (Next.js su Vercel, Postgres Neon, Gemini, cron), ambiti deliberatamente distinti: qui il lavoro (soldi, ospiti, adempimenti legali), là la vita personale. Il digest mattutino/serale resta un unico messaggio per Raffaele ma è composto da due progetti (vedi [[digest-unico-mattina-sera]]).
