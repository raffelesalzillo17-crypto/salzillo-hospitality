// Orchestratore dell'invio REALE ad Alloggiati Web — UNICO punto del progetto autorizzato a
// chiamare sendSchedine() (vedi src/lib/alloggiatiWebService.ts). Applica, nell'ordine:
//
// 1. il filtro di sicurezza deciso da Raffaele (solo alloggi con trasmette_alloggiati=true,
//    oggi solo "Il Tulipano", e solo canale diverso da "No Tax" —
//    wiki/decisioni/solo-tulipano-va-inviato-ad-alloggiati-e-sinfonia.md), verificato QUI lato
//    server anche se la UI filtra già a monte: mai fidarsi solo del client per una
//    comunicazione a un ente pubblico;
// 2. generateToken() + authenticationTest();
// 3. testSchedine() — deve dare esito positivo per la singola schedina, altrimenti ci si ferma
//    e la schedina va in stato "Errore" SENZA mai chiamare Send();
// 4. solo a quel punto sendSchedine() — l'invio vero.
//
// Innescato sempre da un click esplicito di Raffaele su una singola schedina (mai automatico,
// mai in batch) — vedi la route src/app/api/nuovo/alloggiati/invia/route.ts.

import { eq, and, sql } from 'drizzle-orm';
import { getDb } from './db/index';
import { schedine, prenotazioni, alloggi } from './db/schema';
import {
  generateToken, authenticationTest, testSchedine, sendSchedine,
} from './alloggiatiWebService';
import { formatSchedinaRecord, validateSchedina, ordinaGruppoAlloggiati, type DatiSchedina, type TipoAlloggiatoCodice } from './alloggiatiRecordFormat';
import { inArray } from 'drizzle-orm';
import { alertInvioAmbiguo } from './cronAlert';

export type SchedinaDaInviare = {
  id: string;
  cognome: string;
  nome: string;
  alloggioNome: string;
  prenotazioneId: string;
  checkin: string;
  checkout: string;
  canale: string;
  ospiteNomeCompleto: string;
  tipoAlloggiato: string | null;
  esitoInvio: string | null;
};

/** Le schedine "Da inviare" che rientrano nel filtro di sicurezza — quelle che il pulsante
 *  "invia adesso" può davvero mostrare. Usata sia dalla UI (per elencarle) sia come base per
 *  la verifica server-side al momento dell'invio. */
export async function schedineDaInviareAlloggiati(): Promise<SchedinaDaInviare[]> {
  const db = getDb();
  const righe = await db
    .select({
      id: schedine.id,
      cognome: schedine.cognome,
      nome: schedine.nome,
      tipoAlloggiato: schedine.tipo_alloggiato,
      esitoInvio: schedine.esito_invio,
      prenotazioneId: prenotazioni.id,
      checkin: prenotazioni.checkin,
      checkout: prenotazioni.checkout,
      canale: prenotazioni.canale,
      alloggioNome: alloggi.nome,
    })
    .from(schedine)
    .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(and(
      eq(schedine.stato, 'Da inviare'),
      eq(alloggi.trasmette_alloggiati, true),
      sql`${prenotazioni.canale} <> 'No Tax'`,
      eq(prenotazioni.stato, 'Attiva'),
    ))
    .orderBy(prenotazioni.checkin);

  return righe.map((r) => ({
    id: r.id,
    cognome: r.cognome,
    nome: r.nome,
    alloggioNome: r.alloggioNome,
    prenotazioneId: r.prenotazioneId,
    checkin: r.checkin,
    checkout: r.checkout,
    canale: r.canale,
    ospiteNomeCompleto: `${r.nome} ${r.cognome}`.trim(),
    tipoAlloggiato: r.tipoAlloggiato,
    esitoInvio: r.esitoInvio,
  }));
}

export type SchedinaInScadenza = { ospiteNomeCompleto: string; alloggioNome: string; scadeIl: Date };

/** Le schedine "da inviare" (nel filtro di sicurezza) la cui scadenza delle 6h/24h è già
 *  passata o scatta entro `entroOre` — usata per l'avviso proattivo nei digest Telegram.
 *  Prima di questa funzione, l'unico modo di saperlo era guardare la dashboard a occhio. */
export async function schedineInScadenza(entroOre: number): Promise<SchedinaInScadenza[]> {
  const db = getDb();
  const soglia = new Date(Date.now() + entroOre * 3600e3);
  const righe = await db
    .select({ cognome: schedine.cognome, nome: schedine.nome, alloggioNome: alloggi.nome, scadeIl: schedine.scade_il })
    .from(schedine)
    .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(and(
      eq(schedine.stato, 'Da inviare'),
      eq(alloggi.trasmette_alloggiati, true),
      sql`${prenotazioni.canale} <> 'No Tax'`,
      eq(prenotazioni.stato, 'Attiva'),
      sql`${schedine.scade_il} IS NOT NULL AND ${schedine.scade_il} <= ${soglia}`,
    ))
    .orderBy(schedine.scade_il);
  return righe.filter((r): r is typeof r & { scadeIl: Date } => r.scadeIl != null)
    .map((r) => ({ ospiteNomeCompleto: `${r.nome} ${r.cognome}`.trim(), alloggioNome: r.alloggioNome, scadeIl: r.scadeIl }));
}

function isoToItaliano(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function giorniTra(checkinISO: string, checkoutISO: string): number {
  const ms = Date.parse(checkoutISO) - Date.parse(checkinISO);
  return Math.max(1, Math.round(ms / 86400000));
}

export type EsitoInvioSchedina = {
  ok: boolean;
  stato: 'Inviata' | 'Errore';
  messaggio: string;
};

/**
 * Invia DAVVERO una schedina ad Alloggiati Web. Aggiorna sempre lo stato della schedina nel
 * database (Inviata / Errore) prima di ritornare, qualunque sia l'esito.
 */
export async function inviaSchedinaReale(schedinaId: string): Promise<EsitoInvioSchedina> {
  const db = getDb();

  async function segnaErrore(messaggio: string): Promise<EsitoInvioSchedina> {
    await db.update(schedine).set({ stato: 'Errore', esito_invio: messaggio }).where(eq(schedine.id, schedinaId));
    return { ok: false, stato: 'Errore', messaggio };
  }

  const [riga] = await db
    .select({
      id: schedine.id,
      stato: schedine.stato,
      cognome: schedine.cognome,
      nome: schedine.nome,
      sesso: schedine.sesso,
      dataNascita: schedine.data_nascita,
      comuneNascitaCodice: schedine.comune_nascita_codice,
      provinciaNascita: schedine.provincia_nascita,
      statoNascitaCodice: schedine.stato_nascita_codice,
      cittadinanzaCodice: schedine.cittadinanza_codice,
      tipoDocumentoCodice: schedine.tipo_documento_codice,
      numeroDocumento: schedine.numero_documento,
      luogoRilascioDocumento: schedine.luogo_rilascio_documento,
      tipoAlloggiatoCodice: schedine.tipo_alloggiato_codice,
      checkin: prenotazioni.checkin,
      checkout: prenotazioni.checkout,
      canale: prenotazioni.canale,
      prenotazioneStato: prenotazioni.stato,
      trasmetteAlloggiati: alloggi.trasmette_alloggiati,
      alloggioNome: alloggi.nome,
    })
    .from(schedine)
    .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(eq(schedine.id, schedinaId));

  if (!riga) return segnaErrore('Schedina non trovata.');
  if (riga.stato !== 'Da inviare') {
    return { ok: false, stato: riga.stato === 'Inviata' ? 'Inviata' : 'Errore', messaggio: `Questa schedina è già in stato "${riga.stato}", non reinviata.` };
  }
  // Ricontrollo del filtro lato server — non fidarsi del solo filtro applicato in UI.
  if (!riga.trasmetteAlloggiati || riga.canale === 'No Tax' || riga.prenotazioneStato !== 'Attiva') {
    return segnaErrore(`Questa prenotazione (${riga.alloggioNome}, canale ${riga.canale}) non rientra nella regola di invio ad Alloggiati Web.`);
  }
  if (!riga.tipoAlloggiatoCodice || !['16', '17', '18', '19', '20'].includes(riga.tipoAlloggiatoCodice)) {
    return segnaErrore(`Tipo Alloggiato mancante o non valido ("${riga.tipoAlloggiatoCodice}") — completa i dati della schedina prima di inviare.`);
  }
  if (!riga.statoNascitaCodice || !riga.cittadinanzaCodice) {
    return segnaErrore('Stato di nascita o cittadinanza mancanti — completa i dati della schedina prima di inviare.');
  }
  // Scoperto in un audit del 23/09/2026: senza questo controllo un sesso mancante veniva
  // mandato comunque come "Maschio" di default, un dato inventato su un modulo verso la Polizia.
  if (riga.sesso !== 'M' && riga.sesso !== 'F') {
    return segnaErrore('Sesso mancante — completa i dati della schedina prima di inviare.');
  }
  // Scoperto nello stesso audit: il numero di notti veniva silenziosamente troncato a 30 PRIMA
  // del controllo di validità, quindi un soggiorno più lungo veniva inviato con un dato sbagliato
  // invece di essere bloccato. Il tracciato Alloggiati Web accetta al massimo 30 giorni per
  // invio: un soggiorno più lungo va diviso in più invii distinti, decisione che spetta a
  // Raffaele, non un troncamento silenzioso.
  const notti = giorniTra(riga.checkin, riga.checkout);
  if (notti > 30) {
    return segnaErrore(`Soggiorno di ${notti} notti — Alloggiati Web accetta al massimo 30 giorni per invio. Serve dividerlo in più invii separati (contatta l'assistenza del portale se non sai come).`);
  }

  // Blocco atomico: da qui in poi nessun'altra chiamata concorrente sulla STESSA schedina può
  // superare questo controllo — evita un doppio Send() reale alla Polizia se arrivano due
  // richieste quasi simultanee (doppio click, due tab aperte, un retry di rete lato client).
  // Scoperto in un audit del 23/09/2026: prima si leggeva lo stato, si facevano tutte le
  // chiamate esterne, e solo alla fine si scriveva "Inviata" — una finestra ampia in cui due
  // richieste potevano passare entrambe il controllo iniziale.
  const claim = await db.update(schedine)
    .set({ stato: 'In invio' })
    .where(and(eq(schedine.id, schedinaId), eq(schedine.stato, 'Da inviare')))
    .returning({ id: schedine.id });
  if (claim.length === 0) {
    // Non tocchiamo lo stato: appartiene alla richiesta concorrente che ha vinto la corsa.
    return { ok: false, stato: 'Errore', messaggio: 'Un altro invio per questa schedina è già in corso o è appena stato completato — ricarica la pagina prima di riprovare.' };
  }

  const dati: DatiSchedina = {
    tipoAlloggiato: riga.tipoAlloggiatoCodice as TipoAlloggiatoCodice,
    dataArrivo: isoToItaliano(riga.checkin),
    numeroGiorniPermanenza: notti,
    cognome: riga.cognome,
    nome: riga.nome,
    sesso: riga.sesso === 'F' ? '2' : '1',
    dataNascita: riga.dataNascita ? isoToItaliano(riga.dataNascita) : '',
    comuneNascita: riga.comuneNascitaCodice ?? undefined,
    provinciaNascita: riga.provinciaNascita ?? undefined,
    statoNascita: riga.statoNascitaCodice,
    cittadinanza: riga.cittadinanzaCodice,
    tipoDocumento: riga.tipoDocumentoCodice ?? undefined,
    numeroDocumento: riga.numeroDocumento ?? undefined,
    luogoRilascioDocumento: riga.luogoRilascioDocumento ?? undefined,
  };

  const erroriValidazione = validateSchedina(dati);
  if (erroriValidazione.length > 0) return segnaErrore(`Dati non validi: ${erroriValidazione.join('; ')}`);

  const record = formatSchedinaRecord(dati);

  try {
    const tokenRes = await generateToken();
    if (!tokenRes.esito.esito || !tokenRes.token) {
      return segnaErrore(`Autenticazione ad Alloggiati Web fallita: ${tokenRes.esito.erroreDes || 'nessun token ricevuto'}`);
    }
    const authTest = await authenticationTest(tokenRes.token);
    if (!authTest.esito) {
      return segnaErrore(`Verifica token fallita: ${authTest.erroreDes || 'esito negativo'}`);
    }

    const test = await testSchedine(tokenRes.token, [record]);
    const testOk = test.esito.esito && test.schedineValide === 1 && (test.dettaglio[0]?.esito ?? true);
    if (!testOk) {
      const dettaglioErr = test.dettaglio[0];
      const msg = dettaglioErr && !dettaglioErr.esito
        ? `${dettaglioErr.erroreDes || 'errore'} (${dettaglioErr.erroreCod || '?'})`
        : test.esito.erroreDes || 'validazione fallita';
      return segnaErrore(`Test di validazione non superato, invio NON effettuato: ${msg}`);
    }

    // Solo ora, con il Test superato, l'invio vero.
    const send = await sendSchedine(tokenRes.token, [record]);
    const sendOk = send.esito.esito && (send.dettaglio[0]?.esito ?? send.schedineValide === 1);
    if (!sendOk) {
      const dettaglioErr = send.dettaglio[0];
      const msg = dettaglioErr && !dettaglioErr.esito
        ? `${dettaglioErr.erroreDes || 'errore'} (${dettaglioErr.erroreCod || '?'})`
        : send.esito.erroreDes || 'invio non riuscito';
      return segnaErrore(`Invio ad Alloggiati Web fallito: ${msg}`);
    }

    // Da qui in poi l'invio ALLA POLIZIA è già avvenuto per davvero: un problema nostro nel
    // registrarlo (es. timeout del DB) non deve MAI tradursi in uno stato "Errore", che
    // spingerebbe a rimandarla credendo che non sia mai partita — vedi statoSchedina in schema.ts.
    const messaggio = `Inviata con successo il ${new Date().toLocaleString('it-IT')}.`;
    for (let tentativo = 1; tentativo <= 3; tentativo++) {
      try {
        await db.update(schedine).set({ stato: 'Inviata', inviata_il: new Date(), esito_invio: messaggio }).where(eq(schedine.id, schedinaId));
        return { ok: true, stato: 'Inviata', messaggio };
      } catch (errScrittura) {
        if (tentativo === 3) {
          const msgScrittura = errScrittura instanceof Error ? errScrittura.message : String(errScrittura);
          console.error(`[alloggiatiInvio] invio riuscito ma registrazione fallita dopo 3 tentativi (schedina ${schedinaId}):`, msgScrittura);
          await alertInvioAmbiguo({ ospite: `${riga.nome} ${riga.cognome}`, alloggio: riga.alloggioNome, erroreScrittura: msgScrittura }).catch(() => {});
          // La schedina resta "In invio" (il claim di poco fa) — mai "Errore": va risolta a
          // mano da "Alloggiati Web" → "Da verificare" con conferma esplicita del Titolare.
          return { ok: true, stato: 'Inviata', messaggio: `${messaggio} ATTENZIONE: non sono riuscito a registrarlo nel sistema (${msgScrittura}) — vai su "Alloggiati Web → Da verificare" e conferma a mano.` };
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * tentativo));
      }
    }
    // Irraggiungibile (il for sopra o ritorna o, al terzo tentativo, ritorna comunque), ma
    // TypeScript non lo sa senza un valore di chiusura esplicito.
    return { ok: true, stato: 'Inviata', messaggio };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return segnaErrore(`Errore di comunicazione con Alloggiati Web: ${msg}`);
  }
}

export type SchedinaDaVerificare = {
  id: string;
  cognome: string;
  nome: string;
  alloggioNome: string;
  prenotazioneId: string;
  checkin: string;
  stato: 'In invio' | 'Errore';
  esitoInvio: string | null;
};

/** Schedine rimaste in uno stato ambiguo dopo un tentativo di invio — "In invio" (esito reale
 *  sconosciuto, va verificato sul portale prima di decidere) oppure "Errore" (l'invio non è mai
 *  partito, sicuro da rifare). Non ricompaiono mai da sole tra le "Da inviare": serve sempre una
 *  decisione esplicita del Titolare, vedi risolviSchedinaAmbigua sotto. */
export async function schedineDaVerificare(): Promise<SchedinaDaVerificare[]> {
  const db = getDb();
  const righe = await db
    .select({
      id: schedine.id, cognome: schedine.cognome, nome: schedine.nome, stato: schedine.stato,
      esitoInvio: schedine.esito_invio, prenotazioneId: prenotazioni.id, checkin: prenotazioni.checkin,
      alloggioNome: alloggi.nome,
    })
    .from(schedine)
    .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(sql`${schedine.stato} IN ('In invio', 'Errore')`)
    .orderBy(prenotazioni.checkin);
  return righe.map((r) => ({ ...r, stato: r.stato as 'In invio' | 'Errore' }));
}

/** Risolve a mano una schedina rimasta ambigua — mai automatico: sempre una scelta esplicita del
 *  Titolare dopo aver controllato lo stato vero sul portale Alloggiati Web. */
export async function risolviSchedinaAmbigua(schedinaId: string, esito: 'Inviata' | 'Da inviare'): Promise<void> {
  const db = getDb();
  if (esito === 'Inviata') {
    await db.update(schedine).set({
      stato: 'Inviata', inviata_il: new Date(),
      esito_invio: 'Confermata come già inviata a mano dal Titolare, dopo verifica sul portale.',
    }).where(eq(schedine.id, schedinaId));
  } else {
    await db.update(schedine).set({ stato: 'Da inviare', inviata_il: null, esito_invio: null }).where(eq(schedine.id, schedinaId));
  }
}

export type EsitoInvioPrenotazione = { ok: boolean; messaggio: string; inviate: number };

/**
 * Invia DAVVERO ad Alloggiati Web tutte le schedine "Da inviare" di UNA prenotazione, in un
 * solo invio e nell'ordine richiesto (persona di riferimento, poi familiari/membri) — vedi
 * ordinaGruppoAlloggiati. Stesse garanzie di inviaSchedinaReale: filtro di sicurezza
 * ricontrollato qui, blocco atomico contro i doppi invii, Test() prima di Send(), e Send()
 * solo se il Test passa per TUTTE le schedine. Sempre innescato da un click esplicito del
 * Titolare su quella prenotazione, mai automatico e mai su più prenotazioni insieme.
 */
export async function inviaPrenotazioneReale(prenotazioneId: string): Promise<EsitoInvioPrenotazione> {
  const db = getDb();
  const no = (messaggio: string): EsitoInvioPrenotazione => ({ ok: false, messaggio, inviate: 0 });

  const tutte = await db
    .select({
      id: schedine.id, stato: schedine.stato, cognome: schedine.cognome, nome: schedine.nome, sesso: schedine.sesso,
      dataNascita: schedine.data_nascita, comuneNascitaCodice: schedine.comune_nascita_codice,
      provinciaNascita: schedine.provincia_nascita, statoNascitaCodice: schedine.stato_nascita_codice,
      cittadinanzaCodice: schedine.cittadinanza_codice, tipoDocumentoCodice: schedine.tipo_documento_codice,
      numeroDocumento: schedine.numero_documento, luogoRilascioDocumento: schedine.luogo_rilascio_documento,
      tipo: schedine.tipo_alloggiato_codice,
      checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale,
      prenotazioneStato: prenotazioni.stato, trasmetteAlloggiati: alloggi.trasmette_alloggiati, alloggioNome: alloggi.nome,
    })
    .from(schedine)
    .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(eq(schedine.prenotazione_id, prenotazioneId));

  if (tutte.length === 0) return no('Nessuna schedina su questa prenotazione.');
  const p = tutte[0];
  // Ricontrollo del filtro lato server — non fidarsi del solo filtro applicato in UI.
  if (!p.trasmetteAlloggiati || p.canale === 'No Tax' || p.prenotazioneStato !== 'Attiva') {
    return no(`Questa prenotazione (${p.alloggioNome}, canale ${p.canale}) non rientra nella regola di invio ad Alloggiati Web.`);
  }
  // Se una parte del gruppo è già partita (o è rimasta in uno stato incerto) non si può più
  // comporre un invio coerente da qui: meglio fermarsi che mandare un familiare senza il suo
  // capofamiglia, o mandare due volte la stessa persona.
  const nonDaInviare = tutte.filter((s) => s.stato !== 'Da inviare');
  if (nonDaInviare.length > 0) {
    return no(`Su questa prenotazione ci sono schedine già in stato "${nonDaInviare[0].stato}" (${nonDaInviare.map((s) => `${s.nome} ${s.cognome}`).join(', ')}): le altre non possono partire insieme a loro da qui. Controlla sul portale Alloggiati Web e, se serve, inserisci a mano lì quelle che mancano.`);
  }
  const gruppo = ordinaGruppoAlloggiati(tutte);
  if (!gruppo.ok) return no(gruppo.errore);

  const notti = giorniTra(p.checkin, p.checkout);
  if (notti > 30) return no(`Soggiorno di ${notti} notti — Alloggiati Web accetta al massimo 30 giorni per invio.`);

  const record: string[] = [];
  for (const s of gruppo.ordinati) {
    const chi = `${s.nome} ${s.cognome}`;
    if (!s.statoNascitaCodice || !s.cittadinanzaCodice) return no(`${chi}: stato di nascita o cittadinanza mancanti.`);
    // Mai un sesso inventato su un modulo verso la Polizia (audit del 23/09/2026).
    if (s.sesso !== 'M' && s.sesso !== 'F') return no(`${chi}: sesso mancante.`);
    const dati: DatiSchedina = {
      tipoAlloggiato: s.tipo as TipoAlloggiatoCodice,
      dataArrivo: isoToItaliano(p.checkin), numeroGiorniPermanenza: notti,
      cognome: s.cognome, nome: s.nome, sesso: s.sesso === 'F' ? '2' : '1',
      dataNascita: s.dataNascita ? isoToItaliano(s.dataNascita) : '',
      comuneNascita: s.comuneNascitaCodice ?? undefined, provinciaNascita: s.provinciaNascita ?? undefined,
      statoNascita: s.statoNascitaCodice, cittadinanza: s.cittadinanzaCodice,
      tipoDocumento: s.tipoDocumentoCodice ?? undefined, numeroDocumento: s.numeroDocumento ?? undefined,
      luogoRilascioDocumento: s.luogoRilascioDocumento ?? undefined,
    };
    const errori = validateSchedina(dati);
    if (errori.length > 0) return no(`${chi}: dati non validi — ${errori.join('; ')}`);
    record.push(formatSchedinaRecord(dati));
  }

  // Blocco atomico su tutto il gruppo: se anche una sola schedina è già stata presa da un'altra
  // richiesta (doppio click, due schede aperte) si rilasciano le altre e ci si ferma.
  const ids = gruppo.ordinati.map((s) => s.id);
  const presi = await db.update(schedine).set({ stato: 'In invio' })
    .where(and(inArray(schedine.id, ids), eq(schedine.stato, 'Da inviare')))
    .returning({ id: schedine.id });
  const rilascia = async (esito: string | null) => {
    await db.update(schedine).set({ stato: 'Da inviare', esito_invio: esito })
      .where(and(inArray(schedine.id, presi.map((x) => x.id)), eq(schedine.stato, 'In invio')));
  };
  if (presi.length !== ids.length) {
    await rilascia(null);
    return no('Un altro invio per questa prenotazione è già in corso o è appena stato completato — ricarica la pagina prima di riprovare.');
  }

  // Fino a Send() non è partito nulla: ogni problema riporta le schedine a "Da inviare", con il
  // motivo scritto accanto, così si corregge e si riprova senza passare da "Da verificare".
  let token: string;
  try {
    const tokenRes = await generateToken();
    if (!tokenRes.esito.esito || !tokenRes.token) {
      const m = `Autenticazione ad Alloggiati Web fallita: ${tokenRes.esito.erroreDes || 'nessun token ricevuto'}`;
      await rilascia(m); return no(m);
    }
    token = tokenRes.token;
    const authTest = await authenticationTest(token);
    if (!authTest.esito) {
      const m = `Verifica token fallita: ${authTest.erroreDes || 'esito negativo'}`;
      await rilascia(m); return no(m);
    }
    const test = await testSchedine(token, record);
    const testOk = test.esito.esito && test.schedineValide === record.length && test.dettaglio.every((d) => d.esito);
    if (!testOk) {
      const righe = test.dettaglio
        .map((d, i) => (d.esito ? null : `${gruppo.ordinati[i]?.nome ?? ''} ${gruppo.ordinati[i]?.cognome ?? ''}: ${d.erroreDes || 'errore'} (${d.erroreCod || '?'})`))
        .filter(Boolean);
      const m = `Controllo del portale non superato, invio NON effettuato: ${righe.length ? righe.join(' — ') : test.esito.erroreDes || 'validazione fallita'}`;
      await rilascia(m); return no(m);
    }
  } catch (err) {
    const m = `Errore di comunicazione con Alloggiati Web prima dell'invio (non è partito nulla): ${err instanceof Error ? err.message : String(err)}`;
    await rilascia(m); return no(m);
  }

  // Solo ora, con il Test superato per tutte, l'invio vero. Da qui in poi le schedine NON
  // tornano mai da sole a "Da inviare": se l'esito non è chiaro restano "In invio" e vanno
  // risolte a mano da "Da verificare", dopo aver guardato il portale.
  const nomi = gruppo.ordinati.map((s) => `${s.nome} ${s.cognome}`).join(', ');
  let send: Awaited<ReturnType<typeof sendSchedine>>;
  try {
    send = await sendSchedine(token, record);
  } catch (err) {
    const m = `Esito dell'invio sconosciuto (errore di comunicazione durante l'invio: ${err instanceof Error ? err.message : String(err)}). Controlla sul portale Alloggiati Web se le schedine risultano arrivate.`;
    await db.update(schedine).set({ esito_invio: m }).where(inArray(schedine.id, ids));
    await alertInvioAmbiguo({ ospite: nomi, alloggio: p.alloggioNome, erroreScrittura: m }).catch(() => {});
    return no(m);
  }
  const tutteAccettate = send.esito.esito && send.schedineValide === record.length && send.dettaglio.every((d) => d.esito);
  if (!tutteAccettate) {
    if (!send.esito.esito && (send.schedineValide ?? 0) === 0) {
      // Il portale ha rifiutato l'intero invio: non è entrato nulla.
      const m = `Invio ad Alloggiati Web rifiutato: ${send.esito.erroreDes || 'invio non riuscito'}`;
      await db.update(schedine).set({ stato: 'Errore', esito_invio: m }).where(inArray(schedine.id, ids));
      return no(m);
    }
    const m = `Invio accettato solo in parte dal portale (${send.schedineValide ?? '?'} su ${record.length}). Controlla sul portale Alloggiati Web quali ospiti risultano arrivati.`;
    await db.update(schedine).set({ esito_invio: m }).where(inArray(schedine.id, ids));
    await alertInvioAmbiguo({ ospite: nomi, alloggio: p.alloggioNome, erroreScrittura: m }).catch(() => {});
    return no(m);
  }

  const messaggio = `Inviate con successo il ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} (${record.length} ospit${record.length === 1 ? 'e' : 'i'}: ${nomi}).`;
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    try {
      await db.update(schedine).set({ stato: 'Inviata', inviata_il: new Date(), esito_invio: messaggio }).where(inArray(schedine.id, ids));
      return { ok: true, messaggio, inviate: record.length };
    } catch (errScrittura) {
      if (tentativo === 3) {
        const msgScrittura = errScrittura instanceof Error ? errScrittura.message : String(errScrittura);
        await alertInvioAmbiguo({ ospite: nomi, alloggio: p.alloggioNome, erroreScrittura: msgScrittura }).catch(() => {});
        return { ok: true, inviate: record.length, messaggio: `${messaggio} ATTENZIONE: non sono riuscito a registrarlo nel sistema (${msgScrittura}) — vai su "Alloggiati Web → Da verificare" e conferma a mano.` };
      }
      await new Promise((resolve) => setTimeout(resolve, 400 * tentativo));
    }
  }
  return { ok: true, messaggio, inviate: record.length };
}
