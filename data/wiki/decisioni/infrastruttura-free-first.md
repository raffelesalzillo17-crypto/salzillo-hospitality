---
titolo: Infrastruttura gratuita prima, server fisico solo quando serve davvero
tipo: decisione
tag: [decisioni, infrastruttura, costi, assistente-digitale]
fonti:
  - "conversazione diretta in Claude Code, sessione 08/09/2026"
creato: 2026-09-08
aggiornato: 2026-09-08
---

# Infrastruttura gratuita prima, server fisico solo quando serve davvero

**Decisione**: costruire ed espandere l'assistente digitale (bot Telegram, futuro WhatsApp per i clienti, futura gestione email, dashboard Motore Rafilu) sull'hosting gratuito già in uso (Vercel, piano Hobby) il più a lungo possibile. Nessun acquisto di VPS, Raspberry Pi o server fisico finché non emerge un bisogno concreto che il gratuito non può coprire.

**Perché**: Raffaele ha valutato esplicitamente l'idea di affittare un VPS economico (4-5€/mese) per "spostare tutto il sistema lì" invece di comprare un Raspberry Pi, spinto dal problema dei promemoria automatici in ritardo (vedi [[salzillo-hospitality]]). Analizzato insieme: quel problema specifico si risolve gratis (pinger esterno o, in futuro, un semplice riordino dei cron). L'ambizione più grande dichiarata — un assistente che gestisce tutto, risponde ai clienti su WhatsApp e alle email — **non richiede infrastruttura propria**: gira sullo stesso hosting serverless gratuito già usato per il bot Telegram, con lo stesso pattern (un webhook che riceve messaggi, un'IA che li elabora). L'unico vero ostacolo per WhatsApp verso i clienti è la verifica ufficiale dell'attività richiesta da Meta (burocrazia, non hosting).

**Dove un server fisico comincerà ad avere senso** (non oggi): 
- Accesso sempre attivo al wiki completo/non redatto e ai documenti veri in `raw/` (oggi disponibili solo dal PC locale, per scelta di sicurezza — vedi [[due-livelli-credenziali]]).
- Trascrizione vocale indipendente dal PC di Raffaele (oggi fatta in locale con Handy, GPU Windows).
- Se il volume d'uso crescesse al punto che i costi a consumo (Anthropic, Groq — stimati 1-4€/mese) superassero il costo fisso di un server dedicato.

**Come si applica**: prima di proporre o costruire qualunque nuova infrastruttura a pagamento (VPS, server fisico, hosting dedicato), verificare se l'hosting serverless gratuito già in uso può coprire la stessa funzione. Se sì, si costruisce lì. Solo quando uno dei tre casi sopra diventa un bisogno reale e dichiarato da Raffaele, si valuta l'investimento fisico — con la consapevolezza esplicita che spostare `raw/` online cambia il profilo di rischio dei dati sensibili (carte d'identità, credenziali bancarie) rispetto a oggi, dove restano solo sul suo PC. Non è una decisione da prendere solo perché costa poco.
