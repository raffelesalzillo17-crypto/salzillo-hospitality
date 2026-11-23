// Prova che i numeri della Dashboard coincidono con i Rendiconti, e i blocchi di "Cosa manca", sul database VERO con dati
// FINTI (marzo 2099). Toglie solo le righe sue. Si esegue solo con:
//   RUN_DB_TESTS=1 npx vitest run tests/dashboard.db.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';

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

describe.skipIf(!attivo)('dashboard = rendiconti (database reale, dati finti)', () => {
  it('stessi numeri dei Rendiconti, occupazione e prezzo medio, blocchi di cosa manca', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, categorieSpesa, immobili, ospiti, pagamenti, prenotazioni, pulizie, scadenze, spese } = await import('../src/lib/db/schema');
    const { riepilogoDashboard, cosaMancaBlocchi } = await import('../src/lib/db/dashboard');
    const { rendicontoProprietarioDb } = await import('../src/lib/db/queries');
    const db = getDb();
    const idsPren: string[] = []; const idsPul: string[] = []; const idsScad: string[] = [];
    let ospId = ''; let spesaId = '';
    try {
      const [al] = await db.select({ id: alloggi.id, immobile: alloggi.immobile_id }).from(alloggi).where(eq(alloggi.nome, 'Il Tulipano'));
      const [imm] = await db.select({ prop: immobili.proprietario_id }).from(immobili).where(eq(immobili.id, al.immobile));
      const attiviImm = (await db.select({ id: alloggi.id }).from(alloggi).where(eq(alloggi.immobile_id, al.immobile))).length;
      const [o] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoDashboard' }).returning(); ospId = o.id;
      const pren = async (ci: string, co: string, lordo: string, comm: string, netto: string, canale: 'Diretto' | 'Airbnb' = 'Diretto') => {
        const [p] = await db.insert(prenotazioni).values({ alloggio_id: al.id, ospite_id: o.id, checkin: ci, checkout: co, canale, lordo, commissione: comm, cedolare: '0', costo_pulizia: '20', fee_gestione: '0', utile: netto, netto_proprietario: netto, numero_ospiti: 2 }).returning();
        idsPren.push(p.id); return p;
      };
      const p1 = await pren('2099-03-10', '2099-03-12', '100', '0', '80');               // 2 notti, tutte a marzo
      await pren('2099-03-29', '2099-04-02', '200', '30', '150', 'Airbnb');             // 4 notti: a marzo ne cadono 2 (29, 30, 31 → 3)
      const [cat] = await db.select({ id: categorieSpesa.id }).from(categorieSpesa).limit(1);
      const [sp] = await db.insert(spese).values({ immobile_id: al.immobile, categoria_id: cat.id, data: '2099-03-15', descrizione: 'FintoSpesaDashboard', importo: '25' }).returning(); spesaId = sp.id;

      // 1) i numeri sono quelli dei Rendiconti: per proprietario e per tutti
      for (const prop of [imm.prop, null]) {
        const d = await riepilogoDashboard(2099, 3, prop, 'tutti');
        const r = (await rendicontoProprietarioDb(prop, 2099, 3))!;
        expect(d.totali.lordo).toBeCloseTo(r.totali.lordo, 2);
        expect(d.totali.commissioni).toBeCloseTo(r.totali.commissione, 2);
        expect(d.totali.nettoProprietario).toBeCloseTo(r.totali.nettoProprietario, 2);
        expect(d.totali.spese).toBeCloseTo(r.totali.totSpese, 2);
        expect(d.totali.nettoDopoSpese).toBeCloseTo(r.totali.nettoFinale, 2);
        expect(d.totali.tassaRiscossa).toBeCloseTo(r.totali.impostaSoggiorno, 2);
        expect(d.totali.prenotazioni).toBe(r.totali.numPrenotazioni);
      }
      const d = await riepilogoDashboard(2099, 3, imm.prop, 'tutti');
      expect(d.totali.lordo).toBe(300);
      expect(d.totali.commissioni).toBe(30);
      expect(d.totali.nettoProprietario).toBe(230);
      expect(d.totali.spese).toBe(25);
      expect(d.totali.nettoDopoSpese).toBe(205);

      // 2) occupazione e prezzo medio: notti a marzo = 2 + 3 = 5; prezzo medio = 300 / (2 + 4) = 50
      const riga = d.immobili.find((x) => x.immobile && x.immobileId === al.immobile)!;
      expect(riga.nottiOccupate).toBe(5);
      expect(riga.alloggiAttivi).toBeGreaterThan(0);
      expect(riga.occupazione).toBeCloseTo(Math.round((5 / (riga.alloggiAttivi * 31)) * 1000) / 10, 1);
      expect(riga.nottiPrenotazioni).toBe(6);
      expect(riga.prezzoMedioNotte).toBe(50);
      void attiviImm;

      // 3) i filtri per immobile: chi non vede questo immobile non lo trova
      expect((await riepilogoDashboard(2099, 3, imm.prop, [])).immobili).toHaveLength(0);

      // 4) cosa manca: pagamenti (saldo), pulizie di oggi e domani, scadenze a 30 giorni
      let b = await cosaMancaBlocchi('2099-03-08', 'tutti', true);
      expect(b.pagamenti.find((x) => x.id === p1.id)?.residuo).toBe(100);
      await db.insert(pagamenti).values({ prenotazione_id: p1.id, tipo: 'Caparra', importo: '40', data: '2099-03-01' });
      b = await cosaMancaBlocchi('2099-03-08', 'tutti', true);
      expect(b.pagamenti.find((x) => x.id === p1.id)?.residuo).toBe(60);
      await db.insert(pagamenti).values({ prenotazione_id: p1.id, tipo: 'Saldo', importo: '60', data: '2099-03-10' });
      expect((await cosaMancaBlocchi('2099-03-08', 'tutti', true)).pagamenti.find((x) => x.id === p1.id)).toBeUndefined();
      expect((await cosaMancaBlocchi('2099-03-08', 'tutti', false)).pagamenti).toHaveLength(0); // senza accesso finanziario non si vedono

      for (const data of ['2099-03-08', '2099-03-09', '2099-03-10']) { const [pu] = await db.insert(pulizie).values({ alloggio_id: al.id, data }).returning(); idsPul.push(pu.id); }
      b = await cosaMancaBlocchi('2099-03-08', 'tutti', true);
      expect(b.pulizie.filter((x) => idsPul.includes(x.id)).map((x) => x.data)).toEqual(['2099-03-08', '2099-03-09']); // solo oggi e domani

      const [sc1] = await db.insert(scadenze).values({ titolo: 'FintoScadenzaVicina', data_scadenza: '2099-04-01' }).returning(); idsScad.push(sc1.id);
      const [sc2] = await db.insert(scadenze).values({ titolo: 'FintoScadenzaLontana', data_scadenza: '2099-06-01' }).returning(); idsScad.push(sc2.id);
      b = await cosaMancaBlocchi('2099-03-08', 'tutti', true);
      expect(b.scadenze.map((x) => x.titolo)).toContain('FintoScadenzaVicina');
      expect(b.scadenze.map((x) => x.titolo)).not.toContain('FintoScadenzaLontana'); // oltre i 30 giorni
      expect(b.sovrapposizioni).toEqual([]);
    } finally {
      if (idsPul.length) await db.delete(pulizie).where(inArray(pulizie.id, idsPul));
      if (idsScad.length) await db.delete(scadenze).where(inArray(scadenze.id, idsScad));
      if (spesaId) await db.delete(spese).where(eq(spese.id, spesaId));
      if (idsPren.length) { await db.delete(pagamenti).where(inArray(pagamenti.prenotazione_id, idsPren)); await db.delete(prenotazioni).where(inArray(prenotazioni.id, idsPren)); }
      if (ospId) await db.delete(ospiti).where(eq(ospiti.id, ospId));
    }
  }, 240_000);
});
