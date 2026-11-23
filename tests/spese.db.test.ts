// Prova import da estratto conto, ricorrenze, eliminazione con cestino ed export per il commercialista sul database
// VERO con dati FINTI (anno 2099). Non contatta Drive, fogli Google né portali, e toglie solo le righe sue.
// Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/spese.db.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, gte, inArray } from 'drizzle-orm';

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

describe.skipIf(!attivo)('spese e export commercialista (database reale, dati finti)', () => {
  it('importa senza duplicare, genera le ricorrenti una volta sola, cestino, e l\'export torna con i totali', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, categorieSpesa, cestino, immobili, ospiti, prenotazioni, spese, speseRicorrenti } = await import('../src/lib/db/schema');
    const G = await import('../src/lib/db/speseGestione');
    const { ripristinaDalCestino } = await import('../src/lib/db/registro');
    const { datiCommercialista, costruisciXlsx, costruisciCsv } = await import('../src/lib/esportaCommercialista');
    const db = getDb();
    let ospId = ''; let prenId = ''; const ricIds: string[] = [];
    try {
      const [al] = await db.select({ id: alloggi.id, immobile: alloggi.immobile_id }).from(alloggi).where(eq(alloggi.nome, 'Il Tulipano'));
      const [imm] = await db.select({ prop: immobili.proprietario_id }).from(immobili).where(eq(immobili.id, al.immobile));
      const cat = await db.select().from(categorieSpesa);
      const utenze = cat.find((c) => c.nome === 'Utenze')!, manut = cat.find((c) => c.nome === 'Manutenzione')!;

      const [o] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoSpese' }).returning(); ospId = o.id;
      const [p] = await db.insert(prenotazioni).values({ alloggio_id: al.id, ospite_id: o.id, checkin: '2099-03-10', checkout: '2099-03-12', canale: 'Diretto', lordo: '100', commissione: '10', cedolare: '21', costo_pulizia: '20', fee_gestione: '0', utile: '49', netto_proprietario: '90', numero_ospiti: 2 }).returning(); prenId = p.id;

      // 1) import: 2 righe, poi lo STESSO import di nuovo → niente duplicati
      const righe = [
        { data: '2099-02-03', descrizione: 'ENEL ENERGIA luce', importo: 45.2, categoriaId: utenze.id, alloggioId: al.id },
        { data: '2099-02-04', descrizione: 'Idraulico Rossi', importo: 12, categoriaId: manut.id, immobileId: al.immobile },
      ];
      expect(await G.importaSpese(righe)).toEqual({ inserite: 2, saltate: 0 });
      expect(await G.importaSpese(righe)).toEqual({ inserite: 0, saltate: 2 });
      const [conAlloggio] = await db.select().from(spese).where(eq(spese.descrizione, 'ENEL ENERGIA luce'));
      expect(conAlloggio.alloggio_id).toBe(al.id);
      expect(conAlloggio.immobile_id).toBe(al.immobile); // l'immobile si ricava dall'alloggio
      await expect(G.importaSpese([{ ...righe[0], categoriaId: '00000000-0000-0000-0000-000000000000', data: '2099-02-05' }])).rejects.toThrow('categoria');

      // anteprima: riconosce le doppie e suggerisce la categoria dalle spese già registrate
      const an = await G.anteprimaEstratto([{ riga: 2, data: '2099-02-03', descrizione: 'ENEL ENERGIA luce', importo: 45.2 }, { riga: 3, data: '2099-07-01', descrizione: 'Idraulico Bianchi', importo: 80 }]);
      expect(an.righe[0].doppia).toBe(true);
      expect(an.righe[1].doppia).toBe(false);
      expect(an.righe[1].categoriaId).toBe(manut.id);

      // 2) ricorrente mensile dal 15/01/2099: oggi = 20/03/2099 → 3 spese (gen, feb, mar), e rilanciando non ne nascono altre
      const ric = await G.creaSpesaRicorrente({ descrizione: 'FintoRicorrente abbonamento', categoriaId: utenze.id, alloggioId: al.id, importo: 30, frequenza: 'Mensile', primaData: '2099-01-15' });
      ricIds.push(ric.id);
      expect((await G.generaSpeseRicorrenti('2099-03-20')).generate).toBe(3);
      expect((await G.generaSpeseRicorrenti('2099-03-20')).generate).toBe(0);
      const generate = await db.select().from(spese).where(eq(spese.ricorrente_id, ric.id));
      expect(generate.map((x) => x.data).sort()).toEqual(['2099-01-15', '2099-02-15', '2099-03-15']);
      const [dopo] = await db.select().from(speseRicorrenti).where(eq(speseRicorrenti.id, ric.id));
      expect(dopo.prossima_data).toBe('2099-04-15');
      await G.impostaSpesaRicorrente(ric.id, { attiva: false });
      expect((await G.generaSpeseRicorrenti('2099-06-20')).generate).toBe(0); // disattivata: non genera

      // 3) elimina con cestino e ripristina
      await G.eliminaSpesa(conAlloggio.id);
      expect((await db.select().from(spese).where(eq(spese.id, conAlloggio.id))).length).toBe(0);
      const [voce] = await db.select().from(cestino).where(eq(cestino.entita_id, conAlloggio.id));
      expect(voce.tipo).toBe('spesa');
      await ripristinaDalCestino(voce.id);
      expect((await db.select().from(spese).where(eq(spese.id, conAlloggio.id))).length).toBe(1);

      // 4) export: i totali tornano con i dati inseriti (45,20 + 12 + 3 x 30 = 147,20)
      const d = await datiCommercialista(2099, imm.prop);
      expect(d.totali.prenotazioni).toBe(1);
      expect(d.totali.lordo).toBe(100);
      expect(d.totali.commissioni).toBe(10);
      expect(d.totali.cedolare).toBe(21);
      expect(d.totali.netto).toBe(90);
      expect(d.totali.spese).toBe(147.2);
      expect(d.totali.risultato).toBe(-57.2); // 90 - 147,20: con le spese l'utile cambia
      const fSpese = d.fogli.find((f) => f.nome === 'Spese')!;
      expect(fSpese.righe).toHaveLength(5);
      expect(fSpese.righe.reduce((s, r) => s + Number(r[5]), 0)).toBeCloseTo(147.2, 2);
      const xlsx = await costruisciXlsx(d);
      expect(xlsx.subarray(0, 2).toString()).toBe('PK'); // un .xlsx è uno zip
      const csv = costruisciCsv(fSpese);
      expect(csv.startsWith('﻿')).toBe(true);
      expect(csv).toContain('45,2'); // decimali con la virgola
      expect(csv.split('\r\n')[0]).toContain(';');
    } finally {
      const mie = (await db.select({ id: spese.id }).from(spese).where(gte(spese.data, '2099-01-01'))).map((x) => x.id);
      if (mie.length) await db.delete(cestino).where(inArray(cestino.entita_id, mie)); // solo il cestino delle spese di questo test
      await db.delete(spese).where(gte(spese.data, '2099-01-01'));
      if (ricIds.length) await db.delete(speseRicorrenti).where(inArray(speseRicorrenti.id, ricIds));
      if (prenId) await db.delete(prenotazioni).where(eq(prenotazioni.id, prenId));
      if (ospId) await db.delete(ospiti).where(eq(ospiti.id, ospId));
    }
  }, 180_000);
});
