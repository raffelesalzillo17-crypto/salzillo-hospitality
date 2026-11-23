// Prova la proposta/applicazione di cancellazione delle copie dei documenti sul database VERO con dati
// FINTI (prenotazione nel 2099, nessun file su Drive), e poi toglie solo le righe create dal test.
// Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/conservazione.db.test.ts
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

const giornoRoma = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

describe.skipIf(!attivo)('conservazione documenti (database reale, dati finti)', () => {
  it('propone solo se tutto è inviato e c\'è la ricevuta; poi cancella copie e numeri', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, ospiti, prenotazioni, schedine, documenti } = await import('../src/lib/db/schema');
    const { valutaPerTest, applicaConservazione } = await import('../src/lib/conservazione');
    const db = getDb();

    const [al] = await db.select({ id: alloggi.id }).from(alloggi).where(eq(alloggi.nome, 'Il Tulipano'));
    const [osp] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoConservazione' }).returning();
    const [pren] = await db.insert(prenotazioni).values({
      alloggio_id: al.id, ospite_id: osp.id, checkin: '2099-01-10', checkout: '2099-01-12', canale: 'Diretto', lordo: '1',
    }).returning();
    try {
      const ora = new Date();
      const sch = await db.insert(schedine).values([
        { prenotazione_id: pren.id, ospite_id: osp.id, cognome: 'FintoConservazione', nome: 'Uno', numero_documento: 'FAKE000111', luogo_rilascio_documento: 'Comune Finto', stato: 'Inviata', inviata_il: ora },
        { prenotazione_id: pren.id, ospite_id: osp.id, cognome: 'FintoConservazione', nome: 'Due', numero_documento: 'FAKE000222', stato: 'Inviata', inviata_il: ora },
      ]).returning();
      const [copia] = await db.insert(documenti).values({ tipo: 'Documento identità', nome: 'finto.jpg', ospite_id: osp.id, prenotazione_id: pren.id }).returning();

      // 1) senza ricevuta salvata: NON proponibile
      let v = await valutaPerTest(pren.id);
      expect(v.ok).toBe(false);
      expect(!v.ok && v.motivo).toContain('Manca la ricevuta');

      // 2) con la ricevuta del giorno: proponibile
      const [ric] = await db.insert(documenti).values({
        tipo: 'Ricevuta Alloggiati', nome: `Ricevuta Alloggiati ${giornoRoma(ora)}.pdf`, ospite_id: osp.id, prenotazione_id: pren.id, drive_file_id: 'finto-ricevuta',
      }).returning();
      v = await valutaPerTest(pren.id);
      expect(v.ok).toBe(true);
      expect(v.ok && v.proposta.copieDocumento).toBe(1);
      expect(v.ok && v.proposta.schedineConNumero).toBe(2);

      // 3) una schedina ancora da inviare: NON proponibile, e applica rifiuta
      await db.update(schedine).set({ stato: 'Da inviare', inviata_il: null }).where(eq(schedine.id, sch[1].id));
      v = await valutaPerTest(pren.id);
      expect(v.ok).toBe(false);
      await expect(applicaConservazione(pren.id)).rejects.toThrow('Non si può procedere');
      expect((await db.select().from(documenti).where(eq(documenti.id, copia.id))).length).toBe(1);
      await db.update(schedine).set({ stato: 'Inviata', inviata_il: ora }).where(eq(schedine.id, sch[1].id));

      // 4) applica: copie cancellate, numeri tolti, ricevuta intatta
      const esito = await applicaConservazione(pren.id);
      expect(esito.copieEliminate).toBe(1);
      expect(esito.schedineAnonimizzate).toBe(2);
      expect((await db.select().from(documenti).where(eq(documenti.id, copia.id))).length).toBe(0);
      expect((await db.select().from(documenti).where(eq(documenti.id, ric.id))).length).toBe(1);
      const dopo = await db.select().from(schedine).where(eq(schedine.prenotazione_id, pren.id));
      expect(dopo.every((s) => !s.numero_documento && !s.luogo_rilascio_documento)).toBe(true);
      expect(dopo.every((s) => s.cognome === 'FintoConservazione')).toBe(true); // nome e cognome restano
      v = await valutaPerTest(pren.id);
      expect(v.ok).toBe(false); // ora non c'è più niente da togliere
    } finally {
      await db.delete(documenti).where(eq(documenti.prenotazione_id, pren.id));
      await db.delete(schedine).where(eq(schedine.prenotazione_id, pren.id));
      await db.delete(prenotazioni).where(eq(prenotazioni.id, pren.id));
      await db.delete(ospiti).where(inArray(ospiti.id, [osp.id]));
    }
  }, 60_000);
});
