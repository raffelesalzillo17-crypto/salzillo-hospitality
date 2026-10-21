import { describe, it, expect } from 'vitest';
import {
  periodiSiSovrappongono, validaPeriodo, statoBlocca, eErroreVincoloSovrapposizione,
  messaggioOccupazioni, ErroreDate, STATI_NON_BLOCCANTI,
} from '../src/lib/db/disponibilita';

const P = (checkin: string, checkout: string) => ({ checkin, checkout });

describe('periodiSiSovrappongono (notti [checkin, checkout))', () => {
  it('stesso periodo: si sovrappongono', () => {
    expect(periodiSiSovrappongono(P('2026-11-10', '2026-11-14'), P('2026-11-10', '2026-11-14'))).toBe(true);
  });
  it('sovrapposizione parziale in entrambe le direzioni', () => {
    expect(periodiSiSovrappongono(P('2026-11-10', '2026-11-14'), P('2026-11-12', '2026-11-16'))).toBe(true);
    expect(periodiSiSovrappongono(P('2026-11-12', '2026-11-16'), P('2026-11-10', '2026-11-14'))).toBe(true);
  });
  it('uno contenuto nell\'altro', () => {
    expect(periodiSiSovrappongono(P('2026-11-10', '2026-11-20'), P('2026-11-12', '2026-11-14'))).toBe(true);
  });
  it('check-out = check-in del successivo: NON si sovrappongono', () => {
    expect(periodiSiSovrappongono(P('2026-11-10', '2026-11-12'), P('2026-11-12', '2026-11-14'))).toBe(false);
    expect(periodiSiSovrappongono(P('2026-11-12', '2026-11-14'), P('2026-11-10', '2026-11-12'))).toBe(false);
  });
  it('periodi distanti: nessuna sovrapposizione', () => {
    expect(periodiSiSovrappongono(P('2026-11-01', '2026-11-03'), P('2026-12-01', '2026-12-03'))).toBe(false);
  });
  it('cavallo di anno e di mese', () => {
    expect(periodiSiSovrappongono(P('2026-12-30', '2027-01-03'), P('2027-01-02', '2027-01-05'))).toBe(true);
    expect(periodiSiSovrappongono(P('2026-12-30', '2027-01-02'), P('2027-01-02', '2027-01-05'))).toBe(false);
  });
});

describe('validaPeriodo', () => {
  it('accetta date valide con check-out dopo il check-in', () => {
    expect(() => validaPeriodo('2026-11-10', '2026-11-11')).not.toThrow();
  });
  it('rifiuta check-out uguale o precedente al check-in', () => {
    expect(() => validaPeriodo('2026-11-10', '2026-11-10')).toThrow(ErroreDate);
    expect(() => validaPeriodo('2026-11-10', '2026-11-09')).toThrow(/dopo il check-in/);
  });
  it('rifiuta formati non ISO o date inesistenti', () => {
    expect(() => validaPeriodo('10/11/2026', '2026-11-12')).toThrow(ErroreDate);
    expect(() => validaPeriodo('2026-13-40', '2026-14-01')).toThrow(ErroreDate);
    expect(() => validaPeriodo('', '')).toThrow(ErroreDate);
  });
});

describe('stati che occupano l\'alloggio', () => {
  it('Attiva e In attesa di conferma bloccano le date', () => {
    expect(statoBlocca('Attiva')).toBe(true);
    expect(statoBlocca('In attesa di conferma')).toBe(true);
  });
  it('le prenotazioni cancellate o no-show non bloccano', () => {
    for (const s of STATI_NON_BLOCCANTI) expect(statoBlocca(s)).toBe(false);
    expect(STATI_NON_BLOCCANTI).toEqual(['Cancellata', 'Cancellata con penale', 'No-show']);
  });
});

describe('eErroreVincoloSovrapposizione', () => {
  it('riconosce il codice Postgres 23P01', () => {
    expect(eErroreVincoloSovrapposizione({ code: '23P01' })).toBe(true);
  });
  it('lo riconosce anche dentro una catena di cause (errori avvolti da drizzle)', () => {
    expect(eErroreVincoloSovrapposizione(new Error('Failed query', { cause: { code: '23P01' } }))).toBe(true);
  });
  it('lo riconosce dal nome del vincolo nel messaggio', () => {
    expect(eErroreVincoloSovrapposizione(new Error('violates exclusion constraint "prenotazioni_no_sovrapposizione"'))).toBe(true);
  });
  it('non scambia altri errori per una sovrapposizione', () => {
    expect(eErroreVincoloSovrapposizione(new Error('connection refused'))).toBe(false);
    expect(eErroreVincoloSovrapposizione({ code: '23505' })).toBe(false);
    expect(eErroreVincoloSovrapposizione(null)).toBe(false);
    expect(eErroreVincoloSovrapposizione('boom')).toBe(false);
  });
});

describe('messaggioOccupazioni', () => {
  it('nomina chi occupa e le date in formato italiano', () => {
    const m = messaggioOccupazioni([
      { tipo: 'prenotazione', dal: '2026-11-10', al: '2026-11-14', chi: 'Mario Rossi' },
      { tipo: 'blocco', dal: '2026-11-14', al: '2026-11-16', chi: 'blocco: manutenzione' },
    ]);
    expect(m).toContain('prenotazione di Mario Rossi dal 10/11 al 14/11');
    expect(m).toContain('blocco: manutenzione dal 14/11 al 16/11');
    expect(m.startsWith('Date non disponibili')).toBe(true);
  });
});
