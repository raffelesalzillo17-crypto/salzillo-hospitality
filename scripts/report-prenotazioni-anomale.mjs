/**
 * Report in SOLA LETTURA delle prenotazioni anomale (punto 1 delle richieste, 23/11/2026).
 * Non scrive nulla. Niente nomi né contatti degli ospiti: solo id abbreviato, alloggio, date,
 * canale, stato, origine. Uso: node scripts/report-prenotazioni-anomale.mjs
 */
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

const url = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8').match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const sql = neon(url);
const corto = (id) => String(id).slice(0, 8);
const riga = (r) => `${corto(r.id)}  ${r.alloggio.padEnd(14)} ${r.checkin}→${r.checkout}  ${String(r.canale).padEnd(8)} ${String(r.stato).padEnd(22)} ${r.origine}`;

const q = (testo) => sql.query(testo);
const base = `SELECT p.id, a.nome AS alloggio, p.checkin::text AS checkin, p.checkout::text AS checkout,
  p.canale::text AS canale, p.stato::text AS stato, p.origine::text AS origine, p.creato_il
  FROM prenotazioni p JOIN alloggi a ON a.id = p.alloggio_id`;

console.log('== Prenotazioni per origine e stato ==');
console.table(await q(`SELECT origine::text, stato::text, count(*)::int AS n FROM prenotazioni GROUP BY 1,2 ORDER BY 1,2`));

console.log('\n== 1. Doppioni (stesso alloggio, stesse date, entrambe non cancellate) ==');
const dop = await q(`${base} WHERE p.stato = 'Attiva' AND EXISTS (
  SELECT 1 FROM prenotazioni q WHERE q.id <> p.id AND q.alloggio_id = p.alloggio_id AND q.checkin = p.checkin
  AND q.checkout = p.checkout AND q.stato = 'Attiva') ORDER BY a.nome, p.checkin`);
dop.forEach((r) => console.log(riga(r))); if (!dop.length) console.log('nessuno');

console.log('\n== 2. Sovrapposizioni (stesso alloggio, periodi che si accavallano, non cancellate) ==');
const sov = await q(`SELECT x.id AS id_a, y.id AS id_b, a.nome AS alloggio, x.checkin::text AS ci_a, x.checkout::text AS co_a,
  y.checkin::text AS ci_b, y.checkout::text AS co_b, x.origine::text AS or_a, y.origine::text AS or_b
  FROM prenotazioni x JOIN prenotazioni y ON x.alloggio_id = y.alloggio_id AND x.id < y.id
  AND x.checkin < y.checkout AND y.checkin < x.checkout
  JOIN alloggi a ON a.id = x.alloggio_id WHERE x.stato = 'Attiva' AND y.stato = 'Attiva' ORDER BY a.nome, x.checkin`);
sov.forEach((r) => console.log(`${corto(r.id_a)} (${r.ci_a}→${r.co_a}, ${r.or_a}) ⟷ ${corto(r.id_b)} (${r.ci_b}→${r.co_b}, ${r.or_b})  ${r.alloggio}`));
if (!sov.length) console.log('nessuna');

console.log('\n== 3. Prenotazioni importate dal foglio (origine=Foglio) con date future o in corso ==');
console.log('   (sono quelle che il vecchio form può aver creato; il foglio le reimporta ogni giorno)');
const fut = await q(`${base} WHERE p.origine = 'Foglio' AND p.checkout >= CURRENT_DATE ORDER BY p.checkin`);
fut.forEach((r) => console.log(riga(r))); if (!fut.length) console.log('nessuna');

console.log('\n== 4. Prenotazioni senza evento Calendar collegato (non cancellate, future) ==');
const senza = await q(`${base} WHERE p.stato = 'Attiva' AND p.checkout >= CURRENT_DATE AND (p.calendar_event_id IS NULL OR p.calendar_event_id = '') ORDER BY p.checkin`);
senza.forEach((r) => console.log(riga(r))); if (!senza.length) console.log('nessuna');

console.log('\n== 5. Ospiti collegati a una prenotazione ma senza telefono (solo conteggio) ==');
console.table(await q(`SELECT count(*)::int AS prenotazioni_attive_future_senza_telefono FROM prenotazioni p JOIN ospiti o ON o.id = p.ospite_id
  WHERE p.stato = 'Attiva' AND p.checkout >= CURRENT_DATE AND (o.telefono IS NULL OR o.telefono = '')`));
