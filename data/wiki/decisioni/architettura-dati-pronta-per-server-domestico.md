---
titolo: Scrivere l'architettura dati oggi in modo da poterla portare su un server domestico domani
tipo: decisione
tag: [decisioni, infrastruttura, architettura, salzillo-hospitality, server-domestico]
fonti:
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-09-09
aggiornato: 2026-09-09
---

# Scrivere l'architettura dati oggi in modo da poterla portare su un server domestico domani

**Decisione**: continuare a usare Google Sheets/Calendar/Drive come base dati di Salzillo Hospitality — non sostituirli oggi — ma imporre una disciplina di codice che tenga la porta aperta a una futura migrazione verso un server fisico in casa (PC dedicato, possibilmente con un'IA locale sopra), così che quel giorno sia **una sostituzione dello strato di storage, non una riscrittura dell'applicazione**:

- Ogni accesso a un servizio esterno (Sheets, Calendar, Drive) passa da un modulo di libreria dedicato, mai da chiamate dirette sparse nelle route — pattern già in uso per Sheets (`src/lib/sheets.ts`) e da estendere allo stesso modo quando arriverà uno storage documentale vero.
- Il modello dati va pensato per "entità" durature (cliente/ospite, struttura, prenotazione, documento) e non solo come righe di un foglio — così che smontare "riga di Google Sheet" e rimontare "riga di un database vero" tocchi solo lo strato di lettura/scrittura, non la logica applicativa.
- Non si costruisce oggi lo script di migrazione vero e proprio verso l'hardware fisico — sarebbe lavoro speculativo, non testabile finché quel PC non esiste. Si affronta come progetto dedicato quando l'hardware sarà reale, ma su una base di codice già pronta ad accoglierlo.

**Perché**: Raffaele ha chiarito la visione a lungo termine — un giorno un PC/server dedicato in casa, possibilmente con un'intelligenza artificiale locale sopra, come "cuore" di tutto il sistema. Vuole una struttura per cliente (anagrafica, soggiorni, pagamenti, documenti — contratto, ricevuta, schedina Alloggiati — tutti collegati e consultabili insieme), e che il giorno del passaggio non richieda di ricostruire tutto da zero: l'ideale è uno script/pacchetto pronto da installare su una chiavetta USB o un hard disk quando arriverà il nuovo PC. Ha esplicitamente chiesto di continuare a lavorare come ora (Google Sheets, niente cambiato subito) ma di iniziare già a pensare/lavorare in quella direzione.

Verificato durante questa conversazione un punto concreto che rende l'urgenza reale anche oggi, non solo in futuro: contratti e ricevute (`src/app/api/contratto`, `src/app/api/ricevuta`) vengono generati al volo e restituiti direttamente al browser — **il PDF non viene salvato da nessuna parte**, solo per i contratti resta una riga di audit trail (dati, non il file) sulla scheda "CONTRATTI". Oggi non esiste alcun posto dove "i documenti vicino alla ricevuta del contratto" di cui parla Raffaele possano stare.

**Come si applica**:
- Prossima funzione utile SUBITO, non solo in ottica futura: un'anagrafica clienti/ospiti come entità propria (non solo righe di prenotazione sparse), con uno storage reale dei documenti — Google Drive è il candidato naturale come "storage documentale" intermedio, gratuito e già nell'ecosistema in uso, dietro lo stesso tipo di modulo di libreria dedicato usato per Sheets.
- Prima di aggiungere qualunque nuova integrazione esterna, chiedersi: "questo passa da un confine di codice unico, sostituibile in blocco, o chiama l'API esterna direttamente dalla route?" Se la seconda, va rifattorizzato prima di considerarlo finito.
- Resta valida e complementare [[infrastruttura-free-first]]: l'hardware fisico si compra solo quando emerge un bisogno concreto che il gratuito non copre più — questa decisione riguarda *come si scrive il codice nel frattempo*, non *quando comprare il server*.
- Vedi [[piattaforma-property-management-personale]] per la visione più ampia di crescita (più immobili, meno tempo umano per immobile) di cui questa è la base tecnica.
