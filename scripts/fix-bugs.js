/* eslint-disable */
const { google } = require('googleapis');

const SPREADSHEET_ID = '11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys';

const MONTHS = [
  'GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO',
  'LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'
];

const ROW_FIRST = 13;
const ROW_LAST  = 147;

// Month sheet column layout (confirmed by reading actual formulas):
//   L = CANALE  (filters DATABASE!F)
//   O = LORDO   (filters DATABASE!G)
//   R = COMM    (commission formula, currently with $A$7:$B$9)
//   U = CED     (cedolare formula)
const COL_COMM = 'R';
const COL_CED  = 'U';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ──────────────────────────────────────────────────────────────────────────
  // BUG 1 — CONFIG!A9: "Privato / Diretto" → "Diretto"
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n══ BUG 1 — CONFIG!A9 ══════════════════════════════════════════════');
  const cfgBefore = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'CONFIG!A9',
    valueRenderOption: 'FORMATTED_VALUE',
  });
  console.log('  Prima:', cfgBefore.data.values?.[0]?.[0]);

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: 'CONFIG!A9',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [['Diretto']] },
  });
  console.log('✅ BUG 1 RISOLTO: CONFIG!A9 → "Diretto"');

  // ──────────────────────────────────────────────────────────────────────────
  // BUG 2 — COMM formula: VLOOKUP range $A$7:$B$9 → $A$7:$B$10
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n══ BUG 2 — COMM VLOOKUP range ═════════════════════════════════════');

  let bug2Total = 0;
  for (const month of MONTHS) {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${month}!${COL_COMM}${ROW_FIRST}:${COL_COMM}${ROW_LAST}`,
      valueRenderOption: 'FORMULA',
    });
    const rows = res.data.values || [];
    let changed = 0;
    const newVals = rows.map(row => {
      const f = String(row[0] || '');
      if (f.includes('$A$7:$B$9')) {
        changed++;
        return [f.replace(/\$A\$7:\$B\$9/g, '$A$7:$B$10')];
      }
      return [f];
    });
    if (changed > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${month}!${COL_COMM}${ROW_FIRST}:${COL_COMM}${ROW_LAST}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newVals },
      });
      bug2Total += changed;
      console.log(`  ${month}: ${changed} formule COMM aggiornate ✅`);
    } else {
      console.log(`  ${month}: già corretta (o pattern non trovato)`);
    }
  }
  console.log(`✅ BUG 2 RISOLTO: ${bug2Total} celle COMM aggiornate ($A$7:$B$10)`);

  // ──────────────────────────────────────────────────────────────────────────
  // BUG 3 — CEDOLARE formula: aggiungi check No Tax
  //
  // Struttura confermata: CANALE=col L, LORDO=col O, rate=CONFIG!$B$3
  // Formula: =IF(OR(L{r}="",O{r}=""),"",IF(L{r}="No Tax",0,ROUND(O{r}*CONFIG!$B$3,2)))
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n══ BUG 3 — CEDOLARE formula ════════════════════════════════════════');

  for (const month of MONTHS) {
    const newVals = [];
    for (let r = ROW_FIRST; r <= ROW_LAST; r++) {
      newVals.push([
        `=IF(OR(L${r}="";O${r}="");"";IF(L${r}="No Tax";0;ROUND(O${r}*CONFIG!$B$3;2)))`
      ]);
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${month}!${COL_CED}${ROW_FIRST}:${COL_CED}${ROW_LAST}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newVals },
    });
    console.log(`  ${month}: ${newVals.length} formule CED scritte ✅`);
  }
  console.log('✅ BUG 3 RISOLTO: CEDOLARE ora restituisce 0 per "No Tax"');

  // ──────────────────────────────────────────────────────────────────────────
  // BUG 4 — RECAP UTILE NETTO: INDIRECT(...!AD100) → INDIRECT(...!F10)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n══ BUG 4 — RECAP UTILE NETTO ══════════════════════════════════════');

  const recapRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'RECAP!B2:B13',
    valueRenderOption: 'FORMULA',
  });
  const recapRows = recapRes.data.values || [];
  let bug4Count = 0;
  const newRecap = recapRows.map(row => {
    const f = String(row[0] || '');
    if (f.includes('!AD100')) {
      bug4Count++;
      return [f.replace(/!AD100/g, '!F10')];
    }
    return [f];
  });

  if (bug4Count > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'RECAP!B2:B13',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: newRecap },
    });
    console.log(`✅ BUG 4 RISOLTO: ${bug4Count} celle RECAP aggiornate (!AD100 → !F10)`);
  } else {
    console.log('  Nessuna cella con !AD100 trovata in RECAP!B2:B13');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Verifica post-fix
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n══ VERIFICA POST-FIX ═══════════════════════════════════════════════');

  const cfgAfter = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'CONFIG!A7:B10',
    valueRenderOption: 'FORMATTED_VALUE',
  });
  console.log('CONFIG!A7:B10:', JSON.stringify(cfgAfter.data.values));

  const commAfter = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'GENNAIO!R13',
    valueRenderOption: 'FORMULA',
  });
  console.log('COMM formula (GENNAIO!R13):', commAfter.data.values?.[0]?.[0]);

  const cedAfter = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'GENNAIO!U13',
    valueRenderOption: 'FORMULA',
  });
  console.log('CED  formula (GENNAIO!U13):', cedAfter.data.values?.[0]?.[0]);

  const recapAfter = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'RECAP!B2:B3',
    valueRenderOption: 'FORMULA',
  });
  console.log('RECAP B2:', recapAfter.data.values?.[0]?.[0]);
  console.log('RECAP B3:', recapAfter.data.values?.[1]?.[0]);

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(' Tutti e 4 i bug corretti. Esegui il test con:');
  console.log(' node scripts/test-sheets.js');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(e => {
  console.error('ERRORE:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
