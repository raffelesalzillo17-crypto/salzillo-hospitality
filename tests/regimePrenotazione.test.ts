import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { esclusaDaAdempimenti, regimeValido } from '../src/lib/regimePrenotazione';
import { calcolaImportiPuri } from '../src/lib/importi';

describe('regime fiscale della prenotazione (punto 3)', () => {
  it('No Tax resta escluso sia come canale sia come regime', () => {
    expect(esclusaDaAdempimenti('No Tax', 'Ordinario')).toBe(true);
    expect(esclusaDaAdempimenti('Diretto', 'No Tax')).toBe(true);
    expect(esclusaDaAdempimenti('Diretto', 'Ordinario')).toBe(false);
    expect(esclusaDaAdempimenti('Airbnb', 'Esente da tassa di soggiorno')).toBe(false);
    expect(regimeValido('boh')).toBe('Ordinario');
  });
  it('senza cedolare se il regime è No Tax, anche con un canale vero: i totali tornano come prima', () => {
    const base = { lordo: 500, regimeFiscale: 'Con cedolare', costoPulizia: 30, percentualeFee: 10 };
    const prima = calcolaImportiPuri({ ...base, canale: 'No Tax' });
    const dopo = calcolaImportiPuri({ ...base, canale: 'Diretto', regimePrenotazione: 'No Tax' });
    expect(dopo).toEqual(prima);
    expect(dopo.cedolare).toBe(0);
    expect(calcolaImportiPuri({ ...base, canale: 'Diretto', regimePrenotazione: 'Ordinario' }).cedolare).toBeGreaterThan(0);
  });
});

function urlDb(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try { return fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g, '') ?? null; } catch { return null; }
}
const url = urlDb();
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!(process.env.RUN_DB_TESTS === '1' && url))('migrazione No Tax (database reale, dati finti)', () => {
  it('anteprima, spostamento del canale e regime che resta', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, immobili, ospiti, prenotazioni } = await import('../src/lib/db/schema');
    const { anteprimaNoTax, applicaNoTax } = await import('../src/lib/db/migrazioneNoTax');
    const db = getDb();
    let alId = '', ospId = '', prenId = '';
    try {
      const [imm] = await db.select({ id: immobili.id }).from(immobili).limit(1);
      const [al] = await db.insert(alloggi).values({ immobile_id: imm.id, nome: 'FintoAlloggioNoTax' }).returning(); alId = al.id;
      const [o] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoNoTax' }).returning(); ospId = o.id;
      const [b] = await db.insert(prenotazioni).values({ alloggio_id: alId, ospite_id: ospId, checkin: '2099-07-10', checkout: '2099-07-12', canale: 'No Tax', regime_prenotazione: 'No Tax', lordo: '200', numero_ospiti: 2 }).returning(); prenId = b.id;
      const anteprima = await anteprimaNoTax();
      expect(anteprima.find((x) => x.id === prenId)).toMatchObject({ canaleProposto: 'Diretto', alloggio: 'FintoAlloggioNoTax' });
      await expect(applicaNoTax([{ id: prenId, canale: 'Inventato' }])).rejects.toThrow('Canale non valido');
      expect((await db.select().from(prenotazioni).where(eq(prenotazioni.id, prenId)))[0].canale).toBe('No Tax'); // niente si è mosso
      expect(await applicaNoTax([{ id: prenId, canale: 'WhatsApp' }])).toEqual({ spostate: 1, invariate: 0 });
      const dopo = (await db.select().from(prenotazioni).where(eq(prenotazioni.id, prenId)))[0];
      expect(dopo.canale).toBe('WhatsApp');
      expect(dopo.regime_prenotazione).toBe('No Tax');
      expect(Number(dopo.lordo)).toBe(200); // importi intatti
      expect(await applicaNoTax([{ id: prenId, canale: 'Telefono' }])).toEqual({ spostate: 0, invariate: 1 }); // non più No Tax: non si tocca
      expect((await anteprimaNoTax()).find((x) => x.id === prenId)).toBeUndefined();
    } finally {
      if (prenId) await db.delete(prenotazioni).where(eq(prenotazioni.id, prenId));
      if (ospId) await db.delete(ospiti).where(eq(ospiti.id, ospId));
      if (alId) await db.delete(alloggi).where(eq(alloggi.id, alId));
    }
  }, 120_000);
});
