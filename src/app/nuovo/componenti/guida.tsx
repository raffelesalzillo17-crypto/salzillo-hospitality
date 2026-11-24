'use client';

// Guida del gestionale (riscritta il 23/11/2026): frasi brevi, un tema per voce, le stesse parole in tutto il programma.
// Parole fisse: "Titolare" (tutto), "Operatore" (prenotazioni, calendario, ospiti, pulizie), "Addetto pulizie" (solo pulizie);
// "Canale" = da dove arriva la prenotazione; "Regime fiscale" = come viene trattata dal punto di vista delle imposte.

type Voce = { titolo: string; chi?: string; righe: string[] };

const SEZIONI: Voce[] = [
  { titolo: '📊 Dashboard', righe: [
    'Il quadro del mese per tutti gli immobili. Cambi mese con le frecce e, se sei il Titolare, filtri per proprietario.',
    'Gli importi (incasso lordo, commissioni, netto, spese, tassa di soggiorno) sono gli stessi dei Rendiconti dello stesso mese. Occupazione e prezzo medio a notte hanno la spiegazione scritta sotto.',
    'Sotto trovi chi arriva e chi parte, poi "Cosa manca": pagamenti da incassare nei prossimi 7 giorni, pulizie di oggi e domani, scadenze dei prossimi 30 giorni (quelle già scadute sono segnate), schedine mancanti o in ritardo, sovrapposizioni di calendario e prenotazioni da verificare.',
  ] },
  { titolo: '📅 Calendario', righe: [
    'Una riga per ogni alloggio, una barra colorata per ogni prenotazione. Puoi vedere il mese o la settimana (parte dal lunedì); il pulsante "Oggi" ti riporta alla data di oggi.',
    'Passa il mouse sopra una barra (da telefono, toccala) per vedere ospite, notti, canale e stato del pagamento.',
    'Le prenotazioni senza imposte hanno il segno 🚫 e un bordo tratteggiato.',
    'Per bloccare delle notti trascina su una riga vuota (da telefono: tocca il primo e l\'ultimo giorno). Ti chiede sempre conferma.',
    'In alto compare un avviso se una prenotazione si sovrappone a un calendario di Airbnb o Booking.',
    'Le schede "Prezzi" (solo Titolare) ed "Eventi" servono come promemoria: prezzi consigliati per periodo e date con sagre o fiere, che si evidenziano nel calendario.',
  ] },
  { titolo: '📋 Prenotazioni', righe: [
    'L\'elenco di tutte le prenotazioni, con ricerca e filtri (periodo, stato, alloggio, canale, regime fiscale). I filtri restano nell\'indirizzo della pagina, quindi puoi condividerla.',
    'Da qui crei una prenotazione o un preventivo. Toccando una riga vedi i dettagli, modifichi e registri i pagamenti.',
    'I tasti "Excel" e "CSV" scaricano l\'elenco che stai vedendo, con i filtri attivi e il totale.',
    'Ogni prenotazione ha un indirizzo proprio: puoi aprirla direttamente da un link.',
  ] },
  { titolo: '🏷️ Canale e regime fiscale', righe: [
    'Il canale dice da dove arriva la prenotazione: Airbnb, Booking oppure Diretto (fuori dalle piattaforme).',
    'Il regime fiscale dice come viene trattata: Ordinario (con cedolare secca), Esente da tassa di soggiorno (con il motivo) oppure No Tax.',
    'Una prenotazione "Diretto" con regime "No Tax" è esente da ogni imposta: niente cedolare, tassa di soggiorno, Alloggiati Web né ricevuta. Restano solo le spese di pulizia e gli eventuali extra.',
    'Le prenotazioni No Tax hanno l\'etichetta 🚫 No Tax nell\'elenco e nel calendario, e le trovi con il filtro "Regime fiscale".',
  ] },
  { titolo: '📄 Preventivi', righe: [
    'Un preventivo passa da Bozza a Inviato e poi a Accettato.',
    '"Converti in prenotazione" crea la prenotazione con gli stessi dati e ti dice se qualcosa è diverso.',
    'Un preventivo accettato è bloccato: non si modifica né si elimina. Se i dati cambiano, crei una nuova versione (una copia in Bozza).',
    'Se dopo la conversione la prenotazione cambia importo, date o ospiti, sotto il preventivo compare l\'elenco delle differenze.',
    'Gli altri preventivi si eliminano con conferma e restano 30 giorni nel cestino.',
  ] },
  { titolo: '👥 Ospiti', righe: [
    'L\'anagrafica. Cerca per nome, telefono o email; filtra per valutazione, ultimo soggiorno e numero di soggiorni. "Storico" mostra tutti i soggiorni di una persona.',
    'Telefono, email e codice fiscale vengono controllati. Il telefono va in formato internazionale (se manca, si aggiunge +39).',
    'Il pulsante ↔ scambia nome e cognome quando sono invertiti.',
    'Solo il Titolare ha "Possibili duplicati": scegli la scheda principale e le prenotazioni passano tutte lì. Le schede di prova si nascondono senza eliminarle.',
  ] },
  { titolo: '🗂️ Documenti ospiti', chi: 'Titolare e operatore', righe: [
    'Una cartella per ospite con i file salvati su Google Drive: contratti, ricevute e altro.',
    'I documenti d\'identità li vede solo il Titolare.',
  ] },
  { titolo: '💬 Promemoria', chi: 'Titolare e operatore', righe: [
    'Prepara i messaggi per gli ospiti, con il testo già scritto e il link per WhatsApp o per l\'email. Non parte niente da solo: lo invii tu, poi tocchi "Inviato".',
    'Una regola dice quando preparare un messaggio (per esempio il giorno prima dell\'arrivo). Può avere una condizione: solo se mancano i documenti, solo se la caparra non è incassata, solo se resta un saldo. Le condizioni sui pagamenti non valgono per Airbnb e Booking.',
    '"Per prenotazione" mostra, per ogni arrivo, lo stato di ogni messaggio: Pronto, Inviato, In programma, Bloccato (con il motivo, per esempio manca il telefono) o Non necessario.',
    '"Aggiungi i modelli pronti" crea 5 regole già scritte, spente: le accendi tu una per una.',
  ] },
  { titolo: '🧹 Pulizie', righe: [
    'Una pulizia si può segnare "fatta" solo dal giorno del check-out. Per sicurezza serve una conferma in due passaggi e per 10 secondi puoi annullare.',
    'Per ogni pulizia puoi indicare l\'addetto, l\'orario, le note e spuntare la checklist dell\'alloggio (si modifica dalla scheda Immobili).',
    'Se nello stesso alloggio arriva un ospite lo stesso giorno, la pulizia è urgente.',
    'Quelle dopo il check-out si creano da sole. "Pulizia extra" serve per le richieste in più.',
    'Compaiono anche nel calendario come 🧹.',
  ] },
  { titolo: '🛂 Alloggiati Web', chi: 'solo Titolare', righe: [
    'Invia le schedine alla Polizia di Stato, una per volta. Compaiono solo quelle de Il Tulipano, con canale Airbnb, Booking o Diretto e regime diverso da No Tax.',
    'Prima di ogni invio vero il sistema fa un controllo dei dati. L\'invio si ferma se le schedine non sono quante gli ospiti della prenotazione: correggi il numero di ospiti o aggiungi la schedina mancante. Solo con "invia comunque" si può forzare, con un avviso, e resta nel Registro.',
  ] },
  { titolo: '📑 Adempimenti', chi: 'solo Titolare', righe: [
    'Gli arrivi del periodo con lo stato delle schedine: da preparare, pronta, inviata, con errore, non soggetta.',
    'Da qui scarichi il file nel formato ufficiale e lo carichi tu sul portale. Poi segni "inviata" a mano. C\'è anche lo stato mensile di Sinfonia. Niente parte da solo.',
    'Le schedine mancanti o in ritardo (oltre 24 ore dall\'arrivo) compaiono in Dashboard sotto "Cosa manca".',
  ] },
  { titolo: '💶 Rendiconti e resoconto annuale', righe: [
    'Il rendiconto dice quanto spetta a ogni proprietario nel mese, con confronto e previsione. C\'è il PDF pronto da mandare. "Tutti i proprietari" (solo Titolare) somma tutto.',
    'Sotto trovi il resoconto annuale: per ogni mese prenotazioni, incasso lordo, tassa di soggiorno, notti e occupazione; incassi per canale e per regime fiscale; tassa per alloggio; confronto con l\'anno prima. Si scarica in Excel (5 fogli) o CSV.',
    'Prende i dati con le stesse regole della Dashboard (prenotazioni attive, per mese di check-in), quindi i numeri coincidono.',
  ] },
  { titolo: '🧾 Spese', righe: [
    'I costi, con foto o PDF della ricevuta. Entrano nei Rendiconti e abbassano l\'utile.',
    'Il Titolare può importare un estratto conto in CSV (con anteprima e senza duplicati), impostare le spese ricorrenti, che si registrano da sole, ed esportare tutto per il commercialista in Excel o CSV, per anno e per proprietario.',
  ] },
  { titolo: '⏰ Scadenze', righe: [
    'Le scadenze fiscali e amministrative, una per ente. Quando ne segni una come fatta, si rinnova da sola se è ricorrente.',
    'Gli stati sono: aperta, fatta (con data ed eventuale ricevuta) e non più applicabile (con il motivo). Le archiviate stanno nell\'Archivio e non compaiono in Dashboard.',
    'Il Titolare ha "Doppioni" per unire le scadenze scritte due volte, con anteprima.',
  ] },
  { titolo: '🏠 Immobili', righe: [
    'Proprietari, immobili e alloggi. Da qui li aggiungi e li modifichi; solo il Titolare può eliminarli, e solo se non hanno ancora prenotazioni o altri dati collegati.',
    'In ogni alloggio, "calendari" ti dà il link da incollare su Airbnb e Booking (è segreto e lo puoi rigenerare), i link da importare, il pulsante "Sincronizza ora" e il registro delle sincronizzazioni.',
    'Le prenotazioni importate dai calendari sono segnaposto "da completare". Se una sparisce dal calendario del sito, viene segnata "da verificare": non si cancella mai da sola.',
  ] },
  { titolo: '🔗 Link utili', righe: [
    'Una rubrica di link comodi (sito vetrina, check-in, WhatsApp e quelli che aggiungi tu) da avere a portata di mano e condividere.',
  ] },
  { titolo: '🔒 Registro', chi: 'solo Titolare', righe: [
    'Il cestino: ospiti, preventivi, spese e scadenze eliminati si recuperano per 30 giorni.',
    'Il registro di chi ha fatto cosa e quando.',
    'Il controllo che le cartelle dei documenti su Drive non siano condivise pubblicamente.',
    'La proposta di cancellare le copie dei documenti d\'identità dopo l\'invio ad Alloggiati Web (come chiede il Garante della privacy). Compaiono solo le prenotazioni con tutte le schedine inviate e la ricevuta salvata: per salvarla usa "Ricevuta del giorno" in Alloggiati Web. Confermi tu, una prenotazione alla volta.',
  ] },
];

export function Guida() {
  return (
    <div className="grid">
      <div className="card">
        <h2>Guida</h2>
        <p className="sub" style={{ marginTop: -4 }}>
          Tocca una voce per aprirla. Qui trovi a cosa serve ogni sezione, chi può usarla e cosa fa il programma da solo e cosa no.
        </p>
        <h3 style={{ marginTop: 14 }}>Come sono collegati i dati</h3>
        <p className="sub">
          Proprietario → Immobile (un edificio) → Alloggio (la stanza o l&apos;appartamento) → Prenotazione. Alla prenotazione sono collegati l&apos;ospite, i pagamenti,
          la schedina per la Questura e i documenti. Spese, scadenze e rendiconti stanno a parte.
        </p>
        <p className="sub">
          Quando salvi una prenotazione il programma calcola da solo commissione, cedolare, pulizia, utile e netto per il proprietario.
        </p>
      </div>

      <div className="card">
        <h3>Le sezioni</h3>
        {SEZIONI.map((s) => (
          <details key={s.titolo} className="guidavoce" style={{ borderTop: '1px solid var(--line)', padding: '8px 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
              {s.titolo}{s.chi ? <small className="empty"> · {s.chi}</small> : null}
            </summary>
            <ul className="guidalist" style={{ marginTop: 6 }}>
              {s.righe.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          </details>
        ))}
      </div>

      <div className="card">
        <h3>Chi può fare cosa</h3>
        <ul className="guidalist">
          <li><b>Titolare</b>: tutto.</li>
          <li><b>Operatore</b>: prenotazioni, calendario, ospiti, pagamenti e pulizie. Non elimina niente, non cambia prezzi e impostazioni e vede i documenti solo come ••••1234.</li>
          <li><b>Addetto pulizie</b>: vede e conferma solo le pulizie.</li>
          <li>La password del WiFi e il numero completo di un documento si vedono solo dal Titolare, con il pulsante &ldquo;mostra&rdquo;. Ogni visualizzazione resta nel Registro.</li>
        </ul>
      </div>

      <div className="card">
        <h3>Dove stanno i dati</h3>
        <ul className="guidalist">
          <li>La fonte ufficiale è il <b>database di questo gestionale</b>. Tutto si legge e si scrive solo qui.</li>
          <li>I fogli Google (SH · Prenotazioni &amp; Ospiti, SH · Struttura &amp; Spese, SH · Sistema) sono solo una copia di sicurezza. Il gestionale scrive sul foglio, mai il contrario: non modificarli a mano, la modifica non tornerebbe indietro.</li>
          <li>I file (contratti, ricevute, documenti) stanno su Google Drive, nella cartella &ldquo;Archivio — Salzillo Hospitality&rdquo;, una cartella per ospite.</li>
          <li>Il vecchio sito è spento: l&apos;indirizzo principale porta qui e il vecchio modulo non scrive più niente.</li>
          <li>Esiste un link di sola visualizzazione, senza accesso, per chi deve solo vedere il calendario (per esempio la famiglia). Chiedilo a Raffaele.</li>
        </ul>
        <p className="empty" style={{ marginTop: 10 }}>In alto a destra c&apos;è l&apos;interruttore del tema: automatico, chiaro o scuro. Il gestionale si può installare come app dal telefono.</p>
      </div>
    </div>
  );
}
