// Prova il vincolo anti-doppia-prenotazione sul database VERO, senza lasciare tracce: ogni
// scenario gira in una transazione che termina sempre con un errore voluto, quindi viene annullata.
// Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/vincolo.db.test.ts
import { describe, it, expect } from 'vitest';
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';

function urlDb(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const t = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
    return t.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g, '') ?? null;
  } catch { return null; }
}

const url = urlDb();
const attivo = process.env.RUN_DB_TESTS === '1' && !!url;

describe.skipIf(!attivo)('vincolo prenotazioni_no_sovrapposizione (database reale)', () => {
  const sql = neon(url ?? 'postgres://x');

  async function scenario(righe: Array<[string, string, string?]>): Promise<{ codice?: string; arrivatoAlFondo: boolean }> {
    const [al] = await sql.query(`select id from alloggi where nome = 'Il Tulipano'`);
    const [os] = await sql.query(`select id from ospiti limit 1`);
    const ins = (ci: string, co: string, stato = 'Attiva') => sql.query(
      `insert into prenotazioni (alloggio_id, ospite_id, checkin, checkout, canale, lordo, stato) values ($1,$2,$3,$4,'Diretto',1,$5)`,
      [al.id, os.id, ci, co, stato]);
    try {
      // l'ultimo statement (divisione per zero) annulla sempre la transazione
      await sql.transaction([...righe.map(([a, b, s]) => ins(a, b, s)), sql.query('select 1/0')]);
      return { arrivatoAlFondo: false };
    } catch (e) {
      const codice = (e as { code?: string }).code;
      return { codice, arrivatoAlFondo: codice === '22012' };
    }
  }

  it('rifiuta due prenotazioni attive sovrapposte', async () => {
    expect((await scenario([['2099-05-10', '2099-05-14'], ['2099-05-12', '2099-05-16']])).codice).toBe('23P01');
  });
  it('accetta soggiorni consecutivi (check-out = check-in)', async () => {
    expect((await scenario([['2099-06-10', '2099-06-12'], ['2099-06-12', '2099-06-14']])).arrivatoAlFondo).toBe(true);
  });
  it('accetta una prenotazione sopra una cancellata', async () => {
    expect((await scenario([['2099-07-10', '2099-07-14', 'Cancellata'], ['2099-07-11', '2099-07-13']])).arrivatoAlFondo).toBe(true);
  });
  it('rifiuta una prenotazione "in attesa" sopra una attiva', async () => {
    expect((await scenario([['2099-08-10', '2099-08-14'], ['2099-08-11', '2099-08-13', 'In attesa di conferma']])).codice).toBe('23P01');
  });
});
