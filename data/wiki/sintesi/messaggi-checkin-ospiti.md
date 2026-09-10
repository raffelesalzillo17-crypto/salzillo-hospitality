---
titolo: Messaggi standard di check-in per gli ospiti
tipo: sintesi
tag: [salzillo-hospitality, whatsapp, ospiti, checkin, operativo]
fonti:
  - "conversazione diretta in Claude Code, sessione 07/09/2026"
creato: 2026-09-07
aggiornato: 2026-09-07
---

# Messaggi standard di check-in per gli ospiti

Testi pronti da usare come Risposta rapida in WhatsApp Business (vedi [[salzillo-hospitality]] per i contatti ufficiali), una scheda per stanza — nate dall'esigenza di Raffaele di avere per ogni stanza le informazioni corrette, invece di un messaggio unico generico. Base anche per un eventuale futuro concierge IA guest-facing (progetto separato, non ancora avviato — vedi nota in [[salzillo-hospitality]] sui rischi di un'IA che risponde direttamente agli ospiti).

## Versione web (Claude Artifact)

**Aggiornamento (07/09/2026)**: oltre al testo WhatsApp qui sotto, esistono due pagine web dedicate — stile "sito di hotel", font/colori identici a Motore Rafilu (Plus Jakarta Sans + Inter, coral `#FF5A5F`), **tema sempre chiaro** (non segue il tema del telefono, per scelta esplicita), foto vera in copertina per il Tulipano (foto camera con testata in ferro battuto bianco e cuscini rosa, sostituita lo stesso giorno su richiesta di Raffaele con `Il TULIPANO/foto/Foto modificate/Foto 3.png`, ridimensionata/compressa con ffmpeg a ~46KB). Griglia di riquadri (Indirizzo, Parcheggio, Ingresso, WiFi, Cucina, Check-in & Check-out) — ognuno apre una **pagina dedicata a schermo intero** (con tasto indietro), non un pannello che si espande. Tasto fisso in fondo "Contatta Lella" → apre WhatsApp (non chiamata diretta: il `tel:` non funzionava in ambiente sandboxed, e così l'ospite sceglie da sé se chiamare o scrivere una volta dentro la chat). Le due pagine sono scritte per essere **indipendenti**: nessun riferimento incrociato tra Tulipano e Stanza Rosa (un ospite dell'una non deve sapere dell'esistenza dell'altra) — anche il link Google Maps di Stanza Rosa cerca l'indirizzo puro, non il nome dell'attività.

Per **Stanza Rosa** manca il self check-in (nessuna cassetta chiavi dedicata): la sezione "Ingresso" spiega di coordinarsi direttamente con Lella su WhatsApp, con un tasto dedicato, invece di dare istruzioni per un accesso autonomo — senza nemmeno le indicazioni fisiche di come arrivare, perché senza aver prima organizzato l'accesso con Lella l'ospite non può comunque entrare.

**Video (07/09/2026)**: nella sezione "Chiavi & ingresso" del Tulipano è incorporato il video di Raffaele che mostra come trovare/aprire la cassetta chiavi — ricevuto via WhatsApp (22,7MB), compresso con ffmpeg (scala 360px, CRF 30, H.264, senza audio) a 4,9MB e incorporato come base64 direttamente nella pagina, perché la capability "assets" di Claude Artifact non è disponibile per questo account.

**Dove mangiare, espanso a 19 locali (07/09/2026)**: su richiesta di Raffaele ("voglio i venti migliori... divisi per categoria e per chilometri"), la sezione "Dove mangiare" è stata riorganizzata per fascia di distanza (non km esatti — nessun tool di mappe disponibile per calcolarli, raggruppati per zona/tipo di indirizzo) invece che per sola categoria cucina:
- **A piedi** (centro Marcianise, 8 locali): i consigli originali di Raffaele — Trattoria Pizza e Fritti, Pizzeria Letizia dal 1985, Pizzeria da così a così, Il Campanile Pizzeria, Cafeina Eat, Birrodromo Restaurant, Taste, Panificio Delli Paoli
- **In auto, pochi minuti** (Marcianise periferia/Capodrise, 7 locali, trovati via ricerca web con indirizzo+recensioni verificati): Pizz Cor e Passion (Viale Europa 40), Granai Pizzeria (Via F. Evangelista 77, 4.3★), Rossopomodoro (Outlet La Reggia, 9.5/10 TheFork), Ristorante Don Peppe (C.C. Campania Loc. Aurno 87, 3.4★/908 recensioni), Fratelli La Bufala (C.C. Campania Loc. Aurno 87, 8.8/10), Lanza Artigiani del Gusto (C.C. Campania Loc. Aurno 87, 3.5★/650 recensioni), Pharina (Via Retella 85, Capodrise, 9.1/10)
- **In auto, più lontano** (4 locali): Gli Scacchi (Via Salvatore Maielli 3, Caserta, vicino alla Reggia), Le Goût - L'Arte dei Sapori (Via Marchesiello 112, Caserta), Arbù - Welcome to the Jungle (Via Carlo Levi, San Nicola la Strada, 8.4/10), Braceria De Matteo (Maddaloni)

Tutti i nuovi locali (non quelli originali di Raffaele) sono stati proposti a Raffaele con fonte prima di essere pubblicati, e confermati da lui in blocco. Fermato a 19 invece di 20 per non includere nomi senza indirizzo/recensioni verificabili.

**Domande frequenti (07/09/2026)**: aggiunto un riquadro "Domande frequenti" a entrambe le pagine, stesso contenuto per Tulipano e Stanza Rosa (fatti forniti da Raffaele): aria condizionata sì, asciugacapelli sì (in camera), ferro da stiro no, culla per neonati su richiesta.

**Cose da fare (07/09/2026)**: aggiunto un settimo riquadro largo "Cose da fare nei dintorni" (uguale su entrambe le pagine, non specifico per stanza) con due link — Caserta e Napoli — verso GetYourGuide. Scoperte inizialmente decodificando il QR del poster che Raffaele aveva già scaricato ma non ritrovava (`Locandina Get Your Guide (QR esperienze Caserta).pdf`, in `B&B/Via Clanio (Il Tulipano)/` — corregge una nota precedente in [[bb-il-tulipano]] che lo dava per "nessun dato rilevante"), portava a pagine di affiliazione ospitate su **vitadahost.it** ("Vita da Host") con tracking di terzi, non di Raffaele.

**Corretto lo stesso giorno**: Raffaele ha fatto notare che con quei link il guadagno dell'affiliazione va a Vita da Host, non a lui. Prima sostituiti temporaneamente con link diretti non affiliati (estratto il `location_id` dal widget ufficiale usato da vitadahost.it: Caserta=3426, Napoli=162; pattern URL `getyourguide.com/<slug>-l<location_id>/`), poi Raffaele ha fornito il proprio link di affiliazione GetYourGuide personale (`partner_id=LTLBXZL`, programma "share to earn" — evidentemente già registrato in autonomia). Link finali usati su entrambe le pagine, ora con tracking a favore di Raffaele:
- Caserta: https://www.getyourguide.com/caserta-l3426/?partner_id=LTLBXZL&cmp=share_to_earn
- Napoli: https://www.getyourguide.com/napoli-l162/?partner_id=LTLBXZL&cmp=share_to_earn

**Regole della casa (07/09/2026)**: aggiunto un riquadro largo "Regole della casa" (uguale su entrambe le pagine), fatti forniti direttamente da Raffaele in chat: fumo vietato all'interno (consentito fuori), animali ammessi solo di piccola taglia, feste vietate, silenzio dopo le 22:00, ospiti extra da concordare prima con supplemento per il posto letto aggiuntivo, lavatrice non disponibile in struttura.

**Corretto lo stesso giorno**: rimossa la voce "Lavatrice" (non era una vera regola, solo un'informazione). "Ospiti extra" esteso per includere anche letto aggiuntivo/culla (stesso trattamento: va concordato prima). Aggiunta una nuova voce "Pulizie extra": su richiesta, concordabili a 20€.

**Cucina, corretto (07/09/2026)**: Raffaele ha precisato meglio i fatti — non solo il frigo ha un ripiano dedicato per stanza (non l'intera cucina/macchinetta caffè, che restano condivise con tutto l'appartamento); le cialde per il caffè e la colazione (prodotti confezionati) si trovano già in camera, non in cucina. Corretto su entrambe le pagine.

**Dove mangiare**: aggiunto un riquadro largo "Dove mangiare" (uguale su entrambe le pagine). Niente mappa interattiva incorporata: verificato con un test diretto che la security policy dell'Artifact blocca gli iframe verso siti esterni (Google Maps incluso); ogni locale è una scheda tappabile che apre la posizione precisa su Google Maps (stesso pattern già in uso per "Indirizzo"). ~~Prima versione: 9 locali raggruppati per categoria cucina (Pizzerie/Ristoranti/Pane & sfizi/Fuori città)~~ — **espansa lo stesso giorno a 19 locali, riorganizzata per fascia di distanza**, vedi voce sotto.

**Cose da fare, espansa (07/09/2026)**: su richiesta di Raffaele ("metti anche tutto quello che c'è da fare in zona"), oltre ai due link GetYourGuide (ora sotto un sottotitolo "Esperienze guidate") aggiunta una lista di monumenti/luoghi da visitare, verificati via ricerca web (indirizzo/orari con fonte), stessa struttura a fasce di distanza di "Dove mangiare":
- **A piedi** (Marcianise): Fontana dei Delfini (Piazza Umberto I), Duomo di San Michele Arcangelo, Chiesa di Santa Maria della Stella (XII sec.), Santuario di San Rocco
- **In auto, pochi minuti**: Reggia di Caserta (Viale Douhet 2/a, UNESCO), Caserta Vecchia (borgo medievale), Real Sito di San Leucio (Via del Setificio 5, museo della seta, UNESCO), La Reggia Designer Outlet, Centro Commerciale Campania (quest'ultimo aggiunto su richiesta esplicita di Raffaele)
- **In auto, più lontano**: Anfiteatro Campano (Piazza Adriano, Santa Maria Capua Vetere — secondo anfiteatro romano più grande d'Italia)

Proposta con fonti e confermata da Raffaele prima della pubblicazione.

**Corretto il layout mobile, tre tentativi (07/09/2026)**: Raffaele ha segnalato dal telefono vero (screenshot) un grande vuoto tra la griglia di riquadri e la barra di contatto in fondo alla home.
- *Primo tentativo* (scartato): centrare verticalmente il contenuto — ha reso l'effetto peggiore, tre blocchi visivamente staccati (foto in alto, riquadri "flottanti" in mezzo, barra in fondo) invece di una schermata unica.
- *Secondo tentativo* (scartato dopo altri screenshot dal telefono vero, dentro il browser di WhatsApp Business): rimuovere il vuoto forzato e far seguire la barra subito dopo i riquadri — risultato tecnicamente corretto ma la pagina restava corta e non riempiva lo schermo reale (che è più alto della finestra di anteprima usata prima), lasciando comunque un grande vuoto sotto, fuori dal contenuto.
- *Terzo tentativo* (scartato dopo altro screenshot): ancorare la barra al bordo inferiore dello schermo con margine automatico — ha reintrodotto un vuoto (stavolta tra riquadri e barra) che Raffaele ha chiesto esplicitamente di eliminare. Nel frattempo un falso allarme: uno screenshot a pagina intera sembrava mostrare la foto hero sparita/sfondo nero — non era un bug reale, solo un limite dello strumento di screenshot del telefono (non cattura bene sfondi enormi in base64); il sito vero mostrava la foto correttamente. Aggiunta comunque per sicurezza una protezione esplicita del tema chiaro (`color-scheme: light only` in CSS + meta tag), anche se non era la causa del problema visto — verificato che il tema resta chiaro anche forzando la modalità scura del browser.
- *Stato precedente al fix definitivo*: barra dei tasti di nuovo attaccata subito sotto i riquadri (nessun vuoto in mezzo), riquadri/icone più grandi rispetto all'originale. Raffaele ha comunque richiesto un giro di lavoro più approfondito e dedicato (vedi sotto, "squadra di agenti ottimizzazione mobile") perché il risultato visivo su più tentativi non lo ha ancora convinto del tutto.

**Causa radice trovata e risolta (07/09/2026, squadra dedicata ottimizzazione mobile)**: nessuno dei quattro tentativi precedenti aveva notato che **entrambi i file HTML non avevano mai avuto un tag `<meta name="viewport">`**. Senza quel tag, un browser mobile (incluso il browser in-app di WhatsApp Business, dove Raffaele aveva fatto gli screenshot che avevano bocciato i tentativi 2 e 3) renderizza la pagina assumendo una finestra virtuale larga ~980px e poi la rimpicciolisce per adattarla allo schermo reale — per questo tutte le misure in `vh`/`dvh` calcolate nel CSS risultavano coerenti solo nell'anteprima del browser desktop usata per testare, ma sbagliate/incoerenti sul telefono vero. Aggiunta la riga `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (anche `viewport-fit=cover`, necessario perché la barra dei tasti usa `env(safe-area-inset-bottom)`) in cima a entrambi i file, subito dopo il meta charset.

Con il viewport corretto, il layout della home già esistente (hero + griglia 10 riquadri 2 colonne + riga brand + barra "Contatta Lella/Scrivici su WhatsApp" in coda, non fissa) si è rivelato naturalmente più alto dell'altezza visibile reale di un telefono moderno — nessuna ulteriore modifica alle dimensioni di riquadri/font è stata necessaria. Misurato con un vero server locale (non l'anteprima Artifact) e con `window.innerWidth/innerHeight`/`scrollHeight`, non solo a occhio:
- 375×812 (iPhone SE/12 mini): contenuto totale 1251px → eccede il viewport di 439px
- 393×852 (telefono Android medio): contenuto totale 1248px → eccede di 396px
- 430×932 (iPhone Pro Max e simili): contenuto totale 1258px → eccede di 326px
(valori per Il Tulipano; per Stanza Rosa, che ha un hero più basso — gradiente invece di foto, 32vh/max 280px contro 46vh/max 400px — l'eccedenza è comunque sempre positiva: 316-283px a seconda della dimensione)

Cioè il contenuto riempie sempre lo schermo interamente fin dal primo frame (niente vuoto visibile, mai), e richiede solo un piccolo scroll naturale (300-440px, meno di una riga di riquadri) per arrivare in fondo alla barra — comportamento normale per una home con 10 voci, non un difetto. Verificato visivamente con screenshot a tutte e tre le dimensioni, in cima e in fondo alla pagina: nessun vuoto tra hero/riquadri/barra in nessun caso, barra sempre attaccata subito dopo la riga brand. Verificato anche che il tema resti chiaro forzando `prefers-color-scheme: dark` nel browser (protezione `color-scheme: light only` confermata intatta). Toggle IT/EN, navigazione a due livelli in "Cose da fare" (monumento → indietro → sezione → indietro → home) e video incorporato nella pagina del Tulipano ("Chiavi & ingresso") tutti ri-testati e funzionanti dopo la modifica. Stessa verifica ripetuta anche sull'URL statico reale su Vercel (non solo in locale), il test più vicino disponibile al dispositivo reale di Raffaele.

**Dubbio residuo dichiarato**: questa sessione non ha potuto testare sul telefono fisico di Raffaele né dentro il browser in-app di WhatsApp Business (motivo esatto dei due bocciati precedenti) — solo con Chrome DevTools in emulazione mobile a più risoluzioni e sull'URL Vercel reale. La causa radice trovata (viewport meta assente) è però strutturale e nota, non specifica di un emulatore: dovrebbe risolvere l'inconsistenza vista finora. Da confermare con un nuovo screenshot reale di Raffaele.

**Descrizioni storiche (07/09/2026)**: su richiesta di Raffaele ("quando cliccano invece di aprire subito la mappa mi piacerebbe aggiungere anche una descrizione storica"), gli 8 monumenti/siti culturali (non i due centri commerciali, che restano link diretti — non hanno una storia da raccontare) ora aprono una pagina di dettaglio dedicata con un breve testo storico/informativo (2-3 frasi, fatti verificati via ricerca web) e in fondo il pulsante per aprire Google Maps. Ha richiesto un'estensione tecnica del routing della pagina (prima a un solo livello: home → sezione; ora anche sezione → dettaglio, con "indietro" che torna al livello giusto invece che sempre alla home).

**Pubblicate su Vercel (07/09/2026)**: le pagine Claude Artifact erano visibili solo con l'account Claude di Raffaele (private di default, richiedono un tasto "Condividi" manuale per renderle pubbliche — passaggio che avrebbe dovuto rifare lui stesso ogni volta). Su sua indicazione ("di solito pubblichiamo sempre con Vercel"), spostate come pagine statiche dentro il progetto `salzillo-hospitality`: i due file HTML avvolti in un documento completo (`<!doctype>`/`<html>`/`<head>`/`<body>`, essendo frammenti pensati per l'Artifact) e salvati in `public/checkin/`, deploy fatto con `vercel deploy --prod`. Ora pubbliche per chiunque, senza login, verificato via richiesta anonima e nel browser:
- Il Tulipano: https://salzillo-hospitality.vercel.app/checkin/tulipano.html
- Stanza Rosa: https://salzillo-hospitality.vercel.app/checkin/rosa.html

Le pagine Claude Artifact restano comunque pubblicate (stessi URL di sempre) come copia di lavoro/anteprima per le modifiche future — da lì si continua a editare e poi si ripubblica anche la copia statica su Vercel copiando i file aggiornati in `public/checkin/` e ridistribuendo. Provata anche l'abbreviazione del link con TinyURL: gli alias "iltulipano"/"stanzarosa" sono finiti rotti per un errore di codifica dell'URL durante la creazione (non recuperabili senza account) e un tentativo successivo ha iniziato a incapsulare i link in un redirect pubblicitario di terzi (viglink.com) — abbandonato l'uso di TinyURL, i link diretti Vercel sono comunque già brevi e sul dominio di Raffaele.

- Il Tulipano (Artifact, copia di lavoro): https://claude.ai/code/artifact/f11d169e-8138-4716-ad58-00db8e3c3818
- Stanza Rosa (Artifact, copia di lavoro): https://claude.ai/code/artifact/a1fd34ce-892e-4fef-8e26-e955f290e4f2

**Revisione tono + toggle IT/EN (07/09/2026)**: su richiesta di Raffaele, tre interventi sulle due pagine.

1. **Riquadro "Indirizzo" trasformato in link diretto**: era l'unico riquadro delle due pagine il cui contenuto si limitava a un pulsante "Apri in Google Maps" (nessuna informazione ulteriore oltre l'indirizzo, già visibile nell'hero). Il tile in home ora è un `<a>` che apre direttamente Google Maps in una nuova scheda, senza passare da una pagina di dettaglio intermedia — la view dedicata è stata rimossa. Tutti gli altri riquadri (inclusi quelli con pochi link, come "Cose da fare") hanno contenuto informativo reale e sono rimasti pagine a sé.
2. **Testi riscritti in tono più caldo e descrittivo**: ogni micro-testo (intro di ogni view, regole della casa, domande frequenti, WiFi, cucina, check-in/check-out, descrizioni dei locali in "Dove mangiare") è stato riscritto per suonare meno telegrafico, restando sui soli fatti già presenti in pagina/in questo file — nessun dato nuovo introdotto. Esempio (Cucina, Il Tulipano): prima "Cucina in comune con macchinetta del caffè e frigorifero: tutto ciò che trovate sul ripiano con scritto 'Il Tulipano' è vostro." → ora "La cucina è in comune con gli altri ospiti dell'appartamento, ma macchinetta del caffè e frigorifero sono a vostra disposizione: tutto ciò che trovate sul ripiano con scritto 'Il Tulipano' è vostro, sentitevi liberi di usarlo."
3. **Toggle lingua Italiano/Inglese**: pill "IT/EN" in alto a destra dell'hero in home, e ripetuta in ogni view accanto al pulsante indietro. Al click traduce tutto il testo visibile (hero, tile, contenuto delle view, contact bar, descrizioni dei locali) tra italiano e inglese, senza chiamate a servizi esterni di traduzione (bloccate comunque dalla CSP dell'Artifact) — implementato in puro JS con coppie di attributi `data-it`/`data-en` su ogni elemento testuale e uno script che sostituisce `innerHTML` al click, mantenendo la lingua scelta durante la navigazione tra le view (variabile JS in memoria, non persistita tra sessioni). Testato manualmente su entrambe le pagine: switch IT↔EN funzionante sia dall'hero che dall'interno delle view, incluso il caso con markup misto (es. orari in grassetto, badge del codice cassetta chiavi).

Nessun altro riquadro convertito in link diretto: tutti gli altri (Parcheggio, Chiavi & ingresso/Ingresso, WiFi, Cucina, Check-in & Check-out, Dove mangiare, Regole della casa, Domande frequenti, Cose da fare) restano pagine dedicate perché contengono istruzioni, elenchi o testo che va oltre il singolo link.

**QA finale (07/09/2026)**: giro di controllo su entrambe le pagine dopo tutti gli aggiornamenti sopra. Trovati e corretti due problemi di origine tecnica (nessun fatto cambiato):
- Un frammento di testo residuo di una versione precedente era rimasto incollato in coda al paragrafo "Cucina" su entrambe le pagine (visibile solo guardando il codice sorgente, non a schermo — grazie a come funziona il toggle di lingua, che sovrascrive il testo appena la pagina carica). Rimosso.
- Un controllo sistematico ha trovato una ventina di paragrafi (check-in/check-out, regole della casa, domande frequenti, "chiavi & ingresso" del Tulipano, intro di "Dove mangiare") dove il testo scritto per il toggle italiano non corrispondeva esattamente al testo visibile nel codice sorgente — anche qui invisibile a schermo per lo stesso motivo, ma scorretto se mai la pagina venisse letta senza eseguire lo script (es. un'anteprima statica). Allineati tutti.

Verificato dal vivo nel browser: le nuove schede-monumento (bottoni) hanno lo stesso aspetto delle schede-ristorante (link) — nessun bordo o stile di default del bottone che spunta fuori. Aprire un monumento da "Cose da fare" e premere indietro torna a "Cose da fare"; indietro da lì torna alla home (routing a due livelli confermato funzionante). Toggle IT/EN testato anche dentro le nuove pagine dei monumenti (testo, orari di apertura della Reggia, pulsante Google Maps — tutto tradotto correttamente).

## Versione testo (WhatsApp)

## Il Tulipano — Via Clanio 60

✅ **WiFi confermato (07/09/2026)**: rete **Lella** — password **Lella1978@**. Aggiornato su entrambe le pagine web e nel testo sotto (sostituisce la password provvisoria "SalzilloOspiti26", mai impostata sul router).

```
Benvenuti al B&B Il Tulipano! 🌷

Ecco tutte le istruzioni per il self check-in (guardate anche il video allegato).

📍 Indirizzo
Via Clanio 60, Marcianise — su Google Maps: "B&B Il Tulipano Marcianise"

🚗 Parcheggio
Gratuito lungo la strada, non è disponibile un parcheggio interno.

🔑 Ritiro chiavi
Accanto ai citofoni c'è una targhetta con il nome del B&B. Lì vicino trovate la cassetta di sicurezza: codice 1605.

🚪 Ingresso e camera
Entrate dal cancello nero con il numero 60 e proseguite fino in fondo al cortile. Sulla sinistra ci sono tre gradini; alla destra dei gradini un portoncino marrone. La prima porta sulla destra è la vostra camera, "Il Tulipano".

📶 WiFi
Rete: Lella — Password: Lella1978@

☕ Cucina
La cucina è in comune con gli altri ospiti dell'appartamento: macchinetta del caffè e frigorifero sono anch'essi condivisi. Nel frigo trovate però il vostro ripiano personale, con il nome della camera. Le cialde per il caffè e la colazione (prodotti confezionati) le trovate già in camera.

🕒 Check-in: dalle 15:00 (orario indicativo — in caso di imprevisti può anticipare o posticiparsi, scriveteci in anticipo se avete esigenze diverse)

📲 Appena entrati scriveteci: dobbiamo registrarvi in Questura (obbligatorio per legge, pochi secondi) prima che iniziate il soggiorno.

🕙 Check-out: entro le 10:00. Riponete le chiavi nella stessa cassetta di sicurezza da cui le avete prese (codice 1605) e mandateci un messaggio su WhatsApp per confermarci che siete usciti.

🏠 Regole della casa
Non è consentito fumare all'interno (si può fuori). Animali ammessi solo di piccola taglia. Feste non ammesse, silenzio dopo le 22:00. Per aggiungere un ospite non registrato al check-in, o per un letto aggiuntivo/una culla, scriveteci prima: è previsto un supplemento. Su richiesta possiamo organizzare anche una pulizia extra durante il soggiorno, a 20€.

❓ Domande frequenti
Aria condizionata: sì. Asciugacapelli: sì, in camera. Ferro da stiro: non disponibile. Culla per neonati: su richiesta, scriveteci prima del check-in.

Per emergenze o necessità sul posto: Lella, 339 430 4429 (responsabile in loco).
Per tutto il resto restiamo disponibili qui su WhatsApp.

Buon soggiorno! 🌷
Raffaele — B&B Il Tulipano
```

**Dettagli operativi (non nel messaggio, per riferimento)**: cassetta chiavi codice 1605, condivisa con Stanza Rosa (vedi sezione sotto — stesso appartamento). Camera matrimoniale con possibilità di lettino aggiunto apribile. Responsabile in loco: Lella, 339 430 4429 (ruolo/relazione con Raffaele non specificata nelle fonti — verificare). Cucina in comune per l'intero appartamento — condivisa non solo con Stanza Rosa ma anche con altre stanze dell'appartamento non di proprietà di Raffaele (dettaglio emerso l'07/09/2026, non approfondito oltre).

## Stanza Rosa — Via Clanio 60

Stanza più piccola: letto singolo con possibilità di aggiungere un secondo letto singolo. Senza CIN, per scelta esplicita di Raffaele (vedi [[salzillo-hospitality]]). **A differenza del Tulipano, qui non c'è self check-in** (nessuna cassetta chiavi dedicata) — l'ospite si coordina direttamente con Lella. Testo aggiornato il 07/09/2026 per togliere ogni riferimento incrociato al Tulipano (le due stanze devono restare indipendenti agli occhi degli ospiti) e riflettere l'assenza di self check-in.

✅ **WiFi confermato (07/09/2026)**: stessa rete del Tulipano, condivisa in tutto l'appartamento — **Lella** / **Lella1978@**.

```
Benvenuti alla Stanza Rosa! 🌸

Ecco tutte le istruzioni per il vostro soggiorno.

📍 Indirizzo
Via Clanio 60, Marcianise.

🚗 Parcheggio
Gratuito lungo la strada, non è disponibile un parcheggio interno.

🚪 Ingresso
Il check-in si organizza direttamente con Lella, la referente in loco: scrivetele su WhatsApp (339 430 4429) per accordarvi su orario e modalità d'arrivo, prima di presentarvi.

📶 WiFi
Rete: Lella — Password: Lella1978@

☕ Cucina
La cucina è in comune con gli altri ospiti dell'appartamento: macchinetta del caffè e frigorifero sono anch'essi condivisi. Nel frigo trovate però il vostro ripiano personale, con il nome della camera. Le cialde per il caffè e la colazione (prodotti confezionati) le trovate già in camera.

🕒 Check-in: dalle 15:00 (orario indicativo — in caso di imprevisti può anticipare o posticiparsi, scriveteci in anticipo se avete esigenze diverse)

📲 Vi registriamo in Questura (obbligatorio per legge, pochi secondi) prima che iniziate il soggiorno.

🕙 Check-out: entro le 10:00, secondo le modalità concordate con Lella al momento del check-in.

🏠 Regole della casa
Non è consentito fumare all'interno (si può fuori). Animali ammessi solo di piccola taglia. Feste non ammesse, silenzio dopo le 22:00. Per aggiungere un ospite non registrato al check-in, o per un letto aggiuntivo/una culla, scriveteci prima: è previsto un supplemento. Su richiesta possiamo organizzare anche una pulizia extra durante il soggiorno, a 20€.

❓ Domande frequenti
Aria condizionata: sì. Asciugacapelli: sì, in camera. Ferro da stiro: non disponibile. Culla per neonati: su richiesta, scriveteci prima del check-in.

Per tutto il resto restiamo disponibili qui su WhatsApp.

Buon soggiorno! 🌸
Raffaele — Salzillo Hospitality
```

## Richiesta recensione (post check-out)

Aggiunta il 07/09/2026. **Non è nella guida di check-in** (Raffaele: la guida arriva quando l'ospite ha già prenotato/è in arrivo, non è il momento di chiedere una recensione) — è un messaggio WhatsApp a sé, da mandare **dopo il check-out**, la sera stessa o il giorno dopo (non subito, l'ospite è ancora in viaggio; non troppo tardi, si perde il momento).

**Solo Google, non Booking/Airbnb**: Booking e Airbnb mandano già in automatico la loro richiesta di recensione post-soggiorno (chiedere anche lì è ridondante/insistente); le prenotazioni dirette in contanti su Via Campania inoltre non hanno un annuncio Booking/Airbnb su cui recensire, mentre Google funziona per chiunque e aiuta la visibilità su Maps.

Link recensione Google (Il Tulipano — unica scheda Google Maps, usata anche per Stanza Rosa): https://g.page/r/CVxuMMgN8XDNEAE/review

**Il Tulipano:**
```
Grazie per aver soggiornato al B&B Il Tulipano! 🌷

Speriamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.

Se vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:
⭐ https://g.page/r/CVxuMMgN8XDNEAE/review

Grazie di cuore, per noi è un piccolo gesto che conta davvero.

A presto! 🌷
Salzillo Hospitality — B&B Il Tulipano
```

**Stanza Rosa:**
```
Grazie per aver soggiornato alla Stanza Rosa! 🌸

Speriamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.

Se vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:
⭐ https://g.page/r/CVxuMMgN8XDNEAE/review

Grazie di cuore, per noi è un piccolo gesto che conta davvero.

A presto! 🌸
Salzillo Hospitality — Stanza Rosa
```

**Automatizzato (07/09/2026)**: non più solo testo manuale — `/api/cron/checkout-reminder` (Vercel Cron, ogni giorno alle 11:00 italiane) manda a Raffaele su Telegram, per ogni check-out del giorno con telefono registrato, un link `wa.me` già compilato con il messaggio giusto (Tulipano/Rosa/generico), pronto da toccare e inviare. Testato con un invio reale di prova su Telegram (rotta temporanea creata e rimossa subito dopo). Firma cambiata da "Raffaele" a "Salzillo Hospitality" su richiesta di Raffaele dopo aver visto il messaggio di prova — più professionale/aziendale.

**Nota aperta**: al momento esiste un'unica scheda Google Maps (quella del Tulipano) — la richiesta di recensione per Stanza Rosa punta comunque lì, non essendoci una scheda separata per quella stanza. Segnalato da Raffaele, accettato come limite noto per ora (nessuna scheda Google dedicata per Stanza Rosa da creare, a meno di sua diversa indicazione futura).
