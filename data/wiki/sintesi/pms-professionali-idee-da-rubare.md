---
titolo: PMS professionali — cosa imparare da Krossbooking, Octorate, Smoobu, Hospitable
tipo: sintesi
tag: [salzillo-hospitality, database, pms, ricerca, proprietari, adempimenti]
fonti:
  - "ricerca web (agente dedicato), sessione 10/09/2026 — materiale pubblico: pagine funzionalità, help center, community, comparatori"
creato: 2026-09-10
aggiornato: 2026-09-10
---

# PMS professionali — cosa imparare

Ricerca fatta durante la costruzione del nuovo sistema ([[piano-migrazione-database-modello-proprietario]]), su offerta di Raffaele ("se vuoi pago un abbonamento per copiarlo"). Conclusione: **non serve pagare** — il materiale pubblico basta per estrarre i concetti. I due italiani (Krossbooking, Octorate) sono i più rilevanti perché gestiscono nativamente gli adempimenti italiani.

## In breve, per PMS

- **Krossbooking** (IT): suite PMS+ChannelManager+BookingEngine unica. Gerarchia Struttura→Camere→Prenotazioni→Ospiti→Tariffe (base + derivate). **Alloggiati Web automatico** entro 24h, traccia il **rinnovo biennale del certificato**. Imposta di soggiorno con **calcolo automatico + report trimestrali**. Planner tape-chart multi-unità con **split/merge** prenotazioni. Portale proprietari poco sviluppato pubblicamente. Prezzo ~4-6 €/unità/mese (min 3). Anche **smart lock** (KDoor, da 29 €/mese).
- **Octorate** (IT): la **gestione proprietari più completa**. Anagrafica proprietario con IBAN + dati fatturazione elettronica + associazione a proprietà. **Regole di commissione** per proprietario/proprietà/canale. **Owner Portal** con commissioni, prenotazioni, documenti, XML fattura. **Doppia fatturazione PM**: stessa prenotazione → fattura del PM verso l'ospite + ricevuta del proprietario verso l'ospite, con split commissione configurabile. Alloggiati Web + **Ross1000/portali regionali** alimentati dallo stesso check-in. Imposta di soggiorno con **codici di esenzione strutturati** (minori <10, disabili+accompagnatore, residenti, guide 1/25) + integrazione PayTourist per dichiarazione annuale. Prezzo modulare, appartamenti da ~10 €/mese (min 3).
- **Smoobu** (DE): per host indipendenti più che agenzie. **Nessun adempimento italiano nativo** (serve Chekin di terze parti). Owner statement mensile semplice. Accessi assistente **read-only gratuiti e illimitati**, limitabili a singola proprietà.
- **Hospitable** (US): focus automazione messaggi + AI. **Owner statements il modello più elaborato**: Reservation Commission Agreement con direzione del payout, commissione dopo-lo-sconto/su-payout/custom anche **per canale**, **revenue recognition** configurabile (prorata per notte / check-in / check-out), statement a voci esplicite tracciabili, workflow a stati **In Review → Published (PDF) → Paid (immutabile)**. Piano gratuito per inbox+calendario. Nessun adempimento italiano.

## Idee da rubare (concetti, non codice) — ordinate per importanza

1. **Separare "unità fisica" da "annuncio per canale"** — un'unità ha più annunci (Airbnb, Booking, diretto). Evita di riscrivere tutto quando si aggiunge un canale. *(Nostro schema oggi ha `alloggi` ma non `annunci` — da valutare se serve già o dopo.)*
2. **Regole di commissione parametriche** — tabella di accordi per proprietario/unità/canale, con la **direzione dell'incasso** esplicita (chi riceve dall'OTA: noi o il proprietario). Da lì derivano rendiconto e fatture. *(Il nostro `contratti_gestione` va in questa direzione — aggiungere la "direzione incasso".)*
3. **Pipeline adempimenti "un dato inserito una volta"**: check-in online → schedina Alloggiati (auto <24h) → flusso Ross1000/regionale → calcolo imposta di soggiorno, tutto dallo stesso inserimento ospite. È il cuore del valore.
4. **Owner statement a catena di voci esplicite**: ricavo alloggio + fee ospiti − commissione − fee fisse − tasse pass-through ± spese/rettifiche = netto proprietario, ogni riga cliccabile fino alla prenotazione. Mai un "totale netto" opaco.
5. **Stati del rendiconto**: In Revisione (editabile) → Pubblicato (PDF bloccato, condiviso) → Pagato (immutabile). Previene contestazioni. *(Il nostro `rendiconti` ha `inviato_il` — aggiungere uno stato a 3 valori.)*
6. **Revenue recognition configurabile**: decidere se una prenotazione a cavallo di due mesi si conta a check-in / check-out / prorata per notte. Impatta rendiconti e cedolare.
7. **Codici di esenzione strutturati per l'imposta di soggiorno** + tetto notti tassabili + report trimestrale + dati per la dichiarazione annuale.
8. **Certificato Alloggiati Web con scadenza tracciata** (rinnovo biennale) + soggiorni >30 giorni come eccezione (fuori invio automatico).
9. **Raggruppamento ospiti / capofamiglia**: documento richiesto solo al primo ospite del gruppo/camera. *(Già nel nostro modello: capofamiglia alla prenotazione, resto al check-in.)*
10. **Portale proprietario read-only con scope per unità** — accesso gratuito e limitato. *(Già previsto: ruolo "Proprietario" + `permessi_immobile`.)*
11. **Planner tape-chart multi-unità stile Airbnb** con drag/split/merge, vista unificata e filtri per proprietario. *(Già previsto: "vista calendario stile Airbnb".)*
12. **Tariffa base + tariffe derivate** e **piani tariffari colorati con restrizioni** (min stay, blocco arrivi/partenze, incrementi %). *(Nuovo — il nostro modello oggi non ha le tariffe come entità. Da valutare per una fase successiva: oggi Raffaele mette il lordo a mano.)*
13. **Doppia fatturazione PM** — stessa prenotazione → documento del PM verso l'ospite (commissione gestione) + documento del proprietario verso l'ospite (canone), split configurabile. Rilevante per far gestire al proprietario la cedolare sulla sua quota.
14. **Task e smart-lock guidati dalle date** — pulizie auto-generate dalle date (già previsto), codici di accesso a scadenza distinti per ospite e team pulizie. *(Smart lock: idea per il futuro, non ora.)*
15. **Guest Portal unico per prenotazione** — un link autogenerato: check-in, condizioni, istruzioni accesso, guida casa, upsell (late check-out, transfer, colazione).

Bonus a cui non avevamo pensato: verifica ospite / background check prima di dare i codici; damage protection / deposito cauzionale; parcheggio come risorsa prenotabile; monitoraggio tariffe competitor; **CIN come campo obbligatorio dell'unità** esposto ovunque; canale WhatsApp Business; modello freemium per adozione graduale.

## Impatti sul nostro schema (da valutare, non tutti subito)

- `contratti_gestione`: aggiungere `direzione_incasso` (PM | proprietario).
- `rendiconti`: `stato` a 3 valori (In revisione | Pubblicato | Pagato) invece del solo `inviato_il`.
- Regola di "revenue recognition" a livello di impostazione globale o per proprietario.
- Imposta di soggiorno: tabella `tariffe_soggiorno` + `esenzioni_soggiorno` per alloggio/comune.
- Certificato Alloggiati: campo `certificato_scade_il` sull'immobile o a livello globale, con notifica.
- Eventuale entità `annunci` (unità × canale) — probabilmente non per la v1.
- Eventuale entità `tariffe` / `piani_tariffari` — non per la v1 (oggi il lordo si inserisce a mano).
