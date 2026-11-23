import { describe, it, expect } from 'vitest';
import { differenzePreventivoPrenotazione, preventivoBloccato } from '../src/lib/preventiviRegole';

const p = { alloggioId: 'a1', checkin: '2026-12-10', checkout: '2026-12-12', numeroOspiti: 2, ospiteId: 'o1', totale: 300 };
const b = { alloggioId: 'a1', checkin: '2026-12-10', checkout: '2026-12-12', numeroOspiti: 2, ospiteId: 'o1', lordo: 300, stato: 'Attiva' };

describe('preventivo e prenotazione', () => {
  it('nessuna differenza se coincidono', () => {
    expect(differenzePreventivoPrenotazione(p, b)).toEqual([]);
    expect(differenzePreventivoPrenotazione(p, { ...b, lordo: 300.004 })).toEqual([]); // i centesimi arrotondati non contano
  });
  it('segnala ogni differenza, una per una', () => {
    const d = differenzePreventivoPrenotazione(p, { ...b, lordo: 250, checkin: '2026-12-11', numeroOspiti: 3, alloggioId: 'a2', ospiteId: 'o2' }, { alloggioPreventivo: 'Il Tulipano', alloggioPrenotazione: 'Stanza Rosa' });
    expect(d).toHaveLength(5);
    expect(d.join('|')).toContain('Alloggio: preventivo Il Tulipano, prenotazione Stanza Rosa');
    expect(d.join('|')).toContain('Arrivo: preventivo 10/12/2026, prenotazione 11/12/2026');
    expect(d.join('|')).toContain('Ospiti: preventivo 2, prenotazione 3');
    expect(d.join('|')).toContain('Importo: preventivo 300,00 €, prenotazione 250,00 €');
  });
  it('segnala una prenotazione cancellata', () => {
    expect(differenzePreventivoPrenotazione(p, { ...b, stato: 'Cancellata' }).join()).toContain('cancellata');
  });
  it('un preventivo accettato o già legato a una prenotazione è bloccato', () => {
    expect(preventivoBloccato('Accettato', null)).toBe(true);
    expect(preventivoBloccato('Bozza', 'x')).toBe(true);
    expect(preventivoBloccato('Inviato', null)).toBe(false);
  });
});
