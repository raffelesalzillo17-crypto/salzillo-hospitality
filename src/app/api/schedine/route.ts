import { NextRequest, NextResponse } from 'next/server';
import { sheets_v4 } from 'googleapis';
import {
  getSheetsClient,
  colLetter,
  ensureSheetWithHeaders,
  sheetExists as sheetExistsShared,
  readAllRows as readAllRowsShared,
  findFirstFreeRow,
  fileIdForTab,
} from '@/lib/sheets';
import {
  SCHEDINE_SHEET_NAME,
  SCHEDINE_HEADERS,
  SCHEDINE_NUM_COLS,
  COL_DATA_ARRIVO,
  COL_NOTTI,
  COL_STANZA,
  COL_COGNOME,
  COL_NOME,
  COL_DATA_NASCITA,
  COL_LUOGO_NASCITA,
  COL_CITTADINANZA,
  COL_TIPO_DOCUMENTO,
  COL_NUMERO_DOCUMENTO,
  COL_RAPPORTO,
  COL_STATO,
  COL_PRENOTAZIONE_ROW,
  COL_SESSO,
  COL_TIPO_ALLOGGIATO_CODICE,
  COL_COMUNE_NASCITA_CODICE,
  COL_PROVINCIA_NASCITA,
  COL_STATO_NASCITA_CODICE,
  COL_CITTADINANZA_CODICE,
  COL_TIPO_DOCUMENTO_CODICE,
  COL_LUOGO_RILASCIO_DOCUMENTO,
  STATO_DA_INVIARE,
  STATO_INVIATO_MANUALMENTE,
  type Schedina,
} from '@/lib/schedine';

// Scheda "SCHEDINE" sullo stesso spreadsheet SalzilloFlow_2026 usato da /api/prenotazioni.
// Vedi src/lib/schedine.ts per lo schema colonne esatto.
//
// Auth/creazione scheda/lettura righe ora condivise in src/lib/sheets.ts (08/09/2026).
//
// IMPORTANTE: questa route prepara e salva SOLO i dati delle schedine. Non chiama e non deve
// mai chiamare API esterne reali di Alloggiati Web o Sinfonia Turismo Smart — decisione
// esplicita di Raffaele (notte del 07/09/2026). L'invio resta manuale finché non verrà
// attivato, un altro giorno, con un test supervisionato. (Nota 08/09/2026 sera: la connessione
// al web service ufficiale WS_ALLOGGIATI è stata verificata con successo — vedi
// wiki/entita/salzillo-hospitality.md — ma il formattatore del record e l'invio vero restano
// un pezzo separato, non toccato da questa route.)

function ensureSchedineSheet(sheets: sheets_v4.Sheets): Promise<void> {
  return ensureSheetWithHeaders(sheets, SCHEDINE_SHEET_NAME, SCHEDINE_HEADERS, 'schedine');
}

function rowToSchedina(row: number, values: unknown[]): Schedina {
  const v = (i: number) => String(values[i] ?? '');
  return {
    row,
    dataArrivo: v(COL_DATA_ARRIVO),
    notti: v(COL_NOTTI),
    stanza: v(COL_STANZA),
    cognome: v(COL_COGNOME),
    nome: v(COL_NOME),
    dataNascita: v(COL_DATA_NASCITA),
    luogoNascita: v(COL_LUOGO_NASCITA),
    cittadinanza: v(COL_CITTADINANZA),
    tipoDocumento: v(COL_TIPO_DOCUMENTO),
    numeroDocumento: v(COL_NUMERO_DOCUMENTO),
    rapporto: v(COL_RAPPORTO),
    stato: v(COL_STATO) || STATO_DA_INVIARE,
    prenotazioneRow: v(COL_PRENOTAZIONE_ROW),
    sesso: v(COL_SESSO),
    tipoAlloggiatoCodice: v(COL_TIPO_ALLOGGIATO_CODICE),
    comuneNascitaCodice: v(COL_COMUNE_NASCITA_CODICE),
    provinciaNascita: v(COL_PROVINCIA_NASCITA),
    statoNascitaCodice: v(COL_STATO_NASCITA_CODICE),
    cittadinanzaCodice: v(COL_CITTADINANZA_CODICE),
    tipoDocumentoCodice: v(COL_TIPO_DOCUMENTO_CODICE),
    luogoRilascioDocumento: v(COL_LUOGO_RILASCIO_DOCUMENTO),
  };
}

function readAllRows(sheets: sheets_v4.Sheets) {
  return readAllRowsShared(sheets, SCHEDINE_SHEET_NAME, SCHEDINE_NUM_COLS, 2000);
}

function toISO(dataItaliana: string): string {
  // DD/MM/YYYY -> YYYY-MM-DD, per confronti/ordinamento e filtro per range di date.
  const parts = dataItaliana.split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m}-${d}`;
}

export async function GET(req: NextRequest) {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

    // Se la scheda non esiste ancora non c'è nulla da leggere: nessuna schedina è mai stata
    // compilata. Evita di richiedere lo scope di scrittura solo per una GET.
    if (!(await sheetExistsShared(sheets, SCHEDINE_SHEET_NAME))) {
      return NextResponse.json({ ok: true, schedine: [] });
    }

    const prenotazioneRowParam = req.nextUrl.searchParams.get('prenotazioneRow');
    const daParam = req.nextUrl.searchParams.get('da'); // DD/MM/YYYY, incluso
    const aParam = req.nextUrl.searchParams.get('a');   // DD/MM/YYYY, incluso

    const rows = await readAllRows(sheets);
    let schedine = rows.map((r) => rowToSchedina(r.row, r.values));

    if (prenotazioneRowParam) {
      schedine = schedine.filter((s) => s.prenotazioneRow === prenotazioneRowParam);
    }
    if (daParam) {
      const daISO = toISO(daParam);
      schedine = schedine.filter((s) => toISO(s.dataArrivo) >= daISO);
    }
    if (aParam) {
      const aISO = toISO(aParam);
      schedine = schedine.filter((s) => toISO(s.dataArrivo) <= aISO);
    }

    return NextResponse.json({ ok: true, schedine });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedine] GET ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Trova il numero di riga della prenotazione in DATABASE corrispondente a stanza+checkin —
// usata dal check-in pubblico (l'ospite non conosce e non deve conoscere il "prenotazioneRow"
// interno). Nessuna ambiguità tollerata: se le righe candidate sono zero o più di una, chi
// chiama deve gestire l'errore invece di indovinare quale prenotazione aggiornare.
async function trovaPrenotazioneRow(
  sheets: sheets_v4.Sheets,
  stanza: string,
  dataArrivo: string
): Promise<{ row: number } | { errore: string }> {
  const rows = await readAllRowsShared(sheets, 'DATABASE', 11, 1000); // A..K, vedi commento sotto per gli indici
  // A=riga vuota/0, B=checkin(1), C=checkout(2), D=ospite(3), E=stanza(4), F=canale(5), G=lordo(6), H=stato(7)
  const candidate = rows.filter((r) => {
    const rStanza = String(r.values[4] ?? '').trim();
    const rCheckin = String(r.values[1] ?? '').trim();
    const rStato = String(r.values[7] ?? '').trim().toLowerCase();
    return rStanza === stanza && rCheckin === dataArrivo && !rStato.includes('cancellat');
  });
  if (candidate.length === 0) {
    return { errore: 'Non troviamo una prenotazione con questa data di arrivo. Controlla la data o contatta Salzillo Hospitality.' };
  }
  if (candidate.length > 1) {
    return { errore: 'Troviamo più prenotazioni con questi dati — contatta Salzillo Hospitality per completare la registrazione.' };
  }
  return { row: candidate[0].row };
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const {
    dataArrivo, notti, stanza, cognome, nome, dataNascita, luogoNascita,
    cittadinanza, tipoDocumento, numeroDocumento, rapporto,
    // Campi aggiunti il 09/09/2026 per allinearsi al tracciato reale — tutti opzionali per
    // restare compatibili con chi non li passa ancora (es. inserimento manuale storico).
    sesso, tipoAlloggiatoCodice, comuneNascitaCodice, provinciaNascita,
    statoNascitaCodice, cittadinanzaCodice, tipoDocumentoCodice, luogoRilascioDocumento,
  } = body;
  let { prenotazioneRow } = body;

  const campiTesto: Record<string, unknown> = {
    dataArrivo, stanza, cognome, nome, dataNascita, luogoNascita, cittadinanza, tipoDocumento, numeroDocumento, rapporto,
  };
  for (const [campo, valore] of Object.entries(campiTesto)) {
    if (typeof valore !== 'string' || !valore.trim()) {
      return NextResponse.json({ error: `Campo mancante: ${campo}` }, { status: 400 });
    }
  }
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(dataArrivo)) || !/^\d{2}\/\d{2}\/\d{4}$/.test(String(dataNascita))) {
    return NextResponse.json({ error: 'dataArrivo e dataNascita devono essere in formato DD/MM/YYYY' }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    // Se non arriva già un prenotazioneRow (caso interno da Motore Rafilu, che lo conosce
    // già), lo deduciamo da stanza+data — caso del check-in pubblico, dove l'ospite compila
    // solo i propri dati e la data del suo arrivo.
    if (!prenotazioneRow || !String(prenotazioneRow).trim()) {
      const trovata = await trovaPrenotazioneRow(sheets, String(stanza).trim(), String(dataArrivo).trim());
      if ('errore' in trovata) {
        return NextResponse.json({ error: trovata.errore }, { status: 404 });
      }
      prenotazioneRow = String(trovata.row);
    }

    await ensureSchedineSheet(sheets);
    const targetRow = await findFirstFreeRow(sheets, SCHEDINE_SHEET_NAME);

    const values = new Array(SCHEDINE_NUM_COLS).fill('');
    values[COL_DATA_ARRIVO] = String(dataArrivo).trim();
    values[COL_NOTTI] = typeof notti === 'string' || typeof notti === 'number' ? String(notti).trim() : '';
    values[COL_STANZA] = String(stanza).trim();
    values[COL_COGNOME] = String(cognome).trim();
    values[COL_NOME] = String(nome).trim();
    values[COL_DATA_NASCITA] = String(dataNascita).trim();
    values[COL_LUOGO_NASCITA] = String(luogoNascita).trim();
    values[COL_CITTADINANZA] = String(cittadinanza).trim();
    values[COL_TIPO_DOCUMENTO] = String(tipoDocumento).trim();
    values[COL_NUMERO_DOCUMENTO] = String(numeroDocumento).trim();
    values[COL_RAPPORTO] = String(rapporto).trim();
    values[COL_STATO] = STATO_DA_INVIARE;
    values[COL_PRENOTAZIONE_ROW] = typeof prenotazioneRow === 'string' || typeof prenotazioneRow === 'number' ? String(prenotazioneRow) : '';
    values[COL_SESSO] = typeof sesso === 'string' ? sesso.trim() : '';
    values[COL_TIPO_ALLOGGIATO_CODICE] = typeof tipoAlloggiatoCodice === 'string' ? tipoAlloggiatoCodice.trim() : '';
    values[COL_COMUNE_NASCITA_CODICE] = typeof comuneNascitaCodice === 'string' ? comuneNascitaCodice.trim() : '';
    values[COL_PROVINCIA_NASCITA] = typeof provinciaNascita === 'string' ? provinciaNascita.trim() : '';
    values[COL_STATO_NASCITA_CODICE] = typeof statoNascitaCodice === 'string' ? statoNascitaCodice.trim() : '';
    values[COL_CITTADINANZA_CODICE] = typeof cittadinanzaCodice === 'string' ? cittadinanzaCodice.trim() : '';
    values[COL_TIPO_DOCUMENTO_CODICE] = typeof tipoDocumentoCodice === 'string' ? tipoDocumentoCodice.trim() : '';
    values[COL_LUOGO_RILASCIO_DOCUMENTO] = typeof luogoRilascioDocumento === 'string' ? luogoRilascioDocumento.trim() : '';

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCHEDINE'),
      range: `${SCHEDINE_SHEET_NAME}!A${targetRow}:${colLetter(SCHEDINE_NUM_COLS - 1)}${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return NextResponse.json({ ok: true, schedina: rowToSchedina(targetRow, values) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedine] POST ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH: cambia SOLO lo Stato di una schedina esistente (es. "Inviato manualmente" dopo che
// Raffaele ha copiato i dati a mano nel vero Portale Alloggiati Web). Nessuna chiamata a
// sistemi esterni: aggiorna solo la cella Stato sul foglio Google.
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { row, stato } = body;
  const rowNum = Number(row);
  if (!Number.isInteger(rowNum) || rowNum < 2) {
    return NextResponse.json({ error: 'row non valido' }, { status: 400 });
  }
  if (stato !== STATO_DA_INVIARE && stato !== STATO_INVIATO_MANUALMENTE) {
    return NextResponse.json({ error: `stato deve essere "${STATO_DA_INVIARE}" o "${STATO_INVIATO_MANUALMENTE}"` }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCHEDINE'),
      range: `${SCHEDINE_SHEET_NAME}!${colLetter(COL_STATO)}${rowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[stato]] },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[schedine] PATCH ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
