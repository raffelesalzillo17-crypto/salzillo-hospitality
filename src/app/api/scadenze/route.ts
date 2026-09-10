import { NextRequest, NextResponse } from 'next/server';
import { sheets_v4 } from 'googleapis';
import {
  getSheetsClient,
  colLetter,
  ensureSheetWithHeaders,
  sheetExists as sheetExistsShared,
  getSheetIdByName,
  readAllRows as readAllRowsShared,
  findFirstFreeRow,
  fileIdForTab,
} from '@/lib/sheets';
import {
  SCADENZE_SHEET_NAME,
  SCADENZE_HEADERS,
  SCADENZE_NUM_COLS,
  RICORRENZE,
  COL_ID,
  COL_TITOLO,
  COL_DATA_SCADENZA,
  COL_RICORRENZA,
  COL_NOTE,
  COL_ULTIMO_COMPLETAMENTO,
  isRicorrenza,
  parseItDate,
  formatItDate,
  addIntervallo,
  type Scadenza,
} from '@/lib/scadenze';

// Calendario scadenze fiscali/ricorrenti (estintori, imposta di soggiorno, assicurazione, ecc.).
// Scheda "SCADENZE" sullo stesso spreadsheet SalzilloFlow_2026 usato da /api/prenotazioni,
// /api/pulizie-stato e /api/spese. Vedi src/lib/scadenze.ts per lo schema colonne esatto.
//
// Auth/creazione scheda/lettura righe ora condivise in src/lib/sheets.ts (08/09/2026 — prima
// ogni route duplicava le stesse funzioni, vedi commento in quel file per il perché).
//
// Nessun dato di esempio: la scheda parte vuota e Raffaele inserisce le scadenze reali dal
// componente. Vedi src/components/ScadenzeFiscali.tsx per lo stato vuoto onesto.

function ensureScadenzeSheet(sheets: sheets_v4.Sheets): Promise<void> {
  return ensureSheetWithHeaders(sheets, SCADENZE_SHEET_NAME, SCADENZE_HEADERS, 'scadenze');
}

function readAllRows(sheets: sheets_v4.Sheets) {
  return readAllRowsShared(sheets, SCADENZE_SHEET_NAME, SCADENZE_NUM_COLS);
}

function sheetExists(sheets: sheets_v4.Sheets) {
  return sheetExistsShared(sheets, SCADENZE_SHEET_NAME);
}

function rowToScadenza(row: number, values: unknown[]): Scadenza {
  const v = (i: number) => String(values[i] ?? '');
  const ricorrenzaRaw = v(COL_RICORRENZA);
  return {
    row,
    id: v(COL_ID),
    titolo: v(COL_TITOLO),
    dataScadenza: v(COL_DATA_SCADENZA),
    ricorrenza: isRicorrenza(ricorrenzaRaw) ? ricorrenzaRaw : 'Una tantum',
    note: v(COL_NOTE),
    ultimoCompletamento: v(COL_ULTIMO_COMPLETAMENTO),
  };
}

export async function GET() {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

    // Se la scheda non esiste ancora non c'è nulla da leggere: nessuna scadenza è mai stata
    // impostata. Evita di richiedere lo scope di scrittura solo per una GET.
    if (!(await sheetExists(sheets))) {
      return NextResponse.json({ ok: true, scadenze: [] });
    }

    const rows = await readAllRows(sheets);
    const scadenze = rows.map((r) => rowToScadenza(r.row, r.values));

    // Ordinate per data più vicina (scadute/imminenti prima). Date non parsabili in fondo.
    scadenze.sort((a, b) => {
      const da = parseItDate(a.dataScadenza);
      const db = parseItDate(b.dataScadenza);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da.getTime() - db.getTime();
    });

    return NextResponse.json({ ok: true, scadenze });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scadenze] GET ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { titolo, dataScadenza, ricorrenza, note } = body;

  if (typeof titolo !== 'string' || !titolo.trim()) {
    return NextResponse.json({ error: 'Titolo mancante' }, { status: 400 });
  }
  if (typeof dataScadenza !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataScadenza.trim()) || !parseItDate(dataScadenza)) {
    return NextResponse.json({ error: 'DataScadenza mancante o non in formato DD/MM/YYYY' }, { status: 400 });
  }
  const ricorrenzaVal = typeof ricorrenza === 'string' && ricorrenza.trim() ? ricorrenza.trim() : 'Una tantum';
  if (!isRicorrenza(ricorrenzaVal)) {
    return NextResponse.json({ error: `Ricorrenza deve essere una tra: ${RICORRENZE.join(', ')}` }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    await ensureScadenzeSheet(sheets);
    const targetRow = await findFirstFreeRow(sheets, SCADENZE_SHEET_NAME);

    const id = `${Date.now()}`;
    const values: unknown[] = new Array(SCADENZE_NUM_COLS).fill('');
    values[COL_ID] = id;
    values[COL_TITOLO] = titolo.trim();
    values[COL_DATA_SCADENZA] = dataScadenza.trim();
    values[COL_RICORRENZA] = ricorrenzaVal;
    values[COL_NOTE] = typeof note === 'string' ? note.trim() : '';
    values[COL_ULTIMO_COMPLETAMENTO] = '';

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCADENZE'),
      range: `${SCADENZE_SHEET_NAME}!A${targetRow}:${colLetter(SCADENZE_NUM_COLS - 1)}${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return NextResponse.json({ ok: true, scadenza: rowToScadenza(targetRow, values) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scadenze] POST ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Segna una scadenza come completata: valorizza UltimoCompletamento a oggi e, se la ricorrenza
// non è "Una tantum", ricalcola DataScadenza sommando l'intervallo alla data di completamento
// (oggi) — non alla vecchia scadenza, vedi nota in src/lib/scadenze.ts.
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { id } = body;
  if (typeof id !== 'string' || !id.trim()) {
    return NextResponse.json({ error: 'id mancante' }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    if (!(await sheetExists(sheets))) {
      return NextResponse.json({ error: 'Nessuna scadenza impostata ancora' }, { status: 404 });
    }

    const rows = await readAllRows(sheets);
    const match = rows.find((r) => String(r.values[COL_ID] ?? '') === id);
    if (!match) {
      return NextResponse.json({ error: `Nessuna scadenza trovata con id ${id}` }, { status: 404 });
    }

    const scadenza = rowToScadenza(match.row, match.values);
    const oggi = new Date();
    const oggiStr = formatItDate(oggi);

    const values = [...match.values];
    while (values.length < SCADENZE_NUM_COLS) values.push('');
    values[COL_ULTIMO_COMPLETAMENTO] = oggiStr;
    if (scadenza.ricorrenza !== 'Una tantum') {
      values[COL_DATA_SCADENZA] = formatItDate(addIntervallo(oggi, scadenza.ricorrenza));
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCADENZE'),
      range: `${SCADENZE_SHEET_NAME}!A${match.row}:${colLetter(SCADENZE_NUM_COLS - 1)}${match.row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return NextResponse.json({ ok: true, scadenza: rowToScadenza(match.row, values) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scadenze] PATCH ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  let id: string | null = req.nextUrl.searchParams.get('id');
  if (!id) {
    try {
      const body = await req.json();
      if (typeof body?.id === 'string') id = body.id;
    } catch {
      // nessun body: va bene, si usa solo il query param
    }
  }
  if (!id || !id.trim()) {
    return NextResponse.json({ error: 'id mancante (query param ?id= o body JSON { id })' }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    if (!(await sheetExists(sheets))) {
      return NextResponse.json({ error: 'Nessuna scadenza impostata ancora' }, { status: 404 });
    }

    const rows = await readAllRows(sheets);
    const match = rows.find((r) => String(r.values[COL_ID] ?? '') === id);
    if (!match) {
      return NextResponse.json({ error: `Nessuna scadenza trovata con id ${id}` }, { status: 404 });
    }

    const sheetId = await getSheetIdByName(sheets, SCADENZE_SHEET_NAME);
    if (sheetId == null) {
      return NextResponse.json({ error: 'Impossibile trovare la scheda "SCADENZE"' }, { status: 500 });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileIdForTab('SCADENZE'),
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: match.row - 1, // 0-based
                endIndex: match.row,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[scadenze] DELETE ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
