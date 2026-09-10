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
  SPESE_SHEET_NAME,
  SPESE_HEADERS,
  SPESE_NUM_COLS,
  COL_DATA,
  COL_CATEGORIA,
  COL_DESCRIZIONE,
  COL_IMPORTO,
  COL_STRUTTURA,
  type Spesa,
} from '@/lib/spese';

// Registro spese extra (utenze, manutenzione, scorte...) non tracciate dal foglio prenotazioni.
// Scheda "SPESE" sullo stesso spreadsheet SalzilloFlow_2026 usato da /api/prenotazioni e
// /api/pulizie-stato. Vedi src/lib/spese.ts per lo schema colonne esatto.
//
// Auth/creazione scheda/lettura righe ora condivise in src/lib/sheets.ts (08/09/2026).

function ensureSpeseSheet(sheets: sheets_v4.Sheets): Promise<void> {
  return ensureSheetWithHeaders(sheets, SPESE_SHEET_NAME, SPESE_HEADERS, 'spese');
}

function rowToSpesa(row: number, values: unknown[]): Spesa {
  const v = (i: number) => String(values[i] ?? '');
  return {
    row,
    data: v(COL_DATA),
    categoria: v(COL_CATEGORIA),
    descrizione: v(COL_DESCRIZIONE),
    importo: parseFloat(v(COL_IMPORTO)) || 0,
    struttura: v(COL_STRUTTURA),
  };
}

// UNFORMATTED_VALUE: senza questo, la colonna Importo torna troncata se la cella ha un
// formato numerico a 0 decimali (visto in test: 12.34 scritto correttamente, ma letto come
// "12" con il default FORMATTED_VALUE). Il valore sottostante è sempre corretto.
function readAllRows(sheets: sheets_v4.Sheets) {
  return readAllRowsShared(sheets, SPESE_SHEET_NAME, SPESE_NUM_COLS, 1000, 'UNFORMATTED_VALUE');
}

// DD/MM/YYYY -> YYYY-MM per confronto/filtro mese.
function meseDi(dataItaliana: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dataItaliana.trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}`;
}

export async function GET(req: NextRequest) {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

    // Se la scheda non esiste ancora non c'è nulla da leggere: nessuna spesa è mai stata
    // registrata. Evita di richiedere lo scope di scrittura solo per una GET.
    if (!(await sheetExistsShared(sheets, SPESE_SHEET_NAME))) {
      return NextResponse.json({ ok: true, spese: [] });
    }

    const meseParam = req.nextUrl.searchParams.get('mese'); // formato YYYY-MM, opzionale

    const rows = await readAllRows(sheets);
    let spese = rows.map((r) => rowToSpesa(r.row, r.values));

    if (meseParam) spese = spese.filter((s) => meseDi(s.data) === meseParam);

    spese.sort((a, b) => {
      const toISO = (s: string) => s.split('/').reverse().join('-');
      return toISO(b.data).localeCompare(toISO(a.data)); // più recenti prima
    });

    return NextResponse.json({ ok: true, spese });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[spese] GET ERRORE:', msg);
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

  const { data, categoria, descrizione, importo, struttura } = body;

  if (typeof data !== 'string' || !/^\d{2}\/\d{2}\/\d{4}$/.test(data.trim())) {
    return NextResponse.json({ error: 'Data mancante o non in formato DD/MM/YYYY' }, { status: 400 });
  }
  if (typeof categoria !== 'string' || !categoria.trim()) {
    return NextResponse.json({ error: 'Categoria mancante' }, { status: 400 });
  }
  const importoNum = Number(importo);
  if (!Number.isFinite(importoNum) || importoNum <= 0) {
    return NextResponse.json({ error: 'Importo deve essere un numero positivo' }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    await ensureSpeseSheet(sheets);
    const targetRow = await findFirstFreeRow(sheets, SPESE_SHEET_NAME);

    const values: unknown[] = new Array(SPESE_NUM_COLS).fill('');
    values[COL_DATA] = data.trim();
    values[COL_CATEGORIA] = categoria.trim();
    values[COL_DESCRIZIONE] = typeof descrizione === 'string' ? descrizione.trim() : '';
    values[COL_IMPORTO] = Math.round(importoNum * 100) / 100;
    values[COL_STRUTTURA] = typeof struttura === 'string' ? struttura.trim() : '';

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SPESE'),
      range: `${SPESE_SHEET_NAME}!A${targetRow}:${colLetter(SPESE_NUM_COLS - 1)}${targetRow}`,
      // RAW, non USER_ENTERED: con USER_ENTERED Sheets converte "07/09/2026" in una data vera
      // (tipo cella Date), e la GET (che deve leggere UNFORMATTED_VALUE per non troncare
      // l'Importo, vedi readAllRows) la restituirebbe come numero seriale invece che come
      // stringa DD/MM/YYYY. RAW mantiene la data come testo semplice; l'Importo resta comunque
      // un number nativo in questo array, quindi non è influenzato dalla scelta RAW/USER_ENTERED.
      valueInputOption: 'RAW',
      requestBody: { values: [values] },
    });

    return NextResponse.json({ ok: true, spesa: rowToSpesa(targetRow, values) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[spese] POST ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
