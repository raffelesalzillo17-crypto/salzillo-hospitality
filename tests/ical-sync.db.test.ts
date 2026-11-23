// Prova la sincronizzazione iCal sul database VERO con un alloggio FINTO e un feed finto (nessuna rete, nessuna prenotazione
// segnaposto creata, quindi niente scritture su Calendar o fogli). Date nel 2099. Toglie solo le righe sue. Si esegue solo con:
//   RUN_DB_TESTS=1 npx vitest run tests/ical-sync.db.test.ts
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

const ICS = (ev: { s: string; e: string; t?: string }[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...ev.flatMap((x) => ['BEGIN:VEVENT', `DTSTART;VALUE=DATE:${x.s.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${x.e.replace(/-/g, '')}`, `SUMMARY:${x.t ?? 'Reserved'}`, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');

describe.skipIf(!attivo)('sincronizzazione iCal (database reale, alloggio e feed finti)', () => {
  it('sovrapposizioni, sparite, tornate, registro, errori e link protetto', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, calendariIcal, conflittiCalendario, immobili, ospiti, prenotazioni, syncIcalLog } = await import('../src/lib/db/schema');
    const I = await import('../src/lib/db/ical');
    const { cosaMancaBlocchi } = await import('../src/lib/db/dashboard');
    const db = getDb();
    let alId = ''; let ospId = ''; const idsPren: string[] = [];
    try {
      const [imm] = await db.select({ id: immobili.id }).from(immobili).limit(1);
      const [al] = await db.insert(alloggi).values({ immobile_id: imm.id, nome: 'FintoAlloggioIcal' }).returning(); alId = al.id;
      const [o] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoIcal' }).returning(); ospId = o.id;
      const pren = async (ci: string, co: string, canale: 'Booking' | 'Diretto') => { const [p] = await db.insert(prenotazioni).values({ alloggio_id: alId, ospite_id: ospId, checkin: ci, checkout: co, canale, lordo: '1' }).returning(); idsPren.push(p.id); return p; };
      const b1 = await pren('2099-03-10', '2099-03-12', 'Booking');   // coincide col feed
      const b2 = await pren('2099-03-05', '2099-03-07', 'Booking');   // non è nel feed → sparita
      const d1 = await pren('2099-03-20', '2099-03-22', 'Diretto');   // il feed ha un evento che si accavalla → doppia vendita
      const b3 = await pren('2099-03-30', '2099-04-01', 'Booking');   // il feed ha date diverse
      await db.insert(calendariIcal).values({ alloggio_id: alId, nome: 'Booking', url: 'http://prova.invalid/feed.ics' });

      const feed1 = ICS([{ s: '2099-03-10', e: '2099-03-12' }, { s: '2099-03-15', e: '2099-03-17' }, { s: '2099-03-21', e: '2099-03-24' }, { s: '2099-03-30', e: '2099-04-02' }, { s: '2099-03-25', e: '2099-03-27', t: 'Prenotato (Salzillo Hospitality)' }]);
      const opz = { oggi: '2099-03-01', importa: false, origine: 'automatica' as const };
      const [e1] = await I.controllaCalendariAlloggio(alId, { ...opz, scarica: async () => feed1 });
      expect(e1.errore).toBeUndefined();
      expect(e1.eventiLetti).toBe(5);
      expect(e1.mancano.map((x) => x.start)).toEqual(['2099-03-15']);           // non importata (test): resta "mancano"
      expect(e1.importate).toHaveLength(0);
      expect(e1.conflitti.map((x) => x.tipo).sort()).toEqual(['date diverse', 'doppia']);
      expect(e1.inPiu.map((x) => x.start)).toEqual(['2099-03-05']);               // b2 sparita
      const aperti = await db.select().from(conflittiCalendario).where(eq(conflittiCalendario.alloggio_id, alId));
      expect(aperti).toHaveLength(2);
      expect(aperti.every((x) => x.risolto_il === null)).toBe(true);
      const [b2dopo] = await db.select().from(prenotazioni).where(eq(prenotazioni.id, b2.id));
      expect(b2dopo.da_verificare).toBe(true);
      expect(b2dopo.stato).toBe('Attiva');                                         // MAI cancellata da sola
      expect(b2dopo.da_verificare_motivo).toContain('Sparita dal calendario Booking');
      const [b1dopo] = await db.select().from(prenotazioni).where(eq(prenotazioni.id, b1.id));
      expect(b1dopo.da_verificare).toBe(false);

      // il registro e la Dashboard
      const log = await I.leggiLogSync(alId);
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({ esito: 'avvisi', origine: 'automatica', eventi_letti: 5, conflitti: 2, da_verificare: 1 });
      const blocchi = await cosaMancaBlocchi('2099-03-01', 'tutti', false);
      expect(blocchi.sovrapposizioni.some((x) => x.alloggio === 'FintoAlloggioIcal' && x.testo.includes('doppia vendita'))).toBe(true);
      expect(blocchi.daVerificare.map((x) => x.id)).toContain(b2.id);

      // secondo giro: stesse cose, niente duplicati né nuove marcature
      await I.controllaCalendariAlloggio(alId, { ...opz, scarica: async () => feed1 });
      expect(await db.select().from(conflittiCalendario).where(eq(conflittiCalendario.alloggio_id, alId))).toHaveLength(2);
      expect(await I.leggiLogSync(alId)).toHaveLength(2);

      // terzo giro: il problema si sistema (b2 torna nel feed, niente più accavallamenti) → conflitti chiusi e segno tolto
      const feed2 = ICS([{ s: '2099-03-05', e: '2099-03-07' }, { s: '2099-03-10', e: '2099-03-12' }, { s: '2099-03-30', e: '2099-04-01' }]);
      const [e3] = await I.controllaCalendariAlloggio(alId, { ...opz, scarica: async () => feed2 });
      expect(e3.conflitti).toHaveLength(0);
      expect((await db.select().from(conflittiCalendario).where(eq(conflittiCalendario.alloggio_id, alId))).every((x) => x.risolto_il !== null)).toBe(true);
      expect((await db.select().from(prenotazioni).where(eq(prenotazioni.id, b2.id)))[0].da_verificare).toBe(false);

      // un feed vuoto o in errore NON segna niente
      const [e4] = await I.controllaCalendariAlloggio(alId, { ...opz, scarica: async () => ICS([]) });
      expect(e4.feedVuoto).toBe(true);
      expect(e4.inPiu).toHaveLength(0);
      const [e5] = await I.controllaCalendariAlloggio(alId, { ...opz, scarica: async () => { throw new Error('HTTP 503'); } });
      expect(e5.errore).toContain('503');
      expect((await I.leggiLogSync(alId, 1))[0]).toMatchObject({ esito: 'errore', errore: 'HTTP 503' });
      expect((await db.select().from(prenotazioni).where(inArray(prenotazioni.id, idsPren))).every((p) => !p.da_verificare)).toBe(true);
      void b3; void d1;

      // link di export: senza token resta aperto (compatibilità), con token serve quello giusto, rigenerando il vecchio muore
      expect(await I.accessoIcalConsentito(alId, null)).toBe(true);
      const t1 = await I.rigeneraTokenIcal(alId);
      expect(t1.length).toBeGreaterThanOrEqual(30);
      expect(await I.accessoIcalConsentito(alId, null)).toBe(false);
      expect(await I.accessoIcalConsentito(alId, 'sbagliato')).toBe(false);
      expect(await I.accessoIcalConsentito(alId, t1)).toBe(true);
      const t2 = await I.rigeneraTokenIcal(alId);
      expect(t2).not.toBe(t1);
      expect(await I.accessoIcalConsentito(alId, t1)).toBe(false);
      expect(await I.accessoIcalConsentito(alId, t2)).toBe(true);
      expect(await I.accessoIcalConsentito('00000000-0000-0000-0000-000000000000', null)).toBe(false);
    } finally {
      if (alId) {
        await db.delete(conflittiCalendario).where(eq(conflittiCalendario.alloggio_id, alId));
        await db.delete(syncIcalLog).where(eq(syncIcalLog.alloggio_id, alId));
        await db.delete(calendariIcal).where(eq(calendariIcal.alloggio_id, alId));
      }
      if (idsPren.length) await db.delete(prenotazioni).where(inArray(prenotazioni.id, idsPren));
      if (ospId) await db.delete(ospiti).where(eq(ospiti.id, ospId));
      if (alId) await db.delete(alloggi).where(eq(alloggi.id, alId));
    }
  }, 240_000);
});
