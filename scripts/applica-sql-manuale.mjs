// Applica un file SQL di drizzle/manuali/ al database (i file sono scritti per essere idempotenti).
//   node scripts/applica-sql-manuale.mjs drizzle/manuali/0002_regole_automazione.sql
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const radice = path.resolve(import.meta.dirname, '..');
const file = process.argv[2];
if (!file) { console.error('Uso: node scripts/applica-sql-manuale.mjs <file.sql>'); process.exit(1); }
const testo = fs.readFileSync(path.resolve(radice, file), 'utf8');

const env = Object.fromEntries(fs.readFileSync(path.join(radice, '.env.local'), 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sql = neon(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);

// Divide in istruzioni sul ";" a fine riga, ma non dentro i blocchi DO $$ ... $$.
const istruzioni = [];
let corrente = '';
let dentroBlocco = false;
for (const riga of testo.split(/\r?\n/)) {
  if (!dentroBlocco && /^\s*--/.test(riga)) continue;
  corrente += riga + '\n';
  if (/\$\$/.test(riga)) { const n = (riga.match(/\$\$/g) ?? []).length; if (n % 2 === 1) dentroBlocco = !dentroBlocco; }
  if (!dentroBlocco && /;\s*$/.test(riga)) { if (corrente.trim()) istruzioni.push(corrente.trim()); corrente = ''; }
}
if (corrente.trim()) istruzioni.push(corrente.trim());

for (const [i, s] of istruzioni.entries()) {
  await sql.query(s);
  console.log(`ok ${i + 1}/${istruzioni.length}: ${s.split('\n')[0].slice(0, 80)}`);
}
console.log('Fatto.');
