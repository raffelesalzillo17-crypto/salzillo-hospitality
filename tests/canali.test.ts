import { describe, it, expect } from 'vitest';
import { CANALI, CANALI_DIRETTI, canaleConIncasso } from '../src/lib/canali';
import { calcolaImportiPuri } from '../src/lib/importi';

describe('canali (punto 3)', () => {
  it('i nuovi canali diretti ci sono e No Tax resta com\'era', () => {
    expect(CANALI).toEqual(['Airbnb', 'Booking', 'Diretto', 'No Tax']);
    for (const c of ['Diretto', 'No Tax']) expect(canaleConIncasso(c)).toBe(true);
    for (const c of ['Airbnb', 'Booking']) expect(canaleConIncasso(c)).toBe(false);
    expect(CANALI_DIRETTI).not.toContain('No Tax');
  });
  it('WhatsApp, Telefono e Altro si calcolano come Diretto (nessuna commissione, cedolare come le altre dirette)', () => {
    const base = calcolaImportiPuri({ lordo: 500, canale: 'Diretto', regimeFiscale: 'Con cedolare', costoPulizia: 30, percentualeFee: 10 });
    for (const canale of ['Diretto']) {
      expect(calcolaImportiPuri({ lordo: 500, canale, regimeFiscale: 'Con cedolare', costoPulizia: 30, percentualeFee: 10 })).toEqual(base);
    }
  });
});
