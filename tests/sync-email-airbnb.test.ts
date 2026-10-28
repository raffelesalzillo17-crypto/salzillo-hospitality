import { describe, it, expect } from 'vitest';
import { parseAirbnbEmail, extractGuestName } from '../src/lib/airbnbEmail';

// Prove "cattive" sul lettore delle conferme Airbnb (26/10/2026, dopo la prenotazione di Giuseppe del
// 24/10 non registrata). Ogni test dice cosa DOVREBBE succedere: se fallisce, è un difetto.

function email(opzioni: { nome?: string; marker?: string; checkin?: string; checkout?: string; totale?: string; titolo?: string } = {}): string {
  const { nome = 'Giuseppe Zampella', marker = 'Identità verificata · 4 recensioni', checkin = 'sab 24 ott', checkout = 'dom 25 ott', totale = '60,00 €', titolo = 'Il Tulipano Camera con bagno privato a Marcianise' } = opzioni;
  return `Airbnb
Nuova prenotazione confermata! Giuseppe arriverà il 24 ott.

${nome}

${marker}

Caserta, Italia
${titolo}
Stanza

Check-in

${checkin}

15:00

Check-out

${checkout}

10:00

Ospiti
1 adulto
Codice di conferma
HM353YWJXC
L'ospite ha pagato
60,00 € x 1 notte
Totale (EUR)
${totale}
Compenso dell'host
`;
}
const arrivata = new Date('2026-10-24T02:30:00Z');

describe('email Airbnb vera (24/10)', () => {
  it('si legge per intero', () => {
    const r = parseAirbnbEmail(email(), arrivata);
    expect(r.missing).toEqual([]);
    expect(r).toMatchObject({ stanza: 'Tulipano', ospite: 'Giuseppe Zampella', checkinISO: '2026-10-24', checkoutISO: '2026-10-25', lordo: 60 });
  });
});

describe('nomi degli ospiti', () => {
  it.each([
    ["Giuseppe D'Amico"], ['Jean-Luc Picard'], ['Maria De Luca'], ['Hans Müller'], ['Łukasz Nowak'], ['Mario Mc Donald'], ['Ana María'], ['Giuseppe Zampella'],
  ])('%s', (nome) => {
    expect(extractGuestName(email({ nome }))).toBe(nome);
  });

  it.each([['Identità non verificata · 0 recensioni'], ['Nuovo su Airbnb'], ['Identità verificata · 1 recensione'], ['Identity verified · 4 reviews']])('marcatore "%s"', (marker) => {
    expect(extractGuestName(email({ marker }))).toBe('Giuseppe Zampella');
  });
});

describe('date', () => {
  it('cambio d\'anno', () => {
    const r = parseAirbnbEmail(email({ checkin: 'mer 30 dic', checkout: 'ven 1 gen' }), new Date('2026-12-20T10:00:00Z'));
    expect([r.checkinISO, r.checkoutISO]).toEqual(['2026-12-30', '2027-01-01']);
  });
  it('mese in inglese (se Airbnb manda l\'email in inglese)', () => {
    const r = parseAirbnbEmail(email({ checkin: 'Sat 24 Oct', checkout: 'Sun 25 Oct' }), arrivata);
    expect(r.checkinISO).toBe('2026-10-24');
  });
  it('mese scritto per esteso', () => {
    const r = parseAirbnbEmail(email({ checkin: 'sabato 24 ottobre', checkout: 'domenica 25 ottobre' }), arrivata);
    expect(r.checkinISO).toBe('2026-10-24');
  });
  it('prenotazione fatta di notte a cavallo di mezzanotte (UTC)', () => {
    // Email delle 00:30 italiane del 24 = 22:30 UTC del 23: il check-in del 24 non deve slittare all'anno dopo
    const r = parseAirbnbEmail(email(), new Date('2026-10-23T22:30:00Z'));
    expect(r.checkinISO).toBe('2026-10-24');
  });
});

describe('prezzo', () => {
  it.each([['1.234,50 €', 1234.5], ['60 €', 60], ['60,00 €', 60], ['€ 60,00', 60], ['60,00 EUR', 60]])('%s', (totale, atteso) => {
    expect(parseAirbnbEmail(email({ totale }), arrivata).lordo).toBe(atteso);
  });
});

describe('stanza', () => {
  it('Rosa', () => {
    expect(parseAirbnbEmail(email({ titolo: 'La Stanza Rosa a Marcianise' }), arrivata).stanza).toBe('Rosa');
  });
  it('un ospite che si chiama Rosa non deve cambiare la stanza', () => {
    expect(parseAirbnbEmail(email({ nome: 'Rosa Esposito' }), arrivata).stanza).toBe('Tulipano');
  });
});

// Caso reale 24/10: in produzione l'email risultò "dati incompleti (nome ospite; check-in; check-out)". Il testo
// grezzo non ha lo stesso impaginato di quello copiato da Gmail, quindi si provano più impaginati possibili.
describe('impaginati diversi del testo grezzo (caso Giuseppe)', () => {
  const oggetto = 'Prenotazione confermata - Giuseppe Zampella arriverà il 24 ott';
  const coda = 'Ospiti\n1 adulto\nCodice di conferma\nHM353YWJXC\nL\'ospite ha pagato\n60,00 € x 1 notte\nTotale (EUR)\n60,00 €\n';
  const atteso = { ospite: 'Giuseppe Zampella', stanza: 'Tulipano', checkinISO: '2026-10-24', checkoutISO: '2026-10-25', lordo: 60, codice: 'HM353YWJXC' };

  const corpi: Record<string, string> = {
    'colonne affiancate': 'Giuseppe Zampella\nIdentità verificata · 4 recensioni\nIl Tulipano Camera\nCheck-in\tCheck-out\nsab 24 ott\tdom 25 ott\n15:00\t10:00\n' + coda,
    'tutto su una riga': 'Giuseppe Zampella Identità verificata · 4 recensioni Il Tulipano Camera Check-in sab 24 ott 15:00 Check-out dom 25 ott 10:00 ' + coda.replace(/\n/g, ' '),
    'nome con link e immagine': 'Airbnb\n[image: Giuseppe Zampella]\nGiuseppe Zampella <https://www.airbnb.it/users/show/12345>\n<https://www.airbnb.it/x>\nIdentità verificata · 4 recensioni\nIl Tulipano\r\nCheck-in\r\n\r\nsab 24 ott\r\n\r\n15:00\r\n\r\nCheck-out\r\n\r\ndom 25 ott\r\n\r\n10:00\r\n' + coda,
    'date scritte per esteso': 'Giuseppe Zampella\nIdentità verificata\nIl Tulipano\nCheck-in\nsabato 24 ottobre 2026\n15:00\nCheck-out\ndomenica 25 ottobre 2026\n10:00\n' + coda,
  };
  it.each(Object.keys(corpi))('%s', (nome) => {
    expect(parseAirbnbEmail(corpi[nome], arrivata, oggetto)).toMatchObject({ complete: true, ...atteso });
  });

  it('corpo senza date né nome: bastano oggetto e notti del prezzo', () => {
    const r = parseAirbnbEmail('Il Tulipano\n' + coda, arrivata, oggetto);
    expect(r).toMatchObject({ complete: true, ...atteso });
  });
  it('senza oggetto e senza date: dice cosa manca, non inventa', () => {
    const r = parseAirbnbEmail('Il Tulipano\nTotale (EUR)\n60,00 €\n', arrivata);
    expect(r.complete).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(['nome ospite', 'check-in', 'check-out']));
  });
  it('un\'altra data nel testo dopo gli ospiti non diventa il check-out', () => {
    const r = parseAirbnbEmail('Giuseppe Zampella\nIdentità verificata\nIl Tulipano\nCheck-in\nsab 24 ott\nOspiti\n1 adulto\nCancellazione gratuita fino al 22 ott\nTotale (EUR)\n60,00 €\n', arrivata);
    expect(r.checkoutISO).toBeUndefined();
  });
});
