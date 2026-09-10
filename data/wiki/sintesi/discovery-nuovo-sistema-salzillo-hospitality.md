---
titolo: Discovery — cosa deve fare il nuovo sistema Salzillo Hospitality (intervista a Raffaele)
tipo: sintesi
tag: [salzillo-hospitality, database, discovery, requisiti, proprietari]
fonti:
  - "conversazione diretta in Claude Code, sessione 10/09/2026 (Raffaele: «fammi tutte le domande che ti servono, fammi tutte le proposte, io sono ignorante in materia»)"
creato: 2026-09-10
aggiornato: 2026-09-10
---

# Discovery — cosa deve fare il nuovo sistema

Documento di lavoro. Raffaele risponde sezione per sezione; man mano che risponde, le risposte entrano qui e il [[piano-migrazione-database-modello-proprietario]] si aggiorna di conseguenza. Nel frattempo il sistema attuale (Google Sheet, senza login dal 10/09) resta in uso finché il nuovo non è pronto e testato al 100%.

Vincolo trasversale dichiarato da Raffaele: **tutto dev'essere leggibile da un umano — niente codici strani, numeri strani, sigle**. Vedi sezione 1.

### Risposte già date (10/09/2026)

**Primo giro:**
- **Accesso proprietario**: entrambe le cose — rendiconto automatico per tutti + login proprietario in sola lettura, il login si aggiunge in un secondo momento.
- **Fee di gestione**: percentuale sul lordo, impostata **per immobile** (può variare per proprietario). Oggi sono tutti immobili di famiglia → percentuale a **0%**, ma il campo esiste già così in futuro basta cambiarlo senza toccare il sistema.
- **Crescita**: non prevedibile — progettare per scalare ma senza forzare numeri.
- **Interfaccia**: **dashboard + sezioni** — una home con il riepilogo del giorno, poi sezioni separate per area (prenotazioni / soldi / pulizie / documenti / proprietari).

**Secondo giro:**
- **"No Tax"** = affitto senza dichiarazione fiscale (fuori dai portali, nessuna cedolare). Il calcolo attuale è giusto: solo −20€ di pulizia. Resta un "canale" nell'elenco.
- **Regime fiscale per alloggio, configurabile e che cambia nel tempo.** Via Campania (Piano Terra/Primo/Secondo) oggi va trattata come "No Tax" (documentazione e CIN in attesa); quando il CIN sarà pronto passerà al regime "con cedolare" come il Tulipano. → Ogni alloggio ha un campo "regime fiscale attuale"; ogni prenotazione **salva** commissione/cedolare/pulizia com'erano al momento (le prenotazioni vecchie non cambiano quando il regime dell'alloggio cambia).
- **Costo pulizia configurabile per alloggio** (default 20€; gli appartamenti di Via Campania costeranno di più). È un costo di Raffaele, riduce l'utile.
- **Ospiti storici**: importare **tutti** (46) — lo storico completo serve per riconoscere un ospite che torna.
- **Immobili e proprietari (dal wiki, da confermare con Raffaele)**: Via Clanio 60 (Tulipano + Rosa) — SCIA e notifica sanitaria intestate a [[salzillo-luigi]] (padre), immobile in comproprietà tra Salzillo Giuseppe/Angelo/Luigi. Via Campania 36 — proprietà [[iodice-giovanna]] e famiglia Iodice (zie materne). Raffaele è il gestore di entrambi, non intestatario.

**Terzo giro:**
- **Pagamenti**: sì, tracciare **caparra + saldo** per prenotazione — importo caparra, data, quanto manca, se saldato. Serve soprattutto per diretto/No Tax dove l'incasso lo gestisce Raffaele.
- **Foto documenti d'identità**: si **cancellano subito** dopo che la schedina è compilata e trasmessa. Si tengono solo i dati testuali. **Ma**: appena disponibili sul portale Alloggiati, si **scaricano le ricevute di trasmissione e si conservano per sempre** (da verificare il periodo di conservazione previsto dalla legge — probabilmente vanno tenute come prova di adempimento).
- **Contratti e ricevute PDF**: **salvati e ritrovabili** in una cartella per ospite su Drive, accessibili dalla scheda ospite/prenotazione.
- **Dashboard mattutina — mostra tutto e quattro**: chi arriva/parte oggi e domani · incassato e utile del mese (per immobile) · cosa manca (schedine da trasmettere, pulizie, documenti, scadenze) · occupazione attuale e prossimi giorni.

**Quarto giro:**
- **Struttura proprietari/immobili**: Raffaele conferma l'impianto ma vuole correggere qualche dettaglio — *in attesa della sua correzione scritta*. Ipotesi da correggere: Via Clanio 60 → proprietario "Salzillo Luigi"; Via Campania 36 → proprietario "Famiglia Iodice".
- **Pulizie**: **più persone** addette, ognuna con un accesso limitato (vede solo il calendario pulizie e le sue checklist).
- **Google Calendar**: **un calendario per immobile** (così si possono condividere separatamente, es. col proprietario).
- **Categorie di spesa**: **lista fissa** (utenze, manutenzione, prodotti pulizia, commercialista, tasse, arredamento, marketing, ...) **+ possibilità di aggiungerne** di nuove quando servono.

**Quinto giro — rapporto coi proprietari:**
- **Contratto di gestione**: da **tracciare E generare** dal sistema (come i contratti ospiti) — estremi (chi, %, da quando, condizioni) + documento.
- **Rendiconto mensile proprietario**: **entrambe le forme** — PDF pulito pronto da mandare + pagina web sempre consultabile dal proprietario.
- **Spese anticipate da riaddebitare al proprietario**: oggi no, ma **prevedere il campo** ("spesa da rimborsare", finisce nel rendiconto) per quando si gestiranno immobili di terzi.

**Sesto giro — pulizie, scadenze, viste:**
- **Pulizia collegata alla prenotazione**: sì — il sistema crea la pulizia in automatico a ogni check-out (si vede "pulizia dopo il check-out di X, prima del check-in di Y").
- **Niente checklist spuntabile.** Le pulizie le vedono gli addetti (oggi Lella, in futuro forse assunzioni). Serve solo: un messaggio con eventuali "cose da ricordare" (non una checklist) + **un unico tasto "pulizia terminata, stanza pronta"** che l'addetto preme per confermare.
- **Scadenze**: alcune legate all'immobile (es. "rinnovo CIN Via Campania"), alcune generali (es. "commercialista"). Il sistema distingue.
- **Grafici**: scelta libera per i report; **ma la vista chiave che Raffaele vuole è un CALENDARIO stile Airbnb** — griglia di giorni, una riga per alloggio, barre colorate per prenotazione/ospite, click sulla barra → dettaglio prenotazione. (Raffaele manderà uno screenshot di Airbnb come riferimento.)

**Settimo giro — crescita, invii ufficiali, stati:**
- **Tipo di crescita**: non prevedibile (immobili propri e/o di terzi) — il sistema deve reggere entrambe.
- **Invii ufficiali per alloggio**: ogni alloggio ha impostato cosa gli compete ("trasmette ad Alloggiati sì/no", "imposta di soggiorno del comune X sì/no"). Il sistema prepara solo ciò che serve per quell'alloggio.
- **Invio schedine (`Send`)**: **sempre manuale con conferma**, mai automatico (rischio sanzioni). MA il sistema deve **avvisare** (notifica dedicata / promemoria dal bot) quando una schedina è da inviare, tenendo conto della scadenza di legge: **6 ore per i soggiorni di 1 notte, 24 ore per quelli più lunghi** (da verificare il testo esatto della norma).
- **Stati prenotazione**: Attiva · Cancellata · Cancellata con penale · **No-show** · **In attesa di conferma**.

**Ottavo giro — ospiti multipli, bot, email, documenti:**
- **Prenotazione con più ospiti**: alla prenotazione basta il **capofamiglia**; gli altri ospiti li raccoglie il modulo di **check-in online** (servono per le schedine).
- **Bot Telegram**: resta **solo di Raffaele** — legge/scrive sul database ma è collegato alla sua sola chat. Proprietari e collaboratori non lo usano.
- **Lettura automatica email prenotazioni**: si mantiene **e si migliora** — provare a rendere più automatico anche Booking (oggi solo alert), non solo Airbnb.
- **Documenti generabili**: contratto ospite · ricevuta · **preventivo** (per diretto / No Tax) · **fattura/ricevuta per il diretto** · **conferma di prenotazione per l'ospite** · **rendiconto proprietario** (mensile).

### Struttura proprietari — confermata (10/09/2026)

- **Via Clanio 60** (Il Tulipano + Stanza Rosa) → proprietario **Salzillo Luigi** (padre di Raffaele, [[salzillo-luigi]] — dati completi nel wiki locale 🔒, intestatario SCIA e notifica sanitaria).
- **Via Campania 36** → intestataria attuale **Raffaela Iodice** (madre di Raffaele, [[raffaela-iodice]], detta "Lella" — è anche la persona che oggi fa le pulizie). Dati nel wiki.
- Raffaele è il **gestore** di entrambi, non l'intestatario.

### Vista calendario (riferimento: Airbnb "Modifica calendario")

Raffaele ha inviato uno screenshot del calendario Airbnb (PDF, solo immagine). Vista richiesta: **griglia di giorni** (colonne) × **alloggi** (righe), ogni prenotazione è una **barra colorata** che copre le notti del soggiorno con il nome dell'ospite; **click sulla barra → scheda completa della prenotazione**. È la vista "tutti gli annunci" di Airbnb. Da confermare i dettagli fini con Raffaele quando si costruisce.

### Dettagli minori (default assunti)
Campo "metodo di pagamento" e allegato scontrino sulle spese → sì, entrambi opzionali. Email ospite → campo opzionale. I 4 ruoli (titolare/collaboratore/proprietario/pulizie) → assunti sufficienti.

### Vincoli non negoziabili (10/09/2026)
- **Grafica invariata**: stessa identità visiva già in uso e apprezzata da Raffaele — il look di Motore Rafilu / pagine check-in (gradiente corallo→magenta `--coral #FF5A5F`, card pulite, `--font-display` per i titoli). Vale per ogni nuova schermata: dashboard, calendario, pannelli proprietario, tutto. Non si cambia stile.
- **Poche azioni per Raffaele**: ogni flusso deve ridurre, non aumentare, le azioni manuali che restano a lui — vedi [[obiettivo-autonomia-orizzonte-un-anno]].

### PMS professionali come riferimento (proposta dell'agente)
Raffaele ha offerto di pagare l'abbonamento a un gestionale professionale per copiarne struttura e funzioni. Proposta dell'agente: **non serve pagare adesso** — studio 2-3 PMS di riferimento (inclusi gli italiani **Krossbooking** e **Octorate**, che gestiscono nativamente Alloggiati Web + portali regionali tipo Sinfonia + imposta di soggiorno + cedolare) da materiale pubblico, demo e prove gratuite, ed estraggo le idee buone. Un abbonamento a pagamento solo se emerge qualcosa di specifico non visibile altrimenti (probabile candidato: un PMS italiano per vedere in pratica la gestione degli adempimenti).

---

## 1. Come deve "leggersi" il database

**Proposta.** Un database vero non è per forza pieno di codici. Regole che propongo di imporre:

- **Ogni cosa ha un nome leggibile, non un codice.** Un immobile è "Via Campania 36 — Piano Terra", non "IMM-003". Un canale è "Airbnb", non "1". Uno stato è "Attiva" / "Cancellata", non "A"/"C".
- **Gli identificatori tecnici esistono ma non si vedono mai.** Ogni riga ha un id interno (serve al database per collegare le cose), ma nell'interfaccia e nei report non compare mai: si vedono i nomi.
- **I codici ufficiali obbligatori per legge** (i codici Alloggiati Web per stato di nascita, tipo documento, ecc.) restano *dietro le quinte*: l'operatore sceglie "Italia", "Carta d'identità" da un menu; il codice `100000100` lo mette il sistema da solo quando serve trasmettere.
- **Le date sono sempre in formato italiano** (30/12/2026), gli importi sempre in euro con la virgola.
- **Ogni schermata risponde a una domanda in italiano**: "Chi arriva questa settimana?", "Quanto ho guadagnato a settembre con Via Campania?", "Quali documenti mancano?".

**Domande:**
1a. Questa impostazione ti va? C'è qualcosa che vuoi *sempre* vedere o *mai* vedere?
1b. Preferisci un'unica interfaccia (come Motore Rafilu oggi) oppure sezioni separate e nette, una per area (prenotazioni / soldi / pulizie / documenti)?

---

## 2. Struttura: proprietari, immobili, alloggi

**Chiarimento su "un database per alloggio / per proprietario".** In un database vero non servono file separati: c'è *un solo* database, ma dentro ha una tabella "proprietari" e una tabella "immobili", e tutto è collegato. La separazione che vuoi si ottiene così: ogni immobile ha la sua pagina, i suoi numeri, i suoi documenti, i suoi ospiti — filtrati automaticamente. È come avere un archivio unico ma con un cassetto etichettato per ogni immobile. Più pulito e più sicuro che avere davvero database separati (che poi non "parlano" tra loro).

**Proposta di struttura a 3 livelli:**

- **Proprietario** — la persona (o società) che possiede l'immobile. Es. "Raffaele Salzillo", "Giovanna Iodice".
- **Immobile** — l'edificio/unità immobiliare con un indirizzo e un regime fiscale. Es. "Via Clanio 60", "Via Campania 36".
- **Alloggio** (stanza / appartamento affittabile) — quello che prenoti davvero. Es. "Il Tulipano", "Stanza Rosa", "Piano Terra".

Un proprietario può avere più immobili; un immobile più alloggi.

**Domande:**
2a. Oggi: Via Clanio 60 (Tulipano + Rosa) e Via Campania 36 (Piano Terra, Primo, Secondo). Chi è il **proprietario** di ciascuno dei due immobili? (dalle note wiki: Via Campania è di [[iodice-giovanna]] e altri — confermi? Via Clanio?)
2b. I 5 alloggi attuali hanno i nomi giusti così? Vuoi rinominarli?
2c. Quando prendi in gestione un immobile di un altro proprietario, quali dati suoi ti servono nel sistema? (nome, codice fiscale, IBAN per i bonifici, email, telefono, altro?)
2d. Ci sono immobili che gestisci **già oggi** per altri e che non sono nel sistema?

---

## 3. Il tuo business come property manager

Questa sezione definisce i calcoli sui soldi. È la parte in cui solo tu hai le risposte.

**Proposta di modello.** Per ogni prenotazione il sistema calcola una "cascata":

```
Lordo incassato
 − commissione OTA (Airbnb 18,91% / Booking 20,15% / Diretto 0)
 − cedolare secca 21%
 − costo pulizia (€20)
 − la TUA fee di gestione (da definire)
 = netto che spetta al proprietario
```

Per i tuoi immobili, "netto proprietario" = il tuo guadagno. Per immobili di altri, è quello che gli bonifichi.

**Domande:**
3a. **Come ti paghi** quando gestisci per altri? Percentuale sul lordo? Sull'utile? Importo fisso a prenotazione? Un misto?
3b. La **cedolare** per un immobile di un altro: la paghi tu (e la scali) o la paga direttamente il proprietario?
3c. Il **costo pulizia €20**: è sempre €20 per tutti gli alloggi? Lo paghi tu o l'ospite (voce a parte)? Cambia per gli appartamenti più grandi di Via Campania?
3d. Fai (o farai) un **contratto di gestione** con i proprietari? Se sì, il sistema deve tenerne traccia / generarlo?
3e. Vuoi che il sistema produca un **rendiconto mensile per proprietario** ("questo mese il tuo immobile ha incassato X, ti spetta Y") pronto da mandare?
3f. Ci sono **spese** che riaddebiti al proprietario (manutenzione, lavanderia, consumi)? Vanno tracciate per poterle mettere nel rendiconto?

---

## 4. Ospiti

**Proposta.** Un ospite è una persona reale con una scheda: nome, cognome, contatti, e lo storico di tutti i suoi soggiorni + i suoi documenti in un posto solo. Se torna, lo riconosci.

**Domande:**
4a. Oggi in "OSPITI" il nome è un campo unico ("Mario Rossi"). Nel nuovo lo divido in **nome** e **cognome** (serve per le schedine). Ok?
4b. Quali contatti vuoi tenere per ogni ospite? (telefono sempre; email? da dove arriva — Airbnb non lo dà)
4c. Vuoi una nota tipo "ospite problematico" / "ottimo ospite" per ricordartene la volta dopo?
4d. Gli ospiti storici (46 in archivio, molti senza telefono) — li portiamo tutti nel nuovo o si parte "puliti" dalle prenotazioni recenti?

---

## 5. Prenotazioni

**Proposta.** Una prenotazione collega: un alloggio + un ospite + date + canale + soldi + stato. In più vorrei aggiungere il **codice di conferma** del canale (il codice Airbnb/Booking della prenotazione), che oggi non salviamo — serve per ritrovare la prenotazione sulla piattaforma.

**Domande:**
5a. I canali sono Airbnb / Booking / Diretto / No Tax. "**No Tax**" cosa indica esattamente? (prenotazione fuori dai portali senza cedolare? un ospite tuo/di famiglia?) — serve capirlo per i calcoli.
5b. Tieni traccia dei **pagamenti**? Caparra, saldo, chi ha pagato cosa e quando? O il denaro lo gestisci fuori dal sistema?
5c. Le **cancellazioni**: oggi c'è "cancellata" e "cancellata con penale". Ti basta, o vuoi anche "no-show", "modificata", "in attesa di conferma"?
5d. Una prenotazione può avere **più ospiti** (famiglia, gruppo). Vuoi registrarli tutti fin dalla prenotazione, o basta il capofamiglia + gli altri arrivano col check-in?
5e. Vuoi un campo **note libere** per prenotazione (richieste speciali, orario di arrivo, ecc.)?

---

## 6. Pulizie

**Proposta.** Ogni pulizia è legata alla prenotazione che la genera (check-out → pulizia → check-in successivo), con la checklist, chi l'ha fatta, quando.

**Domande:**
6a. Oggi la pulizia è collegata solo a "data + stanza". Vuoi che sia legata alla **prenotazione** (così vedi "pulizia dopo Mario Rossi")?
6b. Chi fa le pulizie? (Lella? altre persone?) Vuoi che ognuna abbia un accesso per spuntare la propria checklist dal telefono?
6c. La checklist a 7 voci va bene per tutti gli alloggi o gli appartamenti di Via Campania ne hanno una diversa?
6d. Il costo della pulizia (chi la fa, quanto le dai) va tracciato come spesa?

---

## 7. Documenti

**Proposta.** Ogni documento (foto carta d'identità, contratto PDF, ricevuta PDF) è un file salvato su Google Drive, con una scheda nel database che dice: di che ospite/prenotazione è, che tipo è, quando è stato caricato. Oggi **i PDF di contratti e ricevute non vengono salvati da nessuna parte** — si generano e spariscono.

**Domande:**
7a. Vuoi che contratti e ricevute vengano **salvati** (in una cartella per ospite su Drive) e ritrovabili dalla scheda dell'ospite?
7b. Le **foto dei documenti d'identità** raccolte col check-in: le conservi (quanto tempo?) o si cancellano dopo aver compilato la schedina? (c'è un tema privacy — meno si tiene meglio è)
7c. Vuoi generare anche altri documenti? (fattura per il diretto, conferma di prenotazione per l'ospite, rendiconto per il proprietario)

---

## 8. Spese

**Domande:**
8a. Oggi una spesa ha: data, categoria, descrizione, importo, struttura. Va bene o aggiungiamo qualcosa? (chi ha pagato, metodo di pagamento, allegato scontrino?)
8b. Le categorie di spesa quali sono? (utenze, manutenzione, prodotti pulizia, commercialista, tasse, arredamento...) — vuoi una lista fissa o campo libero?
8c. Una spesa può essere "di un immobile" o "generale" (es. il commercialista è per tutto). Confermi che serve questa distinzione?

---

## 9. Scadenze fiscali

**Domande:**
9a. Le scadenze oggi non sono legate a un immobile. Con più immobili/proprietari, alcune scadenze sono per-immobile (es. imposta di soggiorno di un comune, rinnovo CIN)? O restano tutte generali?
9b. Vuoi che il sistema calcoli da solo certe scadenze (es. "versamento cedolare" a partire dagli incassi) o le inserisci a mano come promemoria?

---

## 10. Chi usa il sistema (per il futuro, non ora)

Ora il sistema è senza login. Quando il nuovo sarà pronto, torna un accesso — ma fatto bene.

**Proposta di ruoli:**
- **Tu (titolare)** — vedi e fai tutto.
- **Collaboratore** — vede/gestisce le prenotazioni degli immobili che gli assegni; vedi/non vede i numeri finanziari a scelta tua.
- **Proprietario** — vede *solo* il suo immobile: prenotazioni, calendario, rendiconto, documenti. Non vede gli altri, non vede i tuoi margini se non vuoi.
- **Pulizie** — vede solo il calendario pulizie e le sue checklist.

**Domande:**
10a. Questi 4 ruoli coprono tutto? Ne manca qualcuno?
10b. Un **proprietario** deve poter entrare da solo a guardare, o gli mandi tu un report e basta? (cambia parecchio il lavoro)
10c. Motore Rafilu (`/plancia`) resta comunque solo tuo, giusto? (per [[piattaforma-property-management-personale]] sì)

---

## 11. Cosa vuoi vedere — report e dashboard

**Domande:**
11a. Le 3 domande a cui vuoi che il sistema risponda in 2 secondi appena lo apri, quali sono?
11b. Report ricorrenti che ti servono: mensile per proprietario? riepilogo tuo mensile/annuale? occupazione per alloggio? confronto tra immobili?
11c. Vuoi grafici (andamento incassi, occupazione) o ti bastano i numeri in tabella?

---

## 12. Check-in, Alloggiati Web, Sinfonia

Regola già fissata: [[solo-tulipano-va-inviato-ad-alloggiati-e-sinfonia]] — solo Tulipano su Airbnb/Booking/Diretto viene davvero trasmesso.

**Domande:**
12a. Con più immobili, questa regola cambia? Ogni immobile avrà i suoi obblighi (Alloggiati, imposta di soggiorno del suo comune). Vuoi che il sistema sappia, per ogni alloggio, "questo va trasmesso / questo no"?
12b. L'invio vero (`Send`) resta manuale e supervisionato, o a un certo punto vuoi che parta da solo per le prenotazioni che rispettano la regola?

---

## 13. Crescita

**Domande:**
13a. Nei prossimi **12 mesi**, quanti immobili/alloggi pensi realisticamente di gestire? (2? 5? 10?)
13b. La crescita è: più alloggi tuoi, o più immobili di altri proprietari in gestione, o entrambi?
13c. C'è un immobile nuovo già in vista che dovremmo tenere presente nel modello?

---

## 14. Conti bancari

**Domanda:**
14. La scheda CONTI (saldi Intesa / Revolut / Trade Republic / Mediolanum) è finanza tua personale. La teniamo **fuori** dal nuovo sistema property-management (resta un tuo strumento privato dentro Motore Rafilu) o dentro? Consiglio: fuori — non c'entra con la gestione degli immobili.

---

## 15. Bot Telegram, Calendar, email

**Domande:**
15a. Il bot Telegram continua a leggere/scrivere sul nuovo database (invece che sul foglio). Confermi che il bot resta uno strumento tuo, non dei proprietari/collaboratori?
15b. Google Calendar: teniamo la sincronizzazione (ogni prenotazione = un evento)? Con più immobili, un calendario per immobile o uno solo con colori diversi?
15c. La lettura automatica delle email di prenotazione (Airbnb/Booking) la portiamo nel nuovo sistema così com'è?

---

## Stato

- **10/09/2026**: documento creato, poi 8 giri di domande/risposte con Raffaele — la parte di raccolta requisiti è **sostanzialmente completa** (vedi "Risposte già date" in cima). Restano solo: la correzione di Raffaele sulla struttura proprietari, e lo screenshot del calendario Airbnb. Le decisioni confermate sono confluite in [[piano-migrazione-database-modello-proprietario]] (schema aggiornato). Prossimo passo su via libera di Raffaele: Fase 1 (GitHub + Neon + schema Drizzle).
