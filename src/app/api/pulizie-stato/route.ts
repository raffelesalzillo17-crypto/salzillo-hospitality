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
  PULIZIE_SHEET_NAME,
  PULIZIE_HEADERS,
  PULIZIE_NUM_COLS,
  CHECKLIST_STANDARD,
  COL_DATA,
  COL_STANZA,
  COL_OSPITE,
  COL_VOCE_START,
  COL_OPERATORE,
  COL_COMPLETATO_IL,
  COL_NOTE,
  OPERATORE_DEFAULT,
  type PulizieStato,
} from '@/lib/pulizie';

// Stato persistito della checklist pulizie — scheda "PULIZIE" sullo stesso spreadsheet
// SalzilloFlow_2026 usato da /api/prenotazioni e /api/prenotazione. Vedi src/lib/pulizie.ts
// per lo schema colonne esatto.
//
// Auth/creazione scheda/lettura righe ora condivise in src/lib/sheets.ts (08/09/2026).

function ensurePulizieSheet(sheets: sheets_v4.Sheets): Promise<void> {
  return ensureSheetWithHeaders(sheets, PULIZIE_SHEET_NAME, PULIZIE_HEADERS, 'pulizie-stato');
}

function rowToStato(row: number, values: unknown[]): PulizieStato {
  const v = (i: number) => String(values[i] ?? '');
  const voci = CHECKLIST_STANDARD.map((_, i) => {
    const cell = v(COL_VOCE_START + i).trim().toUpperCase();
    return cell === 'SI' || cell === '1' || cell === 'X';
  });
  return {
    row,
    data: v(COL_DATA),
    stanza: v(COL_STANZA),
    ospite: v(COL_OSPITE),
    voci,
    operatore: v(COL_OPERATORE) || OPERATORE_DEFAULT,
    completatoIl: v(COL_COMPLETATO_IL),
    note: v(COL_NOTE),
  };
}

function readAllRows(sheets: sheets_v4.Sheets) {
  return readAllRowsShared(sheets, PULIZIE_SHEET_NAME, PULIZIE_NUM_COLS);
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

    // Se la scheda non esiste ancora non c'è nulla da leggere: nessuna pulizia è mai stata
    // registrata. Evita di richiedere lo scope di scrittura solo per una GET.
    if (!(await sheetExistsShared(sheets, PULIZIE_SHEET_NAME))) {
      return NextResponse.json({ ok: true, stati: [] });
    }

    const dataParam = req.nextUrl.searchParams.get('data');
    const stanzaParam = req.nextUrl.searchParams.get('stanza');

    const rows = await readAllRows(sheets);
    let stati = rows.map((r) => rowToStato(r.row, r.values));

    if (dataParam) stati = stati.filter((s) => s.data === dataParam);
    if (stanzaParam) stati = stati.filter((s) => norm(s.stanza) === norm(stanzaParam));

    return NextResponse.json({ ok: true, stati });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pulizie-stato] GET ERRORE:', msg);
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

  const { data, stanza, ospite, voceIndex, checked, operatore, note } = body;

  if (typeof data !== 'string' || !data.trim() || typeof stanza !== 'string' || !stanza.trim()) {
    return NextResponse.json({ error: 'Campi mancanti: data e stanza sono obbligatori' }, { status: 400 });
  }
  const idx = Number(voceIndex);
  if (!Number.isInteger(idx) || idx < 0 || idx >= CHECKLIST_STANDARD.length) {
    return NextResponse.json({ error: `voceIndex deve essere tra 0 e ${CHECKLIST_STANDARD.length - 1}` }, { status: 400 });
  }
  if (typeof checked !== 'boolean') {
    return NextResponse.json({ error: 'checked deve essere booleano' }, { status: 400 });
  }

  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

    await ensurePulizieSheet(sheets);

    const rows = await readAllRows(sheets);
    const match = rows.find(
      (r) => String(r.values[COL_DATA] ?? '') === data && norm(String(r.values[COL_STANZA] ?? '')) === norm(stanza)
    );

    let targetRow: number;
    let values: unknown[];

    if (match) {
      targetRow = match.row;
      values = [...match.values];
      while (values.length < PULIZIE_NUM_COLS) values.push('');
    } else {
      targetRow = await findFirstFreeRow(sheets, PULIZIE_SHEET_NAME);
      values = new Array(PULIZIE_NUM_COLS).fill('');
      values[COL_DATA] = data;
      values[COL_STANZA] = stanza;
      values[COL_OSPITE] = typeof ospite === 'string' ? ospite : '';
    }

    values[COL_VOCE_START + idx] = checked ? 'SI' : '';
    if (typeof operatore === 'string' && operatore.trim()) values[COL_OPERATORE] = operatore.trim();
    else if (!values[COL_OPERATORE]) values[COL_OPERATORE] = OPERATORE_DEFAULT;
    if (typeof note === 'string') values[COL_NOTE] = note;

    const tutteSpuntate = CHECKLIST_STANDARD.every((_, i) => String(values[COL_VOCE_START + i] ?? '').trim().toUpperCase() === 'SI');
    values[COL_COMPLETATO_IL] = tutteSpuntate ? new Date().toISOString() : '';

    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('PULIZIE'),
      range: `${PULIZIE_SHEET_NAME}!A${targetRow}:${colLetter(PULIZIE_NUM_COLS - 1)}${targetRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [values] },
    });

    return NextResponse.json({ ok: true, stato: rowToStato(targetRow, values) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[pulizie-stato] POST ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
