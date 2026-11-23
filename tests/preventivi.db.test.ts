// Prova il blocco dei preventivi accettati, le nuove versioni e le differenze preventivo/prenotazione sul database VERO con dati FINTI.
// Le scritture verso fogli Google e Drive sono sostituite da funzioni vuote (nessun effetto fuori dal database). Toglie solo le righe sue.
// Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/preventivi.db.test.ts
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';

vi.mock('../src/lib/db/syncFoglio', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'function' ? async () => undefined : v]));
});
vi.mock('../src/lib/documenti', async (importOriginal) => {
  const m = await importOriginal<Record<string, unknown>>();
  return Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === 'function' ? async () => ({ id: 'finto', nome: 'finto', link: '' }) : v]));
});

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

describe.skipIf(!attivo)('preventivi (database reale, dati finti)', () => {
  it('blocco dell\'accettato, nuova versione, differenze e cestino', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, cestino, immobili, ospiti, prenotazioni, preventivi } = await import('../src/lib/db/schema');
    const M = await import('../src/lib/db/mutations');
    const { leggiPreventiviDb } = await import('../src/lib/db/queries');
    const db = getDb();
    let alId = ''; let ospId = ''; let prenId = ''; const idsPrev: string[] = [];
    try {
      const [imm] = await db.select({ id: immobili.id }).from(immobili).limit(1);
      const [al] = await db.insert(alloggi).values({ immobile_id: imm.id, nome: 'FintoAlloggioPreventivi' }).returning(); alId = al.id;
      const [o] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoPreventivi' }).returning(); ospId = o.id;
      const [b] = await db.insert(prenotazioni).values({ alloggio_id: alId, ospite_id: ospId, checkin: '2099-06-10', checkout: '2099-06-12', canale: 'Diretto', lordo: '300', numero_ospiti: 2 }).returning(); prenId = b.id;
      const [acc] = await db.insert(preventivi).values({
        codice: 'PR-0000', ospite_id: ospId, alloggio_id: alId, checkin: '2099-06-10', checkout: '2099-06-12', numero_ospiti: 2, prezzo_notte: '150', totale_pieno: '300', totale: '300',
        stato: 'Accettato', prenotazione_id: b.id, accettato_il: new Date(),
      }).returning(); idsPrev.push(acc.id);
      const vedi = async (id: string) => (await leggiPreventiviDb()).find((x) => x.id === id)!;

      // 1) differenze: all'inizio coincidono; se la prenotazione cambia, le differenze si vedono
      expect((await vedi(acc.id)).differenze).toEqual([]);
      await db.update(prenotazioni).set({ lordo: '250', checkin: '2099-06-11' }).where(eq(prenotazioni.id, b.id));
      const dif = (await vedi(acc.id)).differenze!;
      expect(dif.join('|')).toContain('Importo: preventivo 300,00 €, prenotazione 250,00 €');
      expect(dif.join('|')).toContain('Arrivo: preventivo 10/06/2099, prenotazione 11/06/2099');

      // 2) l'accettato è bloccato: non cambia stato, non si elimina, e non si "accetta" da qui
      await expect(M.aggiornaStatoPreventivo(acc.id, 'Rifiutato')).rejects.toThrow('bloccato');
      await expect(M.eliminaPreventivo(acc.id)).rejects.toThrow('bloccato');
      expect((await db.select().from(preventivi).where(eq(preventivi.id, acc.id)))[0].stato).toBe('Accettato');

      // 3) nuova versione: copia in Bozza, codice nuovo, legata all'originale; una seconda versione resta legata alla stessa radice
      const v2 = await M.nuovaVersionePreventivo(acc.id);
      idsPrev.push(v2.id);
      expect(v2).toMatchObject({ versione: 2, versione_di: acc.id, stato: 'Bozza', prenotazione_id: null });
      expect(v2.codice).not.toBe('PR-0000');
      expect(Number(v2.totale)).toBe(300);
      expect(v2.alloggio_id).toBe(alId);
      const v3 = await M.nuovaVersionePreventivo(v2.id);
      idsPrev.push(v3.id);
      expect(v3).toMatchObject({ versione: 3, versione_di: acc.id });
      expect((await db.select().from(preventivi).where(eq(preventivi.id, acc.id)))[0].stato).toBe('Accettato'); // l'originale non è toccato

      // 4) una bozza si gestisce normalmente: si invia, ma non si può "accettare" saltando la conversione; si elimina nel cestino
      await M.aggiornaStatoPreventivo(v3.id, 'Inviato');
      await expect(M.aggiornaStatoPreventivo(v3.id, 'Accettato')).rejects.toThrow('Converti in prenotazione');
      await M.eliminaPreventivo(v3.id);
      expect((await db.select().from(preventivi).where(eq(preventivi.id, v3.id)))).toHaveLength(0);
      expect((await db.select().from(cestino).where(eq(cestino.entita_id, v3.id)))).toHaveLength(1);
    } finally {
      const ids = (await db.select({ id: preventivi.id }).from(preventivi).where(eq(preventivi.alloggio_id, alId || '00000000-0000-0000-0000-000000000000'))).map((x) => x.id);
      const tutti = [...new Set([...ids, ...idsPrev])];
      if (tutti.length) {
        await db.delete(cestino).where(inArray(cestino.entita_id, tutti));
        // le versioni puntano all'originale: si tolgono prima
        for (const id of tutti) await db.update(preventivi).set({ versione_di: null }).where(eq(preventivi.id, id));
        await db.delete(preventivi).where(inArray(preventivi.id, tutti));
      }
      if (prenId) await db.delete(prenotazioni).where(eq(prenotazioni.id, prenId));
      if (ospId) await db.delete(ospiti).where(eq(ospiti.id, ospId));
      if (alId) await db.delete(alloggi).where(eq(alloggi.id, alId));
    }
  }, 240_000);
});
