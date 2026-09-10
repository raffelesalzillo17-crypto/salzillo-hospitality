---
titolo: HostFlow 2026 — strumento di gestione prenotazioni B&B Il Tulipano
tipo: sintesi
tag: [tulipano, hostflow, prenotazioni, revenue-management, cedolare-secca]
fonti:
  - "B&B/Via Clanio (Il Tulipano)/HostFlow 2026.xlsx"
  - "B&B/Via Clanio (Il Tulipano)/HostFlow snapshots/2026-08-31.csv"
  - "raw/Conversazioni claude.ai/export-2026-08-31/ (export account claude.ai, memoria e progetti)"
creato: 2026-08-31
aggiornato: 2026-08-31
---

# HostFlow 2026 — strumento di gestione prenotazioni B&B Il Tulipano

Foglio di calcolo (originariamente Google Sheets, esportato in .xlsx) usato per [[bb-il-tulipano]] come gestionale prenotazioni e calcolo redditività. Struttura a 19 fogli con un'unica fonte dati (DATABASE) e fogli mensili che la filtrano/elaborano automaticamente.

## Architettura del foglio

- **Risposte del modulo 3**: risposte grezze di un Google Form di check-in ospiti — dati identici a DATABASE (ne è la fonte).
- **DATABASE**: log prenotazioni, unica fonte dati per tutti i calcoli (vedi tabella sotto).
- **CONFIG**: parametri di calcolo (vedi sezione dedicata).
- **GENNAIO...DICEMBRE** (12 fogli): per ciascun mese, filtrano automaticamente DATABASE (per mese/anno) e calcolano commissione, cedolare secca, netto ricevuto, costi fissi pulizie e utile reale riga per riga. Le formule usano funzioni custom di Google Sheets (`__xludf.DUMMYFUNCTION`, wrapper di `FILTER`/`INDEX`) i cui valori cache risultano vuoti nell'esportazione xlsx — servirebbe riaprire il file in Google Sheets per vedere i risultati calcolati, ma la logica di calcolo è ricostruibile dalle formule stesse (vedi sotto).
- **RECAP**: tabella riepilogativa mensile (Mese | Utile Netto | Extra Spese | Totale Nettissimo) che pesca dalla cella AD100 di ciascun foglio mensile — anch'essa vuota per lo stesso motivo.
- **EXPORT SINFONIA**: template vuoto (solo intestazioni: Data, Codice Nazione, Codice Provincia, Arrivi, Partenze, Camere) per l'esportazione verso il gestionale "Sinfonia" del Comune — nessun dato compilato (coerente con [[bb-il-tulipano]], dove il file `Sinfonia_Caserta_202602.txt.txt` risulta vuoto).
- **Alloggiati web**: template vuoto che ricalca i campi richiesti dal Portale Alloggiati Web (Data arrivo, notti, cittadinanza, generalità, documento) per 3 ospiti — nessun dato compilato.
- **Foglio7**: vuoto/non utilizzato.

## CONFIG — parametri

- **Anno**: 2026
- **Costo fisso pulizie**: €20 a prenotazione
- **Cedolare secca**: 21%
- **Commissioni per canale (OTA)**: Airbnb 18,91% — Booking 20,15% — Privato/Diretto 0%. (Nota: la commissione Booking configurata qui, 20,15%, è coerente con quella osservata nelle fatture reali 2025, vedi [[fatture-booking-tulipano]]: €829,88/€4.123,00 = 20,13%.)
- **Regola reale di trattamento fiscale per canale, confermata dall'utente in chat il 31/08/2026** (integra/corregge la formula generica sotto, che applica la cedolare a tutte le righe indistintamente): Booking e Airbnb pagano sempre la propria commissione OTA **e** la cedolare secca 21%; il canale "Privato/Diretto" (configurato ma mai effettivamente usato nel DATABASE finora) pagherebbe solo la cedolare 21%, senza commissioni; il canale "No Tax" indica invece incassi in contanti/non dichiarati ("a nero") — **niente commissioni e niente cedolare secca 21%**, perché non è reddito dichiarato. Le spese di pulizia fisse (€20/prenotazione) si scalano invece **da tutti i canali senza eccezione**, incluso "No Tax".
- **Elenco stanze configurate**: "Tulipano" e "Rosa" (il DATABASE live gestisce anche altre stanze non ancora aggiunte qui, vedi sotto). La SCIA ufficiale dichiara una capacità di 2 posti letto totali (vedi [[bb-il-tulipano]]).
- **Calendario festività italiane 2026**: elenco di date (Capodanno, Epifania, Pasqua/Pasquetta, Liberazione, Lavoratori, Repubblica, Ferragosto, Ognissanti, Immacolata, Natale, S.Stefano), presumibilmente usato per pricing dinamico stagionale.
- Un'area del foglio documenta la logica delle formule usate riga per riga nei fogli mensili: COMM.€ = Lordo × % commissione canale; CEDOLARE = Lordo × 21%; NETTO RICEVUTO = Lordo − Commissione − Cedolare; COSTI FISSI = €20 fissi a prenotazione; UTILE REALE = Netto ricevuto − Costi fissi.

## DATABASE — log prenotazioni

Le date sono salvate come seriali Excel; convertite in calendario (nessuna prenotazione precedente risulta presente nel file, il log parte da fine febbraio 2026):

| Check-in | Check-out | Notti | Ospite | Stanza | Canale | Lordo |
|---|---|---|---|---|---|---|
| 28/02/2026 | 01/03/2026 | 1 | Francesco Raimo | Tulipano | Booking | €47,00 |
| 04/03/2026 | 07/03/2026 | 3 | Ernest Kazani | Tulipano | Booking | €141,00 |
| 07/03/2026 | 08/03/2026 | 1 | Mariapia Grillo | Rosa | Privato/Diretto | €40,00 |
| 07/03/2026 | 09/03/2026 | 2 | Luisa Mula | Tulipano | Booking | €112,00 |
| 10/03/2026 | 11/03/2026 | 1 | Thomas Olin Burgess | Tulipano | Airbnb | €50,00 |
| 11/03/2026 | 13/03/2026 | 2 | Giuseppe Barese | Rosa | Privato/Diretto | €50,00 |
| 12/03/2026 | 13/03/2026 | 1 | Gina Campoli | Tulipano | Privato/Diretto | €45,00 |
| 13/03/2026 | 14/03/2026 | 1 | Mara Marietti | Tulipano | Booking | €48,00 |
| 13/03/2026 | 15/03/2026 | 2 | Piro Party | Rosa | Privato/Diretto | €60,00 |
| 17/03/2026 | 19/03/2026 | 2 | Madison Carpenter | Tulipano | Airbnb | €96,00 |
| 19/03/2026 | 21/03/2026 | 2 | Oriana | Tulipano | Privato/Diretto | €100,00 |
| 21/03/2026 | 22/03/2026 | 1 | Sonia Frammartino | Rosa | Privato/Diretto | €20,00 |
| 22/03/2026 | 25/03/2026 | 3 | Madison Carpenter | Tulipano | Airbnb | €144,00 |
| 26/03/2026 | 31/03/2026 | 5 | Madison Carpenter | Tulipano | Airbnb | €253,00 |
| 11/04/2026 | 13/04/2026 | 2 | Limatola Asia | Tulipano | Booking | €108,00 |

**Totale lordo (15 prenotazioni, 28/02–13/04/2026): €1.314,00.** Canali: 4 Booking, 4 Airbnb, 7 Privato/Diretto. Madison Carpenter compare 3 volte come ospite ricorrente. Questi dati sono successivi/paralleli alle fatture Booking già ingerite (che coprono fino a 02/2026, vedi [[fatture-booking-tulipano]]) e includono per la prima volta canale Airbnb e prenotazioni dirette con importi e nominativi ospite.

## Cartellino prezzi 2026 (riferimento incrociato)

Dal documento ufficiale "Cartellino Prezzi 2026" della Regione Campania (`Cartellino Prezzi 2026 (Regione Campania).pdf`, stampato 09/12/2025): Camera N.1 con 2 letti; bassa stagione (marzo-ottobre) €50-80; alta o unica stagione (ottobre-febbraio) €60-100; letto aggiunto €20; colazione compresa. I campi Gestore/CF/P.IVA risultano in bianco nel documento. I prezzi praticati nel log DATABASE (es. €40-50/notte per singola notte, €96-253 per 2-5 notti) sono coerenti con questa forcella.

## Sincronizzazione automatica dal Google Sheet live

Dal 31/08/2026 il foglio Google Sheets originale (non solo l'export .xlsx statico) è collegato a questo wiki tramite un link di pubblicazione web (`.../pub?output=csv`), fornito direttamente dall'utente. Un task schedulato scarica quotidianamente il CSV pubblicato e lo salva come snapshot datato in `raw/B&B/Via Clanio (Il Tulipano)/HostFlow snapshots/{YYYY-MM-DD}.csv` (mai sovrascritto, per rispettare l'immutabilità di `raw/`). Questa sezione viene aggiornata quando lo snapshot più recente contiene prenotazioni nuove rispetto all'ultimo ingest.

**Nota sul nome — confermato**: il CSV pubblicato scaricato dal task di sync riporta come nome file "SalzilloFlow2026-DATABASE.csv". Confermato il 31/08/2026 leggendo il codice sorgente del sito di Raffaele ([[salzillo-hospitality]]): è lo stesso foglio Google realmente in uso (ID `11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys`), il nome "HostFlow" è superato — il foglio/sistema si chiama ormai "SalzilloFlow 2026".

**Nota sullo schema**: il CSV pubblicato ha colonne leggermente diverse dal DATABASE dell'export .xlsx originale — manca "Notti" (ricavabile da check-in/check-out) ma aggiunge "STATO" (finora sempre "Attiva"), "PENALE €" (finora sempre vuoto) ed "EVENT_ID" (identificativo dell'evento di calendario collegato, presente sulla maggior parte delle righe più recenti). È lo stesso foglio Google Sheets, evolutosi nel tempo rispetto alla versione esportata in .xlsx.

### Snapshot 2026-08-31 — DATABASE live

60 prenotazioni valide, dal check-in 29/04/2026 al check-in 11/09/2026 (nessuna sovrapposizione con le 15 prenotazioni 28/02–13/04/2026 già note dall'export .xlsx, vedi tabella sopra — probabile aggiornamento cronologico successivo dello stesso registro). Lordo totale: **€6.453,20**.

Per stanza:

| Stanza | Prenotazioni | Lordo totale |
|---|---|---|
| Tulipano | 41 | €4.378,20 |
| Rosa | 15 | €1.605,00 |
| Stanza 4 | 2 | €150,00 |
| Stanza 5 | 1 | €100,00 |
| Stanza 3 | 1 | €220,00 |

Per canale:

| Canale | Prenotazioni | Lordo totale |
|---|---|---|
| No Tax | 44 | €5.210,00 |
| Booking | 9 | €842,20 |
| Airbnb | 7 | €401,00 |

**Osservazioni rilevanti:**

- **Stanze aggiuntive nel DATABASE live, ora spiegate**: oltre a "Tulipano" e "Rosa" (le uniche presenti nel foglio CONFIG), compaiono anche "Stanza 3", "Stanza 4" e "Stanza 5" — unità gestite tramite lo stesso foglio ma non ancora riportate in CONFIG. Un export dell'account claude.ai di Raffaele (31/08/2026) chiarisce l'origine: sono le tre nuove stanze in arrivo a settembre 2026 su Via Campania, parte dell'espansione multi-proprietà dell'attività di famiglia — vedi [[salzillo-hospitality]] per i dettagli.
- **Canale "No Tax"**: incassi in contanti/non dichiarati. Nessuna commissione OTA e nessuna cedolare secca 21% (a differenza di "Privato/Diretto", che pagherebbe comunque la cedolare); restano dovuti solo i costi fissi di pulizia (€20/prenotazione), applicati a tutti i canali senza eccezione. Regola confermata dall'utente il 31/08/2026, vedi CONFIG sopra.
- Diversi ospiti ricorrenti: Denise (4 soggiorni), Mohamed Wahabi (4), Ferraro Caterina (4), Angelo Viciglione (2), Michel Magnoli/Mahnoli (2, probabile refuso nel nome tra le due righe), Irene (2).

## Materiale fotografico

La cartella `B&B/Via Clanio (Il Tulipano)/foto/` contiene ~18 foto operative (bagno, camere, foto WhatsApp datate aprile 2024 e febbraio 2025) usate presumibilmente per gli annunci sui portali OTA, più una sottocartella `Foto modificate/` con materiale di marketing già elaborato (collage, immagine profilo, logo). Non ingerite singolarmente (materiale fotografico, nessun dato testuale/anagrafico rilevante da estrarre); disponibili in `raw/` per consultazione diretta.
