/* eslint-disable */
/**
 * SCRIPT 2 — FORMULE FOGLI MESE
 *
 * Per ogni foglio mese aggiorna:
 *  - Col A  Check-in  → INDEX/FILTER (ci OR co in mese) + filtro STATO
 *  - Col B  Check-out → stessa logica
 *  - Col F  Ospite    → stessa logica
 *  - Col I  Stanza    → stessa logica
 *  - Col L  Canale    → stessa logica
 *  - Col O  LORDO     → stessa logica, ma valore vuoto se solo check-in nel mese
 *  - Col R  COMM      → fix: ritorna "" se LORDO è vuoto (era 0)
 *
 * Rimuove anche la formula LET errata lasciata in A13 dalla sessione precedente.
 */
const { google } = require('googleapis');

const SPREADSHEET_ID = '1c3EuxjGs_r8mZHXH7N5lDd0b1nSr_RA9Q5uIXyyxLzA';

const MONTH_NAMES = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO',
                     'LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];

// Righe dati nei fogli mese (1-based, confermato da update-sheets.js ROW_DATA_START=12 → riga 13)
const ROW_START = 13;
const ROW_END   = 147;          // ROW_DATA_END = 147 in update-sheets.js
const N_ROWS    = ROW_END - ROW_START + 1;  // 135 righe

// Colonne dei fogli mese (confermate dall'ispezione)
const C_CI    = 'A';   // Check-in   → DATABASE!B
const C_CO    = 'B';   // Check-out  → DATABASE!C
const C_OSP   = 'F';   // Ospite     → DATABASE!D
const C_STA   = 'I';   // Stanza     → DATABASE!E
const C_CAN   = 'L';   // Canale     → DATABASE!F
const C_LORDO = 'O';   // LORDO      → DATABASE!G (condizionale su co)
const C_COMM  = 'R';   // COMM (€)   → calcolata (fix O="")

// ─── Condizione di filtro comune (ci OR co nel mese E stato ok) ──────────────
// Usata come argomenti 2 e 3 di FILTER(array; cond1; cond2)
// Separatore ';' per locale italiano
const COND_CI_OR_CO =
  '((MONTH(DATABASE!$B$2:$B160)=$A$1)*(YEAR(DATABASE!$B$2:$B160)=CONFIG!$E$1)+' +
  '(MONTH(DATABASE!$C$2:$C160)=$A$1)*(YEAR(DATABASE!$C$2:$C160)=CONFIG!$E$1))>0';

const COND_STATO =
  '(DATABASE!$H$2:$H160="Attiva")+(DATABASE!$H$2:$H160="Cancellata con penale")>0';

// ─── Builder formule ─────────────────────────────────────────────────────────

// Anagrafiche: mostra sempre quando la prenotazione è nel mese
// dbCol = lettera colonna DATABASE (B, C, D, E, F)
// n = posizione risultato (1 per riga 13, 2 per riga 14, ...)
function fAna(dbCol, n) {
  return `=IFERROR(INDEX(FILTER(DATABASE!$${dbCol}$2:$${dbCol}160;${COND_CI_OR_CO};${COND_STATO});ROW(A${n}));"")`;
}

// LORDO: mostra solo se check-out è nel mese, altrimenti ""
function fLordo(n) {
  return (
    `=IFERROR(INDEX(FILTER(` +
      `IF((MONTH(DATABASE!$C$2:$C160)=$A$1)*(YEAR(DATABASE!$C$2:$C160)=CONFIG!$E$1);` +
        `DATABASE!$G$2:$G160;"");` +
      `${COND_CI_OR_CO};${COND_STATO}` +
    `);ROW(A${n}));"")`
  );
}

// COMM: aggiunge OR check su O="" per evitare che mostri 0 quando LORDO è vuoto
function fComm(row) {
  return `=IF(OR(${C_CAN}${row}="";${C_LORDO}${row}="");"";${C_LORDO}${row}*VLOOKUP(${C_CAN}${row};CONFIG!$A$7:$B$10;2;0))`;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('=== SCRIPT 2 — FORMULE FOGLI MESE ===\n');

  // Elenca tutti i fogli
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const monthSheets = meta.data.sheets
    .filter(s => MONTH_NAMES.some(m => s.properties.title.toUpperCase().includes(m)));

  if (monthSheets.length === 0) throw new Error('Nessun foglio mese trovato');
  console.log(`Fogli mese: ${monthSheets.map(s => s.properties.title).join(', ')}\n`);

  let totalUpdated = 0;

  for (const sheet of monthSheets) {
    const name = sheet.properties.title;
    process.stdout.write(`"${name}"... `);

    // Costruisce le 7 colonne di formule per tutte le 135 righe
    const colA = [], colB = [], colF = [], colI = [], colL = [], colO = [], colR = [];

    for (let i = 0; i < N_ROWS; i++) {
      const n   = i + 1;
      const row = ROW_START + i;
      colA.push([fAna('B', n)]);
      colB.push([fAna('C', n)]);
      colF.push([fAna('D', n)]);
      colI.push([fAna('E', n)]);
      colL.push([fAna('F', n)]);
      colO.push([fLordo(n)]);
      colR.push([fComm(row)]);
    }

    // Invia tutto in una sola chiamata batchUpdate
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: [
          { range: `'${name}'!${C_CI}${ROW_START}:${C_CI}${ROW_END}`,    values: colA },
          { range: `'${name}'!${C_CO}${ROW_START}:${C_CO}${ROW_END}`,    values: colB },
          { range: `'${name}'!${C_OSP}${ROW_START}:${C_OSP}${ROW_END}`,  values: colF },
          { range: `'${name}'!${C_STA}${ROW_START}:${C_STA}${ROW_END}`,  values: colI },
          { range: `'${name}'!${C_CAN}${ROW_START}:${C_CAN}${ROW_END}`,  values: colL },
          { range: `'${name}'!${C_LORDO}${ROW_START}:${C_LORDO}${ROW_END}`, values: colO },
          { range: `'${name}'!${C_COMM}${ROW_START}:${C_COMM}${ROW_END}`, values: colR },
        ],
      },
    });

    console.log('✓');
    totalUpdated++;
  }

  console.log(`\n✓ ${totalUpdated} fogli aggiornati (${N_ROWS * 7} formule ciascuno)`);
  console.log('\n=== SCRIPT 2 COMPLETATO ===');
}

main().catch(err => {
  console.error('\n❌ ERRORE:', err.message);
  if (err.errors) err.errors.forEach(e => console.error('  ', e.message));
  process.exit(1);
});
