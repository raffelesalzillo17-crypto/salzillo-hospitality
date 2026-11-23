// Prova stati, storico, ricorrenza e unione dei doppioni delle scadenze sul database VERO con scadenze FINTE (titoli "Finto…").
// Toglie solo le righe sue. Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/scadenze.db.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, like } from 'drizzle-orm';

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

describe.skipIf(!attivo)('scadenze (database reale, scadenze finte)', () => {
  it('fatta, ricorrenza dalla data prevista, non più applicabile, riapri, doppioni e cestino', async () => {
    const { getDb } = await import('../src/lib/db');
    const { cestino, scadenze, scadenzeStorico } = await import('../src/lib/db/schema');
    const S = await import('../src/lib/db/scadenzeGestione');
    const { cosaMancaBlocchi } = await import('../src/lib/db/dashboard');
    const { ripristinaDalCestino } = await import('../src/lib/db/registro');
    const db = getDb();
    try {
      // 1) ricorrente: resta aperta con la data successiva calcolata dalla data PREVISTA (non da oggi)
      const [mensile] = await db.insert(scadenze).values({ titolo: 'FintoMensile', ente: 'Comune', data_scadenza: '2026-10-16', ricorrenza: 'Mensile' }).returning();
      const r1 = await S.completaScadenzaConStorico(mensile.id, '2026-11-20');
      expect(r1.prossima).toBe('2026-11-16');
      expect(r1.scadenza.stato).toBe('Aperta');
      expect(r1.scadenza.ultimo_completamento).toBe('2026-11-20');
      const st = await db.select().from(scadenzeStorico).where(eq(scadenzeStorico.scadenza_id, mensile.id));
      expect(st).toHaveLength(1);
      expect(st[0]).toMatchObject({ scadenza_prevista: '2026-10-16', fatta_il: '2026-11-20' });
      await expect(S.completaScadenzaConStorico(mensile.id, '2099-01-01')).rejects.toThrow('nel futuro');
      await expect(S.salvaRicevutaScadenza('00000000-0000-0000-0000-000000000000', { nome: 'a.pdf', mime: 'application/pdf', contenuto: Buffer.from('x') })).rejects.toThrow('non è ancora stata segnata');

      // 2) una tantum: si archivia come "Fatta" e sparisce da "cosa manca"
      const [unaTantum] = await db.insert(scadenze).values({ titolo: 'FintoUnaTantum', data_scadenza: '2026-11-25', ricorrenza: 'Una tantum' }).returning();
      let blocchi = await cosaMancaBlocchi('2026-11-23', 'tutti', false);
      expect(blocchi.scadenze.map((x) => x.titolo)).toContain('FintoUnaTantum');
      const r2 = await S.completaScadenzaConStorico(unaTantum.id);
      expect(r2.prossima).toBeNull();
      expect(r2.scadenza.stato).toBe('Fatta');
      expect(r2.scadenza.chiusa_il).not.toBeNull();
      await expect(S.completaScadenzaConStorico(unaTantum.id)).rejects.toThrow('riaprila');
      blocchi = await cosaMancaBlocchi('2026-11-23', 'tutti', false);
      expect(blocchi.scadenze.map((x) => x.titolo)).not.toContain('FintoUnaTantum');

      // 3) non più applicabile: serve il motivo, sparisce dalla Dashboard, si può riaprire
      const [vecchia] = await db.insert(scadenze).values({ titolo: 'FintoVecchia', data_scadenza: '2026-10-16', ricorrenza: 'Mensile' }).returning();
      blocchi = await cosaMancaBlocchi('2026-11-23', 'tutti', false);
      const scaduta = blocchi.scadenze.find((x) => x.titolo === 'FintoVecchia');
      expect(scaduta?.scaduta).toBe(true);                                       // una scadenza passata e aperta si vede, segnata "scaduta"
      await expect(S.chiudiNonApplicabile(vecchia.id, ' ')).rejects.toThrow('motivo');
      await S.chiudiNonApplicabile(vecchia.id, 'Non più in vigore in questa forma');
      const [chiusa] = await db.select().from(scadenze).where(eq(scadenze.id, vecchia.id));
      expect(chiusa).toMatchObject({ stato: 'Non più applicabile', motivo_chiusura: 'Non più in vigore in questa forma' });
      blocchi = await cosaMancaBlocchi('2026-11-23', 'tutti', false);
      expect(blocchi.scadenze.map((x) => x.titolo)).not.toContain('FintoVecchia');
      await S.riapriScadenza(vecchia.id);
      expect((await db.select().from(scadenze).where(eq(scadenze.id, vecchia.id)))[0].stato).toBe('Aperta');

      // 4) doppioni: stessa scadenza creata qui (con ente) e tornata dal foglio (senza ente). Anteprima, poi unione con cestino
      const [qui] = await db.insert(scadenze).values({ titolo: 'FintoCedolare — 1° acconto', ente: 'Agenzia delle Entrate', data_scadenza: '2027-09-14', ricorrenza: 'Annuale', origine: 'Database' }).returning();
      const [foglio] = await db.insert(scadenze).values({ titolo: 'FintoCedolare — 1° acconto', data_scadenza: '2027-09-14', ricorrenza: 'Annuale', origine: 'Foglio', ultimo_completamento: '2026-09-14' }).returning();
      const gruppi = await S.cercaDuplicatiScadenze();
      const g = gruppi.find((x) => x.voci.some((v) => v.id === qui.id));
      expect(g).toBeTruthy();
      expect(g!.principaleSuggerito).toBe(qui.id);                              // si propone quella creata qui, con ente
      expect(g!.voci).toHaveLength(2);
      await expect(S.unisciScadenze(qui.id, [])).rejects.toThrow('almeno una');
      const u = await S.unisciScadenze(qui.id, [foglio.id]);
      expect(u.rimosse).toBe(1);
      expect((await db.select().from(scadenze).where(eq(scadenze.id, foglio.id)))).toHaveLength(0);
      const [tenuta] = await db.select().from(scadenze).where(eq(scadenze.id, qui.id));
      expect(tenuta.ente).toBe('Agenzia delle Entrate');
      expect(tenuta.ultimo_completamento).toBe('2026-09-14');                   // l'ultimo completamento dell'altra si conserva
      const [voce] = await db.select().from(cestino).where(eq(cestino.entita_id, foglio.id));
      expect(voce.tipo).toBe('scadenza');
      await ripristinaDalCestino(voce.id);                                      // il cestino la rimette com'era
      expect((await db.select().from(scadenze).where(eq(scadenze.id, foglio.id)))).toHaveLength(1);
      await expect(S.unisciScadenze(qui.id, [mensile.id])).rejects.toThrow('stesso titolo');
    } finally {
      const mie = await db.select({ id: scadenze.id }).from(scadenze).where(like(scadenze.titolo, 'Finto%'));
      for (const m of mie) { await db.delete(cestino).where(eq(cestino.entita_id, m.id)); await db.delete(scadenze).where(eq(scadenze.id, m.id)); }
    }
  }, 240_000);
});
