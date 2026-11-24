// Copia di sicurezza del database su questo computer (sola lettura): una cartella con un file JSON per tabella.
//   node scripts/backup-locale.mjs [cartella-di-destinazione]
// Contiene dati personali degli ospiti: tenere la cartella fuori dal repository e non condividerla.
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const radice = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(radice, '.env.local'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sql = neon(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);

const base = process.argv[2] || path.join(process.env.USERPROFILE || '.', 'Backup-Salzillo-Hospitality');
const adesso = new Date();
const cartella = path.join(base, adesso.toISOString().slice(0, 16).replace(/[:T]/g, '-'));
fs.mkdirSync(cartella, { recursive: true });

const tabelle = (await sql.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE' order by 1")).map((r) => r.table_name);
const riepilogo = [];
for (const t of tabelle) {
  const righe = await sql.query(`select * from "${t}"`);
  fs.writeFileSync(path.join(cartella, `${t}.json`), JSON.stringify(righe));
  riepilogo.push({ tabella: t, righe: righe.length });
}
fs.writeFileSync(path.join(cartella, '_riepilogo.json'), JSON.stringify({ creato: adesso.toISOString(), tabelle: riepilogo }, null, 2));
console.table(riepilogo);
console.log('Salvato in', cartella);
