// Applica drizzle/manuali/0001_vincolo_sovrapposizioni.sql al database (idempotente).
// Prima controlla che i dati attuali non abbiano già sovrapposizioni: se ce ne sono, si ferma
// e le elenca, senza toccare nulla.
//   node scripts/applica-vincolo-sovrapposizioni.mjs
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';

const radice = path.resolve(import.meta.dirname, '..');
const env = Object.fromEntries(fs.readFileSync(path.join(radice, '.env.local'), 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=') && !l.startsWith('#'))
  .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; }));
const sql = neon(env.DATABASE_URL_UNPOOLED || env.DATABASE_URL);

const esiste = await sql.query(`select 1 from pg_constraint where conname = 'prenotazioni_no_sovrapposizione'`);
if (esiste.length) { console.log('Vincolo già presente: niente da fare.'); process.exit(0); }

const conflitti = await sql.query(`
  select a.nome as alloggio, p1.checkin c1, p1.checkout o1, p2.checkin c2, p2.checkout o2
  from prenotazioni p1 join prenotazioni p2 on p1.alloggio_id = p2.alloggio_id and p1.id < p2.id
   and p1.checkin < p2.checkout and p2.checkin < p1.checkout
  join alloggi a on a.id = p1.alloggio_id
  where p1.stato not in ('Cancellata','Cancellata con penale','No-show')
    and p2.stato not in ('Cancellata','Cancellata con penale','No-show')`);
if (conflitti.length) {
  console.error('Ci sono già sovrapposizioni: risolvile prima di applicare il vincolo.');
  console.error(conflitti);
  process.exit(1);
}

await sql.query('CREATE EXTENSION IF NOT EXISTS btree_gist');
await sql.query(`ALTER TABLE prenotazioni ADD CONSTRAINT prenotazioni_no_sovrapposizione
  EXCLUDE USING gist (alloggio_id WITH =, daterange(checkin, checkout, '[)') WITH &&)
  WHERE (stato NOT IN ('Cancellata', 'Cancellata con penale', 'No-show'))`);
console.log('Vincolo prenotazioni_no_sovrapposizione applicato.');
