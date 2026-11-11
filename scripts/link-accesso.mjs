// Riserva per quando non si riesce più a entrare in /nuovo (link perso, dispositivo nuovo):
// stampa il link personale di una persona leggendo il database, creandolo se manca.
//
//   node scripts/link-accesso.mjs                → il link del Titolare
//   node scripts/link-accesso.mjs "Nome"         → il link della persona con quel nome
//   ... | clip                                    → lo copia negli appunti senza mostrarlo
import { neon } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const sql = neon(/^DATABASE_URL=(.*)$/m.exec(env)[1].trim().replace(/^"|"$/g, ''));
const nome = process.argv[2];
const righe = nome
  ? await sql`select id, codice_invito, attivo from utenti where lower(nome) = lower(${nome})`
  : await sql`select id, codice_invito, attivo from utenti where ruolo = 'Titolare'`;
if (righe.length !== 1) { console.error(`Trovate ${righe.length} persone: serve un nome esatto.`); process.exit(1); }
const u = righe[0];
if (!u.attivo) { console.error('Questa persona è disattivata.'); process.exit(1); }
let chiave = u.codice_invito;
if (!chiave || chiave.length < 40) {
  chiave = randomBytes(32).toString('base64url');
  await sql`update utenti set codice_invito = ${chiave}, aggiornato_il = now() where id = ${u.id}`;
}
console.log(`https://salzillo-hospitality.vercel.app/entra?k=${chiave}`);
