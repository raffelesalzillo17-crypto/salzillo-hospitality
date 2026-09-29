---
titolo: Un solo digest la mattina e uno la sera, composto da due progetti
tipo: decisione
tag: [decisioni, salzillo-hospitality, plancia-raffaele, telegram, digest]
fonti:
  - "conversazione diretta in Claude Code, sessioni 29/09/2026 (prima versione: digest unico dentro salzillo-hospitality; riscritta lo stesso giorno dopo la separazione dei progetti)"
creato: 2026-09-29
aggiornato: 2026-09-29
---

# Un solo digest la mattina e uno la sera, composto da due progetti

**Decisione**: Raffaele riceve esattamente **due** messaggi Telegram automatici al giorno — mattina e sera — mai un terzo, anche ora che Plancia (vita personale) e Salzillo Hospitality (affitti brevi) sono separati (vedi [[decisione-separazione-plancia-hospitality]]). Il messaggio lo invia il **bot personale** (quello di Plancia, il bot già in uso); ciascun progetto produce la propria sezione.

**Prima (stessa data, versione precedente)**: il digest era unico ma viveva dentro `salzillo-hospitality`, che includeva anche il recap personale (notizie/mercati/PAC/agenda). Era una collocazione sbagliata rispetto alla separazione voluta il giorno stesso, ed è stata invertita.

**Perché**: Raffaele vuole meno rumore (due messaggi, non tre o cinque — richiesta del 15/09 e del 29/09/2026) ma anche progetti tenuti distinti fino in fondo. Il messaggio arriva dal bot personale perché è il suo assistente principale.

**Come si applica**:
- `plancia-raffaele` (cron `digest-mattina` 06:00 e `digest-sera` 21:00 Europe/Rome, due voci UTC per ora legale/solare): compone il messaggio e lo invia col proprio bot. Mattina = recap personale (agenda, notizie, mercati, PAC — `lib/digestPersonale.ts`) + sezione B&B. Sera = sezione B&B.
- `salzillo-hospitality`: espone `GET /api/digest/sezione?tipo=mattina|sera[&dryRun=1]`, autenticato con `Authorization: Bearer $DIGEST_SHARED_SECRET` (segreto condiviso solo tra i due progetti, separato da CRON_SECRET). Non invia nulla. Sezione mattina: check-in/check-out di oggi, controllo calendari, preventivi in scadenza, pulizie di domani, schedine in scadenza. Sezione sera: sync email Airbnb/Booking, eventi locali (lunedì), schedine in scadenza. I cron `digest-mattina`/`digest-sera` sono stati tolti da `vercel.json`; le route restano per test a mano (mandano un messaggio col bot di Hospitality).
- Se la sezione B&B non risponde, il digest della mattina parte comunque con una riga "⚠️ Sezione B&B non disponibile" e arriva un alert; un digest incompleto è meglio di nessun digest.
- Il recap personale continua a fallire in silenzio se Gemini è sovraccarico (503), come già deciso.
- Variabili: `DIGEST_SHARED_SECRET` in entrambi i progetti Vercel; `HOSPITALITY_BASE_URL` in plancia-raffaele.
