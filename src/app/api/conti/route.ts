import { NextRequest, NextResponse } from 'next/server';
import { sheets_v4 } from 'googleapis';
import {
  getSheetsClient,
  ensureSheetWithHeaders,
  sheetExists as sheetExistsShared,
  readAllRows as readAllRowsShared,
  findFirstFreeRow,
  fileIdForTab,
} from '@/lib/sheets';
import {
  CONTI_SHEET_NAME,
  CONTI_HEADERS,
  CONTI_NUM_COLS,
  COL_DATA,
  COL_BANCA,
  COL_SALDO,
  COL_NOTE,
  type MovimentoConto,
  saldiAttuali,
} from '@/lib/conti';

// Registro conti bancari/investimento — inserimento MANUALE per scelta esplicita (09/09/2026),
// vedi src/lib/conti.ts per il perché (nessuna password bancaria mai gestita da qui). Scheda
// "CONTI" sullo stesso spreadsheet SalzilloFlow_2026 di tutte le altre route.
//
// Ogni POST aggiunge una nuova riga (mai sovrascrive) — storico completo nel tempo. GET
// restituisce sia lo storico completo sia solo i saldi attuali (uno per banca).

function ensureContiSheet(sheets: sheets_v4.Sheets): Promise<void> {
  return ensureSheetWithHeaders(sheets, CONTI_SHEET_NAME, CONTI_HEADERS, 'conti');
}

function readAllRows(sheets: sheets_v4.Sheets) {
  return readAllRowsShared(sheets, CONTI_SHEET_NAME, CONTI_NUM_COLS, 1000, 'UNFORMATTED_VALUE');
}

function rowToMovimento(row: number, values: unknown[]): MovimentoConto {
  const v = (i: number) => String(values[i] ?? '');
  return {
    row,
    data: v(COL_DATA),
    banca: v(COL_BANCA),
    saldo: parseFloat(v(COL_SALDO)) || 0,
    note: v(COL_NOTE),
  };
}

export async function GET() {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

    if (!(await sheetExistsShared(sheets, CONTI_SHEET_NAME))) {
      return NextResponse.json({ ok: true, storico: [], attuali: [], totale: 0 });
    }

    const rows = await readAllRows(sheets);
    const storico = rows.map((r) => rowToMovimento(r.row, r.values));
    const attuali = saldiAttuali(storico).sort((a, b) => a.banca.localeCompare(b.banca));
    const totale = Math.round(attuali.reduce((sum, m) => sum + m.saldo, 0) * 100) / 100;

    // Storico ordinato più recente prima, utile per un futuro grafico nel tempo.
    storico.sort((a, b) => {
      const toISO = (d: string) => d.split('/').reverse().join('-');
      return toISO(b.data).localeCompare(toISO(a.data));
    });

    return NextResponse.json({ ok: true, storico, attuali, totale });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[conti] GET ERRORE:', msg);
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

  const { banca, saldo, note, data } = body;

  if (typeof banca !== 'string' || !banca.trim()) {
    return NextResponse.json({ error: 'Banca mancante' }, { status: 400 });
  }
  const saldoNum = Number(saldo);
  if (!Number.isFinite(saldoNum)) {
    return NextResponse.json({ error: 'Saldo deve essere un numero' }, { status: 400 });
  }
  let dataVal: string;
  if (typeof data === 'string' && data.trim()) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(data.trim())) {
      return NextResponse.json({ error: 'Data deve essere in formato DD/MM/YYYY' }, { status: 400 });
    }
    dataVal = data.trim();
  } else {
    const oggi = new Date();
    dataVal = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    await ensureContiSheet(sheets);
    const targetRow = await findFirstFreeRow(sheets, CONTI_SHEET_NAME);

    const values: unknown[] = new Array(CONTI_NUM_COLS).fill('');
    values[COL_DATA] = dataVal;
    values[COL_BANCA] = banca.trim();
    values[COL_SALDO] = Math.round(saldoNum * 100) / 100;
    values[COL_NOTE] = typeof note === 'string' ? note.trim() : '';

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('CONTI'),
      range: `${CONTI_SHEET_NAME}!A${targetRow}:${String.fromCharCode(65 + CONTI_NUM_COLS - 1)}${targetRow}`,
      // RAW, non USER_ENTERED: stesso motivo di src/app/api/spese/route.ts — con USER_ENTERED
      // Sheets convertirebbe la data in una cella Date vera, e la GET (che deve leggere
      // UNFORMATTED_VALUE per non troncare il Saldo) la restituirebbe come numero seriale.
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });

    return NextResponse.json({ ok: true, movimento: rowToMovimento(targetRow, values) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[conti] POST ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
