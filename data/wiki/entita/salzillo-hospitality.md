---
titolo: Salzillo Hospitality
tipo: entita
tag: [salzillo-hospitality, rs-hospitality, salzilloflow, hospitality, business, tech, automazione]
fonti:
  - "raw/Conversazioni claude.ai/export-2026-08-31/ (export account claude.ai, memoria e progetti)"
  - "C:\Users\salzi\salzillo-hospitality\ (codice sorgente locale del sito/API, consultato il 31/08/2026)"
  - "Allacciamento collettivo.pdf"
  - "Preventivo per la richiesta di allacciamento collettivo per n. 7 forniture in bassa tensione.pdf"
  - "Specifica tecnica.pdf"
  - "b&b via pigna pt-15-01-2025,--17_12_10.zip"
  - "conversazione diretta in Claude Code, sessione 07/09/2026"
  - "conversazione diretta in Claude Code, sessione 08/09/2026"
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-08-31
aggiornato: 2026-09-09
---

# Salzillo Hospitality

Attività di famiglia di gestione affitti brevi a Marcianise (CE), di cui [[bb-il-tulipano]] è la prima e finora unica proprietà pienamente documentata nel wiki. Emersa da un export dell'account claude.ai di [[raffaele-salzillo]] (conversazioni e "memorie" di progetto), non da conversazioni dirette in questo secondo cervello — le informazioni qui sotto sono quindi meno verificate rispetto al resto del wiki e vanno confermate man mano che emergono altrove.

## Contatti ufficiali

- **Email**: salzillohospitality@gmail.com
- **Telefono/WhatsApp Business**: +39 352 220 3806 — numero nuovo (SIM dedicata, offerta 9,99€/mese), attivato il 07/09/2026 su un iPhone 12 mini poi spostato come dispositivo principale su un iPhone 17 Pro (vedi [[assistente-digitale-raffaele]] per il contesto tecnico). Profilo WhatsApp Business configurato con nome "Salzillo Hospitality", foto profilo coerente col brand, orari dichiarati: lun-ven 13:00-21:00, sab-dom 9:00-21:00 (confermati dall'utente il 07/09/2026).

### Messaggi automatici e risposte rapide (WhatsApp Business, 07/09/2026)

- **Messaggio di benvenuto** (testo confermato il 07/09/2026, colma il gap segnalato in precedenza):
  > Ciao! 👋 Benvenuto/a su Salzillo Hospitality, gestione diretta e familiare di alloggi a Marcianise (CE). Dicci le date che ti interessano — ti diciamo subito disponibilità e prezzo!
- **Messaggio di assenza** (confermato invariato il 07/09/2026):
  > Grazie per averci scritto! 🌙 Se hai una prenotazione attiva e hai bisogno di assistenza per il check-in o durante il soggiorno, ti risponderemo il prima possibile, anche fuori orario. Per nuove richieste di disponibilità, invece, siamo disponibili: Lun-ven: 13:00-21:00 Sab-dom: 9:00-21:00 Se ci scrivi fuori da questi orari, nessun problema. Ti risponderemo appena possibile 😊
  
  Riscritto rispetto a una prima versione perché un ospite con prenotazione attiva (bisogno di check-in/assistenza) non deve ricevere lo stesso messaggio generico di chi chiede disponibilità per la prima volta.
- **Risposte rapide** (le scorciatoie WhatsApp Business non accettano trattini/spazi, solo testo attaccato):
  - `checkintulipano` → link alla guida di check-in del Tulipano (https://salzillo-hospitality.vercel.app/checkin/tulipano.html) con testo di accompagnamento
  - `checkinrosa` → stesso, per Stanza Rosa (https://salzillo-hospitality.vercel.app/checkin/rosa.html)
  - `disponibilita` → richiesta date/numero ospiti per chi chiede disponibilità senza prenotazione
  
  Testate dal vivo sul telefono di Raffaele (screenshot): pagina Tulipano si apre correttamente nel browser interno di WhatsApp Business, con foto, griglia riquadri, toggle IT/EN e contact bar tutti visibili e funzionanti.

## Persone coinvolte

- **[[raffaele-salzillo]]**: proprietario della tecnologia e della strategia web/digitale. Non titolare legale (vedi [[salzillo-luigi]] per [[bb-il-tulipano]]).
- **Madre ([[raffaela-iodice]])**: supporto operativo in loco (pulizie, presumibilmente accoglienza).
- **Padre ([[salzillo-luigi]]) e fratelli/sorelle** (non nominati): supporto flessibile, non meglio specificato.

## Evoluzione del progetto (ricostruita dalle memorie claude.ai)

Il progetto ha attraversato almeno tre fasi/nomi, nell'arco di circa 5 mesi (marzo-agosto 2026):

### 1. "RS Hospitality" (da marzo 2026)

- Sito pubblico costruito da zero in "vibe coding" con Claude Code **senza esperienza di programmazione pregressa**: Next.js 16, TypeScript, Tailwind CSS, Shadcn UI, deploy su Vercel (`rs-hospitality.vercel.app`), repository GitHub `raffelesalzillo17-crypto/rs-hospitality`, sviluppo in Cursor.
- Prima proprietà pubblicata: **"Il Tulipano" — categoria "RS Comfort"**, Via Clanio 60 Marcianise, €55-80/notte, con sync calendario iCal da Airbnb/Booking, mappa Google Maps, pulsante WhatsApp, link di prenotazione diretti.
- Identità di brand (versione 1): colori Tabacco `#2C2416`, Lino `#F0EBE0`, Cammello `#8B7355`, Sabbia `#D4C9B5`; font Helvetica; tagline "Ogni soggiorno porta la nostra firma."
- Roadmap dichiarata all'epoca: schema Supabase, PMS base, App Ospite (con Alloggiati Web), pagamenti Stripe, automazioni WhatsApp, dashboard manager ("RS Central"), app proprietario, app staff.

### 2. Pivot a "Salzillo Hospitality" — abbandono dello stack Next.js/Supabase

Decisione architetturale importante: **abbandonato lo stack custom Supabase/Next.js** a favore dell'ecosistema Google come base permanente:

- **Google Sheets** (`HostFlow_2026`, 18 fogli — lo stesso foglio già documentato in [[hostflow-tulipano]]) come livello database, con Claude Code (via Cursor) collegato tramite un service account dedicato (`claude-code`).
- Google Calendar API abilitata insieme a Sheets API sullo stesso progetto Google Cloud.
- File `CLAUDE.md` (nel progetto Cursor, non in questo vault) aggiornato con istruzioni di connessione permanenti.
- Lavoro tecnico recente citato: aggiunta canale "No Tax" in CONFIG per esentare automaticamente Stanza Rosa dalla cedolare secca; aggiunta colonna Telefono al DATABASE in vista di un'integrazione n8n; corrette 5.280 formule su 12 fogli mensili (bug: sintassi italiana a punto e virgola vs virgola inglese — lezione costosa, vedi sotto); eliminati due fogli inutilizzati.

### 3. "SalzilloFlow" — stato più recente noto

Ulteriore evoluzione di branding e architettura, con un foglio Google **diverso** (`SalzilloFlow_2026`, ID `11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys`) rispetto a `HostFlow_2026` — non è chiaro dalle fonti se sia un rinominazione dello stesso foglio o un foglio nuovo che lo sostituisce. **Confermato dall'utente il 31/08/2026 come stato attuale.**

- Sito web Next.js su Vercel per inserimento prenotazioni da mobile: `salzillo-hospitality.vercel.app`.
- Google Calendar dedicato: ID `49e5bd39c07255fe211dd38e651c7df29e7e267167a5a33d6bb89a614fa453af@group.calendar.google.com`.
- Gruppo WhatsApp staff (solo admin possono postare) per notifiche team.
- Automazione pianificata con **n8n + Claude API**.
- File "MASTER" pensato per essere copiato ogni anno (`SalzilloFlow_2027`, ecc.) aggiornando solo l'ID del foglio nella web app.
- Identità di brand (versione 2, aggiornata): Teal `#5E8A82`, Antracite `#2D2D2D`, Bianco caldo `#FAFAF8`, Terracotta `#C4714A`, font Inter, logo "S" stilizzato generato con Gemini.
- **Divisione degli strumenti**: Gemini per asset grafici/visivi, Claude per testo e implementazione tecnica (scelta fatta dopo aver scartato più immagini generate da Claude).

## Proprietà

**Aggiornamento (07/09/2026, riportato direttamente da Raffaele in chat)** — quadro completo e aggiornato delle proprietà e del loro stato regolatorio:

- **Il Tulipano** (vedi [[bb-il-tulipano]] per i dettagli completi) — Via Clanio 60, Marcianise. Ha il **codice CIN** (Codice Identificativo Nazionale) e tutta la documentazione in regola, confermato da Raffaele. Nota: le fonti precedenti in questo wiki citano un codice **CUSR** regionale (15061049EXT0003, assegnato 23/09/2024) — non chiaro dalle fonti se il CIN nazionale coincida con quel codice o sia un codice diverso/successivo (l'Italia ha reso obbligatorio il CIN nazionale a partire dal 2024, in aggiunta/sostituzione dei codici regionali) — da verificare se arriva un documento specifico.
- **Stanza Rosa** — stessa palazzina di Via Clanio 60 (non un indirizzo separato). Singola con possibilità di lettino aggiunto. **Senza CIN, per scelta esplicita**: Raffaele non ha intenzione di richiederlo — la usa informalmente per ospiti singoli, persone che conosce, o come valvola di sfogo quando le altre stanze sono al completo (per evitare overbooking). Coerente con l'uso già osservato del canale "No Tax" (incassi in contanti, mai dichiarata, mai cedolare secca) in [[hostflow-tulipano]].
- **Nuovo fabbricato Via Campania** (Stanza 3, 4, 5 — vedi sezione dedicata sotto per indirizzo/civici/documentazione amministrativa) — **lavori terminati, struttura abitabile** (confermato 07/09/2026, aggiornamento rispetto a "in arrivo a settembre 2026" annotato in precedenza). **In attesa dei codici CIN**, che secondo quanto comunicato a Raffaele arriveranno indicativamente **marzo-aprile 2027**. Nel frattempo Raffaele sta già accettando prenotazioni e incassando **in contanti, non fatturati/non dichiarati** ("a nero"), in attesa dei codici.

## Nuovo fabbricato Via Campania 36/38 (B&B + appartamenti familiari)

Confermato dall'utente (01/09/2026): **Via Campania 36 e Via Campania 38 sono lo stesso fabbricato**, con due civici/ingressi sulla stessa struttura. Localmente la zona/il fabbricato è soprannominata **"Via Pigna"** (toponimo storico, dai pini/pigne che un tempo caratterizzavano la zona) — nome informale, non l'indirizzo ufficiale.

Il fabbricato è diviso in due parti:
- **Parte di [[raffaela-iodice]]** (madre di [[raffaele-salzillo]]): per ora comprende le **tre nuove stanze del B&B** (Stanza 3, 4 e 5 — Stanza 3 al piano terra), già completate; **tre appartamenti ulteriori sono previsti in futuro** sulla stessa porzione.
- **Parte di [[iodice-giovanna]]** (sorella di Raffaela, confermata dall'utente — quindi zia di Raffaele): **tre appartamenti** di sua proprietà, con contatori propri richiesti separatamente.

Le pratiche di allacciamento elettrico coprono l'intero fabbricato:

- **Immobile**: Via Campania 36, Marcianise (CE), CAP 81025 (indirizzo ufficiale nei documenti e-distribuzione) — nuovo fabbricato residenziale realizzato in base al permesso di costruire n. 2979 del 1993, Comune di Marcianise.
- **Origine familiare del terreno** (spiegata dall'utente, 01/09/2026): 30-40 anni fa l'intera area era un unico terreno dove abitavano i nonni di Raffaele con i loro quattro figli — [[iodice-paolo-giovanni]], [[iodice-giovanna]], [[raffaela-iodice]] e [[iodice-rosanna]]. Il nonno ha poi lasciato in eredità una porzione di terreno a ciascuno dei quattro figli, che ci hanno costruito ciascuno il proprio fabbricato: da questa suddivisione è nata una **strada privata** condivisa dai quattro. È per questo che e-distribuzione ha richiesto la firma di consenso di tutti e quattro i comproprietari della strada privata (non solo di Raffaela e Giovanna, le uniche con unità abitative nel fabbricato oggetto della pratica): i lavori di allacciamento interessano infatti il tratto di strada privata comune a tutti.
- **Firmatari/comproprietari nelle pratiche e-distribuzione**: [[raffaela-iodice]] (firmataria principale), [[iodice-giovanna]], [[iodice-rosanna]], [[iodice-paolo-giovanni]] — tutti e quattro fratelli/sorelle, figli degli stessi nonni, comproprietari della strada privata; **confermato dall'utente** (zii materni di Raffaele).
- **Richiesta**: allacciamento collettivo per n. 7 forniture in bassa tensione — 6 forniture uso domestico residenziale (3 kW monofase ciascuna, 19,8 kW totali: presumibilmente 3 per la parte di Raffaela/B&B e 3 per gli appartamenti di Giovanna) + 1 fornitura condominiale trifase (3,3 kW) per le parti comuni, per un totale di 23,1 kW.
- **Preventivo e-distribuzione**: €4.011,15 IVA inclusa (quota distanza €1.467,34 + quota potenza €1.820,49 + IVA), codice di rintracciabilità 546903050, N. Cliente 135356832, POD IT001E13535683, unità operativa DN2FB1. Referente e-distribuzione: Maurizio Fedele; procuratore firmatario: Cioffi Gennaro.
- **Stato**: preventivo pervenuto 19/07/2026, istanza di allacciamento firmata da Raffaela Iodice il 04/08/2026, dichiarazioni di consenso dei comproprietari firmate il 30/07/2026; tempi di esecuzione lavori dichiarati fino a 50 giorni lavorativi dal completamento delle opere a carico del cliente.

**Render Stanza 3**: il file `b&b via pigna pt-15-01-2025.zip` trovato in `raw/` non contiene foto reali ma **8 render/mockup fotorealistici creati da Raffaele stesso** (camera matrimoniale + bagno), raffiguranti l'arredamento previsto per "Stanza 3" (piano terra) prima della realizzazione.

## Logica finanziaria (fissa, dichiarata immutabile nelle fonti)

Coerente con quanto già documentato in [[hostflow-tulipano]] (CONFIG):

- Airbnb: commissione OTA 18,91% + cedolare secca 21% sul lordo
- Booking.com: commissione OTA 20,15% + cedolare secca 21% sul lordo
- Diretto: 0% commissione + 21% cedolare
- No Tax: 0% commissione + 0% cedolare (contanti, riservato a Stanza Rosa)
- Costo fisso pulizie: €20/prenotazione
- Metrica chiave: **utile reale** (netto ricevuto − costi fissi)

## Pricing dinamico ed eventi locali

- Due piani tariffari: flessibile e non rimborsabile (-10%)
- Prezzo di punta manuale (€80) in occasione di eventi locali (concerti alla Reggia di Caserta, Fiera Tarì, festività) — coerente con gli eventi trovati nel Google Calendar del B&B collegato al bot Telegram (vedi [[assistente-digitale-raffaele]])
- Sconto soggiorni lunghi (-15%) e last-minute (-10%)

## Visione automazione e domotica (pianificata, non ancora realizzata)

Pipeline di automazione descritta: email prenotazione OTA → n8n (su VPS, poi eventualmente Raspberry Pi) → scrive su Google Sheets + Calendar → notifica Telegram → Raffaele inoltra riepilogo al gruppo WhatsApp famiglia. Per le prenotazioni dirette: Raffaele manda un messaggio Telegram strutturato → n8n lo interpreta e scrive su Sheets/Calendar.

Visione domotica a tre livelli (~70% realizzabile senza nuovo hardware secondo le fonti, budget hardware dichiarato <€200/proprietà):
- **Livello 1**: serrature smart (Tuya/Sonoff, compatibili n8n), gestione Wi-Fi ospiti, concierge WhatsApp con IA via n8n + Claude API
- **Livello 2**: monitoraggio energia — termostati smart, prese smart, sensori porte/finestre
- **Livello 3** (già fattibile, nessun costo aggiuntivo): coordinamento pulizie, pricing dinamico via Telegram con IA, richieste automatiche di recensione, report settimanali di performance IA

Per la compliance legale (Alloggiati Web, Sinfonia Turismo Smart) è stata valutata la scelta di usare strumenti di terze parti dedicati (Lodgify, Octorate, Beds24) piuttosto che costruire integrazioni custom.

## Lezioni tecniche apprese (dalle fonti)

- **Google Sheets con locale italiano**: i separatori delle formule devono essere punto e virgola (`;`), non virgola — errore costato la riscrittura di 5.280 formule.
- **Colonna LORDO deve essere numerica**: se salvata come testo (es. `"€ 47,00"`) rompe le formule; va convertita via API prima dei calcoli.
- **Permessi service account non ereditano**: ogni nuova copia di un foglio Google richiede una condivisione esplicita "Editor" per il service account.
- **Variabili d'ambiente Vercel**: `vercel env rm/add` + redeploy `vercel --prod` necessari — modificare solo `.env.local` non basta in produzione.
- **Google Apps Script**: timeout di 6 minuti su script che toccano 12+ fogli — risolto con Claude Code via `googleapis` (nessun timeout) invece di Apps Script.
- **Sicurezza credenziali**: un service account JSON condiviso per errore in chat è stato segnalato subito da Claude, con conseguente revoca/rigenerazione — regola stabilita: mai condividere credenziali "vive" (che danno accesso a infrastruttura cloud reale) in chat. Nota: questa regola riguarda credenziali cloud con accesso in scrittura continuativo, non le credenziali statiche di documenti personali già archiviate in chiaro in questo vault per scelta esplicita dell'utente (vedi [[bb-il-tulipano]], [[raffaele-salzillo]]) — sono due categorie di rischio diverse.

## Approccio di lavoro di Raffaele su questo progetto

- Esecuzione sempre tramite **Claude Code in modalità Agent dentro Cursor** (Ctrl+Shift+L) — non esegue mai script manualmente.
- Preferenza per **massima autonomia degli agenti IA**: vuole che eseguano, non solo che consiglino.
- Predilige rollout strutturati a tappe, con prossimi passi chiari a fine sessione.
- Sistemi pensati fin dall'inizio per essere copiati/riusati di anno in anno.
- Naming di codice, file e database storicamente in italiano.

## Rischio da tenere presente

Questa pagina cita ID di fogli Google, ID di calendario ed email di service account emersi da un export di chat — non sono segreti in senso stretto (non includono chiavi private), ma combinati potrebbero facilitare un tentativo di accesso se il vault venisse esposto. Trattare con la stessa cautela già applicata alle altre credenziali nel vault.

## Sistema confermato live (31/08/2026)

Verificato leggendo il codice sorgente locale (`C:\Users\salzi\salzillo-hospitality\`) e il sito pubblico: il sistema **SalzilloFlow è realmente in produzione**, non solo pianificato. Il sito `salzillo-hospitality.vercel.app` mostra 60 prenotazioni attive gestite dal vivo, con un form di inserimento nuova prenotazione e pulsanti di cancellazione funzionanti. Confermato anche che `SalzilloFlow_2026` è l'ID foglio Google realmente usato dalle API (`11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys`, letto direttamente dal codice) — risolve il dubbio lasciato aperto sotto se fosse lo stesso foglio di `HostFlow_2026` o uno diverso: è quello attuale, il nome "HostFlow" risulta superato. Il bot Telegram di [[assistente-digitale-raffaele]] ora si collega direttamente alle API di questo sito (`/api/prenotazioni`, `/api/prenotazione`, `/api/cancella`) invece di leggere il CSV pubblicato grezzo.

## Colonna telefono aggiunta al sistema live (07/09/2026)

In vista dell'automazione del promemoria recensione post check-out (vedi [[messaggi-checkin-ospiti]]), aggiunta una colonna **Telefono** (K) al foglio `SalzilloFlow_2026` (DATABASE), e aggiornate le API in produzione per leggerla/scriverla:
- `/api/prenotazioni` (GET): ora include `telefono` per ogni prenotazione (vuoto per quelle passate — nessun numero storico può essere ricostruito/inventato).
- `/api/prenotazione` (POST): accetta un campo `telefono` opzionale, retrocompatibile.
- Bot Telegram (`assistantCore.ts`): lo strumento di registrazione nuova prenotazione via chat naturale ora può catturare il telefono se Raffaele lo fornisce spontaneamente ("prenotazione per Mario, 340..., ...").
- Deploy fatto e verificato in produzione (`salzillo-hospitality.vercel.app`), letture esistenti confermate intatte.

**Aggiornamento (07/09/2026, più tardi)**: Raffaele ha autorizzato esplicitamente un'eccezione — aggiunto un campo "Telefono (facoltativo)" anche al form condiviso sul sito `/` (vedi nota nella decisione [[non-toccare-sito-prenotazioni]]). Il telefono ora si può registrare sia dal bot Telegram sia dal form condiviso. Deploy fatto e verificato (`npx tsc --noEmit` pulito).

**Promemoria automatico recensione post check-out (07/09/2026)**: creato `/api/cron/checkout-reminder`, cron separato dal digest mattutino (Vercel Cron, `0 9 * * *` UTC = 11:00 italiane, un'ora dopo il check-out delle 10:00). Ogni giorno controlla le prenotazioni con check-out di quel giorno esatto; per ognuna con un numero di telefono registrato, manda a Raffaele su Telegram un messaggio con link `wa.me` già compilato con il testo di richiesta recensione (diverso per Tulipano/Rosa/altre stanze, stesso link Google Maps) — lui deve solo aprire e premere invia. Se manca il numero, segnala di inviarlo a mano. Se non ci sono check-out quel giorno, non manda nulla (niente rumore). Testato con un invio reale su Telegram (rotta temporanea creata e rimossa subito dopo) — firma cambiata da "Raffaele" a "Salzillo Hospitality" su richiesta di Raffaele dopo aver visto la prova.

**Promemoria automatico pre-arrivo (07/09/2026)**: creato `/api/cron/checkin-reminder`, simmetrico al promemoria check-out, stesso orario (`0 9 * * *` UTC = 11:00 italiane). Ogni giorno controlla le prenotazioni con check-in di quel giorno esatto; per ognuna con telefono registrato, manda a Raffaele un link `wa.me` già compilato con il messaggio giusto per la stanza (stesso testo delle risposte rapide `checkintulipano`/`checkinrosa`) e il link alla guida web — lui tocca e invia prima delle 15:00. Se la stanza non ha ancora una guida (es. future stanze di Via Campania) o manca il telefono, lo segnala invece di provarci a caso. Testato con un invio reale su Telegram, stesso schema del check-out (rotta temporanea creata e rimossa). Entrambi i cron confermati attivi su Vercel (`vercel cron ls`).

## Dashboard di controllo — 8 strumenti host (scheletro creato 07/09/2026)

Origine: Raffaele ha mostrato il sito concorrente "Locazione Turistica" (Vita da Host, PDF `FireShot Capture 147 - ... - contratti_ - [contratti.vitadahost.it].pdf`), che offre 8 funzioni per gestori di affitti brevi, e ha chiesto di replicarle invece di pagare un abbonamento, integrandole nel proprio [[assistente-digitale-raffaele|dashboard personale "Motore Rafilu"]] (`/plancia`), non nel sito condiviso `/` (vedi [[non-toccare-sito-prenotazioni]] — questa modifica non lo riguarda, `/plancia` è personale e già suo).

**Fatto il 07/09/2026**: espansa la vista "hospitality" già esistente in `salzillo-hospitality/src/app/plancia/page.tsx` (che mostrava già occupazione stanze, check-out del giorno e link a `/` per la gestione prenotazioni — questa parte resta invariata, è lo strumento "già funzionante"). Aggiunta sotto una sezione "Centro di controllo — gli 8 strumenti host": una griglia di 8 tile cliccabili, con lo stesso stile grafico (`.card`, `.icon-badge`, `.badge`) già usato nella home di Motore Rafilu. Ogni tile apre una scheda di dettaglio con chip "Da costruire" (stesso pattern già usato per "Salute"), contenente: cosa farà lo strumento, e cosa manca per iniziare a costruirlo. Deploy fatto e verificato (`tsc --noEmit` pulito, `next build` pulito, un solo errore di lint pre-esistente e non toccato su un `<a>` verso `/`).

Le 8 schede, con priorità assegnata in base a rischio/valore (discussa con Raffaele prima di questa modifica):

1. **Calendario scadenze fiscali** (hash `hosp-scadenze`, priorità alta) — estintori, imposta di soggiorno, Sinfonia/ISTAT. Manca: data ultimo controllo estintori, periodicità versamento imposta di soggiorno.
2. **Check-in digitale & Schedine** (hash `hosp-alloggiati`, priorità alta) — invio automatico ad Alloggiati Web (Polizia) e Sinfonia Turismo Smart (Regione Campania, sostituisce Turismo Web dal 12/05/2025, API REST con autenticazione CUSR + IAPI KEY; ROSS1000 non è rilevante in Campania, lo usa il concorrente per altre regioni). Unico strumento con vero rischio di sanzione (€250-2.500/mese) se fatto male. Manca: credenziali Alloggiati Web, CUSR+IAPI KEY di Sinfonia, decisione su come raccogliere i documenti ospite.
3. **Ricevute** (hash `hosp-ricevute`, priorità media) — ricevuta affitto + calcolo imposta di soggiorno dai dati già in `SalzilloFlow_2026`. Manca: aliquota esatta del Comune di Marcianise, formato/intestazione voluta.
4. **Gestione Pulizie** (hash `hosp-pulizie`, priorità media) — checklist agganciata ai check-out reali. Manca: conferma se le pulizie sono fatte da personale dedicato o dalla famiglia (cambia se serve notificare terzi), checklist standard attuale.
5. **Contratti di locazione turistica** (hash `hosp-contratti`, priorità normale) — generazione automatica dai dati prenotazione. **Segnalato esplicitamente a Raffaele nella scheda**: il testo va fatto rivedere da un commercialista/legale prima dell'uso reale — unico rischio legale tra gli otto. Manca: un contratto-tipo di partenza, clausole sempre richieste (cancellazione, cauzione).
6. **QR Code Generator** (hash `hosp-qrcode`, priorità bassa) — QR per WiFi, guida check-in, recensione Google. Il più semplice: nessuna API esterna, generabile lato client.
7. **Alert prezzi eventi** (hash `hosp-eventi`, priorità bassa) — versione leggera (ricerca periodica + notifica Telegram) rispetto al database proprietario di ~419 eventi del concorrente, non realisticamente replicabile alla pari.
8. **Contabilità** (hash `hosp-contabilita`, non prioritario) — già coperto da HostFlow; scheda lasciata solo come promemoria, non in programma.

**Prossimi passi (da domani)**: raccogliere le risposte alle domande aperte elencate in ciascuna scheda (viste sopra), poi costruire nell'ordine di priorità — a partire da Scadenze fiscali e Check-in digitale/Alloggiati, che hanno vero valore di compliance.

**Ristrutturazione navigazione (07/09/2026, stesso giorno)**: su richiesta di Raffaele, la vista "hospitality" ora funziona come le guide di check-in (Tulipano/Rosa) — cliccando la scheda "Salzillo Hospitality" da Motore Rafilu si apre subito una griglia di 9 tile (non più i pannelli di occupazione/prenotazioni in cima), una per "Prenotazioni & Calendario" (badge "Attivo", contenuto reale spostato in una vista dedicata `hosp-prenotazioni`) più le 8 già descritte sopra. Ogni tile apre la propria scheda di dettaglio con un tasto indietro che torna alla griglia (non alla home di Motore Rafilu). Deploy fatto e verificato (build/type-check puliti).

## Ristrutturazione a tile di tutte le sezioni di Motore Rafilu (07/09/2026, sessione successiva)

Su richiesta esplicita di Raffaele ("riguarda tutto motore raffilù tutte le sue sezioni e fa sì che tutte quante risultino uguali alla vista... bottoni quadrati, o dove c'è bisogno di più spazio che occupano due slot"), estesa a tutta la dashboard `/plancia` la stessa logica a griglia di tile/bottoni già applicata oggi solo alla vista "hospitality" (vedi sezione sopra) e coerente con lo stile a griglia delle guide di check-in Tulipano/Stanza Rosa. Regola applicata: contenuto compatto (una statistica, 2-3 righe) → tile piccola/quadrata; contenuto che richiede spazio (tabella, grafico, lista lunga) → tile larga a riga intera.

Introdotte due nuove varianti CSS coerenti col sistema di design esistente (`.card`, `.featured`, `.slim`): **`.card.square`** (tile quadrata compatta, aspect-ratio 1:1, resta visivamente quadrata anche su mobile — due per riga sotto 880px, a differenza di `.slim`/`.featured` che diventano piena larghezza) e **`.card.row`** (tile a riga intera, per contenuti che hanno bisogno di spazio); più `.card.static` per le tile non cliccabili (rimuove cursore a mano e hover-lift, mantiene lo stesso stile visivo).

Sezioni riviste (tutte in `salzillo-hospitality/src/app/plancia/page.tsx`):
- **Agenda**: prima un unico pannello con blocchi per giorno; ora due tile quadrate riassuntive in cima ("impegni oggi", "impegni nei prossimi 7 giorni", calcolati dagli eventi già caricati) seguite da una tile larga per ogni giorno con impegni.
- **Notizie**: da un pannello unico con notizie in sequenza a una tile larga per notizia (fonte, titolo, snippet, link).
- **Scuola**: da due pannelli in griglia 2 colonne a due tile compatte ("Contratto in corso", "Anno di formazione e prova 2025/26").
- **Patrimonio**: tile larga per il grafico ETF (serve spazio per la sparkline), tile quadrate individuali una per mercato (S&P 500, Nasdaq, FTSE MIB, EUR/USD) con prezzo e variazione %.
- **Salute**: rimane una singola tile larga esplicativa (contenuto concept, un solo blocco di testo — nessuna griglia complessa necessaria).
- **Personale**: due tile quadrate per le statistiche (giorni insieme, durata relazione) più tile larghe per le liste (Date da ricordare, Prossime ricorrenze) e una tile compatta per Famiglia.
- **Home** e le 8 sotto-viste `hosp-*` di Hospitality: lasciate come sono, già coerenti/a priorità più bassa (non toccate in questa sessione).

Verificato: `npx tsc --noEmit` e `npx next build` puliti (nessun nuovo errore; l'unico warning di lint pre-esistente su un `<a href="/">` non toccato). Verifica visiva fatta nel Browser pane su viewport mobile (375×812) e desktop, con la chiave di sblocco locale (`.env.local` ha `PLANCIA_ACCESS_KEY` vuota in locale, quindi qualsiasi chiave sblocca in dev — comportamento voluto dal codice, non una falla in produzione dove la chiave reale è impostata su Vercel): tile quadrate restano quadrate e appaiate a due su mobile, tile larghe occupano tutta la riga, nessun testo tagliato. Deploy in produzione fatto (`npx vercel deploy --prod --yes`).

## Bug segnalati e corretti (07/09/2026, dopo la ristrutturazione a tile)

- **Scorrimento orizzontale nella scheda "Prenotazioni & Calendario"**: Raffaele ha segnalato che lo schermo "si muove a destra e sinistra" invece di restare centrato. Causa individuata: la tabella "Prossimi arrivi" (5 colonne) dentro `.panel.full` è più larga dello schermo su mobile; il wrapper `.table-wrap` aveva già `overflow-x:auto` per contenerla, ma mancava `min-width:0` sul `.panel` genitore (dentro una griglia CSS, un elemento senza `min-width:0` non si lascia comprimere sotto la dimensione del proprio contenuto, quindi la tabella "spingeva" tutta la pagina più larga dello schermo invece di scorrere solo al proprio interno) — bug classico di CSS Grid, non legato al meta tag viewport (quello era già corretto). Corretto aggiungendo `min-width:0` a `.panel`/`.detail-grid` e `overflow-x:hidden` anche su `html` (non solo su `body`, che da solo non basta su alcuni browser mobile) come protezione aggiuntiva. Deploy fatto e verificato (build/type-check puliti).
- **Errore sul calendario generale ("Agenda")**: `/api/calendario` risponde `{"ok":false,"error":"invalid_grant"}` — il refresh token OAuth di Google Calendar (`GOOGLE_CALENDAR_REFRESH_TOKEN`, condiviso con [[assistente-digitale-raffaele]]) risulta scaduto/revocato. Non è un bug introdotto oggi: è un problema di credenziali lato Google, va rigenerato un nuovo refresh token (stesso account Google personale usato finora) e aggiornata la variabile su Vercel — non ancora risolto, da fare con Raffaele.

## Primi strumenti costruiti davvero (07/09/2026, notte)

Su richiesta di Raffaele ("delle nuove schede degli otto strumenti... riusciresti a crearne qualcuno"), passati dalla sola specifica alla costruzione reale per i primi tre strumenti, con tre agenti in parallelo ciascuno su file nuovi e separati (per non farli scontrare sullo stesso `plancia/page.tsx`, che ho poi collegato io a mano in un solo passaggio, build+deploy unico).

- **QR Code Generator — completato e attivo**: nuovo componente `src/components/QrCodeTool.tsx` (pacchetto npm `qrcode`, nessuna dipendenza nativa). Genera 4 QR per stanza: WiFi (formato standard `WIFI:T:WPA;...`, connessione diretta scansionando), guida check-in (link alla pagina giusta per Tulipano/Rosa), recensione Google. Pulsante download PNG per ciascuno e foglio stampabile ottimizzato per la stampa (CSS `@media print`). Collegato alla scheda "QR Code" della dashboard, badge "Attivo". **Da verificare di persona prima di stampare per davvero**: l'anteprima di stampa del browser e una scansione reale del QR WiFi con un telefono.
- **Ricevute (ricevuta d'affitto) — completato e attivo, imposta di soggiorno ancora manuale**: nuova route `POST /api/ricevuta` (libreria `pdf-lib`, nessuna dipendenza nativa/Chromium) e componente `src/components/RicevutaButton.tsx`, collegato come pulsante "Ricevuta" su ogni riga della tabella "Prossimi arrivi" (vista Prenotazioni & Calendario). Genera un PDF con intestatario, ospite, stanza, date, importo, e un campo "Imposta di soggiorno" ancora da compilare a mano (aliquota di Marcianise non nota). Per Il Tulipano/Stanza Rosa l'intestatario di default è Luigi Salzillo (dati SCIA); per le stanze di Via Campania il campo resta vuoto — **non risulta nel wiki un CF/P.IVA di Raffaela Iodice come intestataria fiscale di quelle stanze**, da chiedere. Badge "In prova".
- **Gestione Pulizie — prima versione attiva, di sola lettura**: nuovo componente `src/components/PulizieChecklist.tsx`, collegato alla scheda "Gestione Pulizie". Genera automaticamente, dai check-out reali (oggi + prossimi 2 giorni), una checklist a 7 voci per stanza (biancheria, asciugamani, bagno, pavimenti, riordino, scorte, oggetti dimenticati). **Deliberatamente senza "segna come fatto" persistente**: le funzioni serverless di Vercel hanno un filesystem effimero, serve una scheda dedicata sul foglio Google (o un database) per salvare lo stato in modo affidabile — decisione di schema da prendere con calma, non presa stanotte. Badge "In prova".

**Intoppo e correzione**: il primo tentativo di deploy è fallito in build su Vercel (non in locale) — l'agente del QR Code aveva installato `@types/qrcode` solo nella cartella locale `node_modules` senza registrarlo in `package.json`/`package-lock.json`, quindi l'installazione pulita fatta da Vercel non lo includeva. Corretto con `npm install -D @types/qrcode` (ora tracciato correttamente in entrambi i file) e ridistribuito con successo.

## Finalizzazione dei 3 strumenti, stessa notte — feedback di Raffaele dopo un primo giro

Raffaele ha guardato i tre strumenti appena costruiti e dato indicazioni precise, applicate con altri tre agenti in parallelo (stesso schema: file separati, collegamento finale a mano):

- **Imposta di soggiorno di Marcianise — verificata come assente**: ricerca web fatta (sia da Raffaele sia da me) — nessun regolamento/delibera trovato per il Comune di Marcianise, a differenza del vicino Comune di Caserta (capoluogo) che la applica dal 2026 con un software dedicato (PayTourist). Non è una certezza assoluta al 100% (nessuna fonte dice esplicitamente "Marcianise non ce l'ha"), ma l'assenza totale di regolamento/notizie è ragionevolmente conclusiva. Il PDF ricevuta ora riporta questo fatto invece di un placeholder "dato mancante".
- **Ricevute solo per gli incassi dichiarati**: confermato da Raffaele che Stanza Rosa e le tre stanze di Via Campania sono affittate **sempre in contanti/a nero**, quindi **mai** una ricevuta; anche per Il Tulipano, le prenotazioni canale "No Tax" non devono avere ricevuta — solo Booking/Airbnb/Diretto. Implementato un blocco sia lato interfaccia (il pulsante "Ricevuta" non compare, mostra "— (No Tax)") sia lato server (la route rifiuta esplicitamente con 400 se richiesta per una prenotazione No Tax) — così anche una chiamata diretta all'API non può generarne una per sbaglio.
- **Gestione Pulizie trattata "come una dipendente"**: le pulizie le fa la madre di Raffaele (Lella/Raffaela Iodice). Costruita persistenza reale su una nuova scheda **"PULIZIE"** dello stesso foglio `SalzilloFlow_2026` (non un foglio separato): una riga per Data+Stanza, le 7 voci della checklist come colonne booleane, più `Operatore` (default Lella, modificabile) e `CompletatoIl` (si valorizza quando tutte le voci sono spuntate). La checklist nella dashboard ora ha checkbox vere che salvano lo stato, e un pulsante "📲 Invia a Lella su WhatsApp" che apre `wa.me` con il messaggio già scritto (stanza, data, voci da fare). Testato con una scrittura reale sul foglio (poi ripulita). **Non ancora incluso**: un campo Note in UI (la colonna esiste sul foglio ma va scritta solo a mano per ora); tracciamento di ore/compenso, se in futuro Raffaele vuole spingersi fino a un vero conteggio da "dipendente".
- **QR Code — centratura corretta**: causa trovata (mancava `justify-content:center` sul contenitore della griglia, non un problema dei singoli QR). Aggiunto anche un **generatore libero**: qualunque link o testo, genera un QR scaricabile con lo stesso stile dei predefiniti — copre "quello che vuoi metterci dentro", con il limite tecnico che un QR standard codifica testo/link, non un'immagine incollata direttamente (segnalato a Raffaele, da confermare se intendeva altro).

Deploy fatto e verificato (build/type-check puliti, tutte le nuove route rispondono in produzione: `/api/ricevuta`, `/api/pulizie-stato`). Le 3 schede sono ora segnate "Attivo" invece di "In prova"/"Da costruire" nella dashboard.

## Secondo giro di costruzione — 7 strumenti su 8 attivi (notte 07→08/09/2026)

Raffaele ha chiesto che entro la mattina dell'8/09 tutti gli 8 strumenti "funzionassero", lasciando la sessione a lavorare in background per ~5 ore. Prima di partire sono state fatte 4 domande di chiarimento (per non inventare fatti/rischiare comunicazioni sbagliate a enti pubblici mentre lui dormiva): rimandare Google Calendar a domani (sì), costruire comunque Contabilità (sì), fare solo raccolta-dati per Check-in/Schedine senza invio automatico reale (sì), generare una bozza di contratto (sì). Costruiti con 4 agenti in parallelo su file separati, collegati a mano uno alla volta, con un giro di verifica visiva reale (Browser pane, desktop e mobile) su tutte le 9 schede prima del deploy finale:

- **Contabilità — attiva**: cruscotto che aggrega utile/lordo mensile dai dati reali di SalzilloFlow (mese corrente vs precedente, per canale, solo mesi con prenotazioni vere), più un registro spese extra su nuova scheda Google **"SPESE"** (Data, Categoria, Descrizione, Importo, Struttura) — "utile netto reale" = utile HostFlow − spese extra del mese.
- **Check-in digitale & Schedine — attivo solo per la raccolta dati**: nuova scheda Google **"SCHEDINE"** (dati anagrafici/documento ospite secondo i campi richiesti da Alloggiati Web). Raffaele compila i dati nel form della dashboard, il sistema prepara un testo pronto da copiare nel vero Portale Alloggiati Web ("Copia dati" + "Segna come inviato"). **Nessuna chiamata reale è mai stata fatta né va fatta automaticamente ad Alloggiati Web o Sinfonia Turismo Smart** — l'invio resta manuale finché non si fa un test supervisionato insieme.
- **Contratti di locazione — bozza attiva**: PDF generato dai dati prenotazione (`pdf-lib`), clausole standard (cancellazione, cauzione — mai importi inventati, sempre campi da compilare), banner "BOZZA — non revisionato da un legale" ripetuto su ogni pagina. Disponibile per qualunque canale, incluso No Tax (qui è una tutela contrattuale, non una questione fiscale).
- **Calendario scadenze fiscali — attivo**: nuova scheda Google **"SCADENZE"**, CRUD completo (aggiungi/segna fatto/elimina), calcolo automatico della prossima scadenza per quelle ricorrenti. Parte vuoto per scelta — nessuna data reale (estintori, assicurazione) è stata inventata, le inserisce Raffaele quando vuole.

**Stato finale dashboard**: 7 schede su 8 "Attivo" (Prenotazioni, Scadenze, Check-in&Schedine, Ricevute, Pulizie, Contratti, QR Code, Contabilità — 8 in realtà, la nona è Alert eventi). Solo **Alert prezzi eventi** resta non costruito: dipende dal Calendario Google, ancora da riautorizzare (vedi sotto), rimandato di comune accordo.

Verificato prima del deploy: `tsc`/`build` puliti, più un giro reale nel browser su ogni singola scheda (non solo compilazione) — dati veri confermati per Prenotazioni, Pulizie, Contabilità, Schedine; stato vuoto onesto confermato per Scadenze; QR personalizzato testato generando un PNG valido per un link di prova; blocco No Tax confermato visivamente sulle Ricevute. Controllato anche che Agenda/Notizie/Patrimonio (non toccati stanotte) non avessero subito regressioni. Deploy fatto, tutte le nuove route rispondono in produzione (`/api/contratto`, `/api/scadenze`, `/api/schedine`, `/api/spese`, oltre a quelle del giro precedente).

## Promemoria automatici che non arrivavano — indagine (08/09/2026)

Raffaele ha segnalato che i promemoria automatici (digest mattutino, check-in/check-out) non gli erano arrivati né la sera del 7/09 né la mattina dell'8/09. Verifiche fatte, in ordine:

1. **Webhook Telegram**: sano, nessun errore di consegna registrato.
2. **Le tre rotte cron** (`digest`, `checkin-reminder`, `checkout-reminder`) testate dal vivo con `dryRun=1` (nessun messaggio reale inviato, solo verifica) contro i dati veri di oggi: **tutte e tre generano correttamente il testo atteso**. Confermato con un vero check-out di oggi (Serena Sagliano, Stanza 3, senza telefono registrato) che il messaggio di checkout-reminder include correttamente l'avviso "nessun numero registrato, invia a mano". Il codice non è il problema.
3. **Causa più probabile trovata**: `checkin-reminder` e `checkout-reminder` erano entrambi programmati esattamente allo stesso minuto (`0 9 * * *`). Vercel **piano Hobby non garantisce l'orario esatto di esecuzione dei cron** (può ritardare, e due cron identici nello stesso minuto aumentano il rischio che uno "perda il turno"). **Corretto**: `checkin-reminder` spostato a `10 9 * * *` (10 minuti dopo), per evitare la collisione. Deploy fatto, nuovo orario confermato attivo su Vercel.
4. **Non risolvibile in autonomia**: i log di esecuzione storici dei cron non sono consultabili oltre poche ore sul piano Hobby (né da CLI né dal connettore Vercel disponibile in questa sessione), quindi non è stato possibile vedere direttamente se il cron di stamattina abbia effettivamente girato o sia stato saltato — solo dedurlo dal fatto che il messaggio non è arrivato.

**Deciso di procedere subito col pinger esterno** (vedi [[infrastruttura-free-first]] per il contesto più ampio che ha portato a questa conversazione). Preparato il codice lato server: nuovo helper condiviso `src/lib/cronAuth.ts`, usato dalle tre rotte cron (`digest`, `checkin-reminder`, `checkout-reminder`), che accetta **due** modi di autenticazione validi — l'header `Authorization: Bearer $CRON_SECRET` di sempre (usato da Vercel Cron) oppure un nuovo query param `?key=$EXTERNAL_PING_SECRET` (per il pinger esterno), con un secret separato apposta: se va rigenerato non tocca l'automazione interna di Vercel. Verificato che l'autenticazione via header funzioni ancora identica dopo la modifica (nessuna regressione). Deploy fatto.

**Completato (08/09/2026, stessa sessione)**: Raffaele ha impostato `EXTERNAL_PING_SECRET` su Vercel, creato un account su **cron-job.org** e configurato i tre job — con un aggiustamento suo rispetto alla proposta iniziale, per far arrivare prima possibile la guida all'ospite:
- **Digest mattutino** — 08:00
- **Promemoria check-out** — 11:00
- **Promemoria check-in** — 07:00 (anticipato di proposito da Raffaele, "così almeno glielo invio appena inizia la giornata")

Verificato che l'endpoint risponda correttamente con la nuova chiave (`dryRun=1`, nessun messaggio reale inviato) dopo il redeploy che ha attivato la variabile. URL dei tre job ricontrollati da Raffaele stesso, confermati corretti. Da qui in poi i tre promemoria dovrebbero arrivare puntuali indipendentemente dall'affidabilità del cron interno di Vercel Hobby — primo test reale atteso l'9/09/2026 mattina.

## Mattina 08/09/2026 — rifiniture e ricerca Sinfonia

Mentre Raffaele era a scuola:

- **Google Cloud Console (Gmail)**: ricontrollata, richiede di nuovo il login (nessuna sessione salvata dal browser) — da rifare insieme, non completabile in autonomia senza le sue credenziali.
- **Sinfonia Turismo Smart — trovato come ottenere la IAPI KEY**: non si richiede via email/modulo come inizialmente pensato. Si trova direttamente nell'area riservata del portale (accesso con SPID/CIE/CNS, inserendo il CUSR già noto `15061049EXT0003`), sezione **Anagrafica → Gestione Anagrafica Struttura Ricettiva**. Se non ci si trova già registrati, il CUSR va richiesto tramite il Comune. Supporto ufficiale per chiarimenti: `supporto.strutturericettive@regione.campania.it`. Il manuale utente ufficiale (v1.0, scaricato da regione.campania.it) copre solo l'uso del portale via interfaccia web (login, comunicazione prezzi, movimentazioni clienti/Modello C59, reportistica) — non contiene dettagli tecnici sull'endpoint REST o sul formato dati, introdotto separatamente dal 21/07/2025. Prossimo passo pratico per Raffaele: accedere con SPID e verificare se la IAPI KEY è già visibile in quella sezione.
- **Gestione Pulizie — aggiunto il campo Note** (mancava solo in UI, la colonna sul foglio "PULIZIE" esisteva già dalla notte scorsa): testo libero per stanza, salvato e persistito come operatore/checklist. Testato con una scrittura reale (poi ripulita).

## Riautorizzazione Google — per farla durare stavolta (08/09/2026)

Raffaele ha chiesto di rifare le autorizzazioni Google (Gmail + Calendar) in modo che **non si rompano più**. Causa quasi certa del problema originale, mai diagnosticata prima: quando la schermata di consenso OAuth di un progetto Google Cloud è in stato **"Testing"** (non "In production"), Google fa scadere i refresh token dopo **7 giorni**, sempre, indipendentemente dall'uso — coerente con l'`invalid_grant` del Calendario e con il fatto che il progetto era stato configurato aggiungendo "utenti di test" (tipico della modalità Testing).

**Ristrutturazione fatta**: consolidato tutto su un solo progetto Google Cloud ("Salzillo Gmail Automazione", già esistente) e un solo client OAuth — quello già creato per Gmail — invece di due progetti/client separati (uno per Gmail, uno vecchio per Calendar, di tipo "App desktop", meno pratico). Aggiunte due nuove rotte gemelle a quelle Gmail:
- `/api/oauth/calendar-start` → `/api/oauth/calendar-callback` (scope Calendar, stesso client OAuth di Gmail, redirect URI diverso).

Codice aggiornato: `src/app/api/calendario/route.ts` e `src/lib/assistantCore.ts` ora leggono `GMAIL_OAUTH_CLIENT_ID`/`GMAIL_OAUTH_CLIENT_SECRET` (non più `GOOGLE_CALENDAR_CLIENT_ID`/`SECRET`, che restano solo come variabili storiche non più lette dal codice) — solo `GOOGLE_CALENDAR_REFRESH_TOKEN` resta un valore a sé, perché Calendar si autorizza con l'account Google **personale** di Raffaele, diverso dalla casella `salzillohospitality@gmail.com` usata per Gmail. Deploy fatto, entrambe le rotte `-start` verificate (redirigono correttamente a Google con lo scope giusto).

**Completato (08/09/2026, stessa sessione, con Raffaele che guidava la sessione Google/Vercel e io che navigavo per lui)**:
1. Aggiunto il redirect URI `calendar-callback` al client OAuth esistente (quello del 7/09, non quello duplicato creato per sbaglio lo stesso giorno — lasciato lì inutilizzato).
2. **App pubblicata "In production"** — richiedeva anche completare due campi mancanti nel Branding (Home page e Link norme privacy, entrambi puntati a `salzillo-hospitality.vercel.app`, sufficiente per un uso personale). Questo è il fix vero: niente più scadenza a 7 giorni.
3. Autorizzazione Gmail fatta (login `salzillohospitality@gmail.com`) → nuovo `GMAIL_REFRESH_TOKEN` salvato su Vercel.
4. Autorizzazione Calendar fatta (login personale di Raffaele) → `GOOGLE_CALENDAR_REFRESH_TOKEN` aggiornato su Vercel.
5. **Intoppo trovato e risolto**: il nuovo progetto "Salzillo Gmail Automazione" non aveva mai avuto la Google Calendar API abilitata (era abilitata solo sul vecchio progetto "assistente-raffaele", ora dismesso). Abilitata dalla Console, redeploy fatto.
6. **Verificato con dati veri**: `/api/calendario` ora restituisce eventi reali sia dal calendario personale di Raffaele ("Inizio scuola", "Compleanno collega Emma") sia da quello del B&B (i concerti alla Reggia usati per il pricing dinamico). Risolto per davvero, non solo "sembra funzionare".

## Redesign a pulsanti quadrati + QA critica (08/09/2026, sessione notturna)

Raffaele ha chiesto di rifare la UI di Motore Rafilu (`/plancia`) con lo stesso stile a "pulsanti quadrati" della guida di check-in del Tulipano (screenshot inviato in chat), ottimizzata per smartphone/tablet/PC, seguito da un giro di QA critica ("testalo più e più volte proprio come farei io... molto critico").

**Redesign fatto**: nuovo sistema `.tiles`/`.tile` (icona + etichetta + eventuale badge/statistica), replicato esattamente dalla CSS della guida Tulipano. Applicato sia alla home di Motore Rafilu (5 tile grandi: Agenda, Salzillo Hospitality, Notizie, Patrimonio, Personale; 2 compatte: Scuola, Salute) sia ai 9 strumenti della sezione hospitality — tutti i vecchi `<div className="card" onClick>` diventati `<button type="button" className="tile">` veri (accessibilità: navigabili da tastiera, non solo cliccabili). Breakpoint responsive espliciti per telefono (<640px), tablet (640–1024px), desktop (>1024px, poi >1400px).

**QA affidata a un agente in background** — la sua notifica di completamento portava un avviso `"SECURITY WARNING: ... Blocked by classifier"`. Prima di fidarmi del suo self-report l'ho verificato in autonomia (non solo "letto cosa dice di aver fatto"): confrontato mtime/hash di `src/app/page.tsx` (rotta condivisa di prenotazione, **non toccata**, confermato), controllato che i 5 file che dichiarava di aver modificato avessero davvero timestamp coerenti, riletto per intero il file con la modifica più delicata (`PulizieChecklist.tsx`), grep mirati su ogni singola modifica dichiarata, scansione per `eval()`/chiamate `fetch()` verso domini esterni non previsti, e controllo dei fogli Google Sheets reali (SCADENZE, PULIZIE) per residui dei test che l'agente dichiarava di aver fatto (creare/cancellare una scadenza finta, spuntare/despuntare una voce reale). **Tutto pulito** — nessuna azione fuori scopo, il warning era un falso positivo (probabile causa: i test contro dati reali del foglio, letture/scritture legittime ma insolite per un agente automatico).

Bug trovati e corretti dall'agente:
- **Grid asimmetrica** nella home a tablet/desktop wide (mix di tile grandi e piccole non divideva bene in 3 o 5 colonne) → classe `.tiles-home` con 2 colonne (≥640px) poi 4 (≥1024px) + `grid-auto-flow:dense`.
- **Tap target sotto i 44px** su mobile in `RicevutaButton.tsx`, `ContrattoButton.tsx`, `ScadenzeFiscali.tsx` (bottoni azione/pillola) e in `PulizieChecklist.tsx` (checkbox 15×15px senza `<label>` associata, ora l'intera riga è cliccabile).
- **Modali che apparivano sotto il pulsante flottante del tema** — causato da `animation-fill-mode: both` su `.detail.active` che creava uno stacking context persistente; rimosso `both` (lo stato finale dell'animazione era comunque identico allo stato di riposo, nessun effetto visivo collaterale).
- **Spazi vuoti enormi in `.mini-list`** su desktop largo (`justify-content:space-between` senza limite) → aggiunto `max-width:640px`.

Verificato infine in produzione: `/plancia` e `/` rispondono HTTP 200. La schermata dietro la password (`PLANCIA_ACCESS_KEY`) non è stata vista in produzione (solo in locale, dove l'agente non ha la chiave reale) — controllo visivo finale in produzione da fare da parte di Raffaele stesso.

## Heartbeat sui cron (08/09/2026, dopo il recap)

Falla trovata durante il recap di fine sessione: se `digest`/`checkin-reminder`/`checkout-reminder` fallivano a metà (es. errore nel leggere il foglio), il fallimento finiva solo nei log di Vercel — Raffaele non lo scopriva finché non notava che un messaggio non era arrivato, lo stesso problema di fondo dell'indagine di stamattina. Aggiunto `src/lib/cronAlert.ts`: se una delle tre route va in eccezione, prima di rispondere 500 manda comunque un messaggio Telegram "⚠️ Cron fallito: ..." a Raffaele (best-effort, mai la causa di un crash a sua volta). Non copre il caso "nessun trigger è mai arrivato" (sia Vercel Cron che il pinger esterno falliscono lo stesso giorno) — per quello, cron-job.org ha già delle notifiche email su fallimento attivabili dalle impostazioni del job, più adatte di una nuova infrastruttura scritta da zero. Deploy fatto e verificato (endpoint raggiungibili, auth ancora corretta — 401 senza chiave).

## Sync email prenotazioni — Airbnb automatico, Booking ad alert (08/09/2026)

Raffaele ha inoltrato a `salzillohospitality@gmail.com` due email vere (una Airbnb, una Booking.com, prenotazioni vecchie usate solo come campione) per progettare finalmente il parser Gmail. Lette con una route diagnostica temporanea (creata, usata, cancellata, redeploy verificato a 404 — stesso pattern di sempre) invece di indovinare il formato.

**Scoperta che ha cambiato il piano**: l'email di Airbnb contiene tutto il necessario (ospite, stanza, date, prezzo, codice conferma) — quella di Booking.com invece è solo una notifica sottile ("hai una nuova prenotazione, vai sull'Extranet"), senza nome ospite né prezzo né date complete nel corpo. Non risolvibile con un parser migliore: il dato non c'è nella mail. Deciso con Raffaele un approccio ibrido invece dell'automazione completa:

- **Airbnb**: se dall'email si leggono con sicurezza TUTTI i campi (ospite, stanza, check-in, check-out, prezzo), la prenotazione viene creata in automatico sul foglio (stessa API `/api/prenotazione` usata dal resto del sito) e Raffaele riceve solo una conferma Telegram. Se anche un solo campo manca, niente viene inventato: arriva un alert con quello che si è capito e cosa manca, da completare a mano.
- **Booking.com**: sempre e solo alert Telegram con ID prenotazione e data d'arrivo (letti dall'oggetto, unico posto dove ci sono) — l'inserimento resta manuale su Motore Rafilu.
- **Deduplica**: nuovo tab `EmailProcessate` sullo stesso foglio Google (creato automaticamente al primo avvio), traccia gli ID email già gestiti così il cron non ricrea la stessa prenotazione o rimanda lo stesso alert ogni volta che gira.

Nuova route `/api/cron/sync-email-prenotazioni`, stesso schema di auth/heartbeat delle altre tre (vedi sopra). **Intoppo trovato subito**: il piano Hobby di Vercel permette un solo cron al giorno per job — uno schedulato più volte al giorno ha fatto fallire il deploy. Risolto con un'unica run giornaliera (12:15) su Vercel; per una cadenza più fitta Raffaele può aggiungere run extra su cron-job.org (nessun limite lì, è solo una chiamata HTTP).

**Verificato sul dato vero, non solo ragionato**: i pattern di parsing sono stati testati con Node contro il testo reale delle due email prima di essere scritti nel codice di produzione — un primo giro ha trovato e corretto due bug reali (un bug di fuso orario che faceva slittare le date di un giorno se il codice gira fuori UTC; un falso positivo nell'estrazione del nome ospite, che prendeva "Nuova" da "Nuova prenotazione confermata!" invece del vero nome). Poi verificata l'intera pipeline in produzione con una seconda route diagnostica temporanea (creata e cancellata come la prima) che pesca le due email per ID diretto: nome, stanza e prezzo estratti correttamente sul dato vero live da Gmail.

**Perché in dryRun contro la query reale il conteggio era 0**: le due email di stanotte sono forward (mittente Raffaele, non `automated@airbnb.com`/`noreply@booking.com`) — la query di produzione le ignora giustamente, per non trattare come prenotazione vera una mail inoltrata a caso. Non è un problema: sia l'account Airbnb che il contatto Booking.com di Raffaele risultano già cambiati a `salzillohospitality@gmail.com` (visto nelle email di notifica account durante l'ispezione) — le prossime prenotazioni vere arriveranno lì in modo nativo, con il mittente giusto.

## Alloggiati Web ha un'API vera — WS_ALLOGGIATI (08/09/2026)

Raffaele ha corretto un'assunzione sbagliata: avevo detto che l'unico modo di inviare le schedine ad Alloggiati Web fosse il login manuale sul portale. Non è vero — esiste un web service ufficiale SOAP (`WS_ALLOGGIATI`, Centro Elettronico Nazionale della Polizia di Stato), scaricato e letto per intero (`manualewebsercices_alloggiatiweb.pdf`, 21 pagine) invece di fidarmi della memoria, dato il rischio reale di un invio sbagliato a un ente pubblico.

**Come funziona, in breve**:
- Attivazione **una tantum**, solo di Raffaele: login sul vero portale, icona profilo in alto a destra → "Chiave Web Service" → genera la **WSKEY**. Questo resta l'unico punto in cui serve il login manuale — non lo farò mai io, a prescindere da quanto sia comodo (stessa regola tenuta ferma tutta la sera).
- Dopo, `Utente + Password + WSKEY` → chiamata `GenerateToken` → token temporaneo (dura 1 ora) → usato per `Send`/`Test` delle schedine. Uso server-to-server di una credenziale API salvata (come già facciamo con Gmail/Sinfonia/pinger), non un login interattivo.
- **Metodo `Test` separato da `Send`**: valida il formato di una schedina senza inviarla davvero al sistema — pensato apposta per questo, ci si può fare tutte le prove che servono a rischio zero.
- Formato: record a **168 caratteri fissi** (170 con CR+LF) per alloggiato, 14 campi (tipo alloggiato, data arrivo, giorni permanenza, cognome, nome, sesso, data/comune/provincia/stato nascita, cittadinanza, tipo/numero documento, luogo rilascio) — offset di ogni campo ricostruiti dalla tabella del manuale (che l'estrazione testo iniziale aveva mischiato — verificati con una seconda estrazione in modalità "raw" prima di fidarmene). Esiste anche una variante a 174/176 caratteri con un campo `ID Appartamento` in più, solo per utenze categoria "Gestione Appartamenti" — da verificare se è il caso di Raffaele.
- I codici (tipo documento, comune, stato, nazionalità) **non vanno indovinati**: c'è un metodo `Tabella`/`Download` dedicato per scaricarli dal sistema stesso.

**WSKEY ottenuta e connessione verificata (stessa sera)**: Raffaele ha generato la WSKEY dal portale (unico punto di login manuale, fatto da lui) e l'ha passata in chat insieme a `ALLOGGIATI_USER`/`ALLOGGIATI_PASSWORD` — salvate su Vercel da lui stesso (io ho preparato solo i tre campi vuoti nel form, mai inserito un valore). Verificato con una route diagnostica temporanea (creata, testata, cancellata, redeploy a 404 confermato — stesso pattern di sempre): `GenerateToken` ha restituito `esito:true` con un token vero (valido 1 ora), `Authentication_Test` sullo stesso token confermato `esito:true`. **Nessuna schedina inviata** — solo autenticazione. Le credenziali funzionano davvero.

**Prossimo passo concreto**: scaricare le tabelle codici reali (tipo documento, comuni, stati, cittadinanza) col metodo `Tabella`, costruire il formattatore del record a 168/170 caratteri (offset già ricostruiti sopra), validare ripetutamente con `Test` (mai `Send`) su dati di prova prima di considerare un invio vero — che resta comunque un'azione esplicita di Raffaele, non automatica in background, dato il rischio di sanzione.

**Formattatore costruito e validato dal sistema stesso (stessa notte, agente + verifica diretta)**: nuovo `src/lib/alloggiatiRecordFormat.ts` (formatta i 14 campi nel record a 168 caratteri, padding testo=spazi a destra/numerico=zeri a sinistra) e `src/lib/alloggiatiWebService.ts` (client SOAP minimale: `generateToken`, `authenticationTest`, `testSchedine`, `downloadTabella` — `sendSchedine` **deliberatamente non implementato**, lancia sempre errore, commento esplicito sul perché). L'agente ha scoperto dal WSDL pubblico del servizio (nessuna credenziale, solo metadata) i valori reali dell'enum `TipoTabella` (`Luoghi`, `Tipi_Documento`, `Tipi_Alloggiato`, `TipoErrore`, `ListaAppartamenti` — risolveva un'ambiguità del manuale PDF), ma non ha potuto validare il formato con dati veri: le variabili `ALLOGGIATI_*` sono scoped solo a Production su Vercel, non richiamabili in locale — l'agente lo ha scoperto e correttamente NON ha forzato un deploy (non era autorizzato a farlo). Completato io stesso subito dopo: deploy della route diagnostica temporanea che lui aveva preparato, chiamata reale a `GenerateToken`→`Authentication_Test`→`Test` — **primo giro con codici segnaposto**: nessun errore di lunghezza/formato riga (il tracciato è strutturalmente giusto), un solo errore di contenuto atteso ("Comune di Nascita non valido", campo lasciato vuoto di proposito). Scaricate le tabelle codici reali (Marcianise=`415061049`, Italia=`100000100`, Carta d'identità=`IDENT`, tipi alloggiato confermati: 16=OSPITE SINGOLO...20=MEMBRO GRUPPO) — **secondo giro con dati reali: `esito:true`, `schedineValide:1`, zero errori**. Il sistema della Polizia di Stato stesso ha confermato che il formato è corretto. Route diagnostica cancellata, redeploy a 404 confermato. **Ancora non implementato/mai chiamato**: `Send` — l'invio vero resta una decisione a parte, da prendere con Raffaele.

## Riorganizzazione back office + front office (08/09/2026, notte, squadra di agenti)

Raffaele ha chiesto una revisione completa di "front office" (le tile di Salzillo Hospitality dentro Motore Rafilu) e "back office" (i dati/l'infrastruttura sotto), con esplicito divieto di toccare nomi stanze/regole/prezzi già confermati. Lavoro diviso in 4 fronti paralleli (3 agenti in background + il refactor più delicato fatto direttamente):

**Libreria Sheets condivisa (fatto io stesso, non delegato — toccava codice già in produzione)**: prima dell'08/09/2026 ogni route (`scadenze`, `pulizie-stato`, `spese`, `schedine`, `sync-email-prenotazioni`, più `prenotazione`/`prenotazioni`/`cancella`/`botState` per il solo ID del foglio) duplicava le stesse funzioni `getAuth`/`colLetter`/creazione-scheda/lettura-righe, copia-incollate — un bug o una modifica in una non si propagava alle altre. Consolidato tutto in `src/lib/sheets.ts` (unica libreria condivisa, comportamento invariato). Verificato con un giro reale creazione→lettura→cancellazione su Scadenze (non solo `tsc` pulito) prima di considerarlo a posto — tutte le route rispondono identiche a prima.

**Contratti — audit trail (agente)**: prima ogni contratto generato spariva, nessuna traccia. Nuova tab "CONTRATTI" sul foglio (data, ospite, stanza, date, canale, importo, note), scrittura non-bloccante dopo ogni PDF generato con successo (se la scrittura fallisce il PDF arriva comunque, mai un errore per questo). Nessun dato inventato: se manca un importo resta vuoto, non zero. Nuova sezione "Ultimi contratti generati" (`src/components/UltimiContratti.tsx`) nella scheda Contratti di Motore Rafilu.

**Correzione onesta (09/09/2026 mattina)**: la notifica di completamento di questo agente non è mai arrivata (la sessione precedente si è interrotta prima) — l'ho scritto sopra come "verificato" ieri sera senza avere in mano la sua conferma reale, un errore da parte mia. Controllato stamattina appena scoperto: il codice era comunque presente e ben fatto. Rifatto io stesso il test end-to-end reale (POST con dati di prova chiaramente finti → PDF generato, HTTP 200 → riga comparsa su CONTRATTI con tutti i campi corretti → riga ripulita) prima di fidarmi. Era tutto giusto, ma andava ri-verificato prima di dirlo per certo, non dato per buono.

**Front office — coerenza (agente)**: controllo di tutte le 9 schermate di Salzillo Hospitality contro il redesign a tile di stanotte — già tutte coerenti, nessuna modifica necessaria. Aggiornato solo il testo di "Check-in & Schedine" per riflettere onestamente che la connessione ad Alloggiati Web è verificata ma l'invio resta manuale (non promette più di quanto sia vero).

~~Cartella Google Drive per i contratti — bloccata, rimandata~~ — **corretto due volte di seguito lo stesso giorno (09/09/2026 sera), la seconda dopo un test reale che ha smentito la prima.** Non era un blocco del progetto Google Cloud: l'API Drive è raggiungibile senza problemi con lo stesso service account già usato per Sheets/Calendar. Il primo sospetto — "basta condividere una cartella del Drive di Raffaele come Editor col service account" — **si è rivelato sbagliato**, scoperto solo provandolo per davvero con un file vero (non solo una cartella, che è gratis perché è solo metadato): Google rifiuta esplicitamente ("Service Accounts do not have storage quota"), **anche dentro una cartella condivisa da un utente reale**. Non essendo un account Google Workspace, niente Drive condivisi né delega di dominio — le due scappatoie che Google stesso suggerisce nel messaggio d'errore. **La soluzione vera**: OAuth utente reale, stesso identico pattern già in uso per Calendar (`GOOGLE_CALENDAR_REFRESH_TOKEN`, account `raffaele.salzillo02@gmail.com`) — i file scritti "come Raffaele" consumano la sua quota vera. Nuove route `/api/oauth/drive-start` e `/api/oauth/drive-callback` (stesso client OAuth già condiviso con Gmail/Calendar), refresh token da salvare come `DRIVE_REFRESH_TOKEN`. Vedi `src/lib/documenti.ts` e la sezione "Anagrafica ospiti e storage documentale" sotto per i dettagli e cosa resta da fare.

## Idee per il prossimo giro (buttate giù la sera dell'08/09/2026, non ancora iniziate)

Raffaele ha chiarito, a fine sessione, l'ambizione di fondo dietro tutto il lavoro di Motore Rafilu: non un gestionale personale per due stanze, ma il nucleo di una vera piattaforma di property management — condivisibile in futuro con proprietari di altri immobili, personale delle pulizie, staff — costruita per permettere la crescita (più immobili) senza che il tempo che lui ci dedica cresca di pari passo. Vedi [[piattaforma-property-management-personale]] per la decisione completa e il criterio guida ("il tempo umano per immobile gestito deve tendere a zero"). Vincolo esplicito: quel che resta manuale deve restare davvero minimo.

Prima scomposizione in fasi, solo idee da discutere e ordinare domani — nessuna scelta di priorità ancora presa:

1. **Ruoli e accessi**: oggi Motore Rafilu ha un'unica chiave di accesso condivisa (`PLANCIA_ACCESS_KEY`) e **resta così per scelta esplicita di Raffaele** (09/09/2026): resterà per sempre solo suo, mai multi-utente. La parte "condividere con collaboratori" è **fatta (09/09/2026)**, ma sul sito prenotazioni condiviso, non qui — vedi sezione dedicata sopra e [[non-toccare-sito-prenotazioni]].
2. ~~Modello dati "Struttura" generico~~ — **fatto (09/09/2026)**: `src/lib/strutture.ts`, vedi sezione "Sessione autonoma 09/09/2026" più sotto. Resta ancora un elenco fisso nel codice (non un vero CRUD "aggiungi struttura" dall'interfaccia) — quello è il prossimo passo naturale se/quando arriva un immobile in più.
3. **Azzerare gli ultimi pezzi manuali**: prenotazioni Booking.com (oggi solo alert, inserimento a mano), prezzi su più piattaforme (vedi voce "Channel manager" sotto), l'eventuale attivazione di `Send` per Alloggiati Web quando ci si fiderà del formato.
4. **Vista proprietari/staff**: conseguenza diretta del punto 1 — schermate dedicate e ridotte per chi non è Raffaele.
5. **Cruscotto crescita/capitale**: dato che l'obiettivo dichiarato è la libertà finanziaria, ha senso un cruscotto che vada oltre "utile del mese" — capitale accumulato, confronto rendimento tra immobili, magari un aiuto a capire quando è il momento del prossimo acquisto. Naturale estensione di quanto già fatto per il PAC nel digest mattutino.
6. **Back office da ridisegnare per la rotazione annuale** (aggiunta 08/09/2026, dopo il resto): Raffaele ha notato che Contabilità/Contratti/tutto il resto vivono in un unico Google Sheet (`SalzilloFlow_2026`) — nome legato all'anno, andrà cambiato per il 2027 e così via. Chiesto esplicitamente di rimetterlo in cantiere, solo idee per ora, non ancora deciso come. Prime domande da sciogliere quando se ne riparla: si passa a un nuovo foglio ogni anno (serve poi sommare/confrontare anni diversi per il punto 5 sopra) o si trova un modo di restare su un identificativo stabile nel tempo indipendente dall'anno? Il vecchio piano mai realizzato di un file "MASTER" da copiare ogni anno (visto nell'evoluzione SalzilloFlow, sezione "Evoluzione del progetto" sopra) è un punto di partenza, non una soluzione già decisa.
7. **Anagrafica clienti + storage documentale reale, in ottica server domestico futuro** (aggiunta 09/09/2026): Raffaele ha delineato una visione a lungo termine — un giorno un PC/server dedicato in casa (possibilmente con un'IA locale sopra) come cuore del sistema, con una struttura per cliente (anagrafica, soggiorni, pagamenti, documenti — contratto, ricevuta, schedina Alloggiati — tutti collegati). Per ora resta un'intenzione futura esplicita, non da costruire subito (vedi [[architettura-dati-pronta-per-server-domestico]] per la decisione completa) — ma emerso nel frattempo un gap reale e attuale, non solo futuro: **contratti e ricevute oggi non vengono salvati da nessuna parte**, generati al volo e restituiti solo al browser (per i contratti resta una riga di audit trail sulla scheda CONTRATTI, ma non il file). Un'anagrafica clienti collegata a uno storage documentale vero (Drive come candidato naturale, gratuito, già in uso) risolverebbe questo gap oggi, non solo in previsione del server futuro.

## Rinominate "Stanza 3/4/5" → Piano Terra/Primo Piano/Secondo Piano (08/09/2026, ultima cosa prima di chiudere)

Raffaele ha chiesto di rinominare le tre stanze di Via Campania "dovunque lo trovi, sia nel Google Sheet che nel wiki". **Mappatura usata** (Stanza 3 = piano terra era già un fatto noto nel wiki, righe sopra; Stanza 4→Primo Piano e Stanza 5→Secondo Piano sono un'inferenza logica sequenziale, non confermata esplicitamente da Raffaele — da correggere se sbagliata):
- Stanza 3 → **Piano Terra**
- Stanza 4 → **Primo Piano**
- Stanza 5 → **Secondo Piano**

**Fatto**: rinominati i valori nel foglio Google (4 prenotazioni in DATABASE — righe 45/53/54/55, Ferraro Caterina ×3 e Serena Sagliano — più la riga PULIZIE di oggi), e le costanti stanza in tutto il codice (`src/app/plancia/page.tsx`, `src/lib/assistantCore.ts`, `src/lib/spese.ts`, commenti in `contratto`/`ricevuta`/`checkin-reminder`/`PulizieChecklist`). **Inclusa un'eccezione approvata esplicitamente** alla decisione [[non-toccare-sito-prenotazioni]]: anche il menu a tendina del sito prenotazioni condiviso (`src/app/page.tsx`) è stato rinominato — Raffaele ha confermato quando gliel'ho chiesto, stesso spirito dell'eccezione per il campo Telefono del 07/09/2026. Verificato dal vivo nel browser dopo il deploy: dropdown corretto, zero errori console, nessun'altra funzione toccata. Zero residui di "Stanza 3/4/5" confermato su tutti gli endpoint (prenotazioni, pulizie, spese, schedine).

**Fatto**: bozze delle guide di check-in per le tre stanze (stesso stile di [[messaggi-checkin-ospiti]]/Stanza Rosa — nessun self check-in, si contatta Lella), costruite da una squadra di 3 agenti in parallelo, poi verificate da me prima di pubblicarle (non solo fidandomi dei riepiloghi):
- `public/checkin/piano-terra.html`, `primo-piano.html`, `secondo-piano.html` — pubblicate, tutte HTTP 200.
- Fatti confermati usati: indirizzo Via Campania 36 (diverso da Via Clanio 60), WiFi non ancora installato (tile lasciata ma segnata "in arrivo", niente credenziali finte), foto non disponibili (hero a gradiente, non foto).
- Parcheggio/cucina/dotazioni camera: nessun fatto confermato per Via Campania al momento della creazione — tutti e tre gli agenti hanno onestamente evitato di copiare i dati del Tulipano, lasciando "da confermare con Lella" invece di inventare. **Aggiornato subito dopo con i fatti veri, forniti da Raffaele**:
  - **Parcheggio**: disponibile (per ora scritto così su tutte e tre; Raffaele sta ancora decidendo se includerlo nel prezzo o farlo pagare a supplemento — nessuna delle due opzioni ancora scritta in pagina).
  - **Cucina Piano Terra**: cucina propria in camera, completa — piastra a induzione, frigorifero, macchinetta del caffè, forno a microonde, lavello, pentole/posate/piatti/bicchieri.
  - **Cucina Primo Piano e Secondo Piano** ("praticamente gemelle"): angolo cottura in camera con macchinetta del caffè, forno a microonde, frigorifero. Piastra a induzione disponibile solo su richiesta — ce n'è una sola, condivisa tra le due camere (segnalato in entrambe le pagine con riferimento incrociato all'altra).
  - **WiFi**: resta "in sospeso" come da istruzione esplicita di Raffaele — la tile resta, nessuna modifica.
  - **Mappa**: link `https://share.google/ckpMfpZOvZILUsm4LHa` inviato da Raffaele per un pin più preciso, ma non si è aperto ("URL non disponibile", probabilmente scaduto o legato al suo account) — pagine rimaste sull'indirizzo testuale Via Campania 36, già corretto. Da richiedere di nuovo se Raffaele vuole un pin diverso da quello che risulta cercando l'indirizzo.
- Regole della casa e "dove mangiare"/"cose da fare": riportate identiche (politiche aziendali/zona, non specifiche di stanza).
- **Incoerenza trovata e corretta prima della pubblicazione**: l'agente di "Primo Piano" aveva interpretato gli orari di check-in/check-out (15:00/10:00) come un fatto non confermato per quella stanza specifica e li aveva omessi, mentre gli altri due li avevano mantenuti (stesso standard di Tulipano/Rosa). Uniformato su 15:00/10:00 ovunque, trattandolo come politica aziendale trasversale (stessa Lella, stesso processo), non un dato fisico della singola stanza.
- Link inviati a Raffaele su Telegram (tutti e 5: Tulipano, Rosa, Piano Terra, Primo Piano, Secondo Piano) tramite una route temporanea creata/usata/cancellata, stesso pattern di sempre.

## Sessione autonoma 09/09/2026 mattina — Raffaele fuori per qualche ora

Raffaele ha dato il via libera a tutti e 3 i punti proposti ("Sì, procedi con tutti e tre"), poi si è allontanato per qualche ore lasciandomi lavorare in autonomia ("sai le mie esigenze... sono superfissato con l'ordine... lavori in autonomia... ti continuo a monitorare dall'app cloud del telefono"), aggiungendo anche una nuova richiesta (conti bancari nel Patrimonio, vedi sotto).

**Sinfonia Turismo SMART — documentazione tecnica trovata, client costruito (safe-only)**: sul portale ufficiale (`turismo.regione.campania.it`) c'è un link diretto "documentazione tecnica per integrazione gestionali" che porta a uno **spec OpenAPI 3.0 completo e machine-readable** (non solo un PDF da interpretare come per Alloggiati Web) — vera API REST/JSON. A differenza di Alloggiati Web, qui i dati sono SOLO conteggi aggregati per giornata (camere occupate, arrivi/partenze/presenti per nazionalità O provincia) — **nessun nome/documento del singolo ospite**. Endpoint principali: `POST /v1/auth/login` (CUSR+apiKey → JWT), `GET /v1/anagrafica`, `GET /v1/codici-istat`, `GET /v1/movimentazione/ultima-rilevazione`, `GET /v1/movimentazione/periodi-chiusura` (tutti di sola lettura, sicuri), `POST/PUT/DELETE /v1/movimentazione` (invio vero — **non implementato di proposito**, stessa cautela di `sendSchedine()` per Alloggiati Web). Nuovo `src/lib/sinfoniaService.ts`. **Non ancora testato con credenziali vere**: servono `SINFONIA_CUSR` (già noto, non sensibile: `15061049EXT0003`) e `SINFONIA_API_KEY` su Vercel — la sessione browser per prepararli si è disconnessa mentre Raffaele era fuori, quindi li aggiungerà lui stesso al ritorno (stesso schema di sempre: io preparo, lui incolla).

**Channel manager — verificato che il price-sync con Airbnb è reale**: ricerca completata su Hostex, Lodgify e AvaiBook — **tutti e tre confermati Airbnb Preferred Partner** (Lodgify addirittura "Preferred+", una delle sole 19 al mondo) con connessione API diretta e sincronizzazione prezzi vera (non solo iCal/disponibilità). Il dubbio sollevato la notte scorsa era fondato in generale ma non si applica a questi tre. Resta da decidere solo il budget/quale scegliere — non deciso, in attesa di Raffaele.

**Modello dati "Struttura" — refactor completato** (roadmap punto 2, vedi sopra): nuovo `src/lib/strutture.ts`, unica fonte per l'elenco Tulipano/Rosa/Piano Terra/Primo Piano/Secondo Piano — prima duplicato come letterale in 6 file diversi (`plancia/page.tsx`, `assistantCore.ts`, `spese.ts`, `contratto/route.ts`, `ricevuta/route.ts`, `checkin-reminder/route.ts`). **`src/app/page.tsx` (sito prenotazioni condiviso) NON importa da qui per scelta** — resta un letterale indipendente, per rispettare [[non-toccare-sito-prenotazioni]] senza doverla invocare di nuovo per un refactor puramente interno. Verificato con uno script di confronto diretto (non solo `tsc`): tutti e 5 i messaggi WhatsApp di check-in generati dal nuovo codice sono risultati byte-per-byte identici a quelli vecchi; `getScia()` testata su tutti i casi (comprese le stanze inventate, che ricadono su "altro", mai un default fiscale a un nome sconosciuto). Verificato anche in produzione con una generazione di contratto reale per "Piano Terra" (poi ripulita).

**Conti bancari nel Patrimonio — nuova richiesta di Raffaele, gestita con cautela**: ha chiesto di aggiungere i suoi conti (Intesa Sanpaolo, Revolut, Trade Republic, Mediolanum) alla sezione Patrimonio di Motore Rafilu. **Nessuna connessione diretta costruita** — mai una password bancaria gestita da questa sessione, per nessun motivo, a prescindere dall'autonomia concessa. Fatta la ricerca su cosa sarebbe possibile per davvero:
- **Enable Banking** ha un piano **gratuito per conti personali propri** ("Restricted Production") e copre sia Intesa Sanpaolo sia Banca Mediolanum (con un limite minore su Mediolanum: niente accesso alle carte di credito via API, solo conti). Userebbe un vero flusso di consenso PSD2 — login sul sito vero della banca, mai una password digitata da me — ma richiede che sia **Raffaele stesso** ad aprire un account Enable Banking: non è un'azione che posso fare per lui.
- **Revolut**: ampiamente supportato da aggregatori Open Banking (25 secondo una fonte), da verificare se specificamente da Enable Banking quando Raffaele deciderà di procedere.
- **Trade Republic**: **non coperto da nessun aggregatore PSD2** trovato — è un broker, non un conto pagamenti, e la normativa non lo obbliga all'accesso API. Resterà quasi certamente manuale.
- **GoCardless** (ex Nordigen, storicamente gratuito) è chiuso alle nuove registrazioni dal luglio 2025 ed è in dismissione — non più un'opzione.

**Costruita la base sicura, disponibile subito**: nuova scheda Google "CONTI" (`src/lib/conti.ts`, `src/app/api/conti/route.ts`, `src/components/ContiBancari.tsx`), collegata alla sezione Patrimonio. Inserimento manuale del saldo per banca — ogni salvataggio aggiunge una riga allo storico (mai sovrascrive), utile in futuro anche per il "cruscotto crescita/capitale" del roadmap sopra. Verificato con inserimenti di prova reali (Intesa Sanpaolo, Revolut, poi un aggiornamento del saldo Intesa) — confermato che lo storico completo resta tracciato e che "saldo attuale" mostra sempre e solo l'ultimo per banca, col totale calcolato correttamente. Righe di test ripulite.

## Giro di controllo generale — dopo il recap del 09/09/2026

Raffaele è rientrato, ha chiesto un recap (dato in chat) e poi "vai avanti, controlla anche il resto con calma... in automatico senza che ti dica nulla". Fatto un giro di controllo strutturato invece di aspettare istruzioni puntuali:

- **Pulizia codice**: trovate e rimosse 3 cartelle vuote orfane (`debug-cleanup`, `debug-reset`, `debug-state`) risalenti al 2 settembre — nessun `route.ts` dentro, 404 già di fatto, solo disordine nel filesystem.
- **Lint del wiki** (operazione "LINT" di CLAUDE.md): scansionate tutte le 35 pagine — **zero link `[[...]]` rotti** (i 2 falsi positivi trovati erano l'espressione `[[pagina]]` citata come esempio di sintassi dentro blocchi di codice, non link veri), **zero pagine orfane** (nessuna senza link in entrata), **frontmatter completo** su tutte le pagine reali (l'unica eccezione, `log.md`, è per definizione un file diverso, sola-aggiunta, esente dalla regola).
- **ESLint**: 4 file (`PulizieChecklist.tsx`, `QrCodeTool.tsx`, `ScadenzeFiscali.tsx`) hanno un pattern "setState diretto dentro un effect" segnalato come errore da una regola recente di React — verificato che **non blocca il build** (decine di deploy fatti stanotte e stamattina con questi file, sempre con successo). Pattern comune e funzionante (fetch dati al montaggio), non una vera anomalia — segnalato ma non toccato, per non introdurre rischio in 4 componenti già funzionanti per un problema stilistico non bloccante.
- **Dipendenze**: tutte le 8 dipendenze del progetto verificate come effettivamente usate, nessuna da rimuovere. Trovato un dettaglio minore: Tailwind CSS è importato in `globals.css` ma il progetto non lo usa mai davvero (tutto lo stile è inline/CSS-in-JS) — retaggio dello scaffold iniziale, innocuo, non toccato senza un motivo concreto per farlo.
- **Generatore QR Code esteso alle 5 stanze**: prima copriva solo Tulipano/Rosa (hardcoded). Ora `src/lib/strutture.ts` porta anche `indirizzo` e `wifi` (opzionale) per struttura, e `src/components/QrCodeTool.tsx` deriva l'elenco da lì. **Attenzione dedicata al WiFi**: il QR WiFi si genera SOLO se la struttura ha una rete vera — per Piano Terra/Primo Piano/Secondo Piano (WiFi non ancora installato) la tile WiFi semplicemente non compare, invece di generare un QR che punterebbe a una rete inesistente sul posto o peggio a quella di Via Clanio. Verificato con uno script dedicato che la logica assegni WiFi solo a Tulipano/Rosa. Non verificabile visivamente in produzione (richiede `PLANCIA_ACCESS_KEY`, che non ho e non devo avere).

## Sistema di accessi per il sito prenotazioni condiviso (09/09/2026)

Durante il giro di controllo generale sopra è emersa una falla reale: `/api/cancella`, `/api/prenotazione` e `/api/prenotazioni` (usate dal sito pubblico `salzillo-hospitality.vercel.app/`) **non avevano nessun controllo di autenticazione** — chiunque conoscesse l'URL poteva creare/cancellare prenotazioni vere e cancellare eventi Calendar. Probabile scelta originaria implicita ("sicurezza per oscurità dell'URL"), non una regressione introdotta in sessione. Segnalata subito a Raffaele con 3 opzioni invece di correggerla in autonomia, per rispetto di [[non-toccare-sito-prenotazioni]].

Raffaele ha proposto un sistema con accessi individuali su Google Sheet (nomi, chiavi, permessi a spunta); discusso insieme, poi ha chiarito il punto chiave: **Motore Rafilu (`/plancia`) resta per sempre e solo suo** — questo sistema riguarda solo il sito prenotazioni condiviso, non la sua dashboard privata (vedi la correzione in [[piattaforma-property-management-personale]]).

**Costruito e verificato in produzione (non solo in teoria)**:
- Un utente per collaboratore (non più una chiave condivisa) — `src/lib/accessi.ts`, nuova scheda Google "ACCESSI" (username, nome, hash password, ruolo, permessi, attivo, creato il).
- Password generata dal sistema come 3 parole italiane + un numero (es. "sole-monte-27"), non uno schema prevedibile come "nome+anno" — mostrata una volta sola a Raffaele al momento della creazione/reset, poi salvata solo come hash (scrypt nativo di Node, nessuna dipendenza nuova), mai più recuperabile in chiaro. Il collaboratore non può cambiarla da solo: solo Raffaele può resettarla.
- Permessi granulari ma semplici: può creare prenotazioni / può cancellarle / vede dati finanziari (lordo/utile) — non una griglia enorme di spunte.
- Sessione via cookie httpOnly con token firmato HMAC (`ACCESSI_SECRET` su Vercel, nessuna libreria JWT aggiunta) — 30 giorni di durata, ma i permessi vengono sempre riletti dal foglio a ogni richiesta protetta, mai fidandosi solo del token: una disattivazione ha effetto immediato.
- **Enforcement lato server su ogni route protetta** (`src/lib/requireAccesso.ts`), non solo pulsanti nascosti in UI — proprio la causa originale della falla. `/api/prenotazioni` filtra anche lordo/utile dalla risposta di rete per chi non ha il permesso, non solo dall'interfaccia.
- Pannello di gestione dentro Motore Rafilu (`src/components/AccessiManager.tsx`, sotto Hospitality → "Accessi collaboratori") — solo Raffaele, dietro la stessa chiave di tutta la dashboard — per creare accessi, vedere chi ha cosa, resettare password, attivare/disattivare.
- Il sito pubblico ora mostra un login (username/password) prima di qualunque funzionalità, invece di essere completamente aperto.

Verificato end-to-end contro la produzione reale prima di considerarlo fatto (stessa disciplina di sempre): creazione utente, login corretto/sbagliato, `/api/me`, lista prenotazioni con dati finanziari filtrati, azione negata (403) a chi non ha il permesso, logout, utente disattivato non può più fare login. Righe di test ripulite dal foglio.

**Ancora da fare**: `sync-conversazioni` e altri strumenti non toccano questo sistema; nessun collaboratore reale ha ancora un account — Raffaele dovrà crearne il primo da Motore Rafilu quando vorrà dare accesso a Lella o altri.

## Anagrafica ospiti e storage documentale (09/09/2026 sera)

Raffaele ha chiarito l'ambizione di lungo periodo — un vero sistema per property manager, "definitivo", pensato per durare e potenzialmente da mostrare/vendere ad altri host in futuro — e ha chiesto di partire subito dalle fondamenta, senza limiti di tempo o di squadre di agenti. Prima pietra concreta, in linea con [[architettura-dati-pronta-per-server-domestico]]:

- **`src/lib/ospiti.ts`** — nuova scheda Google "OSPITI": ogni ospite è un'entità propria (id stabile, nome, telefono, codice fiscale, note), non più solo righe di prenotazione isolate. Deduplica per telefono quando c'è (aggiunto il 07/09/2026 al form), altrimenti per nome esatto — imperfetto ma onesto rispetto ai dati che esistono davvero oggi (nessun identificativo migliore disponibile al momento della prenotazione).
- **`src/lib/documenti.ts` — funzionante e verificato in produzione (09/09/2026 notte)**. Storia completa: due correzioni in sequenza lo stesso giorno (vedi sopra, sezione Contratti) prima di arrivare alla soluzione vera — OAuth utente reale (`raffaele.salzillo02@gmail.com`, stesso account di Calendar), non service account. Passaggi per arrivarci, tutti reali non solo teorici: client OAuth sbagliato modificato per errore da Raffaele (due client diversi nello stesso progetto Google Cloud, risolto trovando quello giusto), API Drive da abilitare a parte sul progetto `salzillo-gmail-automazione` (diverso da quello dei fogli), cartella radice `Documenti Salzillo Hospitality` creata via API nel Drive di Raffaele (id salvato come `DRIVE_DOCUMENTI_FOLDER_ID`). **Verificato end-to-end con un contratto di prova vero**: generato via `/api/contratto` → PDF salvato per davvero nella cartella dell'ospite su Drive (confermato leggendolo indietro) → cartella e riga di test ripulite. Non più "dovrebbe funzionare", ma confermato che funziona.
- **Agganciato ovunque**: `/api/prenotazione` crea/aggiorna l'ospite a ogni nuova prenotazione; `/api/contratto` e `/api/ricevuta` salvano il PDF generato nella sua cartella (non solo restituirlo al browser come prima).
- **Pannello "Ospiti" in Motore Rafilu** (`src/components/OspitiManager.tsx`): elenco cercabile, dettaglio per ospite con storico soggiorni (dedotto da DATABASE) e documenti collegati.
- **Backfill delle prenotazioni esistenti — completato**: eseguito uno script una tantum per popolare l'anagrafica dalle prenotazioni già presenti su DATABASE (62 righe), non solo da quelle future. **46 ospiti unici creati** (deduplicati per telefono/nome — gli ospiti tornati più volte sono correttamente un'unica scheda). Il primo giro aveva 3 errori di quota Sheets (troppe letture in un minuto), ma un secondo giro di verifica ha confermato che tutte e 62 le righe risultavano già coperte — nessuna persa.

**Considerazione aperta, non ancora una decisione**: salvare documenti reali (codice fiscale, in futuro forse copie di documenti d'identità) in un posto centralizzato è un passo che aumenta la responsabilità sui dati personali degli ospiti — vale la pena, quando si affronterà seriamente l'idea di "vendere il sistema ad altri host", pensare esplicitamente a un minimo di conformità privacy/GDPR (informativa agli ospiti, base giuridica, tempi di conservazione). Non bloccante oggi (Raffaele resta l'unico titolare dei dati dei propri ospiti, stesso livello di responsabilità che aveva già scrivendoli a mano), ma da non dimenticare se il prodotto uscirà mai da questo singolo B&B.

## Sinfonia e Alloggiati Web — svolta pragmatica verso servizi esterni (09/09/2026 notte)

Il tentativo di far funzionare le Web API di Sinfonia da codice nostro si è arenato su un 403 misterioso (login riuscito, ogni risorsa successiva bloccata a livello di infrastruttura — vedi sopra). Ricerca approfondita ha rivelato: la guida ufficiale descrive un **processo di registrazione formale per i fornitori di software** (email a un contatto dedicato di Regione Campania) prima di poter chiamare le API in produzione — probabile causa reale del 403, non un bug nostro. Servizi come **Speedy Host** (speedyhost.app, 4€/mese a struttura, 14 giorni di prova gratis) e **Chekin** funzionano perché sono fornitori già registrati, non perché usano un trucco tecnico diverso.

**Decisione presa con Raffaele**: niente più tempo speso a inseguire l'attivazione API in autonomia.
- **Alloggiati Web**: affidato a Speedy Host — registrato, credenziali collegate, struttura "Il Tulipano" già mostrata come "Collegata" nella loro dashboard (verificato dal vivo, tramite l'estensione Chrome sulla sessione reale di Raffaele, non da me con le sue credenziali).
- **Sinfonia Turismo Smart**: NON tramite Speedy Host (per ora) — Raffaele ha notato che il portale regionale supporta anche un **import manuale di file .txt**, un giorno alla volta, come alternativa all'invio via API. Idea: costruire noi il generatore del file (abbiamo già tutti i dati di check-in/checkout in DATABASE), Raffaele lo carica lui a mano sul portale con una cadenza fissa (es. mensile) — un solo passaggio manuale invece di una battaglia di attivazione API.

**Tracciato del file .txt — trovato da Raffaele direttamente nel portale** (screenshot della finestra di aiuto "Informazioni per la corretta compilazione dei file da importare", non documentato in nessuna guida pubblica trovata online):

```
DDMMYYYY;codiceNazione;codiceProvincia;numeroArrivi;numeroPartenze
```

- Un record per riga, campi separati da `;`, fine riga = `\n` (a capo), **nessuno spazio** attorno ai separatori.
- **Codice nazione**: `0` se il cliente è italiano (in quel caso si valorizza il codice provincia).
- **Codice provincia**: `0` se il cliente è straniero (in quel caso si valorizza il codice nazione).
- I codici sono quelli ufficiali ISTAT (province + nazioni) — non ancora recuperati/mappati da noi, da fare prima di costruire il generatore.
- **Niente righe duplicate** per lo stesso codice nazione/provincia nello stesso file.
- Il "numero camere occupate" **non fa parte del file**: si inserisce a mano nel riepilogo dopo il caricamento (un solo valore per giornata, coerente con quanto descritto nella mini-guida ufficiale).

**Perché serve comunque il flusso di check-in con raccolta documenti (vedi sotto)**: per generare questo file serve sapere la provenienza (provincia o nazione) di ogni ospite per ogni giornata — dato che oggi non raccogliamo mai al momento della prenotazione. Le due iniziative si alimentano a vicenda.

## Nuovo flusso di check-in — raccolta documenti prima dello sblocco (09/09/2026 notte, in corso)

Raffaele ha proposto un cambiamento al flusso di check-in attuale (oggi: pagine puramente informative, mai raccolgono dati) ispirandosi al modulo di pre-check-in visto su Speedy Host (`speedyhost.app/check-in/il-tulipano`): l'ospite apre il link, **prima di tutto** inserisce i propri dati anagrafici e documento (stessi campi richiesti da Alloggiati Web), il sistema verifica che siano arrivati correttamente, e **solo dopo** si sblocca la pagina attuale (WiFi, istruzioni, regole della casa).

Vantaggi identificati: adempie all'obbligo di legge (schedina entro 24h) invece di lasciarlo solo alla buona volontà di Raffaele; alimenta l'anagrafica `OSPITI` già costruita con dati reali (codice fiscale, nazionalità) invece di restare vuota; fornisce esattamente il dato di provenienza necessario per il file mensile di Sinfonia sopra.

**Costruito e verificato in produzione (09/09/2026 notte)**. Riuso quasi totale di quanto già esisteva, zero nuovo modello dati:
- **`/api/schedine` esteso** (non un nuovo endpoint): il `prenotazioneRow` diventa opzionale — se assente, la route cerca da sola in DATABASE la prenotazione con la stessa stanza e data di check-in indicate, e usa quella. Se zero o più di una corrispondenza, errore chiaro invece di indovinare ("contatta Lella"). Stesso identico endpoint già usato da Motore Rafilu per le schedine compilate manualmente — nessuna duplicazione di logica o di dati.
- **`public/checkin/checkin-gate.js`**: script condiviso, iniettato in tutte e 5 le pagine di check-in (`<script src="/checkin/checkin-gate.js" data-stanza="...">`), che mostra un overlay a schermo intero con: data di check-in + un blocco per ospite (cognome, nome, data/luogo di nascita, cittadinanza, tipo/numero documento — stessi campi di `SchedineManager.tsx`), pulsante "+ Aggiungi un altro ospite" per gruppi/famiglie. Al submit, invia una richiesta a `/api/schedine` per ogni ospite; se tutte riescono, salva un flag in `localStorage` (per dispositivo) e sblocca subito la pagina sottostante — nessuna revisione umana necessaria per lo sblocco, solo la conferma che i dati sono arrivati.
- **Verificato dal vivo in produzione**, non solo letto il codice: percorso di errore (data inventata → "non troviamo una prenotazione", nessuna scrittura); percorso di successo con una prenotazione reale esistente (Rosa, 30/04/2026, "Francesca Collega Mamma") → riga creata su SCHEDINE con `prenotazioneRow` dedotto correttamente (riga 3, giusta) → confermato leggendo il foglio → riga di test ripulita; ricaricata la pagina dopo il successo, il gate non ricompare (persistenza `localStorage` confermata).
- **Limite noto, accettato per ora**: il flag di sblocco vive solo nel browser che ha compilato il form — se l'ospite riapre da un altro dispositivo, il gate ricompare (i dati non vengono persi, semplicemente richiederebbe un secondo invio). Non risolto perché non necessario per il caso d'uso reale (un ospite apre il link una volta, dallo stesso telefono).

### Allineamento al tracciato reale + lettura automatica documenti (09/09/2026 notte)

Raffaele ha chiesto due cose in più, entrambe fatte e verificate con dati reali (non inventati) prima di considerarle finite:

**1. Il form non era "la stessa scheda" del vero Alloggiati Web** — confronto diretto col tracciato ufficiale (`src/lib/alloggiatiRecordFormat.ts`) ha rivelato campi obbligatori mancanti (sesso, tipo alloggiato/rapporto a 5 valori invece di 2, stato di nascita) e campi salvati come testo libero invece dei codici ufficiali richiesti (cittadinanza, tipo documento). Corretto:
- **Tabelle ufficiali scaricate DAVVERO** dal servizio reale (metodo `Tabella()`, sola lettura — stessa cautela di sempre) — 232 stati esteri validi, i 3 tipi documento rilevanti per un turista (IDENT/PASOR/PATEN), tutti e 5 i tipi alloggiato (16=singolo, 17=capofamiglia, 18=capogruppo, 19=familiare, 20=membro gruppo). Salvate in `src/lib/alloggiatiTabelle.ts` (server) e `public/checkin/tabelle.json` (client, stessa fonte).
- **`src/lib/schedine.ts` esteso** con 8 nuove colonne (Sesso, TipoAlloggiatoCodice, ComuneNascitaCodice, ProvinciaNascita, StatoNascitaCodice, CittadinanzaCodice, TipoDocumentoCodice, LuogoRilascioDocumento) — aggiunte in coda, righe precedenti al 09/09/2026 restano valide con le colonne nuove vuote.
- **`checkin-gate.js` aggiornato**: menu Sesso, campi Stato di nascita/Cittadinanza con suggerimento dalla lista reale dei 232 stati (l'ospite scrive "Italia" in chiaro, il sistema salva il codice `100000100`), un piccolo toggle "Famiglia/Amici" (mostrato solo con più di un ospite) per calcolare automaticamente il tipo alloggiato giusto per ciascuno.

**2. Lettura automatica del documento fotografato** — Raffaele ha fatto notare che quando manda una foto di un documento in chat riesco a leggerla da solo: stessa cosa, ma richiamabile da codice. Nuova **`/api/checkin-ocr`**, riusa lo stesso motore già configurato per il bot Telegram (`ANTHROPIC_API_KEY`, Claude con input immagine — nessun servizio OCR terzo, nessun costo aggiuntivo). L'ospite può caricare una foto del documento: i campi si pre-compilano da soli ma restano sempre modificabili — mai un dato salvato senza che un umano l'abbia visto, dato che sono dati legalmente rilevanti.

**Verificato con dati reali, non solo il codice**:
- OCR testato con un'immagine di documento chiaramente fittizia ("PROVA — NON REALE") generata al volo: tutti i 9 campi letti correttamente (cognome, nome, sesso, data/luogo di nascita, stato di nascita, cittadinanza, tipo/numero documento, luogo di rilascio).
- Flusso completo end-to-end sul sito vero: submit con Sesso=M, Stato di nascita/Cittadinanza="Italia" → salvati sulla scheda SCHEDINE come `100000100` (codice ITALIA reale), tipo documento "Carta d'identità" → salvato come `IDENT`, un solo ospite → tipo alloggiato dedotto correttamente come `16` (Ospite Singolo). Riga di test ripulita.

**Non ancora fatto**: `SchedineManager.tsx` (inserimento manuale interno, usato da Raffaele) non è stato aggiornato con gli stessi campi nuovi — resta lo schema precedente, semplificato. Da allineare se/quando serve coerenza piena tra i due punti di inserimento.

### Correzioni dopo il primo test reale di Raffaele su mobile (09/09/2026 notte)

Raffaele ha provato il form sul telefono prima di inviarlo davvero e ha trovato problemi concreti, tutti corretti e riverificati su viewport mobile prima di richiudere:

- **Bug di layout vero, non solo estetico**: "la pagina si muove nello spazio" — causa reale: ogni campo era `<label>` + `<input>` come due elementi separati dentro una griglia a 2 colonne, quindi la label di un campo finiva affiancata all'input del campo *successivo* invece che al proprio (es. "Cognome" affiancato al campo vuoto, invece che sopra il proprio campo). Corretto avvolgendo ogni campo in un `<div>` — ora ogni "cella" della griglia è un campo completo (label+input insieme).
- **Stile troppo scollegato dalla pagina che si sblocca dopo**: aggiunta una barra superiore in stile "hero" (stesso gradiente corallo della pagina vera) con "Salzillo Hospitality" — il gate ora sembra parte dello stesso prodotto, non un modulo grigio a parte.
- **Caricamento foto troppo rigido**: l'attributo `capture="environment"` forzava l'apertura diretta della fotocamera su mobile, senza possibilità di scegliere una foto già esistente. Rimosso — ora il device mostra la scelta tra scattare una foto o selezionare un file.
- **Impossibile rimuovere un ospite aggiunto per errore**: non esisteva alcun modo per togliere un "Ospite 2" aggiunto per sbaglio. Aggiunto un pulsante "✕ Rimuovi" su ogni ospite oltre al primo, con rinumerazione automatica e il toggle "Famiglia/Amici" che si nasconde di nuovo se resta un solo ospite. **Verificato dal vivo**: aggiunto un secondo ospite, cliccato Rimuovi, tornati correttamente a un solo ospite senza il pulsante Rimuovi né il toggle gruppo.
- **Contatto sbagliato**: "Problemi? Contatta [Lella]" puntava al numero di Lella (la referente solo per questioni pratiche in loco, non per problemi col sito). Cambiato al numero "Salzillo Hospitality" già usato altrove nella stessa pagina per l'assistenza generale.

Tutto riverificato su viewport mobile reale (375×812) dopo le correzioni, non solo su desktop.

### Secondo giro di correzioni — bug reale sul secondo ospite (09/09/2026, tarda notte)

Raffaele ha ritestato dal telefono e trovato che il problema persisteva ancora per il secondo ospite. Causa trovata: `applyLang()` (la funzione che traduce le etichette dei campi) veniva chiamata solo una volta, al primo caricamento della pagina — ogni ospite aggiunto DOPO restava con tutte le etichette vuote (comprese quelle del bottone "Carica foto"), che sembrava "non funzionare" perché letteralmente non si vedeva cosa toccare. Corretto chiamando `applyLang()` anche dopo ogni `aggiungiOspite()`.

Raffaele ha anche suggerito di guardare come Speedy Host risolve Stato di nascita/Cittadinanza (`speedyhost.app/check-in/il-tulipano`) — **non copiato il loro codice** (non è nostro), ma adottata la stessa soluzione tecnica: sostituito il campo "testo con suggerimento" (`<input list>`) con una vera `<select>` nativa per i 232 stati — più stabile su mobile, probabile causa reale del residuo "si muove nello schermo" (i suggerimenti di un datalist su iOS Safari sono notoriamente instabili/imprevedibili nel layout).

Verificato dal vivo su mobile dopo la correzione: aggiunto un secondo ospite, tutte le etichette (comprese "📷 Documento (foto o file)") visibili correttamente, select Stato di nascita/Cittadinanza funzionanti su entrambi gli ospiti.

### Terzo giro sul check-in — causa vera del "si muove a destra e sinistra" (09→10/09/2026)

Raffaele ha continuato a segnalare il "si muove nello spazio" anche dopo i due giri precedenti, e ha insistito che serviva "la stessa risoluzione del resto dell'applicazione" (parlava di "1920×1080"). Non era un problema di viewport/risoluzione — il meta viewport è identico tra sito principale e pagine di check-in. Causa vera trovata per confronto diretto col codice del sito già funzionante (`src/app/page.tsx`): tutti gli input veri del sito sono a `font-size:16`, mentre i campi del check-in gate erano a `15px`. **Sotto i 16px iOS Safari zooma automaticamente la pagina quando si mette il focus su un campo**, e dopo lo zoom la pagina resta spostabile a destra/sinistra finché non si torna a mano al livello originale — esattamente il sintomo descritto. Portati tutti i campi a `16px`, aggiunto `overflow-x:hidden` esplicito sull'overlay come protezione in più. Confermato risolto da Raffaele dopo il deploy.

### Effetti collaterali del gate di autenticazione — tre, tutti corretti (09→10/09/2026)

Proteggere `/api/prenotazioni`, `/api/prenotazione`, `/api/cancella` con `requireAccesso` (09/09) ha rotto tre consumatori che chiamavano quelle rotte **senza autenticarsi**:

1. **Login mai creato** — il foglio ACCESSI aveva solo l'intestazione, nessun account, nemmeno quello di Raffaele. Si è trovato bloccato fuori dal proprio sito. Creato il suo account (`raffaele` / ruolo Titolare / permessi pieni) via script diretto sul foglio; password in chiaro in [[bb-il-tulipano]]. Lezione: un sistema di login va sempre accompagnato dal bootstrap del primo account admin.
2. **Card "Salzillo Hospitality" di Motore Rafilu in errore** — `/plancia` chiamava `/api/prenotazioni` senza credenziali. Corretto in `src/lib/requireAccesso.ts`: chi presenta `PLANCIA_ACCESS_KEY` valida ottiene permessi pieni equivalenti (niente doppio login); il client di `/plancia` ora invia quella chiave e rifà la richiesta quando la chiave diventa disponibile.
3. **Avvisi automatici fermi (scoperto 10/09)** — i cron (digest, promemoria check-in/check-out) e il bot Telegram chiamavano `/api/prenotazioni` → 401 → nessun avviso. Confermato dai log: 10/09 ore 06:00, `GET /api/prenotazioni 401`. Corretto in modo strutturale: estratta la lettura in `src/lib/prenotazioni.ts` (`leggiPrenotazioni()`), importata direttamente da cron e bot senza HTTP. Anche `/api/cron/sync-email-prenotazioni` (Airbnb da email) aveva lo stesso problema → ora invia `PLANCIA_ACCESS_KEY`. Build + typecheck puliti, deploy fatto.

## Archivio Google Sheets spezzato in 3 file (10/09/2026)

Fino al 10/09 tutto stava in un unico foglio "SalzilloFlow 2026" — 26 tab cresciuti per accumulo. Raffaele ("sono un precisino e fissato per l'organizzazione") ha chiesto un "archivio separato e catalogato".

| File Google (cartella "Archivio — Salzillo Hospitality") | Tab |
|---|---|
| **SH · Prenotazioni & Ospiti** | DATABASE, OSPITI, SCHEDINE, CONTRATTI |
| **SH · Struttura & Spese** | PULIZIE, SPESE, SCADENZE, CONTI |
| **SH · Sistema** | ACCESSI, BOT_STATE, TELEGRAM_LOG, EmailProcessate, **CREDENZIALI** (nuovo) |
| **SalzilloFlow 2026** (originale, invariato) | RECAP, CONFIG, GENNAIO…DICEMBRE (contabilità manuale) |

**Come**: il service account non può creare file su Drive — i 3 file creati via route temporanea con OAuth (raffaele.salzillo02), tab copiati con `sheets.copyTo` (copia, non sposta), vecchi tab tenuti come backup. Nuova `fileIdForTab(tab)` in `src/lib/sheets.ts` mappa tab→file con fallback all'originale se le variabili `SPREADSHEET_ID_*` mancano. ~15 file toccati. Verificato in produzione: letture (contratti, pulizie, scadenze, conti, login, 63 prenotazioni) e scrittura (test creato→letto→cancellato) sui file nuovi.

**Intoppo**: la colonna PasswordHash di ACCESSI conteneva la password in chiaro invece dell'hash (modificata a mano) — login rotto, hash rigenerato, riverificato. La colonna PasswordHash non va mai toccata a mano; la password in chiaro sta nel tab CREDENZIALI.

**Ancora da fare**: rimuovere i tab vecchi dall'originale dopo qualche giorno di conferma. `SchedineManager.tsx` non ancora allineato ai nuovi campi schedine (pendenza pre-esistente).

## In sospeso — aggiornato 08/09/2026 sera

1. ~~Ri-autorizzazione Google Calendar~~ — **risolto** (vedi sopra): token durevole, verificato con dati veri.
2. ~~Automazione Gmail~~ — **risolto** (vedi sopra): Airbnb automatico quando i dati sono completi, Booking ad alert. Da confermare sulla prima prenotazione vera che arriva nativamente (non forward).
3. **Alloggiati Web — formato confermato dal sistema stesso, manca solo `Send`**: `GenerateToken`→`Authentication_Test`→`Test` verificati end-to-end con codici reali (Marcianise, Italia, Carta d'identità) — `esito:true`, `schedineValide:1`, zero errori (vedi sopra). `Send` (l'invio vero) deliberatamente non implementato — da fare insieme a Raffaele quando deciderà di attivarlo davvero, non in autonomia.
   ~~Sinfonia bloccata~~ — **risolto (09/09/2026)**: trovata la documentazione tecnica completa (spec OpenAPI), client costruito (vedi sopra). Manca solo che Raffaele aggiunga `SINFONIA_CUSR`/`SINFONIA_API_KEY` su Vercel per il primo test reale (sola lettura).
4. **Cartella Google Drive per i contratti**: rimandata, il progetto Google Cloud del vecchio tentativo n8n non è accessibile dall'account Google attuale di Raffaele (vedi sopra).
5. **Channel manager per sincronizzare i prezzi tra le piattaforme**: ricerca completata (vedi sopra) — Hostex/Lodgify/AvaiBook tutti confermati Airbnb Preferred Partner con sync prezzi vera. Resta solo la scelta/il via libera di Raffaele sul budget, non ancora deciso.
6. **Conti bancari nel Patrimonio** (nuova, 09/09/2026): base manuale costruita e funzionante (vedi sopra). Il collegamento diretto vero (Enable Banking, gratuito per conti personali, copre Intesa Sanpaolo e Mediolanum) richiede che Raffaele stesso apra l'account — non è un'azione delegabile. Trade Republic quasi certamente resterà manuale (nessun aggregatore lo copre).
7. ~~`/api/test-sheets` — route diagnostica dimenticata dal 31/08/2026, senza autenticazione~~ — **risolto (09/09/2026 mattina)**: eliminata su richiesta di Raffaele, insieme alla funzione `readConfigSheet` in `src/lib/sheets.ts` (usata solo da quella route, ormai morta). Verificato 404 in produzione, resto dell'app confermato sano.
8. ~~`/api/cancella`, `/api/prenotazione`, `/api/prenotazioni` senza autenticazione~~ — **risolto (09/09/2026 sera)**: sistema di accessi per collaboratori costruito e verificato in produzione, vedi sezione dedicata sopra. Resta da fare: Raffaele deve creare il primo account reale da Motore Rafilu quando vorrà dare accesso a qualcuno.

## Da approfondire

- Stato reale di avanzamento dell'automazione n8n e della domotica (le fonti descrivono solo una visione/pianificazione, non conferme di realizzazione) — a differenza del sistema di prenotazioni base, confermato live
- Approfondire il contenuto delle conversazioni claude.ai originali (raw/Conversazioni claude.ai/export-2026-08-31/conversations/) se servono dettagli oltre queste sintesi
- Data prevista per i "tre appartamenti futuri" sulla porzione di Raffaela (nessuna data nelle fonti, solo intenzione dichiarata)
- Nomi dei nonni materni di Raffaele (lato Iodice, proprietari originari del terreno, mai nominati nelle fonti)
- Per la dashboard 8-strumenti: aliquota imposta di soggiorno di Marcianise, data ultimo controllo estintori, periodicità versamento imposta di soggiorno, credenziali Alloggiati Web e Sinfonia Turismo Smart, se le pulizie sono fatte da personale dedicato o dalla famiglia — nessuna di queste risposte è ancora nelle fonti
