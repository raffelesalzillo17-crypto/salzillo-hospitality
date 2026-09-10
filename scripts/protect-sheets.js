/* eslint-disable */
const { google } = require('googleapis');

const SPREADSHEET_ID = '11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys';
const SERVICE_ACCOUNT = 'salzillo-n8n@glowing-patrol-493409-f5.iam.gserviceaccount.com';
const PROTECTION_MSG  = 'Foglio protetto. Inserisci dati solo nel foglio DATABASE.';

// DATABASE is free — protect everything else
const SKIP = new Set(['DATABASE']);

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const toProtect = meta.data.sheets.filter(s => !SKIP.has(s.properties.title));

  console.log(`Fogli da proteggere (${toProtect.length}):`);
  toProtect.forEach(s => console.log(`  ${s.properties.title} (id=${s.properties.sheetId})`));
  console.log(`Fogli liberi: DATABASE`);
  console.log(`Editor service account: ${SERVICE_ACCOUNT}\n`);

  const requests = toProtect.map(s => ({
    addProtectedRange: {
      protectedRange: {
        range: { sheetId: s.properties.sheetId },
        description: PROTECTION_MSG,
        warningOnly: false,
        editors: {
          users: [SERVICE_ACCOUNT],
        },
      },
    },
  }));

  const result = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: { requests },
  });

  console.log(`Richieste inviate: ${requests.length}`);
  console.log(`Risposte ricevute: ${result.data.replies.length}`);

  // Verify by re-reading protections
  const verify = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  let ok = 0;
  for (const s of verify.data.sheets) {
    const prot = s.protectedRanges || [];
    const name = s.properties.title;
    if (name === 'DATABASE') {
      console.log(`  DATABASE       — 🔓 libero (${prot.length} protezioni)`);
    } else {
      const active = prot.length > 0;
      console.log(`  ${name.padEnd(12)} — ${active ? '🔒 PROTETTO' : '❌ NON protetto'}`);
      if (active) ok++;
    }
  }

  console.log(`\n✅ ${ok}/${toProtect.length} fogli protetti correttamente.`);
  if (ok === toProtect.length) {
    console.log('Protezione completata. Solo il service account può modificare questi fogli.');
  }
}

main().catch(e => {
  console.error('ERRORE:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
