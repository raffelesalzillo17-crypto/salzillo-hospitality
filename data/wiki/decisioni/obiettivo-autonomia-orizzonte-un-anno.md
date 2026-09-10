---
titolo: Obiettivo di autonomia e orizzonte di un anno per l'ecosistema Salzillo Hospitality
tipo: decisione
tag: [decisioni, salzillo-hospitality, visione, autonomia, hardware, assistente-digitale]
fonti:
  - "conversazione diretta in Claude Code, sessione 10/09/2026"
creato: 2026-09-10
aggiornato: 2026-09-10
---

# Obiettivo di autonomia e orizzonte di un anno

**Decisione / patto dichiarato da Raffaele (10/09/2026)**: l'agente ha **un anno di tempo** (dal 10/09/2026 al 10/09/2027) per portare a maturità l'intero ecosistema — l'assistente digitale personale, il nuovo sistema property-management a database, e quello che verrà dopo. Se il risultato è "davvero valido", Raffaele compra un hardware dedicato (scelto dall'agente, con un budget concordato) e ci fa girare il sistema in locale a casa sua — passando dall'hosting cloud a un server proprio.

**Perché**: Raffaele vuole **più tempo libero nella sua vita** per i suoi interessi e hobby. Il sistema deve lavorare al posto suo. Il suo ruolo deve ridursi a **poche azioni concrete, mirate e sicure** — approvare, controllare, decidere le cose importanti — non a inserire dati, rincorrere adempimenti, coordinare via messaggi. È la stessa logica di [[piattaforma-property-management-personale]] ("il tempo umano per immobile deve tendere a zero") portata a livello di vita, non solo di singolo immobile.

**Come si applica**:
- L'agente lavora "a bomba" su questo — è un progetto prioritario, non un lavoretto tra i tanti.
- Ogni funzione si giudica anche con la domanda: "questo toglie un'azione manuale a Raffaele, o gliene aggiunge una?".
- Le azioni che restano a Raffaele vanno rese **poche, chiare e a basso rischio**: un tap di conferma, non una procedura.
- Resta valida [[infrastruttura-free-first]]: il cloud gratuito (Vercel + Neon) regge finché serve; l'hardware fisico si compra **quando il sistema è provato**, non prima, e comunque quello per far girare l'automazione 24/7 costa poco (~500€). Un hardware più costoso (per un'IA locale) è un "eventuale, più avanti" — vedi budget sotto.
- Resta valida [[architettura-dati-pronta-per-server-domestico]]: si scrive il codice già pronto a essere spostato su hardware locale (un dump Postgres è portabile).

## Budget hardware (stima 10/09/2026)

Due livelli, da non confondere:

**Livello 1 — "il sistema gira da solo 24/7, indipendente da Vercel e dal PC di Raffaele" (l'obiettivo vero)**
- Un mini PC (es. Beelink / Minisforum, Ryzen 7, 32GB RAM, 1TB NVMe) oppure un PC aziendale ricondizionato.
- **~400-600€, una tantum.** Silenzioso, ~15W, dura anni.
- Fa girare: app web + database Postgres + tutti i cron/automazioni + webhook Telegram + sync Google.
- Continua a usare l'API di Claude per le parti "intelligenti" (bot, lettura documenti, recap) — costo ~1-4€/mese, qualità piena.
- **Questo è, con ogni probabilità, tutto ciò che servirà davvero.**

**Livello 2 — "aggiungere un'IA locale sopra" (opzionale, da rivalutare tra 6-12 mesi)**
- Una macchina con molta memoria per l'inferenza: Mac Studio (M4 Max, 128GB) ~3500-4000€, oppure PC con GPU (RTX 4090 24GB) ~2800-3500€.
- Serve solo se si vuole **zero dipendenza da servizi esterni** o se un giorno i costi API diventassero rilevanti (improbabile ai volumi di Raffaele).
- Oggi un modello locale sarebbe un **downgrade di qualità** rispetto a Claude per bot/OCR/recap. Consiglio: **aspettare** — i modelli locali migliorano in fretta, e tra un anno si saprà il fabbisogno reale.

**Raccomandazione**: puntare al Livello 1 (~500€) come traguardo del primo anno. Il Livello 2 si valuta dopo, con dati d'uso alla mano.
