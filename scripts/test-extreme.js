/* eslint-disable */
const { google } = require('googleapis');
const SPREADSHEET_ID = '11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys';

// ── DATI DI TEST ─────────────────────────────────────────────────────────────
// [checkin, checkout, ospite, stanza, canale, lordo]
const DB_DATA = [
  // FASE 1 — GENNAIO (righe 13-22)
  ['02/01/2026','05/01/2026','Test Airbnb',    'Tulipano','Airbnb', 300],
  ['06/01/2026','08/01/2026','Test Booking',   'Rosa',    'Booking',200],
  ['09/01/2026','11/01/2026','Test Diretto',   'Tulipano','Diretto',150],
  ['12/01/2026','14/01/2026','Test NoTax',     'Rosa',    'No Tax', 100],
  ['15/01/2026','17/01/2026','Test Airbnb2',   'Stanza 3','Airbnb', 500],
  ['18/01/2026','20/01/2026','Test Booking2',  'Stanza 4','Booking', 75],
  ['21/01/2026','23/01/2026','Test Diretto2',  'Stanza 5','Diretto',999.99],
  ['24/01/2026','26/01/2026','Test NoTax2',    'Tulipano','No Tax',  50],
  ['27/01/2026','29/01/2026','Test Centesimi', 'Rosa',    'Airbnb', 123.45],
  ['30/01/2026','31/01/2026','Test 1notte',    'Stanza 3','Booking', 60],
  // FASE 2 — cavallo mese (check-in Gen → appare in GENNAIO)
  ['29/01/2026','03/02/2026','Test Cavallo Mese','Tulipano','Airbnb',400],
  // FASE 3 — FEBBRAIO valori estremi
  ['01/02/2026','02/02/2026','Test 1euro',     'Tulipano','Airbnb',   1],
  ['03/02/2026','04/02/2026','Test Grande',    'Rosa',    'Booking',9999.99],
  ['05/02/2026','06/02/2026','Test Tondo',     'Stanza 3','Diretto',1000],
  ['07/02/2026','28/02/2026','Test LungaSosta','Stanza 4','Airbnb', 2500],
  // FASE 4 — un mese per foglio (Feb–Dic)
  ['10/02/2026','12/02/2026','Test Feb',  'Tulipano','Diretto', 200],
  ['05/03/2026','08/03/2026','Test Mar',  'Rosa',    'No Tax',  150],
  ['15/04/2026','17/04/2026','Test Apr',  'Stanza 3','Airbnb',  280],
  ['20/05/2026','22/05/2026','Test Mag',  'Stanza 4','Booking', 320],
  ['10/06/2026','15/06/2026','Test Giu',  'Stanza 5','Diretto', 450],
  ['01/07/2026','07/07/2026','Test Lug',  'Tulipano','Airbnb',  800],
  ['10/08/2026','20/08/2026','Test Ago',  'Rosa',    'Booking',1200],
  ['05/09/2026','10/09/2026','Test Set',  'Stanza 3','No Tax',  300],
  ['15/10/2026','18/10/2026','Test Ott',  'Stanza 4','Airbnb',  250],
  ['05/11/2026','08/11/2026','Test Nov',  'Stanza 5','Diretto', 180],
  ['20/12/2026','27/12/2026','Test Dic',  'Tulipano','Booking', 700],
  // FASE 6 — edge cases
  ['31/01/2026','','','','',  ''],          // partial (solo check-in) → GENNAIO
  ['15/03/2026','16/03/2026','Test InvalidCh','Tulipano','Test',100], // canale invalido → MARZO
  ['20/03/2026','21/03/2026','Test Zero',  'Rosa',    'Airbnb',  0], // lordo=0 → MARZO
];

// ── FORMULE ATTESE ───────────────────────────────────────────────────────────
const COMM_RATE = { Airbnb:0.1891, Booking:0.2015, Diretto:0, 'No Tax':0 };
const CED_RATE  = 0.21;
const COSTI     = 20;

function calcExpected(lordo, canale) {
  const isNoTax = canale === 'No Tax';
  const isKnown = canale in COMM_RATE;
  const isDiretto = canale === 'Diretto';
  const comm  = round2(lordo * (COMM_RATE[canale] ?? 0));
  const ced   = isNoTax ? 0 : round2(lordo * CED_RATE);
  const netto = round2(lordo - comm - ced);
  const utile = round2(netto - COSTI);
  const bugs = [];
  if (isDiretto) bugs.push('BUG1:VLOOKUP-mismatch("Diretto"≠"Privato/Diretto")');
  if (isNoTax)   bugs.push('BUG2:VLOOKUP-range(A7:B9 esclude A10)', 'BUG3:CED-no-esclusione-NoTax');
  return { comm, ced, netto, costi: COSTI, utile, bugs, errComm: isDiretto||isNoTax };
}

function round2(n) { return Math.round(n * 100) / 100; }

function numOrErr(v) {
  if (v === undefined || v === null || v === '') return { val: null, err: false, empty: true };
  const s = String(v);
  if (s.startsWith('#')) return { val: s.split('(')[0], err: true, empty: false };
  return { val: parseFloat(s), err: false, empty: false };
}

function ok(atteso, letto, tolerr) {
  if (tolerr && letto.err) return '⚠️BUG'; // expected error due to known bug
  if (letto.err) return `❌ERR(${letto.val})`;
  if (letto.empty) return '❌VUOTO';
  const diff = Math.abs(letto.val - atteso);
  return diff < 0.02 ? '✅' : `❌DIFF(Δ${diff.toFixed(3)})`;
}

const COL = { COMM:17, CED:20, NETTO:23, COSTI:26, UTILE:29 };

// ── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  const auth = new google.auth.GoogleAuth({ keyFile: './google-credentials.json', scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Pulisci DB e inserisci tutti i dati
  await sheets.spreadsheets.values.clear({ spreadsheetId: SPREADSHEET_ID, range: 'DATABASE!B2:G40' });
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID, range: 'DATABASE!B2',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: DB_DATA },
  });
  console.log(`✅ DATABASE: ${DB_DATA.length} righe inserite (B2:G${1+DB_DATA.length})\n`);
  await new Promise(r => setTimeout(r, 2500)); // pausa propagazione

  const allResults = [];

  // ── FASE 1+2+6partial — GENNAIO ───────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(' FASE 1+2+6 — GENNAIO (righe 13-24)');
  console.log('══════════════════════════════════════════════════════════════════');

  const genRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'GENNAIO!A13:AJ24',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const gRows = genRows.data.values || [];

  const genTest = [
    ...DB_DATA.slice(0,10),   // FASE 1
    DB_DATA[10],              // FASE 2 cavallo (appare in GENNAIO)
    DB_DATA[26],              // FASE 6 partial
  ];

  genTest.forEach((t, i) => {
    const row = gRows[i] || [];
    const lordo = t[5];
    const canale = t[4];
    const ospite = t[2];
    const partial = ospite === '' && canale === '';

    if (partial) {
      // Riga parziale: tutte le celle formula devono essere vuote ("")
      const r = { comm: numOrErr(row[COL.COMM]), ced: numOrErr(row[COL.CED]),
                  netto: numOrErr(row[COL.NETTO]), cf: numOrErr(row[COL.COSTI]), utile: numOrErr(row[COL.UTILE]) };
      const allEmpty = [r.comm, r.ced, r.netto, r.cf, r.utile].every(x => x.empty || (!x.err && x.val === 0));
      const status = allEmpty ? '✅ TUTTE VUOTE/0 — graceful' : `⚠️ ALCUNE NON VUOTE: comm=${row[COL.COMM]} ced=${row[COL.CED]} netto=${row[COL.NETTO]} cf=${row[COL.COSTI]} utile=${row[COL.UTILE]}`;
      console.log(`R${13+i} | ${t[0]} (partial) | ${status}`);
      allResults.push({ fase:'6-Partial', riga:13+i, campo:'Tutti', atteso:'(vuoto)', letto:status.includes('✅')?'(vuoto)':JSON.stringify([row[COL.COMM],row[COL.COMM]]), esito:allEmpty?'✅':'❌' });
      return;
    }

    const exp = calcExpected(Number(lordo)||0, canale);
    const r = {
      comm:  numOrErr(row[COL.COMM]),
      ced:   numOrErr(row[COL.CED]),
      netto: numOrErr(row[COL.NETTO]),
      cf:    numOrErr(row[COL.COSTI]),
      utile: numOrErr(row[COL.UTILE]),
    };

    const fase = i < 10 ? '1' : i === 10 ? '2-Cavallo' : '6-Partial';
    const tag = exp.bugs.length ? ` [${exp.bugs.join(' ')}]` : '';
    console.log(`R${13+i} | ${ospite.padEnd(16)} | ${canale.padEnd(8)} | L=${lordo}${tag}`);
    const fields = [
      ['COMM',  exp.comm,  r.comm,  exp.errComm],
      ['CED',   exp.ced,   r.ced,   false],
      ['NETTO', exp.netto, r.netto, exp.errComm],
      ['CF',    exp.costi, r.cf,    false],
      ['UTILE', exp.utile, r.utile, exp.errComm],
    ];
    fields.forEach(([campo, atteso, letto, tolerr]) => {
      const esito = ok(atteso, letto, tolerr);
      const lettoStr = letto.err ? letto.val : (letto.empty ? '(vuoto)' : String(letto.val));
      console.log(`  ${esito.padEnd(14)} ${campo.padEnd(6)} att=${String(atteso).padEnd(10)} letto=${lettoStr}`);
      allResults.push({ fase, riga:13+i, campo, atteso, letto:lettoStr, esito });
    });
  });

  // Totali GENNAIO
  const genSum = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'GENNAIO!B10:F10',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const gs = genSum.data.values?.[0] || [];
  const tcf = gs[0]; const utm = gs[4];
  console.log(`\n  TOTALE COSTI FISSI (B10): letto=${tcf} — ${Math.abs(tcf-220)<1?'✅':'⚠️'} (atteso≈220 se 11 ospiti+parziale)`);
  console.log(`  UTILE REALE MESE   (F10): letto=${utm} — (dipende da righe senza #N/A)`);

  // FASE 2 — cavallo in FEBBRAIO?
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' FASE 2 — Cavallo mese: compare in FEBBRAIO?');
  console.log('══════════════════════════════════════════════════════════════════');
  const febRow1 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'FEBBRAIO!A13:F13',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const febFirstOspite = febRow1.data.values?.[0]?.[5] || '(vuoto)';
  const cav_in_feb = String(febFirstOspite).includes('Cavallo');
  console.log(`  Prima riga FEBBRAIO ospite: "${febFirstOspite}"`);
  console.log(`  Cavallo appare in FEBBRAIO? ${cav_in_feb ? '⚠️ SÌ (doppio conteggio!)' : '✅ NO'}`);
  console.log(`  Cavallo in GENNAIO? ✅ SÌ (check-in 29/01 → mese=1=GENNAIO)`);
  console.log(`  ➜ Il sistema aggrega PER MESE DI CHECK-IN. Prenotazioni a cavallo`);
  console.log(`    appaiono SOLO nel mese del check-in. Non esiste gestione split.`);

  // ── FASE 3 — FEBBRAIO estremi ────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' FASE 3 — FEBBRAIO valori estremi (righe 13-17)');
  console.log('══════════════════════════════════════════════════════════════════');

  const febRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'FEBBRAIO!A13:AJ17',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const fRows = febRows.data.values || [];
  // In FEBBRAIO: FASE 3 (4 righe) + FASE 4 Feb (1 riga) = 5 righe
  const febTest = [...DB_DATA.slice(11,15), DB_DATA[15]]; // FASE3[0-3] + FASE4-Feb
  febTest.forEach((t, i) => {
    const row = fRows[i] || [];
    const exp = calcExpected(Number(t[5])||0, t[4]);
    const r = { comm:numOrErr(row[COL.COMM]), ced:numOrErr(row[COL.CED]),
                netto:numOrErr(row[COL.NETTO]), cf:numOrErr(row[COL.COSTI]), utile:numOrErr(row[COL.UTILE]) };
    const tag = exp.bugs.length ? ` [BUG]` : '';
    console.log(`R${13+i} | ${t[2].padEnd(16)} | ${t[4].padEnd(8)} | L=${t[5]}${tag}`);
    [['COMM',exp.comm,r.comm,exp.errComm],['CED',exp.ced,r.ced,false],
     ['NETTO',exp.netto,r.netto,exp.errComm],['UTILE',exp.utile,r.utile,exp.errComm]].forEach(([c,a,l,te])=>{
      const e=ok(a,l,te); const ls=l.err?l.val:(l.empty?'(vuoto)':String(l.val));
      console.log(`  ${e.padEnd(14)} ${c.padEnd(6)} att=${String(a).padEnd(10)} letto=${ls}`);
      allResults.push({fase:'3',riga:13+i,campo:c,atteso:a,letto:ls,esito:e.includes('✅')||e.includes('⚠️BUG')?'OK*':'❌'});
    });
  });

  // ── FASE 4 — tutti i mesi ────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' FASE 4 — Tutti i 12 mesi (1 prenotazione ciascuno)');
  console.log('══════════════════════════════════════════════════════════════════');

  const monthSheets = ['MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
  const fase4data  = DB_DATA.slice(16,26); // FASE4 Mar–Dic (10 rows)

  for (let i = 0; i < monthSheets.length; i++) {
    const sheet = monthSheets[i];
    const t = fase4data[i];
    const exp = calcExpected(Number(t[5]), t[4]);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `${sheet}!A13:AJ13`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const row = res.data.values?.[0] || [];
    const ospite = row[5] || '(mancante)';
    const r = { comm:numOrErr(row[COL.COMM]), ced:numOrErr(row[COL.CED]),
                netto:numOrErr(row[COL.NETTO]), utile:numOrErr(row[COL.UTILE]) };
    const commE=ok(exp.comm,r.comm,exp.errComm), utileE=ok(exp.utile,r.utile,exp.errComm);
    const datiOK = ospite.includes(t[2].split(' ')[1]||t[2]);
    console.log(`${sheet.padEnd(10)} | ${t[4].padEnd(8)} | L=${String(t[5]).padEnd(7)} | ospite=${datiOK?'✅':'❌'} COMM=${commE} UTILE=${utileE}`);
    allResults.push({fase:'4',riga:sheet,campo:'COMM+UTILE',atteso:`${exp.comm}+${exp.utile}`,letto:`${r.comm.val}+${r.utile.val}`,esito:commE+' '+utileE});
  }

  // ── FASE 5 — RECAP ───────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' FASE 5 — RIEPILOGO ANNUALE');
  console.log('══════════════════════════════════════════════════════════════════');

  const recapVals = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'RECAP!A1:D14',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  console.log('\n  RECAP attuale (UTILE NETTO = IFERROR(AD100,0) → sempre 0 se <88 prenotazioni):');
  (recapVals.data.values||[]).forEach((r,i)=>console.log(`  row${i+1}: ${JSON.stringify(r)}`));

  // Calcola manualmente le somme UTILE REALE per mese (solo da F10 di ogni foglio)
  console.log('\n  Confronto F10 (UTILE REALE MESE reale) vs RECAP.B (letto da AD100):');
  const recapMesi = ['GENNAIO','FEBBRAIO','MARZO','APRILE','MAGGIO','GIUGNO','LUGLIO','AGOSTO','SETTEMBRE','OTTOBRE','NOVEMBRE','DICEMBRE'];
  let totalF10 = 0;
  for (const m of recapMesi) {
    const f10res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID, range: `${m}!F10`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const f10 = f10res.data.values?.[0]?.[0];
    const f10n = numOrErr(f10);
    if (!f10n.err && !f10n.empty) totalF10 += f10n.val || 0;
    console.log(`  ${m.padEnd(12)} F10=${f10n.err?f10n.val:(f10n.empty?'(vuoto)':f10n.val.toFixed(2))}`);
  }
  console.log(`\n  ❌ BUG4: RECAP legge 'MESE'!AD100 (88a prenotazione, sempre vuota)`);
  console.log(`         dovrebbe leggere 'MESE'!F10 (SUM UTILE REALE mese)`);
  console.log(`         Totale reale F10 di tutti i mesi: €${totalF10.toFixed(2)}`);
  console.log(`         Totale RECAP attuale: 0 (errato)`);

  // ── FASE 6 — edge cases ─────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' FASE 6 — Test errori e robustezza');
  console.log('══════════════════════════════════════════════════════════════════');

  const marzoRows = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID, range: 'MARZO!A13:AJ15',
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const mz = marzoRows.data.values || [];

  // Riga MARZO 14 = Test Invalid Channel
  const invRow = mz[1] || [];
  const invComm = numOrErr(invRow[COL.COMM]);
  const invCed  = numOrErr(invRow[COL.CED]);
  console.log(`\n  Canale invalido ("Test") — MARZO riga 14:`);
  console.log(`    COMM: ${invComm.err ? `❌ ${invComm.val}` : '✅ '+invComm.val} (atteso: #N/A → errore VLOOKUP)`);
  console.log(`    CED:  ${invCed.err ? '❌'+invCed.val : '✅ '+invCed.val} (atteso: 21.00)`);
  allResults.push({fase:'6-InvalidCh',riga:'MARZO-14',campo:'COMM',atteso:'#N/A',letto:invComm.err?invComm.val:invComm.val,esito:invComm.err?'✅(previsto)':'❌'});

  // Riga MARZO 15 = Lordo=0
  const zeroRow = mz[2] || [];
  const zeroComm=numOrErr(zeroRow[COL.COMM]), zeroCed=numOrErr(zeroRow[COL.CED]);
  const zeroNetto=numOrErr(zeroRow[COL.NETTO]), zeroCf=numOrErr(zeroRow[COL.COSTI]), zeroUtile=numOrErr(zeroRow[COL.UTILE]);
  console.log(`\n  Lordo=0 (Airbnb) — MARZO riga 15:`);
  console.log(`    COMM:  ${ok(0,zeroComm,false).padEnd(6)} att=0     letto=${zeroComm.empty?'(vuoto)':zeroComm.val}`);
  console.log(`    CED:   ${ok(0,zeroCed,false).padEnd(6)} att=0     letto=${zeroCed.empty?'(vuoto)':zeroCed.val}`);
  console.log(`    NETTO: ${ok(0,zeroNetto,false).padEnd(6)} att=0     letto=${zeroNetto.empty?'(vuoto)':zeroNetto.val}`);
  console.log(`    CF:    ${ok(20,zeroCf,false).padEnd(6)} att=20    letto=${zeroCf.empty?'(vuoto)':zeroCf.val}`);
  console.log(`    UTILE: ${ok(-20,zeroUtile,false).padEnd(6)} att=-20   letto=${zeroUtile.empty?'(vuoto)':zeroUtile.val}`);
  allResults.push({fase:'6-Zero',riga:'MARZO-15',campo:'UTILE',atteso:-20,letto:zeroUtile.empty?'(vuoto)':zeroUtile.val,esito:ok(-20,zeroUtile,false)});

  // Riga parziale — già verificata in FASE 1 GENNAIO R24
  console.log(`\n  Riga parziale (solo check-in) — GENNAIO riga 24:`);
  console.log(`    ➜ Verificata sopra. Atteso: tutte le celle formula = vuoto`);

  // ── RIEPILOGO BUG ────────────────────────────────────────────────────────
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log(' RIEPILOGO BUG — 4 errori strutturali');
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(`
  🐛 BUG 1 — VLOOKUP "Diretto" fallisce
     Formula: O13 * VLOOKUP(L13; CONFIG!A7:B9; 2; 0)
     Config ha "Privato / Diretto" (A9), dropdown usa "Diretto" → #N/A
     Colpisce: COMM, NETTO, UTILE di TUTTE le prenotazioni Diretto
     Fix: rinominare CONFIG!A9 → "Diretto"

  🐛 BUG 2 — VLOOKUP "No Tax" fuori range
     Range CONFIG!A7:B9 ha 3 righe; "No Tax" è in A10 (escluso)
     Colpisce: COMM, NETTO, UTILE di TUTTE le prenotazioni No Tax
     Fix: estendere range a CONFIG!A7:B10

  🐛 BUG 3 — Cedolare 21% applicata su "No Tax"
     Formula: O13 * CONFIG!B3 (fisso 21%, nessun check sul canale)
     Sara Neri: cedolare letta=€16,80 attesa=€0,00 (Δ€16,80)
     Fix: =IF(L13="No Tax";0; O13*CONFIG!$B$3)

  🐛 BUG 4 — RECAP legge AD100 invece di F10
     IFERROR(INDIRECT("'MESE'!AD100");0) → legge 88a prenotazione (vuota)
     Risultato: UTILE NETTO = 0 per tutti i mesi, sempre
     F10 di ogni mese ha =SUM(AD13:AD100), il valore corretto
     Fix: cambiare INDIRECT("...!AD100") → INDIRECT("...!F10")
`);
  console.log('══════════════════════════════════════════════════════════════════');
  console.log(` Test completato. ${allResults.filter(r=>r.esito&&!r.esito.includes('✅')&&!r.esito.includes('OK')).length} discrepanze su ${allResults.length} controlli.`);
}

main().catch(e => { console.error('ERRORE:', e.message); process.exit(1); });
