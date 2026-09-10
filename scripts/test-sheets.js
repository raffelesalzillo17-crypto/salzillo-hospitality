/* eslint-disable */
const { google } = require('googleapis');

const SPREADSHEET_ID = '11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys';

// Commissioni attese (da CONFIG)
const COMM_RATE = { Airbnb: 0.1891, Booking: 0.2015, Diretto: 0, 'No Tax': 0 };
const CED_RATE  = 0.21; // CONFIG!B3
const COSTI     = 20;   // CONFIG!B2
const NO_TAX_CH = 'No Tax';

// Dati di test (FASE 1)
const TEST_ROWS = [
  { checkin: '01/01/2026', checkout: '04/01/2026', ospite: 'Mario Rossi',   stanza: 'Tulipano', canale: 'Airbnb',  lordo: 240 },
  { checkin: '05/01/2026', checkout: '07/01/2026', ospite: 'Anna Bianchi',  stanza: 'Rosa',     canale: 'Booking', lordo: 160 },
  { checkin: '10/01/2026', checkout: '12/01/2026', ospite: 'Luca Verde',    stanza: 'Tulipano', canale: 'Diretto', lordo: 180 },
  { checkin: '15/01/2026', checkout: '16/01/2026', ospite: 'Sara Neri',     stanza: 'Rosa',     canale: 'No Tax',  lordo: 80  },
  { checkin: '20/01/2026', checkout: '25/01/2026', ospite: 'Carlo Blu',     stanza: 'Stanza 3', canale: 'Airbnb',  lordo: 350 },
  { checkin: '26/01/2026', checkout: '28/01/2026', ospite: 'Giulia Viola',  stanza: 'Stanza 4', canale: 'Booking', lordo: 200 },
  { checkin: '28/01/2026', checkout: '30/01/2026', ospite: 'Paolo Giallo',  stanza: 'Stanza 5', canale: 'Diretto', lordo: 150 },
  { checkin: '30/01/2026', checkout: '31/01/2026', ospite: 'Fatima Hassan', stanza: 'Tulipano', canale: 'No Tax',  lordo: 100 },
];

function round2(n) { return Math.round(n * 100) / 100; }

// Calcolo atteso per ogni riga
function expected(row) {
  const lordo = row.lordo;
  const comm  = round2(lordo * (COMM_RATE[row.canale] ?? 0));
  const ced   = row.canale === NO_TAX_CH ? 0 : round2(lordo * CED_RATE);
  const netto = round2(lordo - comm - ced);
  const utile = round2(netto - COSTI);
  return { comm, ced, netto, costi: COSTI, utile };
}

function fmt(v) {
  if (v === null || v === undefined || v === '') return '(vuoto)';
  if (typeof v === 'number') return '€' + v.toFixed(2).replace('.', ',');
  return String(v);
}

function status(atteso, letto) {
  if (letto === null || letto === undefined || letto === '' ||
      String(letto).startsWith('#') || isNaN(Number(letto))) {
    return '❌ ERRORE (' + letto + ')';
  }
  const diff = Math.abs(Number(letto) - atteso);
  return diff < 0.015 ? '✅ OK' : '⚠️ DIFF (Δ' + diff.toFixed(3) + ')';
}

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: './google-credentials.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // ── FASE 1: Inserisci dati in DATABASE ──────────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' FASE 1 — Inserimento dati in DATABASE (righe 2-9)');
  console.log('═══════════════════════════════════════════════════════');

  const dbRows = TEST_ROWS.map(r => [r.checkin, r.checkout, r.ospite, r.stanza, r.canale, r.lordo]);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: 'DATABASE!B2:G9',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: dbRows },
  });
  console.log('✅ Dati inseriti in DATABASE!B2:G9');

  // Piccola pausa per la propagazione server-side
  await new Promise(r => setTimeout(r, 2000));

  // ── FASE 2: Leggi valori calcolati da GENNAIO ────────────────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(' FASE 2 — Lettura valori calcolati (GENNAIO righe 13-20)');
  console.log('═══════════════════════════════════════════════════════');

  // Colonne da leggere (0-based):
  //  O=14 LORDO, R=17 COMM, U=20 CED, X=23 NETTO, AA=26 COSTI, AD=29 UTILE
  const readRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'GENNAIO!A13:AJ20',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows = readRes.data.values || [];

  // Colonne rilevanti in slice dal range A-AJ (col 0 = A)
  const COL = { CHECKIN: 0, CHECKOUT: 1, OSPITE: 5, STANZA: 8, CANALE: 11,
                LORDO: 14, COMM: 17, CED: 20, NETTO: 23, COSTI: 26, UTILE: 29 };

  console.log('\nVERIFICA RIGA PER RIGA:');
  console.log('─'.repeat(100));

  const issues = [];

  TEST_ROWS.forEach((test, i) => {
    const row   = rows[i] || [];
    const exp   = expected(test);
    const ospite = row[COL.OSPITE] || '(mancante)';
    const canale = row[COL.CANALE] || test.canale;
    const lordo  = row[COL.LORDO];

    const checks = [
      { campo: 'COMM. €',        atteso: exp.comm,  letto: row[COL.COMM]  },
      { campo: 'CEDOLARE',        atteso: exp.ced,   letto: row[COL.CED]   },
      { campo: 'NETTO RICEVUTO',  atteso: exp.netto, letto: row[COL.NETTO] },
      { campo: 'COSTI FISSI',     atteso: exp.costi, letto: row[COL.COSTI] },
      { campo: 'UTILE REALE',     atteso: exp.utile, letto: row[COL.UTILE] },
    ];

    console.log(`\n▸ Riga ${i + 13} | ${test.ospite} | ${test.stanza} | ${test.canale} | LORDO €${test.lordo}`);
    console.log(`  Lordo letto dal foglio: ${lordo !== undefined ? '€' + lordo : '(mancante — filtro non attivo?)'}`);

    checks.forEach(c => {
      const st = status(c.atteso, c.letto);
      const attesoStr = fmt(c.atteso);
      const lettoStr  = (c.letto === undefined || c.letto === '') ? '(vuoto)' : String(c.letto);
      console.log(`  ${st.padEnd(22)} ${c.campo.padEnd(18)} atteso: ${attesoStr.padEnd(12)} letto: ${lettoStr}`);
      if (!st.startsWith('✅')) issues.push({ riga: i + 13, ospite: test.ospite, campo: c.campo, atteso: c.atteso, letto: c.letto, bug: st });
    });
  });

  // ── FASE 3: Totali riepilogo (righe 9-10 di GENNAIO) ────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log(' FASE 3 — Verifica TOTALE COSTI FISSI e UTILE REALE MESE');
  console.log('═══════════════════════════════════════════════════════');

  const summaryRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'GENNAIO!B9:H10',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const sumRows = summaryRes.data.values || [];
  // B9="TOTALE COSTI FISSI", F9="UTILE REALE"
  // B10=valore, F10=valore
  const totCF    = sumRows[1]?.[0]; // B10
  const utileMese = sumRows[1]?.[4]; // F10 (col F relative to B = index 4)

  // Calcolo atteso solo per righe che NON hanno errori di formula
  const okRows = TEST_ROWS.filter((r, i) => r.canale !== 'Diretto' && r.canale !== 'No Tax');
  // (Le righe Diretto e No Tax avranno errori di formula → utile mese parziale)
  const expCF    = TEST_ROWS.length * COSTI; // 8 × 20 = 160 (se tutte le righe sono OK)
  // Nota: se alcune righe sono in errore, il totale sarà diverso

  console.log(`\n  TOTALE COSTI FISSI  — atteso (tutte 8 righe): €${expCF.toFixed(2)}`);
  console.log(`                        letto: ${totCF !== undefined ? '€' + totCF : '(vuoto)'}`);
  console.log(`  UTILE REALE MESE    — letto: ${utileMese !== undefined ? '€' + utileMese : '(vuoto)'}`);
  console.log(`  (L\'utile mese dipende dalle righe senza errori di formula)`);

  // ── FASE 4: Verifica foglio RECAP ────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log(' FASE 4 — Verifica RECAP aggrega gennaio');
  console.log('═══════════════════════════════════════════════════════');

  const recapRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'RECAP!A1:H15',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const recapRows = recapRes.data.values || [];
  console.log('\n  Struttura RECAP (prime 15 righe):');
  recapRows.forEach((r, i) => {
    if (r.some(c => c !== '' && c !== undefined))
      console.log(`  row${i + 1}: ${JSON.stringify(r)}`);
  });

  // ── RIEPILOGO BUG ────────────────────────────────────────────────────────────
  console.log('\n\n═══════════════════════════════════════════════════════');
  console.log(' RIEPILOGO — Bug rilevati');
  console.log('═══════════════════════════════════════════════════════');

  if (issues.length === 0) {
    console.log('  ✅ Nessun problema rilevato!');
  } else {
    const bugs = new Set();
    issues.forEach(is => {
      console.log(`  ❌ Riga ${is.riga} (${is.ospite}) — ${is.campo}: atteso ${fmt(is.atteso)}, letto "${is.letto}"`);
    });
    console.log('\n  CAUSE RADICE IDENTIFICATE:');

    // Cerca pattern
    const dirIssues  = issues.filter(i => TEST_ROWS[i.riga - 13]?.canale === 'Diretto');
    const noTaxIssues = issues.filter(i => TEST_ROWS[i.riga - 13]?.canale === 'No Tax');
    if (dirIssues.length) {
      console.log('  🐛 BUG 1 — VLOOKUP canale "Diretto": CONFIG usa "Privato / Diretto" → lookup fallisce');
      console.log('     Fix: rinominare CONFIG!A9 in "Diretto" OPPURE VLOOKUP con canale esatto');
    }
    if (noTaxIssues.some(i => i.campo === 'COMM. €')) {
      console.log('  🐛 BUG 2 — VLOOKUP canale "No Tax": range CONFIG!$A$7:$B$9 esclude riga 10 (No Tax)');
      console.log('     Fix: estendere range a CONFIG!$A$7:$B$10');
    }
    if (noTaxIssues.some(i => i.campo === 'CEDOLARE')) {
      console.log('  🐛 BUG 3 — CEDOLARE formula applica 21% anche su "No Tax" (dovrebbe essere 0)');
      console.log('     Fix: =IF(L13="No Tax";0;O13*CONFIG!$B$3)');
    }
  }
  console.log('');
}

main().catch(e => {
  console.error('ERRORE:', e.message);
  if (e.errors) console.error(JSON.stringify(e.errors, null, 2));
  process.exit(1);
});
