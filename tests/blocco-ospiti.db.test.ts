// Prova che l'invio ad Alloggiati Web si BLOCCA quando le schedine non coincidono con gli ospiti della
// prenotazione, sul database vero con dati FINTI (prenotazione nel 2099). NON prova mai l'invio forzato
// e non contatta il portale: il blocco scatta prima di qualsiasi chiamata. Toglie solo le righe sue.
// Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/blocco-ospiti.db.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';

function urlDb(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const t = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
    return t.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g, '') ?? null;
  } catch { return null; }
}
const url = urlDb();
const attivo = process.env.RUN_DB_TESTS === '1' && !!url;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!attivo)('blocco invio se schedine ≠ ospiti (database reale, dati finti)', () => {
  it('blocca 2 ospiti con 1 schedina e 1 ospite con 2 schedine, senza toccare le schedine', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, ospiti, prenotazioni, schedine } = await import('../src/lib/db/schema');
    const { inviaPrenotazioneReale, schedineDaInviareAlloggiati } = await import('../src/lib/alloggiatiInvio');
    const db = getDb();

    const [al] = await db.select({ id: alloggi.id }).from(alloggi).where(eq(alloggi.nome, 'Il Tulipano'));
    const [osp] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoBlocco' }).returning();
    const creaPren = async (checkin: string, checkout: string, nOspiti: number) => (await db.insert(prenotazioni).values({
      alloggio_id: al.id, ospite_id: osp.id, checkin, checkout, canale: 'Diretto', lordo: '1', numero_ospiti: nOspiti,
    }).returning())[0];
    const creaSch = (pid: string, nome: string) => db.insert(schedine).values({
      prenotazione_id: pid, ospite_id: osp.id, cognome: 'FintoBlocco', nome, tipo_alloggiato_codice: '16', stato: 'Da inviare',
    });
    const p1 = await creaPren('2099-02-10', '2099-02-12', 2);
    const p2 = await creaPren('2099-03-10', '2099-03-12', 1);
    try {
      await creaSch(p1.id, 'Uno');
      await creaSch(p2.id, 'Uno'); await creaSch(p2.id, 'Due');

      const e1 = await inviaPrenotazioneReale(p1.id);
      expect(e1.ok).toBe(false);
      expect(e1.messaggio).toContain('INVIO BLOCCATO');
      expect(e1.messaggio).toContain('2 ospiti');
      expect(e1.messaggio).toContain('solo 1 schedina');

      const e2 = await inviaPrenotazioneReale(p2.id);
      expect(e2.ok).toBe(false);
      expect(e2.messaggio).toContain('INVIO BLOCCATO');
      expect(e2.messaggio).toContain('2 schedine');

      // nulla è stato toccato: restano tutte "Da inviare", senza esito
      const dopo = await db.select().from(schedine).where(eq(schedine.ospite_id, osp.id));
      expect(dopo.length).toBe(3);
      expect(dopo.every((s) => s.stato === 'Da inviare' && !s.esito_invio && !s.inviata_il)).toBe(true);

      // l'elenco per la schermata espone gli ospiti attesi, così si può mostrare l'avviso
      const elenco = await schedineDaInviareAlloggiati();
      expect(elenco.find((s) => s.prenotazioneId === p1.id)?.ospitiAttesi).toBe(2);
    } finally {
      await db.delete(schedine).where(eq(schedine.ospite_id, osp.id));
      await db.delete(prenotazioni).where(eq(prenotazioni.ospite_id, osp.id));
      await db.delete(ospiti).where(eq(ospiti.id, osp.id));
    }
  }, 60_000);
});
