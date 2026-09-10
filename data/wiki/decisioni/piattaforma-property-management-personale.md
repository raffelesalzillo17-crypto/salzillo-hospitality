---
titolo: Motore Rafilu come piattaforma di property management, non solo dashboard personale
tipo: decisione
tag: [decisioni, salzillo-hospitality, motore-rafilu, visione, crescita]
fonti:
  - "conversazione diretta in Claude Code, sessione 08/09/2026"
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-09-08
aggiornato: 2026-09-09
---

# Motore Rafilu come piattaforma di property management, non solo dashboard personale

> **attenzione: chiarimento importante (09/09/2026)** — la formulazione originale di questa pagina (sotto) prevedeva Motore Rafilu stesso come eventualmente condivisibile con proprietari/staff. Raffaele ha chiarito esplicitamente il 09/09/2026: **Motore Rafilu (`/plancia`) resterà per sempre e solo suo** ("motore raffiguro... resterà per sempre solo di mia proprietà e quindi lo userò per sempre solo io"). Non è una revoca dell'ambizione di crescita sotto — è una precisazione su *dove* vive la condivisione: non dentro Motore Rafilu, ma in strumenti separati e dedicati per chi non è Raffaele. Il primo di questi è già costruito: il sistema di login/permessi per collaboratori sul sito prenotazioni condiviso (`salzillo-hospitality.vercel.app/`, non `/plancia` — vedi [[salzillo-hospitality]] e la terza eccezione in [[non-toccare-sito-prenotazioni]]). Il resto di questa pagina va letto con questa correzione: dove si legge "Motore Rafilu" come superficie condivisa, va inteso come "l'ecosistema salzillo-hospitality nel suo complesso", di cui Motore Rafilu è e resta la sola parte privata di Raffaele.

**Decisione**: l'ecosistema software costruito attorno al B&B di Raffaele (di cui Motore Rafilu, `/plancia`, è il centro di controllo privato) non va pensato come un semplice strumento personale, ma come il primo nucleo di una **vera piattaforma di property management** — con l'ambizione dichiarata di poter in futuro dare accesso mirato a più tipi di persone (collaboratori, eventualmente proprietari di altri immobili, personale delle pulizie), ciascuno con accesso solo alla propria parte, **tramite superfici dedicate e separate da Motore Rafilu**, non tramite Motore Rafilu stesso. Ogni nuova funzione va valutata anche con questa lente, non solo "serve a Raffaele oggi".

**Perché**: l'obiettivo dichiarato da Raffaele non è "avere un buon gestionale per due stanze" ma costruire libertà finanziaria attraverso la crescita — acquisizione di nuovi immobili nel tempo. Se ogni nuovo immobile aggiunto richiede proporzionalmente più tempo-uomo di Raffaele (più schedine da compilare a mano, più prezzi da aggiornare piattaforma per piattaforma, più checklist da coordinare via messaggi), la crescita si autolimita: non potrà mai gestire "tanti immobili" restando incollato al computer. Il software deve essere la leva che rompe questo limite — non un semplice registro di quello che già fa a mano.

Da qui discende anche il vincolo esplicito di Raffaele: quel che resta manuale deve restare **davvero minimo**, l'eccezione mai la norma. Non "automatizziamo quello che è comodo automatizzare", ma "il tempo umano per immobile gestito deve tendere a zero man mano che si cresce".

**Come si applica**:
- Prima di costruire una nuova funzione, chiedersi non solo "risolve un problema di oggi" ma anche "regge se domani ci sono 5 immobili invece di 2, e altre persone oltre a Raffaele la usano". Se una scelta tecnica funziona solo perché c'è un'unica struttura o un solo utente (es. nomi di stanza hardcoded nel codice invece che dati), va segnalata come debito da risolvere quando si affronta la crescita, non ignorata.
- Quando si valuta se automatizzare qualcosa che oggi Raffaele fa a mano, il criterio guida è: "questo aumenta o riduce il tempo umano per immobile gestito?" — non solo "costa poco/è comodo".
- Un passaggio manuale può restare tale solo se: (a) è genuinely a basso volume/basso rischio se automatizzato male (vedi es. l'invio vero delle schedine ad Alloggiati Web, lasciato manuale apposta per il rischio di sanzione — [[salzillo-hospitality]]), oppure (b) richiede giudizio umano che non ha senso delegare (es. decidere se acquistare un nuovo immobile). Mai lasciato manuale solo perché "non c'è stato tempo di automatizzarlo".
- Questa decisione non impone di costruire subito il multi-utente/i permessi per proprietari e staff — impone di **non precludere** quella direzione con scelte tecniche miopi fatte oggi. Vedi [[salzillo-hospitality]], sezione "Idee per il prossimo giro" per una prima scomposizione in fasi.
- Primo passo concreto già fatto (09/09/2026): accessi individuali (username/password, permessi granulari) per i collaboratori sul sito prenotazioni condiviso — **non** dentro Motore Rafilu, che resta privato. Ogni prossimo passo in questa direzione va costruito allo stesso modo: superficie separata, mai un varco dentro `/plancia`.
- Resta valida e complementare [[infrastruttura-free-first]]: crescere in ambizione del prodotto non significa spendere in infrastruttura finché il gratuito la regge.
