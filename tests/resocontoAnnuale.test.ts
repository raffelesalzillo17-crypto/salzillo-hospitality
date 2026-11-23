import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { confrontoAnni, costruisciResoconto, fogliResoconto, nottiNelMese, tassaPrenotazione, type RigaResoconto } from '../src/lib/resocontoAnnuale';

const r = (o: Partial<RigaResoconto> = {}): RigaResoconto => ({
  checkin: '2026-03-10', checkout: '2026-03-13', canale: 'Diretto', alloggio: 'A', ospiti: 2, lordo: 300, impostaImporto: 2, impostaMaxNotti: null, ...o,
});

describe('resoconto annuale', () => {
  it('tassa: notti (max dell\'alloggio) × ospiti × importo', () => {
    expect(tassaPrenotazione(r())).toBe(12);
    expect(tassaPrenotazione(r({ impostaMaxNotti: 2 }))).toBe(8);
    expect(tassaPrenotazione(r({ impostaImporto: 0 }))).toBe(0);
  });
  it('notti a cavallo di due mesi', () => {
    const x = { checkin: '2026-03-30', checkout: '2026-04-03' };
    expect(nottiNelMese(x, 2026, 3)).toBe(2);
    expect(nottiNelMese(x, 2026, 4)).toBe(2);
    expect(nottiNelMese(x, 2026, 5)).toBe(0);
    expect(nottiNelMese({ checkin: '2026-12-30', checkout: '2027-01-02' }, 2026, 12)).toBe(2);
  });
  it('totali = somma dei mesi; incassi per canale e tassa per alloggio', () => {
    const c = costruisciResoconto(2026, [r(), r({ checkin: '2026-04-01', checkout: '2026-04-02', canale: 'Airbnb', alloggio: 'B', lordo: 100, ospiti: 1 })], 2);
    expect(c.totali).toMatchObject({ prenotazioni: 2, lordo: 400, tassa: 14, nottiOccupate: 4 });
    expect(c.mesi[2]).toMatchObject({ prenotazioni: 1, lordo: 300, tassa: 12, nottiOccupate: 3 });
    expect(c.perCanale).toEqual([{ canale: 'Airbnb', prenotazioni: 1, lordo: 100 }, { canale: 'Diretto', prenotazioni: 1, lordo: 300 }]);
    expect(c.tassaPerAlloggio.find((x) => x.alloggio === 'A')).toMatchObject({ totale: 12 });
    expect(c.mesi[2].occupazione).toBe(Math.round((3 / (2 * 31)) * 1000) / 10);
  });
  it('una prenotazione con check-in l\'anno prima conta solo nelle notti, non nell\'incasso', () => {
    const c = costruisciResoconto(2026, [r({ checkin: '2025-12-30', checkout: '2026-01-03', lordo: 500 })], 1);
    expect(c.totali.lordo).toBe(0);
    expect(c.mesi[0].nottiOccupate).toBe(2);
  });
  it('confronto e fogli', () => {
    const a = costruisciResoconto(2026, [r({ lordo: 300 })], 1), b = costruisciResoconto(2025, [r({ checkin: '2025-03-10', checkout: '2025-03-13', lordo: 200 })], 1);
    expect(confrontoAnni(a, b).lordo).toEqual({ corrente: 300, precedente: 200, differenza: 100, percentuale: 50 });
    expect(confrontoAnni(a, costruisciResoconto(2025, [], 1)).lordo.percentuale).toBeNull();
    const fogli = fogliResoconto(a, b);
    expect(fogli.map((f) => f.nome)).toEqual(['Mesi', 'Per canale', 'Per regime fiscale', 'Tassa per alloggio', 'Confronto']);
    expect(fogli[0].righe).toHaveLength(13);
  });
});

function urlDb(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try { return fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g, '') ?? null; } catch { return null; }
}
const url = urlDb();
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!(process.env.RUN_DB_TESTS === '1' && url))('resoconto annuale = Dashboard (sola lettura, dati veri)', () => {
  it('lordo, tassa e occupazione di ogni mese coincidono con la Dashboard', async () => {
    const { leggiResoconto } = await import('../src/lib/db/resocontoAnnuale');
    const { riepilogoDashboard } = await import('../src/lib/db/dashboard');
    const res = await leggiResoconto(2026, 'tutti');
    for (const mese of [1, 6, 9, 11]) {
      const dash = await riepilogoDashboard(2026, mese, null, 'tutti');
      const m = res.mesi[mese - 1];
      expect(m.lordo).toBeCloseTo(dash.totali.lordo, 2);
      expect(m.tassa).toBeCloseTo(dash.totali.tassaRiscossa, 2);
      expect(m.prenotazioni).toBe(dash.totali.prenotazioni);
      expect(m.nottiOccupate).toBe(dash.totali.nottiOccupate);
      expect(m.occupazione).toBe(dash.totali.occupazione);
    }
  }, 120_000);
});
