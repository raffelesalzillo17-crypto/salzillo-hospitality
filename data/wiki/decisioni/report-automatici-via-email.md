---
titolo: Report automatici via email — analisi di mercato settimanale e rendiconto mensile
tipo: decisione
tag: [decisioni, salzillo-hospitality, email, automazione, report]
fonti:
  - "conversazione diretta in Claude Code, sessione 29/09/2026"
creato: 2026-09-29
aggiornato: 2026-09-29
---

# Report automatici via email — analisi di mercato settimanale e rendiconto mensile

**Decisione**: due nuovi report PDF automatici inviati via email a `salzillohospitality@gmail.com`:
- **Ogni sabato alle 8:00**: un'analisi di mercato (occupazione/andamento reale delle 5 strutture + quadro di mercato in zona + suggerimenti).
- **Il primo di ogni mese alle 8:00**: un'unica email con il rendiconto "tutti gli immobili" più un PDF separato per ciascun proprietario esistente (oggi Salzillo Luigi e Raffaela Iodice, cresce da solo con nuovi proprietari futuri).

**Perché**: Raffaele vuole un momento fisso per rivedere prezzi/occupazione senza doverlo chiedere, e ricevere il rendiconto mensile senza aprire il pannello `/nuovo`.

**Come si applica — scelta tecnica discussa e approvata da Raffaele**: l'analisi di mercato NON fa scraping diretto di Booking.com in automatico ogni settimana — troppo fragile (rischio concreto di essere bloccati dal sito, romperebbe il report in silenzio). Combina invece due fonti:
1. **Dati reali** dal database di produzione: occupazione nei prossimi 45 giorni, prenotazioni/lordo ultimi 30 giorni, canale OTA ultimi 90 giorni, per ciascuna delle 5 strutture.
2. **Ricerca di mercato fatta da un'IA** (Gemini con accesso a Google, stesso meccanismo già usato per gli eventi locali in `assistente-digitale-raffaele` (wiki Plancia)) — non un dato letterale, va letto come materiale di supporto.

I suggerimenti nel PDF devono sempre rispettare le decisioni già salvate (in particolare [[solo-le-festivita-italiane-muovono-le-prenotazioni]] — non basarsi su sagre/eventi locali per il pricing).

**Prerequisito tecnico**: serviva ampliare i permessi del collegamento Gmail esistente (prima solo lettura, ora anche invio) — nuova autorizzazione one-time di Raffaele via `/api/oauth/gmail-start`, il refresh token risultante sostituisce `GMAIL_REFRESH_TOKEN` su Vercel.

**Verifica**: la generazione dei PDF di rendiconto è stata testata in locale contro i dati reali del database (3 PDF generati correttamente, mandati a Raffaele per controllo visivo). La parte di ricerca IA (Gemini) non è testabile in locale — la chiave è una variabile "Sensitive" su Vercel, illeggibile anche da CLI — ma riusa lo stesso meccanismo già in produzione nel digest e negli eventi locali.
