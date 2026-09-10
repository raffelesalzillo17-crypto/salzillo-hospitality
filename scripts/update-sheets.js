/* eslint-disable */
const { google } = require('googleapis');

const SPREADSHEET_ID = '1c3EuxjGs_r8mZHXH7N5lDd0b1nSr_RA9Q5uIXyyxLzA';

const MONTHS = [
  { title: 'GENNAIO',   id: 411184964   },
  { title: 'FEBBRAIO',  id: 1184561122  },
  { title: 'MARZO',     id: 920237019   },
  { title: 'APRILE',    id: 1687409442  },
  { title: 'MAGGIO',    id: 1102065008  },
  { title: 'GIUGNO',    id: 1644866381  },
  { title: 'LUGLIO',    id: 971531847   },
  { title: 'AGOSTO',    id: 1948811644  },
  { title: 'SETTEMBRE', id: 2063970018  },
  { title: 'OTTOBRE',   id: 761924351   },
  { title: 'NOVEMBRE',  id: 696585423   },
  { title: 'DICEMBRE',  id: 1137080579  },
];

const CONFIG_ID = 918006881;

function rgb(hex) {
  return {
    red:   parseInt(hex.slice(1,3), 16) / 255,
    green: parseInt(hex.slice(3,5), 16) / 255,
    blue:  parseInt(hex.slice(5,7), 16) / 255,
  };
}

// Palette Salzillo Hospitality brand
const DARK      = rgb('#2D2D2D'); // header bg / title bg / charcoal
const LIGHT     = rgb('#FAFAF8'); // header text / title text / sfondo chiaro
const TEAL      = rgb('#5E8A82'); // UTILE REALE MESE box bg
const UTILE_BG  = rgb('#E8F4F1'); // colonna UTILE REALE nella tabella
const BEIGE     = rgb('#E8E4DC'); // stanze col A bordi/sfondo
const ROW_ODD   = rgb('#FAFAF8'); // righe dispari
const ROW_EVEN  = rgb('#F5F2EE'); // righe pari / TOTALE COSTI FISSI bg

// Layout constants — monthly sheets (0-based row/col indices)
const COL_TOTAL         = 35; // total columns
const ROW_TITLE         = 0;  // riga 1 — titolo mese
const ROW_SUMMARY_START = 8;  // riga 9 — label TOTALE COSTI FISSI / UTILE REALE
const ROW_SUMMARY_END   = 10; // exclusive (righe 9-10 in 1-based)
const COL_TCF_START     = 0;  // col A — area TOTALE COSTI FISSI (A:D, 0-4)
const COL_TCF_END       = 5;  // exclusive
const COL_UTM_START     = 5;  // col F — area UTILE REALE MESE (F:H, 5-8)
const COL_UTM_END       = 8;  // exclusive
const ROW_HEADER        = 11; // riga 12 — header tabella (Check-in, Check-out…)
const ROW_DATA_START    = 12; // riga 13 — prima riga dati
const ROW_DATA_END      = 147;
const COL_UTILE_START   = 29; // col AD — colonna UTILE REALE nella tabella
const COL_UTILE_END     = 32; // exclusive (AD:AF)

function repeatCell(sheetId, r0, r1, c0, c1, fmt, fields) {
  return {
    repeatCell: {
      range: { sheetId, startRowIndex: r0, endRowIndex: r1, startColumnIndex: c0, endColumnIndex: c1 },
      cell: { userEnteredFormat: fmt },
      fields,
    }
  };
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  console.log('Fetching spreadsheet metadata...');
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const bandingId = {};
  for (const s of meta.data.sheets) {
    if (s.bandedRanges?.length) {
      bandingId[s.properties.sheetId] = s.bandedRanges[0].bandedRangeId;
    }
  }
  console.log('Banding IDs found:', JSON.stringify(bandingId));

  const requests = [];

  // ── MONTHLY SHEETS ──────────────────────────────────────────────────────────
  for (const month of MONTHS) {
    const sid = month.id;

    // 1. Font Arial — intero foglio (solo fontFamily, nessun altro campo toccato)
    requests.push(repeatCell(sid, 0, 160, 0, COL_TOTAL,
      { textFormat: { fontFamily: 'Arial' } },
      'userEnteredFormat.textFormat.fontFamily'
    ));

    // 2. Titolo mese (riga 1): #2D2D2D bg, #FAFAF8 testo, grassetto, 14px
    requests.push(repeatCell(sid, ROW_TITLE, ROW_TITLE + 1, 0, COL_TOTAL,
      { backgroundColor: DARK, textFormat: { foregroundColor: LIGHT, bold: true, fontFamily: 'Arial', fontSize: 14 } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 3. Reset area sommario (righe 9-10) — pulisce eventuale sfondo precedente
    requests.push(repeatCell(sid, ROW_SUMMARY_START, ROW_SUMMARY_END, 0, COL_TOTAL,
      { backgroundColor: ROW_ODD, textFormat: { foregroundColor: DARK, fontFamily: 'Arial' } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 4. TOTALE COSTI FISSI box (A:D, righe 9-10): #F7F6F3 bg, #2D2D2D testo
    requests.push(repeatCell(sid, ROW_SUMMARY_START, ROW_SUMMARY_END, COL_TCF_START, COL_TCF_END,
      { backgroundColor: ROW_EVEN, textFormat: { foregroundColor: DARK, fontFamily: 'Arial' } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 5. UTILE REALE MESE box (F:H, righe 9-10): #5E8A82 bg, #FAFAF8 testo, grassetto
    requests.push(repeatCell(sid, ROW_SUMMARY_START, ROW_SUMMARY_END, COL_UTM_START, COL_UTM_END,
      { backgroundColor: TEAL, textFormat: { foregroundColor: LIGHT, bold: true, fontFamily: 'Arial' } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 6. Header tabella (riga 12): #2D2D2D bg, #FAFAF8 testo, grassetto, 10px
    requests.push(repeatCell(sid, ROW_HEADER, ROW_HEADER + 1, 0, COL_TOTAL,
      { backgroundColor: DARK, textFormat: { foregroundColor: LIGHT, bold: true, fontFamily: 'Arial', fontSize: 10 } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 7. Righe alternate (banding): dispari #FAFAF8, pari #F7F6F3
    const bId = bandingId[sid];
    if (bId) {
      requests.push({
        updateBanding: {
          bandedRange: {
            bandedRangeId: bId,
            range: { sheetId: sid, startRowIndex: ROW_DATA_START, endRowIndex: ROW_DATA_END, startColumnIndex: 0, endColumnIndex: COL_TOTAL },
            rowProperties: { firstBandColor: ROW_ODD, secondBandColor: ROW_EVEN },
          },
          fields: 'rowProperties.firstBandColor,rowProperties.secondBandColor,range',
        }
      });
    } else {
      requests.push({
        addBanding: {
          bandedRange: {
            range: { sheetId: sid, startRowIndex: ROW_DATA_START, endRowIndex: ROW_DATA_END, startColumnIndex: 0, endColumnIndex: COL_TOTAL },
            rowProperties: { firstBandColor: ROW_ODD, secondBandColor: ROW_EVEN },
          }
        }
      });
    }

    // 8. Colonna UTILE REALE nella tabella (AD:AF, righe dati): #2D2D2D testo grassetto, #E8F4F1 bg
    requests.push(repeatCell(sid, ROW_DATA_START, ROW_DATA_END, COL_UTILE_START, COL_UTILE_END,
      { backgroundColor: UTILE_BG, textFormat: { foregroundColor: DARK, bold: true, fontFamily: 'Arial' } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 9. Stanze colonna A righe 3-7 (index 2-6): #E8E4DC bg, #2D2D2D testo
    requests.push(repeatCell(sid, 2, 7, 0, 1,
      { backgroundColor: BEIGE, textFormat: { foregroundColor: DARK, fontFamily: 'Arial' } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));
  }

  // ── CONFIG SHEET ─────────────────────────────────────────────────────────────
  // Font Arial — intero foglio
  requests.push(repeatCell(CONFIG_ID, 0, 50, 0, 26,
    { textFormat: { fontFamily: 'Arial' } },
    'userEnteredFormat.textFormat.fontFamily'
  ));

  // Header tabella canali (riga 6, index 5): #2D2D2D bg, #FAFAF8 testo, grassetto, 10px
  requests.push(repeatCell(CONFIG_ID, 5, 6, 0, 8,
    { backgroundColor: DARK, textFormat: { foregroundColor: LIGHT, bold: true, fontFamily: 'Arial', fontSize: 10 } },
    'userEnteredFormat(backgroundColor,textFormat)'
  ));

  // ── INVIO ────────────────────────────────────────────────────────────────────
  console.log(`Sending ${requests.length} formatting requests...`);
  const result = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  console.log('Done. Replies:', result.data.replies.length);
  console.log('\nFormule, valori e struttura intatti (modificato solo userEnteredFormat).');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
