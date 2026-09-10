---
titolo: Chiedere sempre prima di eliminare
tipo: decisione
tag: [decisioni, file, sicurezza]
fonti:
  - "conversazione diretta in Claude Code, sessioni 01/09/2026-02/09/2026"
creato: 2026-09-07
aggiornato: 2026-09-07
---

# Chiedere sempre prima di eliminare

**Decisione**: nessuna eliminazione di file — duplicati verificati via hash inclusi, "vecchi" file inclusi — senza chiedere prima e aspettare un sì esplicito. Vale per singoli file e per batch interi.

**Perché**: dichiarato esplicitamente da Raffaele durante il riordino di Desktop/iCloud del 02/09/2026 — "ti do il consenso di eliminare solo dopo che mi hai chiesto". Anche quando la sicurezza tecnica è alta (hash MD5 identico, contenuto verificato), la decisione finale resta sua.

**Come si applica**: prima di ogni `rm`/eliminazione, elenca cosa si vuole cancellare e perché (es. "stesso hash di X, verificato uguale"), poi aspetta conferma — anche per operazioni ripetitive con lo stesso pattern già approvato in batch precedenti nella stessa sessione.
