---
titolo: Un solo canale attivo per il bot Telegram
tipo: decisione
tag: [decisioni, telegram, tecnico]
fonti:
  - "conversazione diretta in Claude Code, sessione 02/09/2026"
creato: 2026-09-07
aggiornato: 2026-09-07
---

# Un solo canale attivo per il bot Telegram

**Decisione**: `bot.js` (versione locale, in polling sul PC di Raffaele) e il webhook su Vercel (versione cloud, sempre attiva) non devono mai girare contemporaneamente.

**Perché**: Telegram permette un solo modo di consegna degli aggiornamenti alla volta — averli entrambi attivi crea conflitti/comportamento imprevedibile, non un semplice doppione innocuo.

**Come si applica**: dal 02/09/2026 il bot gira in produzione solo su Vercel (webhook). `bot.js` resta sul disco come riferimento/fallback ma non va avviato mentre il webhook è configurato — se in futuro serve tornare al polling locale, va prima rimosso il webhook (`setWebhook` con url vuota) lato Telegram.
