import { describe, it, expect, vi, beforeEach } from 'vitest';

// Registrazione nel database di una prenotazione letta dall'email Airbnb — con database, Calendar e
// foglio FINTI: nessuna scrittura vera.
const { risultati, aggiornamenti, creaPrenotazione } = vi.hoisted(() => ({ risultati: [] as unknown[][], aggiornamenti: [] as unknown[], creaPrenotazione: vi.fn(async (..._a: unknown[]) => ({ id: 'p1' })) }));
vi.mock('../src/lib/db/index', () => ({
  getDb: () => ({
    select: () => ({ from: () => { const w = { where: () => ({ limit: async () => risultati.shift() ?? [], then: (f: (v: unknown) => unknown) => f(risultati.shift() ?? []) }) }; return { ...w, innerJoin: () => w }; } }),
    update: () => ({ set: (v: unknown) => { aggiornamenti.push(v); return { where: async () => undefined }; } }),
  }),
}));
vi.mock('../src/lib/db/mutations', () => ({ creaPrenotazione }));
vi.mock('../src/lib/db/importDaSheets', () => ({
  ALLOGGI_SEED: [{ nome: 'Il Tulipano', foglio: 'Tulipano' }, { nome: 'Stanza Rosa', foglio: 'Rosa' }],
}));

import { registraPrenotazioneAirbnb, dividiNomeOspite } from '../src/lib/db/prenotazioneDaEmail';
import { parseAirbnbEmail } from '../src/lib/airbnbEmail';

const dati = { ospite: 'Giuseppe Zampella', stanza: 'Tulipano', checkinISO: '2026-10-24', checkoutISO: '2026-10-25', lordo: 60, codice: 'HM353YWJXC' };
beforeEach(() => { risultati.length = 0; aggiornamenti.length = 0; creaPrenotazione.mockClear(); });

describe('registraPrenotazioneAirbnb', () => {
  it('crea la prenotazione con codice di conferma e canale Airbnb', async () => {
    risultati.push([], [{ id: 'alloggio-1' }], [], []); // nessun codice già presente, alloggio trovato, nessuna prenotazione uguale, ospite nuovo
    const r = await registraPrenotazioneAirbnb(dati);
    expect(r.esito).toBe('creata');
    expect(creaPrenotazione).toHaveBeenCalledWith(expect.objectContaining({
      alloggioId: 'alloggio-1', ospiteNome: 'Giuseppe', ospiteCognome: 'Zampella', checkin: '2026-10-24', checkout: '2026-10-25',
      canale: 'Airbnb', lordo: 60, codiceConfermaCanale: 'HM353YWJXC',
    }));
  });
  it('lo stesso codice di conferma non si registra due volte', async () => {
    risultati.push([{ id: 'esistente' }]);
    expect((await registraPrenotazioneAirbnb(dati)).esito).toBe('gia-presente');
    expect(creaPrenotazione).not.toHaveBeenCalled();
  });
  it('un ospite già in anagrafica viene riusato', async () => {
    risultati.push([], [{ id: 'alloggio-1' }], [], [{ id: 'ospite-9' }]);
    await registraPrenotazioneAirbnb(dati);
    expect(creaPrenotazione).toHaveBeenCalledWith(expect.objectContaining({ ospiteId: 'ospite-9' }));
  });
  it('stessa prenotazione già inserita a mano (senza codice): non è una doppia, si aggancia il codice', async () => {
    risultati.push([], [{ id: 'alloggio-1' }], [{ id: 'manuale-1', codice: null }]);
    expect((await registraPrenotazioneAirbnb(dati)).esito).toBe('gia-presente');
    expect(creaPrenotazione).not.toHaveBeenCalled();
    expect(aggiornamenti).toEqual([{ codice_conferma_canale: 'HM353YWJXC' }]);
  });
  it('stanza sconosciuta: errore, non una prenotazione sbagliata', async () => {
    risultati.push([]);
    await expect(registraPrenotazioneAirbnb({ ...dati, stanza: 'Garage' })).rejects.toThrow(/Stanza sconosciuta/);
    expect(creaPrenotazione).not.toHaveBeenCalled();
  });
});

describe('nomi e codice', () => {
  it('divide nome e cognome', () => {
    expect(dividiNomeOspite('Maria De Luca')).toEqual({ nome: 'Maria', cognome: 'De Luca' });
    expect(dividiNomeOspite('Madonna')).toEqual({ nome: 'Madonna', cognome: '(da completare)' });
  });
  it('legge il codice di conferma dall\'email', () => {
    const corpo = 'Giuseppe Zampella\n\nIdentità verificata · 4 recensioni\nIl Tulipano\nCheck-in\n\nsab 24 ott\n\n15:00\n\nCheck-out\n\ndom 25 ott\n\n10:00\nCodice di conferma\nHM353YWJXC\nTotale (EUR)\n60,00 €\n';
    expect(parseAirbnbEmail(corpo, new Date('2026-10-24T02:30:00Z')).codice).toBe('HM353YWJXC');
  });
});
