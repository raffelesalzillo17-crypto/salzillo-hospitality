/* eslint-disable */
/**
 * SCRIPT 1 — DATABASE
 * Aggiunge colonne STATO (H) e PENALE € (I), dropdown e formattazione condizionale
 */
const { google } = require('googleapis');

const SPREADSHEET_ID = '1c3EuxjGs_r8mZHXH7N5lDd0b1nSr_RA9Q5uIXyyxLzA';

function hexRgb(hex) {
  return {
    red:   parseInt(hex.slice(1, 3), 16) / 255,
    green: parseInt(hex.slice(3, 5), 16) / 255,
    blue:  parseInt(hex.slice(5, 7), 16) / 255,
  };
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── 1. Leggi struttura spreadsheet ─────────────────────────────────────────
  console.log('Lettura struttura spreadsheet...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

  const dbSheet = meta.data.sheets.find(s => s.properties.title === 'DATABASE');
  if (!dbSheet) throw new Error('Foglio DATABASE non trovato nel MASTER');
  const dbSheetId = dbSheet.properties.sheetId;
  console.log(`✓ DATABASE trovato — sheetId: ${dbSheetId}`);

  // ── 2. Leggi header riga 1 per verifica struttura ──────────────────────────
  const headersResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'DATABASE!A1:Z1',
  });
  const headers = (headersResp.data.values || [[]])[0];
  console.log(`✓ Headers attuali: ${headers.join(' | ')}`);

  // Controlla se STATO è già presente
  if (headers.some(h => h.toString().toUpperCase() === 'STATO')) {
    console.log('⚠  Colonna STATO già presente — script interrotto (nessuna modifica)');
    return;
  }

  // Trova indice LORDO (atteso in G = indice 6)
  const lordoIdx = headers.findIndex(h => h.toString().toUpperCase().includes('LORDO'));
  if (lordoIdx === -1) throw new Error('Colonna LORDO non trovata nel DATABASE');
  console.log(`✓ LORDO in colonna ${String.fromCharCode(65 + lordoIdx)} (indice ${lordoIdx})`);

  // STATO va in H (indice 7), PENALE € in I (indice 8)
  // Se ci sono già colonne dopo LORDO potrebbe essere necessario inserire
  // Per sicurezza impostiamo sempre H e I come nuove colonne dopo LORDO
  const statoColLetter  = 'H';
  const penaleColLetter = 'I';

  // ── 3. Leggi tutte le righe per sapere fino a dove scrivere "Attiva" ────────
  const dataResp = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'DATABASE!A:A',
  });
  const lastRow = (dataResp.data.values || []).length;
  console.log(`✓ Righe totali (inclusa intestazione): ${lastRow}`);

  // ── 4. Scrivi header H1=STATO, I1=PENALE € ─────────────────────────────────
  console.log('\nAggiunta header STATO e PENALE €...');
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `DATABASE!${statoColLetter}1:${penaleColLetter}1`,
    valueInputOption: 'RAW',
    requestBody: { values: [['STATO', 'PENALE €']] },
  });
  console.log(`✓ H1 = "STATO", I1 = "PENALE €"`);

  // ── 5. Imposta "Attiva" per tutte le righe dati esistenti (H2:H{lastRow}) ───
  if (lastRow > 1) {
    const dataCount  = lastRow - 1;
    const attivaData = Array.from({ length: dataCount }, () => ['Attiva']);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `DATABASE!${statoColLetter}2:${statoColLetter}${lastRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: attivaData },
    });
    console.log(`✓ "Attiva" impostato su ${dataCount} righe (H2:H${lastRow})`);
  }

  // ── 6. batchUpdate: dropdown + formattazione condizionale ───────────────────
  console.log('\nAggiunta dropdown e formattazione condizionale...');

  const COL_H     = 7;    // 0-indexed
  const START_ROW = 1;    // riga 2 (0-indexed)
  const END_ROW   = 1001; // riga 1001

  const statoRange = {
    sheetId:          dbSheetId,
    startRowIndex:    START_ROW,
    endRowIndex:      END_ROW,
    startColumnIndex: COL_H,
    endColumnIndex:   COL_H + 1,
  };

  const WHITE = { red: 1, green: 1, blue: 1 };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        // ── Dropdown data validation ──────────────────────────────────────────
        {
          setDataValidation: {
            range: statoRange,
            rule: {
              condition: {
                type: 'ONE_OF_LIST',
                values: [
                  { userEnteredValue: 'Attiva' },
                  { userEnteredValue: 'Cancellata' },
                  { userEnteredValue: 'Cancellata con penale' },
                ],
              },
              showCustomUi: true,
              strict: true,
            },
          },
        },
        // ── CF: Attiva → verde #34A853 ────────────────────────────────────────
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [statoRange],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Attiva' }] },
                format: {
                  backgroundColor: hexRgb('#34A853'),
                  textFormat: { foregroundColor: WHITE },
                },
              },
            },
            index: 0,
          },
        },
        // ── CF: Cancellata → rosso #EA4335 ───────────────────────────────────
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [statoRange],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Cancellata' }] },
                format: {
                  backgroundColor: hexRgb('#EA4335'),
                  textFormat: { foregroundColor: WHITE },
                },
              },
            },
            index: 1,
          },
        },
        // ── CF: Cancellata con penale → arancio #FF6D00 ───────────────────────
        {
          addConditionalFormatRule: {
            rule: {
              ranges: [statoRange],
              booleanRule: {
                condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Cancellata con penale' }] },
                format: {
                  backgroundColor: hexRgb('#FF6D00'),
                  textFormat: { foregroundColor: WHITE },
                },
              },
            },
            index: 2,
          },
        },
      ],
    },
  });

  console.log('✓ Dropdown aggiunto su H2:H1001');
  console.log('✓ CF verde  → Attiva');
  console.log('✓ CF rosso  → Cancellata');
  console.log('✓ CF arancio → Cancellata con penale');
  console.log('\n=== SCRIPT 1 COMPLETATO ===');
}

main().catch(err => {
  console.error('\n❌ ERRORE:', err.message);
  if (err.errors) err.errors.forEach(e => console.error(' ', e.message));
  process.exit(1);
});
