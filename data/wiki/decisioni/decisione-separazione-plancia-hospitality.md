---
titolo: Separazione totale tra Plancia Raffaele e Salzillo Hospitality
tipo: decisione
tag: [decisioni, plancia-raffaele, salzillo-hospitality, separazione, account, database, telegram]
fonti:
  - "conversazione diretta in Claude Code, sessione 29/09/2026"
creato: 2026-09-29
aggiornato: 2026-09-29
---

# Separazione totale tra Plancia Raffaele e Salzillo Hospitality

**Decisione** (Raffaele, 29/09/2026): i due progetti si tengono divisi "proprio tutto": wiki, sessioni di lavoro con Claude, codice, database, bot Telegram, account Google, email, calendari. Plancia Raffaele = vita personale. Salzillo Hospitality = tutto il mondo degli affitti brevi. Quando Raffaele dice "vai su quel progetto" si cambia interamente contesto.

**Perché**: sono due ambiti con logiche, dati e rischi diversi (i dati degli ospiti e gli adempimenti legali del B&B non devono convivere con patrimonio, scuola e vita personale), e vuole poter dire a Claude a quale dei due sta parlando. Già dal 18-19/09/2026 le tabelle Postgres erano separate (vedi `schema-db-motore-rafilu-separato`, wiki Plancia); questa decisione porta la separazione fino in fondo.

**Come si applica**:
- **Wiki**: due cartelle gemelle, ciascuna col proprio `CLAUDE.md`. Personale: `C:\Users\salzi\OneDrive\Desktop\Il mio cervello\` (non si rinomina né sposta: i task schedulati ne referenziano il path). Hospitality: `C:\Users\salzi\OneDrive\Desktop\Salzillo Hospitality\`. Un fatto va scritto nel wiki del progetto a cui appartiene.
- **Account Google**: `salzillohospitality@gmail.com` = business (foglio `SalzilloFlow_2026`, calendari prenotazioni/pulizie, email OTA Airbnb/Booking, Doc idee del B&B). `raffelesalzillo17@gmail.com` = quotidiano + pubblicità (personale, giorno per giorno). `raffaele.salzillo02@gmail.com` = quella "seria", solo cose davvero importanti.
- **Database Neon**: uno per progetto (il DB personale di Plancia passa su un Neon proprio, staccato da quello di salzillo-hospitality).
- **Bot Telegram**: un bot per progetto.
- **Digest**: Raffaele vuole comunque **un solo messaggio la mattina e uno la sera** (conferma la decisione `digest-unico-mattina-sera`) — la separazione è nei sistemi, non nei messaggi che riceve. Il messaggio unico viene composto da due sezioni, ciascuna prodotta dal proprio progetto.

**Stato attuale**: wiki e sessioni divisi il 29/09/2026. Restano da completare (vedi log): database, bot, digest, account Google.
