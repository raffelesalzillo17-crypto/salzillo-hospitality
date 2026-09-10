---
titolo: Assistente digitale personale di Raffaele (bot Telegram)
tipo: concetto
tag: [assistente, telegram, bot, progetto, ai]
fonti:
  - "conversazione diretta in Claude Code, sessione del 31/08/2026"
  - "raw/Conversazioni claude.ai/export-2026-08-31/ (export account claude.ai, memoria e progetti)"
  - "conversazione diretta in Claude Code, sessione 07/09/2026"
  - "conversazione diretta in Claude Code, sessione 09/09/2026"
creato: 2026-08-31
aggiornato: 2026-09-09
---

# Assistente digitale personale di Raffaele

Progetto in corso, richiesto da [[raffaele-salzillo]] il 31/08/2026: un "assistente digitale" raggiungibile via bot Telegram, pensato non come una semplice interfaccia di query sul wiki ma come un concierge personale — una versione digitale di sé stesso — capace di rispondere su lavoro, vita personale, notizie dal mondo, mercati finanziari, ed eventualmente eseguire compiti su richiesta.

## Requisiti espressi dall'utente

- **Canale**: Telegram, preferito esplicitamente a WhatsApp (complessità/rischio ToS delle librerie non ufficiali per quest'ultimo).
- **Accesso**: riservato al solo Raffaele, raggiungibile da qualunque posto si trovi.
- **Ambito funzionale**, descritto liberamente e non da un elenco chiuso: "risponde a qualsiasi cosa chiedo, lavoro, vita personale, news dal mondo, mercati finanziari, aggiornamenti... se gli chiedo mi serve questo, lui lo fa" — quindi sia consultazione sia esecuzione di compiti.

## Approccio a fasi

1. **Fase 1 — bot Telegram di consultazione sul wiki** (avviata e **completata/operativa** il 31/08/2026, bot `@AssistenteRaffaelebot`, codice in `assistente-telegram/` nella root del vault): risponde alle domande di Raffaele usando il contenuto di `wiki/` come contesto, replicando il flusso QUERY di CLAUDE.md. Esecuzione locale via long polling (nessuna porta esposta in ingresso), autenticazione tramite whitelist del proprio chat id Telegram (734132058). Testato con successo: risponde correttamente a domande come "chi sono?" citando le pagine wiki pertinenti. **Limite noto**: gira solo mentre il PC dell'utente è acceso e il processo attivo.
2. **Fase 2 — notizie e mercati finanziari** (avviata e operativa il 31/08/2026): il bot recupera notizie fresche da tre fonti (ANSA, BBC World, Il Sole 24 Ore, via RSS) e una panoramica di mercato (S&P 500, Nasdaq, FTSE MIB, EUR/USD, via Yahoo Finance) sia su richiesta sia in un digest automatico giornaliero (cron configurabile via `DIGEST_CRON`, default 08:00). Su richiesta di approfondimento ("approfondisci"), il bot recupera e legge il testo completo dell'articolo collegato invece del solo titolo/estratto. Mantiene una breve memoria conversazionale per chat (ultimi scambi) per gestire i follow-up. Codice in `assistente-telegram/lib/` (`news.js`, `markets.js`, `article.js`, `bookings.js` — quest'ultimo per i dati di prenotazione live del B&B, vedi sezione dedicata sotto).
3. **Fase 3 — esecuzione di compiti (agentic)** (avviata il 31/08/2026, primo perimetro: aggiornamento del wiki via chat): capacità di "fare cose" su richiesta e non solo rispondere. Perimetro scelto esplicitamente dall'utente tra le opzioni proposte (gestione B&B, organizzazione personale, aggiornamento wiki via chat, comunicazioni per suo conto): **solo aggiornamento del wiki per ora**, con conferma esplicita obbligatoria prima di ogni scrittura (non azioni autonome). Le altre aree (gestione B&B, promemoria personali, comunicazioni per conto suo) restano da scoprire in futuro. Vedi sezione dedicata sotto per i dettagli implementativi.

## Recupero file e foto, e stile di conversazione (31/08/2026)

Su richiesta dell'utente, il bot cerca file e foto in `raw/` per parola chiave (nome file/cartella) e li invia direttamente su Telegram (foto con `sendPhoto`, altri documenti con `sendDocument`) quando il messaggio contiene termini come "foto", "file", "documento", "manda", "invia". Ramo gestito senza passare da Claude, per velocità e affidabilità.

Rivisto anche lo stile delle risposte testuali su richiesta esplicita ("una chat tra persone normali"): niente più sintassi `[[pagina]]` o grassetto a doppio asterisco visibili come testo letterale — il bot ora usa il formato Markdown di Telegram (`*grassetto*` singolo, reso davvero in grassetto), elenchi puntati ed emoji pertinenti, tono da conversazione amichevole invece che enciclopedico. L'invio ha un fallback automatico a testo semplice se Telegram non riesce a interpretare la formattazione.

## Dati di prenotazione live per il B&B (31/08/2026)

Bug critico segnalato dall'utente: alla domanda "chi arriva nei miei b&b nei prossimi giorni?" il bot aveva risposto in modo confuso e inaffidabile (arrivando persino a generare uno scambio senza senso, come se stesse parlando con sé stesso). Causa: la ricerca contestuale del bot cerca solo dentro `wiki/**/*.md`, e la pagina wiki sul B&B (`hostflow-tulipano.md`) contiene solo riepiloghi aggregati (totali per stanza/canale), non le singole prenotazioni con date e nomi ospiti — quindi il modello non aveva i dati per rispondere e ha "inventato" una risposta.

Fix: nuovo modulo `assistente-telegram/lib/bookings.js` che legge in tempo reale, a ogni domanda pertinente, il CSV pubblicato del foglio Google delle prenotazioni (lo stesso usato dal task `sync-hostflow-tulipano`), lo parsa riga per riga (parser CSV scritto a mano, gestisce virgolette e newline nei campi) e calcola al volo: ospiti attualmente in casa, partenze previste oggi, prossimi arrivi nei 14 giorni successivi. Questi dati — sempre aggiornati al momento della domanda, non uno snapshot statico — vengono iniettati come contesto dedicato quando il messaggio contiene parole chiave legate a prenotazioni/ospiti/arrivi/partenze/stanze. Il prompt di sistema ora istruisce esplicitamente il bot a usare solo questi dati live (mai i riepiloghi wiki aggregati) per domande sul B&B, e a dichiarare apertamente quando l'informazione manca invece di inventare — trattandosi di un ambito dove un errore può creare una figuraccia reale con un ospite.

Nota tecnica: il fetch verso il CSV pubblicato di Google Sheets falliva con un `HeadersTimeoutError` usando `fetch()` di Node senza header — risolto aggiungendo un header `User-Agent` esplicito alla richiesta.

## Riduzione costi API (31/08/2026)

L'utente ha segnalato un consumo elevato dell'API Anthropic (oltre 1€ per poche domande di test). Causa individuata: `findRelevantPages` mandava a Claude, a ogni domanda, il contenuto **integro** di fino a 6 pagine wiki (alcune da 10-12KB), perché il punteggio di rilevanza contava anche parole italiane comunissime ("sono", "che", "con"...) presenti ovunque — bastava una domanda generica per trascinare dentro le pagine più lunghe del wiki, non le più pertinenti.

Fix applicati in `bot.js`:
- Lista di stopword italiane (`WIKI_STOPWORDS`) escluse dal punteggio di rilevanza, per matchare solo parole davvero significative.
- Pagine wiki iniettate per domanda ridotte da 6 a 3 (`WIKI_PAGES_LIMIT`).
- Ogni pagina troncata a un tetto di 2.500 caratteri (`WIKI_MAX_CHARS_PER_PAGE`) invece di essere inviata per intero.
- Modello aggiornato da `claude-sonnet-4-6` a `claude-sonnet-5` (stesso livello di capacità, prezzo per token inferiore) su richiesta esplicita dell'utente, con `thinking` disattivato esplicitamente (Sonnet 5 farebbe "adaptive thinking" di default, che avrebbe aggiunto token di ragionamento non necessari per semplici risposte conversazionali).

Nota: il prompt caching non è stato attivato perché non aiuterebbe granché in questa architettura — il contenuto pesante (contesto wiki) cambia a ogni domanda e finisce sempre in coda al messaggio, quindi non è mai un prefisso realmente riutilizzabile tra una richiesta e l'altra.

**Decisione presa dall'utente (31/08/2026)**: valutata e scartata l'ipotesi di passare a un'API AI gratuita per azzerare i costi. Motivo principale: i tier gratuiti (es. Google Gemini) permettono in genere l'uso dei dati inviati per addestrare i modelli, mentre il wiki contiene documenti d'identità e credenziali bancarie in chiaro che finiscono nel contesto ad ogni domanda pertinente — rischio di esposizione dati non accettabile. Scartata anche l'opzione di un modello locale (Ollama, gratis e privacy massima) per il rischio di risposte meno affidabili, in particolare sull'ambito ospiti/prenotazioni dove è stata posta la priorità assoluta sull'accuratezza (regola confermata anche nella memoria persistente di Claude, non solo qui nel wiki). Confermato di restare su Anthropic, con il costo ormai stimato in 1-4€/mese dopo i fix di riduzione contesto sopra.

## Fase 3 v1 — aggiornare il wiki via chat (31/08/2026)

Prima capacità "agentic" del bot: scrivere davvero sul wiki, non solo rispondere. Attivata dicendo al bot frasi come "segna che...", "annota...", "aggiorna il wiki con...", "nota che...".

Flusso: il bot cerca le pagine wiki potenzialmente pertinenti (stesso motore di `findRelevantPages`), le passa a Claude insieme all'indice (`index.md`) tramite un **tool forzato** (`propose_wiki_edit`, in `assistente-telegram/lib/wikiEditor.js`) che deve restituire una proposta strutturata: pagina da creare/aggiornare, contenuto completo del file, riga di log, eventuale riga per l'indice, ed eventuale segnalazione di conflitto con dati esistenti (replica la "Regola del conflitto" di questo stesso CLAUDE.md). Il bot manda a Raffaele solo il riassunto leggibile e **aspetta conferma esplicita** ("sì"/"no") prima di scrivere qualunque cosa su disco — nessuna scrittura autonoma, per scelta esplicita dell'utente. Se arriva un messaggio che non è né sì né no, la proposta in sospeso viene scartata silenziosamente e il messaggio nuovo viene gestito normalmente (niente blocchi in attesa di conferma).

Limiti noti di questa v1: aggiorna una sola pagina per richiesta (non un ingest multi-pagina come farebbe una sessione Claude Code completa); il percorso del file è validato per stare dentro `entita/`, `concetti/` o `sintesi/` (mai `index.md`/`log.md`/`overview.md` direttamente, quelli si aggiornano solo tramite gli helper dedicati). Testato prima di attivarlo in produzione: proposta corretta di aggiunta di una spesa fittizia alla pagina di [[bb-il-tulipano]], con aggiornamento pulito di frontmatter e sezione dedicata.

## Fase 3 v2 — Google Calendar (31/08/2026)

Seconda area scelta dall'utente per la Fase 3: promemoria/organizzazione personale, tramite il suo Google Calendar reale (non un sistema di promemoria separato dentro il bot, per evitare di frammentare ulteriormente le cose).

**Consolidamento**: Raffaele ha più account Google con impegni sparsi — `raffaele.salzillo02@gmail.com` (principale), `raffelesalzillo17@gmail.com` (secondaria), `raffaele.salzillo@istitutosuperiorefeltre.it` (lavoro), più una nuova casella email dedicata al B&B non ancora comunicata nel dettaglio (indirizzo da registrare qui appena disponibile). Invece di collegare il bot separatamente a ciascun account, ha scelto di provare prima a **consolidare i calendari lato Google** (condivisione/iscrizione tra i propri account) sull'account principale, così il bot si autentica una sola volta.

**Setup tecnico**: creato un progetto Google Cloud ("assistente-raffaele"), abilitata la Calendar API, creata una credenziale OAuth di tipo "App desktop", autorizzato l'accesso al calendario di `raffaele.salzillo02@gmail.com` tramite un flusso OAuth locale una tantum (`assistente-telegram/authorize-calendar.js`, redirect su `http://localhost` per app desktop). Intoppo incontrato: primo tentativo fallito con "Errore 403: access_denied" perché l'account non era stato aggiunto come "utente di test" nella schermata di consenso OAuth (nella nuova interfaccia "Google Auth Platform" di Google, questa sezione si chiama "Audience"/Pubblico, non più "Test users" nella vecchia posizione) — risolto aggiungendolo lì.

**Funzionalità nel bot** (`assistente-telegram/lib/calendar.js`):
- Lettura: chiedendo cose come "cosa ho oggi/domani", "i miei impegni", il bot recupera gli eventi dei prossimi 14 giorni dal Calendar e risponde su quelli.
- Creazione: frasi come "ricordami di...", "aggiungi al calendario...", fanno scattare lo stesso pattern *proponi e chiedi conferma* già usato per il wiki — un tool Anthropic forzato interpreta la richiesta in linguaggio naturale (data/ora, se è un evento con orario preciso o per l'intera giornata) e il bot scrive sul Calendar solo dopo un sì esplicito.
- Le due azioni "in sospeso" (modifica wiki e nuovo evento) condividono ora lo stesso meccanismo di conferma nel bot (`state.pendingAction`), per non dover gestire due sistemi paralleli.

Testato prima di attivare in produzione: lettura di eventi reali dal calendario confermata funzionante; proposta di un promemoria di prova ("chiamare il commercialista venerdì alle 15") tradotta correttamente in data/ora ISO, mai salvata (solo verificata la struttura della proposta).

**Esito consolidamento** (confermato dall'utente): riusciti la condivisione dell'account secondario e della nuova casella B&B (`salzillohospitality@gmail.com`) sull'account principale; **l'account di lavoro (istitutosuperiorefeltre.it) risulta bloccato**, come previsto, verosimilmente per restrizioni dell'amministratore IT della scuola — resta escluso dalla consolidazione per ora.

**Correzione tecnica successiva**: "iscriversi" a un calendario di un altro account (fatto da Raffaele nel passaggio sopra) lo aggiunge alla lista di calendari visibili dell'account autorizzato, ma **non lo fa comparire leggendo solo il calendario "primary"** via API — `listUpcomingEvents` in `lib/calendar.js` è stato corretto per interrogare tutti i calendari visibili (`calendarList.list()`) e unire i risultati, mostrando anche il nome del calendario di provenienza in ogni evento. Testato con successo: il bot ora vede sia il calendario personale sia quello del B&B (che risulta usato anche per segnare eventi/concerti locali vicino al B&B, verosimilmente per il pricing dinamico — es. "GEMITAIZ alla Reggia — €80/notte"). La creazione di nuovi eventi resta invece sempre sul calendario principale (`GOOGLE_CALENDAR_ID`, default "primary"), per non disperdere i nuovi promemoria tra più calendari.

## Ristrutturazione affidabilità — da parole chiave a strumenti (31/08/2026)

L'utente ha segnalato problemi seri di affidabilità: il bot non sapeva che giorno fosse, sbagliava i calcoli di data, non riusciva a leggere il calendario in molti casi, e in generale "non risponde a tutto quello che gli chiedo". Causa radice individuata: l'architettura precedente decideva **a parole chiave predefinite** quando andare a recuperare notizie/mercati/prenotazioni/calendario/wiki — se la domanda di Raffaele non conteneva esattamente una di quelle frasi, il bot rispondeva a vuoto o solo con contesto wiki generico. E in nessun punto del prompt era mai indicata la data odierna.

Fix strutturale in `bot.js`:
- **Data e ora sempre presenti**: ogni chiamata include ora una riga esplicita "OGGI è [giorno] [data], ore [ora] (Europe/Rome)" nel prompt di sistema, generata al momento della richiesta — non più lasciata all'ipotesi del modello.
- **Da parole chiave a strumenti (tool use)**: rimossi tutti gli elenchi di parole chiave (notizie, mercati, prenotazioni, calendario, aggiornamento wiki, promemoria). Claude ora ha a disposizione strumenti veri — `search_wiki`, `get_news`, `read_article`, `get_markets`, `get_bookings`, `get_calendar_events`, `find_and_send_files`, `propose_wiki_edit_from_chat`, `propose_calendar_event_from_chat` — e decide da solo quali usare in base al significato reale della domanda, anche più di uno per la stessa risposta. Il ciclo (chiamata → esecuzione strumento → risultato → eventuale altra chiamata) è limitato a 6 passaggi per messaggio come rete di sicurezza.
- **Thinking riacceso ma economico**: con gli strumenti attivi, il thinking disattivato rischiava di far scrivere a Claude una finta chiamata a strumento come testo invece di una vera tool_use (comportamento noto dei modelli Claude 4.6+ recenti) — riacceso in modalità adattiva con `effort: low`, per restare affidabile senza far risalire troppo il costo.
- **Supporto foto**: se Raffaele manda una foto (con o senza didascalia), viene scaricata da Telegram e passata a Claude come immagine vera (visione nativa del modello), che ne estrae le informazioni rilevanti. Non richiede configurazione aggiuntiva.
- **Vocali — implementati, 100% locali e gratuiti**: Claude non supporta l'audio nativamente nell'API Messages, quindi serve un passaggio di trascrizione (speech-to-text) prima. Soluzione trovata: Raffaele aveva già installato **Handy** (app di dettatura open source, `C:\Users\salzi\OneDrive\Desktop\Handy\handy.exe`), che monta un motore di trascrizione locale — non Whisper ma un modello NVIDIA Parakeet/Nemotron ("nemotron-3.5-asr-streaming-0.6b", formato GGUF), accelerato via GPU (Vulkan). Handy espone una modalità "headless" via riga di comando pensata apposta per questo caso (`handy.exe --transcribe-file <wav> --json`), scoperta ispezionando `handy.exe --help`. Flusso in `assistente-telegram/lib/voiceTranscription.js`: il vocale Telegram (OGG/Opus) viene convertito in WAV 16kHz mono con `ffmpeg-static` (binario ffmpeg incluso via npm, nessuna installazione manuale), poi passato a Handy in modalità file. Nessun account esterno, nessun costo, l'audio non lascia mai il PC. Percorso di Handy configurabile via `HANDY_EXE_PATH` in `.env`. Testato con successo su una registrazione reale prima di attivarlo (trascrizione accurata in ~1-2 secondi per 20 secondi di audio, velocità 4-9x tempo reale).
- **Log delle conversazioni su disco**: ogni turno (domanda e risposta) viene ora scritto in `assistente-telegram/conversation-logs/{YYYY-MM-DD}.jsonl`, un file al giorno — prima la cronologia viveva solo in memoria e si perdeva a ogni riavvio del bot. Questo è anche il presupposto per il punto successivo.
- **Le conversazioni col bot alimentano il wiki**: il task schedulato `sync-conversazioni` (vedi CLAUDE.md, sezione 4) è stato esteso per leggere anche questi log, oltre alle sessioni Claude Code e agli export claude.ai — stesso meccanismo a offset incrementale, stessa logica di "non duplicare cose già scritte".

Testato con un ciclo di prova prima di attivare in produzione: risposta corretta alla data odierna, scelta autonoma dello strumento calendario per una domanda generica ("cosa ho in programma questa settimana?"), buon ragionamento sui risultati.

## Fase 3 v3 — collegamento al vero sistema di prenotazioni (31/08/2026)

Terza area della Fase 3: invece di far scrivere al bot direttamente sul foglio Google (duplicando la logica di calcolo commissioni/cedolare secca/sync Calendar), si è scoperto che Raffaele ha già un sito funzionante — `salzillo-hospitality.vercel.app`, codice in locale in `C:\Users\salzi\salzillo-hospitality\` — con tre API pulite già in produzione:

- `GET /api/prenotazioni` — elenco prenotazioni con utile netto già calcolato
- `POST /api/prenotazione` — crea una nuova prenotazione (scrive sul foglio Google **e** crea l'evento Calendar in un solo passaggio)
- `POST /api/cancella` — cancella una prenotazione (con o senza penale), rimuove anche l'evento Calendar

Il bot ora chiama queste stesse API invece di leggere il CSV pubblicato grezzo — `assistente-telegram/lib/bookingSystem.js` sostituisce il precedente `lib/bookings.js` (rimosso). Vantaggi: dati sempre coerenti con quello che Raffaele vede sul sito, nessuna logica di calcolo duplicata, se un domani cambia una formula sul sito il bot resta automaticamente allineato.

**Nuove capacità**, sempre con conferma esplicita prima di scrivere (stesso pattern proponi-e-conferma di wiki/calendario):
- **Nuova prenotazione**: frasi come "nuova prenotazione: Mario Rossi, Tulipano, dal 5 al 7 settembre, Booking, 150€" fanno scattare `propose_new_booking_from_chat`.
- **Cancellazione**: frasi come "cancella la prenotazione di Mario" fanno scattare `propose_cancel_booking_from_chat`, che cerca la prenotazione corrispondente tra quelle attive — se non è identificabile con certezza (nome/date ambigui), il bot chiede chiarimenti invece di indovinare o cancellare la prenotazione sbagliata.

Prudenza applicata durante lo sviluppo: il codice delle API è stato letto direttamente dal progetto locale (sola lettura) invece di scoprirlo "a tentativi" mandando richieste di prova al sito vero — per non rischiare di creare o cancellare per sbaglio una prenotazione reale durante i test. Solo la lettura (`GET /api/prenotazioni`) è stata testata dal vivo; le funzioni di creazione/cancellazione sono state verificate testando solo la fase di "proposta" (senza eseguirla), lasciando il primo utilizzo reale a Raffaele.

## Motore Rafilu — dashboard personale online (01-02/09/2026, ex "Plancia di Raffaele")

Prima versione live della "dashboard con macroaree" già immaginata da Raffaele (vedi sezione "Visione più ampia" sopra). Pubblicata come nuova pagina `/plancia` dentro il progetto esistente **salzillo-hospitality** (Vercel), senza toccare il sito di gestione prenotazioni già in uso (resta a `/`, invariato) — per scelta esplicita di Raffaele, che vuole poter continuare a condividere quello strumento con eventuali collaboratori futuri.

**Design**: due proposte mostrate a Raffaele (una calda/editoriale con teal e terracotta, una in stile Apple×Airbnb con superfici morbide, molto bianco e accento corallo) — scelta la seconda. Card cliccabili che aprono una pagina di dettaglio dedicata (via hash routing lato client), con un pulsante "Apri gestione prenotazioni" nella scheda del B&B che rimanda al sito vero per le azioni (aggiungere/cancellare prenotazioni), non duplicate qui.

**Dati live collegati**:
- **Prenotazioni**: stessa API del sito (`/api/prenotazioni`) — occupazione stanze, arrivi nei 14 giorni, utile del mese, tutto calcolato da dati reali
- **Calendario**: nuova route `/api/calendario`, stesso account Google OAuth già usato dal bot Telegram (credenziali duplicate come variabili d'ambiente su Vercel) — aggrega personale + B&B come fa il bot
- **Notizie**: nuova route `/api/notizie` (ANSA, BBC World, Il Sole 24 Ore via RSS)
- **Mercati**: nuova route `/api/mercati` (Yahoo Finance, incluso il PAC ETF)
- **Meteo**: chiamata diretta dal browser a Open-Meteo (gratuito, senza chiave) per Marcianise e Feltre

**Non collegati** (restano statici per ora, nessuna fonte automatizzabile disponibile): Scuola, Salute (dichiarata esplicitamente "concept"), Vita personale.

**Bug trovato e corretto prima di considerarla stabile**: la barra superiore "sospesa" (`position: sticky`) usava un effetto di sfocatura (`backdrop-filter: blur`) che, in combinazione con lo scroll, causava un mancato ripristino del contenuto sottostante in alcuni scenari (schermo che restava bianco/vuoto scorrendo) — bug noto di Chromium in quella combinazione. Rimossa la sfocatura, mantenuto solo lo sfondo semi-opaco; anche corretto lo sfondo della pagina (che tornava al colore chiaro del sito principale invece di rispettare il tema scuro). Verificato con test mirati prima e dopo la correzione.

**Accesso**: nessuna protezione/password — scelta esplicita di Raffaele nonostante il rischio segnalato (calendario e dati finanziari visibili a chiunque abbia il link).

**Evoluzione (02/09/2026)**: rifatta la grafica prendendo ispirazione da Instagram/Airbnb/Apple (font Plus Jakarta Sans + Inter, quadranti circolari sfumati stile Apple Fitness per B&B/patrimonio/relazione, palette calda) dopo che la prima versione "non faceva effetto wow". Aggiunto un pulsante per scegliere esplicitamente tema chiaro/scuro (persistito sul dispositivo), oltre al comportamento automatico secondo il sistema. Aggiunta identità da "app": icona e nome dedicati per il salvataggio in home screen su iPhone/iPad (si apre a schermo intero, senza barra di Safari). **Rinominata da "Plancia di Raffaele" a "Motore Rafilu"** su richiesta esplicita di Raffaele, che voleva un nome personale invece di uno generico — "Rafilu" è il soprannome che gli dà Martina; icona con monogramma "MR".

## Sezione Salute — tentativo e rinuncia (02/09/2026)

Provato a collegare la sezione "Salute" (finora un concept) a dati reali: automazione iPhone (app Comandi) che avrebbe mandato passi e calorie attive ogni giorno a una nuova route `/api/salute`, con dashboard e assistente aggiornati di conseguenza. **Costruito, testato con successo con un dato finto, poi smontato su richiesta di Raffaele**: senza uno smartwatch, l'app Salute del suo iPhone non ha dati affidabili nemmeno per passi/calorie — non ha senso costruire l'integrazione ora. Rimossi: route `/api/salute`, tool `get_health` dell'assistente, card/vista "Salute" tornate al placeholder "Concept" originale, tab "HEALTH" del foglio Google eliminata. Da riprendere se in futuro arriva un dispositivo wearable.

## Bot Telegram spostato su Vercel, sempre acceso (02/09/2026)

Il bot Telegram di Raffaele non gira più sul suo PC (bot.js, polling) ma su Vercel (webhook), quindi ora risponde 24/7 anche a computer spento — stesso obiettivo della barra della dashboard qui sopra, stessa architettura.

**Cosa è cambiato**:
- Nuova route `src/app/api/telegram-webhook/route.ts`: Telegram chiama questo indirizzo ad ogni messaggio (invece del bot che chiede continuamente "ci sono novità?"). Protetta da un secret token verificato ad ogni chiamata (`TELEGRAM_WEBHOOK_SECRET`), così solo Telegram può invocarla.
- Il ciclo agentico (stessi strumenti di prima: prenotazioni, calendario, notizie, mercati, proposte con conferma) è stato spostato in `src/lib/assistantCore.ts`, condiviso sia dal webhook Telegram sia dalla barra della dashboard — nessuna logica duplicata tra i due.
- **Stato della conversazione** (cronologia, proposta in sospeso): prima viveva in una variabile in memoria del processo bot.js: su Vercel, dove ogni richiesta può girare su un'istanza diversa, serviva un posto persistente. Invece di aggiungere un database nuovo, riusa lo stesso foglio Google Sheets già usato per le prenotazioni, con una tab dedicata "BOT_STATE" (una riga per chat, si crea da sola al primo utilizzo).
- **Digest mattutino**: spostato da un cron interno al processo (node-cron) a un Vercel Cron Job (`vercel.json`, endpoint `/api/cron/digest`, protetto da `CRON_SECRET`), programmato per le 8:00 ora italiana (nota: essendo Vercel Cron in UTC fisso, senza aggiustamento automatico per l'ora legale, l'orario potrebbe scalare di un'ora quando cambia l'ora legale a fine ottobre — da sistemare se capita).
- **Non disponibile da qui** (come già per la barra dashboard): ricerca nel wiki, invio file/foto, messaggi vocali — richiedono il disco locale del PC. Se arriva un messaggio con foto/vocale, il bot ora risponde spiegando che quel tipo di contenuto non è ancora supportato dalla versione cloud.
- Il vecchio bot.js locale resta nel progetto, funzionante, ma **non va riavviato mentre il webhook è attivo** (Telegram permette solo una modalità di consegna alla volta: webhook o polling, non entrambi insieme) — se in futuro serve tornare al bot locale per wiki/foto, va prima rimosso il webhook (`deleteWebhook`).

**Effetto collaterale non ancora risolto**: il task schedulato `sync-conversazioni` legge le conversazioni Telegram dai file locali `conversation-logs/*.jsonl`, che il bot cloud non scrive più (Vercel non ha accesso al disco di Raffaele). Da oggi in poi, finché non si costruisce un equivalente cloud di quel log, le conversazioni Telegram non vengono più ingerite automaticamente nel wiki.

Testato con chiamate dirette simulate al webhook (senza toccare il bot reale) prima di attivarlo: dati live confermati corretti (es. ospiti in casa), cronologia e proposta in sospeso persistite correttamente tra chiamate separate (propose → conferma/rifiuto), poi attivato con `setWebhook` e verificato con `getWebhookInfo`.

## Barra assistente nella dashboard (02/09/2026)

Aggiunta una barra fissa in fondo a Motore Rafilu (`/plancia`), sempre visibile durante lo scroll, dove Raffaele può scrivere (o dettare via microfono della tastiera iOS, nessuna API vocale necessaria) domande e richieste — stile "barra di ricerca", risposta che si espande sopra la barra come una card, coerente con lo stile del resto della dashboard.

**Nuova route** `src/app/api/assistente/route.ts` su salzillo-hospitality: un ciclo agentico Claude equivalente a quello del bot Telegram, ma **cloud-only** — nessun accesso al wiki né invio file, perché quelli richiedono il disco locale del PC di Raffaele dove gira bot.js. Strumenti disponibili: get_bookings/get_calendar_events/get_news/get_markets (tutti chiamano le API già esistenti della dashboard) e propose_new_booking/propose_cancel_booking/propose_calendar_event_from_chat (stessa logica "proponi e aspetta conferma sì/no" del bot, riscritta qui perché il bot vive in un progetto separato non condiviso). Stato di conversazione (cronologia, proposta in sospeso) gestito lato browser, non sul server — si azzera se si ricarica la pagina.

Aggiunta la chiave `ANTHROPIC_API_KEY` alle variabili d'ambiente di Vercel del progetto (mancava, il resto delle API della dashboard non ne aveva mai avuto bisogno).

Testato dal vivo in produzione: query sui dati (mercati, prenotazioni), proposta di un evento calendario con richiesta di conferma, e il percorso di rifiuto ("no" → annullato).

## Redesign del sistema di gestione prenotazioni (02/09/2026)

Applicata la stessa palette/tipografia di Motore Rafilu (Plus Jakarta Sans per i titoli, colori corallo/verde/ambra, angoli più arrotondati, ombre morbide sulle card) alla pagina `/` del progetto **salzillo-hospitality** — il sistema di gestione prenotazioni che Raffaele condivide con i suoi collaboratori. Modifica **puramente visiva**: nessuna funzionalità toccata, per scelta esplicita di Raffaele. Verificato dopo la modifica che form, lista prenotazioni e modale di cancellazione funzionassero esattamente come prima.

## Bug nella ricerca wiki (search_wiki) trovato e risolto (08/09/2026)

Raffaele ha segnalato che il bot/la barra di Motore Rafilu (non ricordava quale dei due, ma condividono lo stesso codice — vedi sopra) non gli aveva dato nulla chiedendo "mandami i dati del mio diploma" col PC spento. Non serviva il file vero (quello lo recupera lui dal telefono): gli bastavano i dati testuali già nel wiki (data, istituto, votazione, numero diploma — stessa logica delle credenziali già in chiaro nel wiki).

Indagine: il webhook Telegram risultava sano (nessun errore di consegna registrato da Telegram) — il problema non era l'infrastruttura ma la funzione `search_wiki` stessa, in `assistantCore.ts` (condivisa da bot Telegram e barra dashboard). Due bug reali trovati riproducendo la ricerca sulla copia cloud del wiki:

1. **Conteggio a sottostringa, non a parola intera**: `testo.split(parola).length` contava anche le occorrenze dentro altre parole — es. "nato" risultava "presente" in ogni pagina del wiki solo perché è sottostringa di "aggior**nato**" (nel frontmatter `aggiornato:` di ogni singola pagina).
2. **Punteggio grezzo non pesato**: contare semplicemente le occorrenze faceva vincere pagine lunghe e generiche (es. `log.md`, la pagina del bot stesso) che ripetono tanto parole comuni come "dati", invece della pagina realmente pertinente ma più corta e specifica.

Corretto con tokenizzazione a parola intera + punteggio **BM25** (tecnica standard di information retrieval: pesa le parole rare/specifiche della domanda più di quelle comuni, e non lascia vincere le pagine solo perché sono lunghe). `log.md` escluso dalla ricerca (storico operativo, quasi mai la risposta a una domanda sui fatti). Limite pagine restituite alzato da 3 a 5 per dare più margine quando la pagina giusta non è la prima per punteggio.

**Verificato con il codice reale** (non solo con uno script di prova): la query "mandami i dati del mio diploma" ora restituisce correttamente [[titoli-certificazioni-raffaele]] tra le pagine trovate. Deploy fatto, nessuna rotta di test lasciata in produzione.

## Rischio da tenere presente

Il vault contiene credenziali bancarie e documenti d'identità in chiaro, per scelta esplicita di Raffaele (vedi [[bb-il-tulipano]] e [[raffaele-salzillo]]). Un bot raggiungibile da internet aumenta la superficie di esposizione di questi dati: la whitelist sul proprio chat id Telegram è la prima barriera di Fase 1, ma non l'unica misura da considerare man mano che il progetto cresce (in particolare quando si passerà a un server sempre acceso per la Fase 2/3).

## Visione più ampia emersa da claude.ai (31/08/2026)

Un export dell'account claude.ai di Raffaele ha rivelato che questa stessa visione era già stata discussa in precedenza, in chat separate, con dettagli aggiuntivi mai menzionati direttamente in Claude Code. Registrati qui come roadmap futura, non ancora costruiti:

- **Dashboard con macroaree cliccabili**: patrimonio, salute, lavoro come insegnante, lavoro come host ([[salzillo-hospitality]]), agenda, meteo, vita personale (viaggi, ecc.) — ogni macroarea apre una sezione con dati specifici e possibilità di interagire.
- **Modulo salute/forma fisica**: bracciale Fitbit senza schermo (es. Fitbit Air) collegato via Google Health API per raccogliere passi, calorie, minuti attivi, allenamenti, distanza, frequenza cardiaca, sonno, peso. Obiettivo: poter chiedere ogni giorno "cosa mangio oggi?" e ricevere consigli su pasti/spuntini (quantità, kcal, macro) tenendo conto di cosa ha già mangiato; le calorie stimate dal Fitbit vanno trattate come stima, non valore esatto; il sistema dovrebbe adattare gradualmente le calorie consigliate confrontando peso reale vs previsto nel tempo, senza reagire in modo aggressivo a una singola giornata. Alimentazione consigliata: semplice, economica, sostenibile.
- **Consigli automatici**: cosa indossare in base a meteo, stipendio e guardaroba; cosa comprare, vendere o regalare.
- **Hosting**: valutava sia un Raspberry Pi locale (budget dichiarato: sotto €100) sia il cloud; livello di comfort tecnico dichiarato "basso" all'epoca (prima di iniziare a costruire da solo [[salzillo-hospitality]] con Claude Code, il che suggerisce che questo limite potrebbe non valere più).
- Per la prima versione, preferenza dichiarata: partire dalla "facciata" (struttura/dashboard) e lasciare a Claude la scelta di come procedere sul resto.

## Visione ampliata — "vero assistente personale" (08/09/2026)

Raffaele ha esplicitato un obiettivo più grande, discutendo se convenisse affittare un VPS per raggiungerlo: un assistente che gestisce tutto, risponde sia a lui sia ai clienti del B&B su **WhatsApp**, e gestisce le **email**. Analizzato insieme (vedi anche [[infrastruttura-free-first]] per la decisione sull'hosting): nessuna di queste due estensioni richiede un'infrastruttura diversa da quella già in uso (Vercel, stesso pattern webhook già usato per Telegram). Non ancora costruite, ma tecnicamente pronte per essere aggiunte quando Raffaele vorrà:

- **WhatsApp per i clienti** (risposta automatica agli ospiti, non solo i tap-to-send manuali di oggi): richiede la verifica ufficiale dell'attività da parte di Meta (WhatsApp Business Cloud API) — un passaggio burocratico/di approvazione, non un costo di hosting. **Promemoria del rischio già segnalato** (vedi [[messaggi-checkin-ospiti]]): un'IA che risponde direttamente a ospiti veri, a differenza di rispondere a Raffaele, ha conseguenze concrete se sbaglia — da costruire con più cautela (es. conferma di Raffaele prima dell'invio, almeno in una prima fase).
- **Gestione email**: stessa logica di lettura/risposta già pianificata per l'automazione Gmail (vedi sezione "Fase 3" sopra e [[salzillo-hospitality]] per lo stato dell'OAuth, ancora bloccato).

**Ulteriore sharpening (08/09/2026 sera)**: Raffaele ha precisato che l'ambizione non è solo "un assistente che fa tutto per me", ma una vera piattaforma di property management condivisibile in futuro con proprietari/staff, costruita esplicitamente per permettere la crescita (più immobili) senza aumentare il tempo umano richiesto — vedi la decisione dedicata [[piattaforma-property-management-personale]] e [[salzillo-hospitality]] sezione "Idee per il prossimo giro".

## Log conversazioni Telegram interrotto per una settimana — trovato e corretto (09/09/2026)

Durante un giro di controllo generale ("controlla anche il resto in autonomia", Raffaele) è emerso che **dal 02/09/2026 (giorno del passaggio del bot da locale a Vercel, vedi [[un-solo-canale-bot-telegram]]) nessuna conversazione Telegram veniva più registrata da nessuna parte**. Il vecchio `bot.js` scriveva ogni turno in `assistente-telegram/conversation-logs/{data}.jsonl` — file che infatti si fermano esattamente al 2 settembre. Il nuovo webhook su Vercel (funzioni serverless, filesystem effimero) non aveva mai avuto un equivalente: la sostituzione non era mai stata fatta, un buco silenzioso di circa una settimana, mai notato prima.

**Corretto lo stesso giorno**: nuovo `src/lib/telegramLog.ts` nel progetto salzillo-hospitality — stesso schema `{ts, chatId, role, text}` di sempre, ma scritto su una tab dedicata del foglio Google (`TELEGRAM_LOG`) invece che su file locali, coerente con come gira già tutto il resto su Vercel. Collegato in `src/app/api/telegram-webhook/route.ts`: logga sia il messaggio dell'utente sia la risposta del bot, sempre con `await` (non fire-and-forget) perché una funzione serverless può essere terminata subito dopo la risposta HTTP — un log non atteso rischierebbe di sparire in silenzio, esattamente il bug che doveva risolvere. Verificato con una scrittura di prova reale (dati chiaramente finti, poi ripuliti) prima di dichiararlo a posto.

**Resta da fare**: il task schedulato `sync-conversazioni` (vedi CLAUDE.md del vault) va aggiornato per leggere anche dalla nuova tab `TELEGRAM_LOG`, non solo dai vecchi file `.jsonl` locali (fermi al 02/09, restano validi come archivio storico di quel periodo). CLAUDE.md già aggiornato con la spiegazione, manca la logica del task stesso.

## Da approfondire

- La trascrizione vocale dipende dal fatto che Handy resti installato in `C:\Users\salzi\OneDrive\Desktop\Handy\` con quel nome — se Raffaele disinstalla/sposta Handy, i vocali smettono di funzionare finché non si aggiorna `HANDY_EXE_PATH`.
- **Disponibilità 24/7 — decisione presa il 31/08/2026 (Raspberry Pi), poi risolta diversamente**: valutate tre opzioni (Raspberry Pi a casa, server cloud gratuito, ibrido), scelto allora il Raspberry Pi soprattutto per non aumentare l'esposizione dei dati sensibili del vault su un server esterno. **Aggiornamento (02/09/2026, stesso giorno del resto di questa pagina)**: l'obiettivo di fondo — bot e dashboard sempre raggiungibili, non solo mentre il PC di Raffaele è acceso — è stato raggiunto per un'altra strada, spostando bot e dashboard su Vercel (vedi sezioni "Bot Telegram spostato su Vercel" e "Motore Rafilu" sopra). Il Raspberry Pi non risulta acquistato né più menzionato dopo questa data: l'idea resta sullo sfondo solo se in futuro Raffaele preferisse spostare i dati sensibili fuori da un server cloud esterno per motivi di privacy (motivo originale della scelta), non più per il solo obiettivo di uptime, ormai coperto da Vercel. Persistono da PC locale solo le funzioni che richiedono il disco di Raffaele: ricerca nel wiki completa, invio file/foto, trascrizione vocale (Handy) — la ricerca nel wiki è comunque raggiungibile online temporaneamente (copia redatta, password), vedi [[overview]].
- Estensione della Fase 3 alle altre aree valutate ma non ancora scelte allora: gestione B&B (es. aggiornare prenotazioni, rispondere a messaggi ospiti) — **in parte intrapresa dal 07/09/2026**, non tramite il bot ma con un'espansione diretta della dashboard Motore Rafilu (griglia di 8 strumenti host da costruire, vedi [[salzillo-hospitality]]); comunicazioni per conto di Raffaele restano non affrontate (esplicitamente l'area più delicata).
- Verificare se il consolidamento del calendario di lavoro (istitutosuperiorefeltre.it) e della nuova casella B&B (`salzillohospitality@gmail.com`, vedi [[bb-il-tulipano]]) nell'account principale è andato a buon fine — **aggiornamento (07/09/2026)**: indipendentemente dal consolidamento, l'autorizzazione OAuth stessa di Google Calendar risulta scaduta/revocata (`/api/calendario` risponde `invalid_grant`), da rifare — vedi [[salzillo-hospitality]], sezione "In sospeso — da riprendere l'8/09/2026".
