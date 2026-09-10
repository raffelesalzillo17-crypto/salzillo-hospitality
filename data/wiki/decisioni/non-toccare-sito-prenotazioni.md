---
titolo: Non toccare la funzionalità del sito prenotazioni
tipo: decisione
tag: [decisioni, salzillo-hospitality, sito]
fonti:
  - "conversazione diretta in Claude Code, sessioni 01/09/2026-02/09/2026"
  - "conversazione diretta in Claude Code, sessione 08/09/2026"
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-09-07
aggiornato: 2026-09-09
---

# Non toccare la funzionalità del sito prenotazioni

**Decisione**: la route `/` di `salzillo-hospitality.vercel.app` (il sito di gestione prenotazioni, distinto dalla dashboard personale `/plancia`) può essere modificata solo a livello visivo (colori, font, spaziature). Logica e comportamento restano invariati, sempre.

**Perché**: Raffaele lo condivide con collaboratori/famiglia che lo usano operativamente per il B&B — un cambiamento di comportamento inatteso rompe il loro flusso di lavoro, non solo il suo.

**Come si applica**: qualunque modifica a `page.tsx`/`globals.css` di quella route va limitata a CSS/markup visivo. Prima di pubblicare una modifica visiva, verificarla con un test live nel browser (digitare in un campo, aprire/chiudere modali) per confermare che zero logica sia cambiata — fatto già una volta con successo durante il restyling coral/Plus Jakarta Sans del 02/09/2026.

**Eccezione approvata esplicitamente (07/09/2026)**: aggiunto un campo "Telefono (facoltativo)" al form di nuova prenotazione — unica modifica di logica mai fatta a questa route, autorizzata da Raffaele in chat ("sì aggiungiamo il campo anche sul form condiviso") in vista dell'automazione del promemoria recensione post check-out, che ha bisogno del numero dell'ospite per costruire il link WhatsApp. Non un precedente generale: resta valida la regola di base, questa è un'eccezione puntuale e concordata, non una revoca della decisione.

**Seconda eccezione approvata esplicitamente (08/09/2026)**: rinominati i valori del menu a tendina stanze ("Stanza 3/4/5" → "Piano Terra/Primo Piano/Secondo Piano", vedi [[salzillo-hospitality]]). Segnalato a Raffaele prima di procedere che questo tocca la regola, ha confermato esplicitamente di volerlo comunque ("Sì, rinomina anche lì"). Verificato dal vivo nel browser dopo il deploy: dropdown corretto, zero errori console, nessuna logica cambiata oltre ai valori del dropdown. Stesso spirito della prima eccezione: puntuale e concordata, non una revoca della regola di base.

**Terza eccezione, la più grande — sistema di accessi (09/09/2026)**: durante un giro di controllo generale autonomo è emerso che `/api/cancella`, `/api/prenotazione` e `/api/prenotazioni` non avevano NESSUN controllo di autenticazione — chiunque conoscesse l'URL poteva creare o cancellare prenotazioni reali e cancellare eventi Calendar. Segnalato subito a Raffaele con 3 opzioni invece di correggere da solo (proprio per questa regola). Raffaele ha proposto un sistema con accessi individuali su Google Sheet; discusso insieme il disegno, poi ha chiarito esplicitamente: **Motore Rafilu (`/plancia`) resta per sempre e solo suo** — questo sistema riguarda solo il sito prenotazioni condiviso. Costruito: login username/password per collaboratore (non più una chiave unica condivisa), permessi granulari (può creare / può cancellare / vede dati finanziari), enforcement lato server su ogni route protetta (non solo nascondere pulsanti in UI). Vedi [[assistente-digitale-raffaele]] e `src/lib/accessi.ts` per il disegno tecnico completo. Verificato end-to-end contro la produzione reale (login corretto/sbagliato, permessi negati/concessi, filtro dati finanziari, logout) prima di considerarlo fatto. Questa non è una violazione della regola "non toccare la funzionalità" — è l'evoluzione esplicitamente concordata del suo modello di sicurezza, dato che prima non ne aveva nessuno.
