import { describe, it, expect } from 'vitest';
import { calcolaImportiPuri } from '../src/lib/importi';
import { calcUtile } from '../src/lib/prenotazioni';

const base = { lordo: 100, costoPulizia: 20, percentualeFee: 0 };

describe('calcolaImportiPuri', () => {
  it('Airbnb con cedolare: commissione 18,91%, cedolare 21%, pulizia 20', () => {
    const r = calcolaImportiPuri({ ...base, canale: 'Airbnb', regimeFiscale: 'Con cedolare' });
    expect(r.commissione).toBe(18.91);
    expect(r.cedolare).toBe(21);
    expect(r.costoPulizia).toBe(20);
    expect(r.utile).toBe(40.09);
    expect(r.feeGestione).toBe(0);
    expect(r.nettoProprietario).toBe(40.09);
  });

  it('Booking con cedolare: commissione 20,15%', () => {
    const r = calcolaImportiPuri({ ...base, canale: 'Booking', regimeFiscale: 'Con cedolare' });
    expect(r.commissione).toBe(20.15);
    expect(r.utile).toBe(38.85);
  });

  it('prenotazione diretta con cedolare: nessuna commissione OTA', () => {
    const r = calcolaImportiPuri({ ...base, canale: 'Diretto', regimeFiscale: 'Con cedolare' });
    expect(r.commissione).toBe(0);
    expect(r.cedolare).toBe(21);
    expect(r.utile).toBe(59);
  });

  it('"No Tax": niente commissione né cedolare, resta solo la pulizia', () => {
    const r = calcolaImportiPuri({ ...base, canale: 'No Tax', regimeFiscale: 'Con cedolare' });
    expect(r.commissione).toBe(0);
    expect(r.cedolare).toBe(0);
    expect(r.utile).toBe(80);
  });

  it('alloggio senza cedolare: la cedolare non si applica nemmeno su Airbnb', () => {
    const r = calcolaImportiPuri({ ...base, canale: 'Airbnb', regimeFiscale: 'No tax' });
    expect(r.cedolare).toBe(0);
    expect(r.utile).toBe(61.09);
  });

  it('fee di gestione del proprietario: si calcola sul lordo e si toglie dal netto', () => {
    const r = calcolaImportiPuri({ lordo: 200, canale: 'Diretto', regimeFiscale: 'No tax', costoPulizia: 20, percentualeFee: 15 });
    expect(r.feeGestione).toBe(30);
    expect(r.utile).toBe(180);
    expect(r.nettoProprietario).toBe(150);
  });

  it('canale sconosciuto: commissione 0, nessun crash', () => {
    const r = calcolaImportiPuri({ ...base, canale: 'Sconosciuto', regimeFiscale: 'No tax' });
    expect(r.commissione).toBe(0);
    expect(r.utile).toBe(80);
  });

  it('arrotonda al centesimo senza errori di virgola mobile', () => {
    const r = calcolaImportiPuri({ lordo: 133.33, canale: 'Airbnb', regimeFiscale: 'Con cedolare', costoPulizia: 20, percentualeFee: 7.5 });
    expect(r.commissione).toBe(25.21);
    expect(r.cedolare).toBe(28);
    expect(r.feeGestione).toBe(10);
    expect(Number.isInteger(Math.round(r.utile * 100))).toBe(true);
  });
});

describe('calcUtile (lettura legacy dal foglio)', () => {
  it('"No Tax" toglie solo la pulizia', () => {
    expect(calcUtile(100, 'No Tax')).toBe(80);
  });
  it('Airbnb: commissione + cedolare + pulizia', () => {
    expect(calcUtile(100, 'Airbnb')).toBe(40.09);
  });
  // Nota di progetto: calcUtile applica la cedolare a OGNI canale diverso da "No Tax", mentre
  // calcolaImportiPuri la applica solo agli alloggi con regime "Con cedolare". Il test fissa il
  // comportamento attuale: se un giorno si unificano, questo test deve cambiare di proposito.
  it('applica la cedolare anche al canale Diretto (diverso da calcolaImportiPuri su alloggi senza cedolare)', () => {
    expect(calcUtile(100, 'Diretto')).toBe(59);
    expect(calcolaImportiPuri({ lordo: 100, canale: 'Diretto', regimeFiscale: 'No tax', costoPulizia: 20, percentualeFee: 0 }).utile).toBe(80);
  });
});
