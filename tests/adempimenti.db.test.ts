// Prova gli Adempimenti (stati, file Alloggiati, "inviata a mano", ritardo, Sinfonia) sul database VERO con dati
// FINTI (prenotazioni nel 2099). NON contatta mai il portale Alloggiati Web e toglie solo le righe sue.
// Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/adempimenti.db.test.ts
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

describe.skipIf(!attivo)('adempimenti (database reale, dati finti)', () => {
  it('stati, file nel tracciato ufficiale, invio a mano e annullo, ritardo, Sinfonia', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, immobili, inviiRegione, ospiti, prenotazioni, schedine } = await import('../src/lib/db/schema');
    const A = await import('../src/lib/adempimenti');
    const { SCHEDINA_RECORD_LENGTH } = await import('../src/lib/alloggiatiRecordFormat');
    const db = getDb();
    const idsPren: string[] = [];
    let osp: { id: string } | undefined;
    let immobileId = '';
    try {
      const [al] = await db.select({ id: alloggi.id, immobile: alloggi.immobile_id }).from(alloggi).where(eq(alloggi.nome, 'Il Tulipano'));
      immobileId = al.immobile;
      [osp] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoAdempimenti' }).returning();
      const pren = async (ci: string, co: string, ospitiAttesi: number, canale: 'Diretto' | 'No Tax' = 'Diretto') => {
        const [p] = await db.insert(prenotazioni).values({ alloggio_id: al.id, ospite_id: osp!.id, checkin: ci, checkout: co, canale, lordo: '1', numero_ospiti: ospitiAttesi }).returning();
        idsPren.push(p.id); return p;
      };
      const completa = (pid: string, extra: Record<string, unknown> = {}) => db.insert(schedine).values({
        prenotazione_id: pid, ospite_id: osp!.id, cognome: 'FintoAdempimenti', nome: 'Uno', sesso: 'M', data_nascita: '1980-01-01',
        stato_nascita_codice: '100000215', cittadinanza_codice: '100000215', tipo_documento_codice: 'IDENT', numero_documento: 'FAKE123456',
        luogo_rilascio_documento: '100000215', tipo_alloggiato_codice: '16', stato: 'Da inviare', ...extra,
      } as never);

      const pA = await pren('2099-01-10', '2099-01-12', 1); await completa(pA.id);                       // pronta
      const pB = await pren('2099-02-10', '2099-02-12', 2); await completa(pB.id);                       // 2 ospiti, 1 schedina
      const pC = await pren('2099-03-10', '2099-03-12', 1); await completa(pC.id, { numero_documento: null }); // manca il documento
      const pD = await pren('2099-04-10', '2099-04-12', 1, 'No Tax'); await completa(pD.id);             // non soggetta
      const pE = await pren('2099-05-10', '2099-05-12', 1); await completa(pE.id, { stato: 'Inviata', inviata_il: new Date() }); // già inviata
      const pF = await pren('2099-06-10', '2099-06-12', 1);                                             // nessuna schedina

      const prima = Date.parse('2099-01-01T00:00:00Z');
      const arrivi = await A.arriviAdempimenti('2099-01-01', '2099-06-30', prima);
      const per = (id: string) => arrivi.find((x) => x.prenotazioneId === id)!;
      expect(per(pA.id).stato).toBe('Pronta');
      expect(per(pB.id).stato).toBe('Da preparare');
      expect(per(pB.id).motivi.join(' ')).toContain('2 ospiti');
      expect(per(pC.id).stato).toBe('Da preparare');
      expect(per(pC.id).motivi.join(' ')).toContain('numero del documento mancante');
      expect(per(pD.id).stato).toBe('Non soggetta');
      expect(per(pE.id).stato).toBe('Inviata');
      expect(per(pF.id).stato).toBe('Da preparare');
      expect(per(pF.id).motivi.join(' ')).toContain('Nessuna schedina');
      expect(per(pA.id).inRitardo).toBe(false);

      // il file: solo le pronte, record da 168 caratteri, CRLF
      const file = await A.generaFileAlloggiati([pA.id, pB.id, pC.id, pD.id, pE.id], '2099-01-01');
      expect(file.prenotazioniInFile).toBe(1);
      expect(file.schedineInFile).toBe(1);
      expect(file.saltate.map((s) => s.prenotazioneId).sort()).toEqual([pB.id, pC.id, pD.id, pE.id].sort());
      const righe = file.contenuto.split('\r\n').filter(Boolean);
      expect(righe).toHaveLength(1);
      expect(righe[0]).toHaveLength(SCHEDINA_RECORD_LENGTH);
      expect(righe[0].startsWith('16')).toBe(true);          // tipo: ospite singolo
      expect(righe[0].slice(2, 12)).toBe('10/01/2099');      // data arrivo
      expect(righe[0].slice(12, 14)).toBe('02');             // giorni di permanenza (campo numerico, con lo zero davanti)
      expect(file.contenuto.endsWith('\r\n')).toBe(true);

      // in ritardo / in scadenza (si passa l'ora a mano: nessuna dipendenza dalla data di oggi)
      const tardi = await A.arriviAdempimenti('2099-01-01', '2099-01-31', Date.parse('2099-01-20T00:00:00Z'));
      expect(tardi.find((x) => x.prenotazioneId === pA.id)!.inRitardo).toBe(true);
      const avvisi = await A.avvisiAdempimenti('2099-01-20', Date.parse('2099-01-20T00:00:00Z'));
      expect(avvisi.some((x) => x.prenotazioneId === pA.id)).toBe(true);
      const vigilia = await A.avvisiAdempimenti('2099-01-09', Date.parse('2099-01-10T08:00:00Z')); // arrivo oggi, mancano meno di 24 ore
      expect(vigilia.some((x) => x.prenotazioneId === pA.id)).toBe(true);
      const lontano = await A.avvisiAdempimenti('2099-01-01', Date.parse('2099-01-01T08:00:00Z'));
      expect(lontano.some((x) => x.prenotazioneId === pA.id)).toBe(false);

      // inviata a mano, poi annullata
      const m = await A.segnaInviataAMano(pA.id);
      expect(m.aggiornate).toBe(1);
      expect((await A.arriviAdempimenti('2099-01-01', '2099-01-31', prima)).find((x) => x.prenotazioneId === pA.id)!.stato).toBe('Inviata');
      await expect(A.segnaInviataAMano(pA.id)).rejects.toThrow('già tutta inviata');
      await expect(A.annullaInvioAMano(pE.id)).rejects.toThrow('segnato a mano'); // quella inviata davvero NON si annulla da qui
      await A.annullaInvioAMano(pA.id);
      expect((await A.arriviAdempimenti('2099-01-01', '2099-01-31', prima)).find((x) => x.prenotazioneId === pA.id)!.stato).toBe('Pronta');

      // Sinfonia: stato mensile (si prova su un anno fittizio e si toglie la riga)
      const s0 = await A.statoSinfonia(2099, 12);
      const mio = s0.find((x) => x.immobileId === immobileId);
      expect(mio?.mesi).toHaveLength(12);
      expect(mio!.mesi[0].stato).toBe('Da generare');
      await A.segnaSinfoniaInviato(immobileId, 2099, 1, true);
      expect((await A.statoSinfonia(2099, 12)).find((x) => x.immobileId === immobileId)!.mesi[0].stato).toBe('Inviato');
      await A.segnaSinfoniaInviato(immobileId, 2099, 1, false);
      expect((await A.statoSinfonia(2099, 12)).find((x) => x.immobileId === immobileId)!.mesi[0].stato).toBe('Da generare');
    } finally {
      if (idsPren.length) { await db.delete(schedine).where(inArray(schedine.prenotazione_id, idsPren)); await db.delete(prenotazioni).where(inArray(prenotazioni.id, idsPren)); }
      if (osp) await db.delete(ospiti).where(eq(ospiti.id, osp.id));
      if (immobileId) await db.delete(inviiRegione).where(eq(inviiRegione.anno, 2099));
      void immobili;
    }
  }, 180_000);
});
