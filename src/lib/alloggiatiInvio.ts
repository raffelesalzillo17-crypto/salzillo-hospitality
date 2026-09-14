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
import { formatSchedinaRecord, validateSchedina, type DatiSchedina, type TipoAlloggiatoCodice } from './alloggiatiRecordFormat';

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
  }));
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

  const dati: DatiSchedina = {
    tipoAlloggiato: riga.tipoAlloggiatoCodice as TipoAlloggiatoCodice,
    dataArrivo: isoToItaliano(riga.checkin),
    numeroGiorniPermanenza: Math.min(30, giorniTra(riga.checkin, riga.checkout)),
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

    const messaggio = `Inviata con successo il ${new Date().toLocaleString('it-IT')}.`;
    await db.update(schedine).set({ stato: 'Inviata', inviata_il: new Date(), esito_invio: messaggio }).where(eq(schedine.id, schedinaId));
    return { ok: true, stato: 'Inviata', messaggio };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return segnaErrore(`Errore di comunicazione con Alloggiati Web: ${msg}`);
  }
}
