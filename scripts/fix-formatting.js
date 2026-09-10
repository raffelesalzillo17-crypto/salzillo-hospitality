/* eslint-disable */
const { google } = require('googleapis');

const SPREADSHEET_ID = '11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys';

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

function rgb(hex) {
  return {
    red:   parseInt(hex.slice(1,3), 16) / 255,
    green: parseInt(hex.slice(3,5), 16) / 255,
    blue:  parseInt(hex.slice(5,7), 16) / 255,
  };
}

const DARK      = rgb('#2D2D2D');
const NEUTRAL   = rgb('#FAFAF8'); // sfondo riga 11 + testo invisibile A1

// Palette stanze — bg, testo #2D2D2D
const ROOMS = [
  { row: 2, bg: rgb('#E8E4DC'), label: 'Tulipano' },
  { row: 3, bg: rgb('#DDD9D0'), label: 'Rosa'     },
  { row: 4, bg: rgb('#D3CFC6'), label: 'Stanza 3' },
  { row: 5, bg: rgb('#C8C4BB'), label: 'Stanza 4' },
  { row: 6, bg: rgb('#BDBAB1'), label: 'Stanza 5' },
];

const COL_TOTAL = 35;

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

  const requests = [];

  for (const month of MONTHS) {
    const sid = month.id;

    // 1. RIGA 11 (index 10) — sfondo #FAFAF8, testo neutro, nessun colore residuo
    requests.push(repeatCell(sid, 10, 11, 0, COL_TOTAL,
      { backgroundColor: NEUTRAL, textFormat: { foregroundColor: DARK, bold: false, fontFamily: 'Arial' } },
      'userEnteredFormat(backgroundColor,textFormat)'
    ));

    // 2. COLORI STANZE — solo colonna A (index 0), righe 3-7 (index 2-6)
    for (const room of ROOMS) {
      requests.push(repeatCell(sid, room.row, room.row + 1, 0, 1,
        { backgroundColor: room.bg, textFormat: { foregroundColor: DARK, fontFamily: 'Arial' } },
        'userEnteredFormat(backgroundColor,textFormat)'
      ));
    }

    // 3. CELLA A1 (index 0,0) — testo #FAFAF8 (invisibile), formula intatta
    requests.push(repeatCell(sid, 0, 1, 0, 1,
      { textFormat: { foregroundColor: NEUTRAL } },
      'userEnteredFormat.textFormat.foregroundColor'
    ));
  }

  console.log(`Sending ${requests.length} requests (${MONTHS.length} sheets × 7 ops)...`);
  const result = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });
  console.log('Done. Replies:', result.data.replies.length);
  console.log('Formule e valori intatti — modificato solo userEnteredFormat.');
}

main().catch(e => {
  console.error('ERROR:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
