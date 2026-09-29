---
titolo: Solo le festività italiane (non le sagre/eventi locali) muovono le prenotazioni
tipo: decisione
tag: [decisioni, salzillo-hospitality, prezzi, marketing]
fonti:
  - "conversazione diretta in Claude Code, sessione 16/09/2026"
  - "Booking.com, verifica dal vivo nel browser, 29/09/2026"
  - "database Postgres di produzione (salzillo-hospitality), interrogato direttamente il 29/09/2026"
creato: 2026-09-16
aggiornato: 2026-09-29
---

# Solo le festività italiane (non le sagre/eventi locali) muovono le prenotazioni

**Decisione**: per decidere quando alzare i prezzi de Il Tulipano (e in futuro delle altre strutture), contano solo le **festività italiane** — Ognissanti, Immacolata (specialmente quando cade vicino a un ponte), Natale, Capodanno — e occasionalmente i **concerti alla Reggia di Caserta**. Sagre locali, festival culturali, rassegne ed eventi simili in zona (Marcianise/Caserta/Capua/Roccamonfina) **non hanno impatto reale sulle prenotazioni**, anche quando durano settimane o vengono segnalati come "Alto impatto" dalla ricerca automatica eventi del gestionale.

**Perché**: Raffaele gestisce la struttura da anni e lo riporta come osservazione diretta e ripetuta, non teorica — corretta esplicitamente durante un'analisi di mercato che ipotizzava (sbagliando) un impatto della Sagra della Castagna IGP di Roccamonfina (ott-nov, un mese intero) sulla domanda.

**Come si applica**:
- Il calendario "Eventi in zona" (`eventi_locali` nel database, popolato da un cron settimanale che cerca eventi reali via Claude+ricerca web) resta utile come **materiale grezzo per l'analisi di Raffaele**, ma il suo campo "impatto" (Alto/Medio/Basso) **non va usato per decidere in automatico un aumento di prezzo** — non riflette la domanda reale.
- Qualsiasi proposta di pricing stagionale (mia o del sistema) deve basarsi sulle festività italiane sopra elencate, non sugli eventi locali tracciati.
- Fa eccezione un concerto specifico alla Reggia di Caserta, se grande/noto — da valutare caso per caso, non come categoria generale "eventi culturali".

## Riverifica 29/09/2026 — Raffaele segnala di nuovo poche prenotazioni

Raffaele ha richiesto una nuova analisi di mercato perché non sta ricevendo prenotazioni, chiedendo se sia un problema di domanda in zona o un problema suo. Rifatta la verifica dal vivo su Booking.com (non ho accesso al gestionale interno/foglio da questa sessione, solo al mercato pubblico):

- **L'annuncio de Il Tulipano è sano e prenotabile**: verificato per il 3-5/10 e il 10-12/10/2026 (oltre la soglia dei 15 giorni che aveva causato il buco di prenotazioni del 16/09) — nessun segno che il bug del calendario Booking chiuso sia tornato. Prezzo (€120-125/2 notti), punteggio (8,8/50 recensioni) in linea con i concorrenti diretti.
- **Domanda in zona presente, non crollata**: Orchidea1 e B&B Loretta risultavano entrambi con disponibilità residua molto bassa ("ne resta 1"/"ne restano 4") sulle stesse date, non vuoti ma nemmeno saturi — quadro coerente con quanto già osservato il 16/09.
- **Nessuna prova esterna di "carenza di domanda in zona"**: dal solo mercato pubblico non emerge un calo della domanda. I numeri reali di prenotazioni recenti sono stati poi verificati direttamente sul database di produzione (vedi sezione sotto).

**attenzione: questo contraddice quanto scritto sopra il 16/09/2026** — prima diceva che "i suoi unici rivali diretti (stesso livello di Tulipano/Rosa) sono Orchidea1 e B&B Loretta", presentandoli come concorrenza esterna indipendente. **Raffaele ha chiarito il 29/09/2026**: **Orchidea1 è di suo zio Peppe** (Salzillo Giuseppe, fratello del padre [[salzillo-luigi]]) — lo stesso zio proprietario anche dell'annuncio "Mini appartamento a Marcianise" a Via Clanio 62 (vedi [[bb-il-tulipano]], scoperto lo stesso giorno prima di questo chiarimento). Orchidea1 **non è un concorrente esterno**, è un'altra struttura di famiglia, indipendente dall'attività di Raffaele ([[salzillo-hospitality]]).

**Correzione più ampia, stesso giorno — definizione di "concorrente"**: Raffaele ha chiarito esplicitamente che per l'analisi di mercato **tutti gli alloggi di Marcianise contano come concorrenti**, non solo quelli "dello stesso livello" (la restrizione a "Orchidea1 e B&B Loretta" del 16/09 era troppo stretta). Da tenere presente in ogni futura analisi: la lista completa emersa da Booking.com per Marcianise (29/09/2026) include, oltre a Il Tulipano/Stanza Rosa: B&B Loretta, Dimora Borbonica 1, Bed and Breakfast Medaglia D'oro, Orchidea1 (di famiglia), ARQO Apartments, Maison Geraldine, Narciso Rooms, Mini appartamento a Marcianise (di famiglia), Conterraneo Hotel, Habitat modern venery, 50 Passi dal Duomo — undici strutture concorrenti dirette in totale, quasi tutte con disponibilità residua bassa ("ne resta 1") sulle date controllate, coerente con una domanda di zona presente e non in calo.

## Verifica sui dati reali 29/09/2026 — interrogato direttamente il database di produzione

Raffaele ha chiesto di verificare i numeri veri (non solo il mercato esterno), perché con le 3 nuove stanze di Via Campania avviate a settembre si aspettava almeno 2-3k€/mese di netto, contro l'~1k€/mese fatto finora con sole 2 stanze (Tulipano+Rosa). Interrogato direttamente il database Postgres di produzione (tabella `prenotazioni`, non il foglio Google che può essere in ritardo).

**Andamento netto mensile reale, tutte le strutture insieme (solo prenotazioni Attiva):**

| Mese | N. prenotazioni | Lordo | Netto proprietario |
|---|---|---|---|
| 2026-04 (parziale) | 2 | €520 | €480 |
| 2026-05 | 8 | €876 | €578 |
| 2026-06 | 12 | €982 | €637 |
| 2026-07 | 18 | €1.471 | €1.040 |
| 2026-08 | 12 | €1.715 | €1.306 |
| 2026-09 | 12 | €1.280 | €1.015 |
| 2026-10 (in corso, solo prenotazioni già acquisite) | 5 | €495 | €415 |
| 2026-11 | **0** | €0 | €0 |
| 2026-12 (già acquisite in anticipo) | 2 | €340 | €320 |

**Tre cause concrete, non "carenza di domanda in zona":**

1. **Le 3 nuove stanze (Piano Terra, Primo Piano, Secondo Piano) non possono ancora essere vendute online**: non hanno il CIN (atteso marzo-aprile 2027, vedi [[salzillo-hospitality]]), quindi non sono su Airbnb/Booking — vivono solo di passaparola. Hanno prodotto insieme solo **€360 a settembre** e **€295 a ottobre finora**. Aspettarsi 2-3k€/mese da 5 stanze quando solo 2 sono visibili online era ottimistico per questa fase: il salto arriverà quando arriva il CIN, non prima.
2. **Il canale OTA di Il Tulipano (Airbnb+Booking, l'unico dato automatico — sincronizzato dalle email di conferma, non inserito a mano) è crollato a 1 sola prenotazione in tutto settembre (€60 lordo)**, contro 3-6/mese a maggio-agosto. Coincide con la finestra in cui il calendario Booking.com restava chiuso oltre i 15 giorni (bug trovato e risolto il 16/09, vedi sopra) — chi cercava a luglio/agosto una data di settembre più di 15 giorni avanti non trovava nulla e prenotava altrove. Probabile causa diretta di quello che hai percepito come "niente prenotazioni".
3. **Novembre risulta a zero prenotazioni in ogni struttura**, ma verificato dal vivo su Booking.com (14-16/11/2026): il calendario di Il Tulipano è aperto e prenotabile, il bug non è tornato. È presto per allarmarsi (6+ settimane di anticipo, e gli ospiti di questa struttura sembrano prenotare più a ridosso della data), ma **da ricontrollare tra 1-2 settimane** se resta fermo a zero.

**Attenzione al dato "No Tax"**: la maggioranza delle prenotazioni (canale "No Tax", contanti) è inserita **a mano** da Raffaele, non sincronizzata automaticamente — se prenotazioni informali recenti non sono ancora state segnate sul sistema, settembre/ottobre potrebbero risultare più bassi di quanto siano in realtà. Il canale OTA (Airbnb/Booking) invece è automatico (sync serale dalle email Gmail) ed è il segnale più affidabile per capire l'andamento reale della domanda.
