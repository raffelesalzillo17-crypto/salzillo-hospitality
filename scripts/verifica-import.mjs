/**
 * Confronta il database Neon con la FONTE VERA (il foglio Google, letto direttamente con
 * valori non formattati) — deve tornare tutto al centesimo.
 */
import { google } from 'googleapis';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const DATABASE_URL = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8')
  .match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const sql = neon(DATABASE_URL);

const FILE_PRENOTAZIONI = '1SFQhO_SPRvIe8L1lgILRNsE-kUHPEfVqUEo3-wwwRjs';
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

const COMM_RATE = { Airbnb: 0.1891, Booking: 0.2015, Diretto: 0, 'No Tax': 0 };
const utileAtteso = (lordo, canale) => {
  const comm = Math.round(lordo * (COMM_RATE[canale] ?? 0) * 100) / 100;
  const ced = canale === 'No Tax' ? 0 : Math.round(lordo * 0.21 * 100) / 100;
  return Math.round((lordo - comm - ced - 20) * 100) / 100;
};

// stesso parser numerico dell'import (gestisce la virgola decimale italiana)
const num = (v) => {
  if (v == null || v === '') return 0;
  const s = String(v).trim();
  return parseFloat(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s) || 0;
};

// ── Fonte: foglio DATABASE (formattato, come lo legge l'import) ─────────────
const res = await sheets.spreadsheets.values.get({
  spreadsheetId: FILE_PRENOTAZIONI, range: 'DATABASE!B1:K100000',
});
const rows = (res.data.values ?? []).slice(1);
const canaleMap = { 'No tax': 'No Tax', 'Notax': 'No Tax' };
const fonte = rows
  .map((r) => ({ checkin: r[0], ospite: r[2], stanza: r[3], canale: canaleMap[r[4]] ?? r[4], lordo: num(r[5]) }))
  .filter((p) => p.checkin && p.ospite && p.stanza && p.canale && /^\d{2}\/\d{2}\/\d{4}$/.test(String(p.checkin)));

const sommaLordoFonte = fonte.reduce((s, p) => s + p.lordo, 0);
const sommaUtileFonte = fonte.reduce((s, p) => s + utileAtteso(p.lordo, p.canale), 0);

// ── Database ──────────────────────────────────────────────────────────────
const [cnt] = await sql`SELECT
  (SELECT count(*) FROM proprietari) proprietari,
  (SELECT count(*) FROM immobili) immobili,
  (SELECT count(*) FROM alloggi) alloggi,
  (SELECT count(*) FROM ospiti) ospiti,
  (SELECT count(*) FROM prenotazioni) prenotazioni,
  (SELECT coalesce(sum(lordo),0) FROM prenotazioni) somma_lordo,
  (SELECT coalesce(sum(utile),0) FROM prenotazioni) somma_utile,
  (SELECT coalesce(sum(commissione),0) FROM prenotazioni) somma_comm,
  (SELECT coalesce(sum(cedolare),0) FROM prenotazioni) somma_ced`;

const eq = (a, b) => Math.abs(a - b) < 0.015;
const ck = (ok) => ok ? '✅' : '❌';

console.log('CONTEGGI');
console.log('  prenotazioni: foglio', fonte.length, '| db', Number(cnt.prenotazioni), ck(fonte.length === Number(cnt.prenotazioni)));
console.log('  proprietari/immobili/alloggi/ospiti:', Number(cnt.proprietari), Number(cnt.immobili), Number(cnt.alloggi), Number(cnt.ospiti));

console.log('\nTOTALI ECONOMICI (foglio vs db, tolleranza 1,5 cent)');
console.log('  somma lordo:', sommaLordoFonte.toFixed(2), '|', Number(cnt.somma_lordo).toFixed(2), ck(eq(sommaLordoFonte, Number(cnt.somma_lordo))));
console.log('  somma utile:', sommaUtileFonte.toFixed(2), '|', Number(cnt.somma_utile).toFixed(2), ck(eq(sommaUtileFonte, Number(cnt.somma_utile))));
console.log('  (dettaglio db: commissioni', Number(cnt.somma_comm).toFixed(2), '| cedolare', Number(cnt.somma_ced).toFixed(2), ')');

// ── Confronto riga per riga (join su checkin + lordo esatti) ───────────────
console.log('\nRIGA PER RIGA');
let disallineate = 0;
for (const p of fonte) {
  const ci = p.checkin.split('/').reverse().join('-');
  const found = await sql`SELECT pr.utile, pr.canale FROM prenotazioni pr WHERE pr.checkin = ${ci} AND pr.lordo = ${p.lordo}`;
  if (found.length === 0) { console.log(`  ❌ mancante: ${p.ospite} ${p.checkin} ${p.canale} ${p.lordo}€`); disallineate++; continue; }
  const atteso = utileAtteso(p.lordo, p.canale);
  const match = found.some((f) => eq(Number(f.utile), atteso));
  if (!match) { console.log(`  ❌ utile diverso: ${p.ospite} ${p.checkin} — atteso ${atteso}, db ${found.map(f=>Number(f.utile))}`); disallineate++; }
}
console.log(disallineate === 0 ? '  ✅ tutte le righe allineate' : `  ❌ ${disallineate} righe disallineate`);

console.log('\nPER ALLOGGIO (db)');
for (const r of await sql`SELECT a.nome, count(*) n, sum(pr.lordo) lordo, sum(pr.utile) utile
  FROM prenotazioni pr JOIN alloggi a ON a.id = pr.alloggio_id GROUP BY a.nome ORDER BY n DESC`)
  console.log(`  ${r.nome.padEnd(14)} ${String(r.n).padStart(2)} pren · ${Number(r.lordo).toFixed(2)}€ lordo · ${Number(r.utile).toFixed(2)}€ utile`);
