import { describe, it, expect, vi, afterEach } from 'vitest';

// Se un passo della sera fallisce DOPO che il sync ha già creato una prenotazione, l'avviso
// "Nuova prenotazione aggiunta" non deve andare perso (l'email risulta già segnata come gestita).
vi.mock('../src/lib/telegramDigest', () => ({
  eseguiSyncEmailPrenotazioni: vi.fn(async () => ['✅ Nuova prenotazione Airbnb aggiunta']),
  testoEventiLocali: vi.fn(async () => { throw new Error('429 quota Gemini'); }),
  testoSchedineInScadenza: vi.fn(async () => null),
  testoCheckinOggi: vi.fn(), testoCheckoutOggi: vi.fn(), testoControlloCalendari: vi.fn(),
  testoPreventiviScadenza: vi.fn(), testoPulizieDomani: vi.fn(),
}));
vi.mock('../src/lib/posta', () => ({ testoPostaInSospeso: vi.fn() }));
vi.mock('../src/lib/db/regole', () => ({ testoPromemoriaAutomatici: vi.fn() }));

import { sezioneSera } from '../src/lib/digestSezioni';

afterEach(() => vi.useRealTimers());

describe('sezione sera', () => {
  it('il lunedì, con Gemini in errore, l\'avviso della prenotazione creata non si perde', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-19T19:00:00Z')); // lunedì
    const blocchi = await sezioneSera('https://x', false).catch(() => null);
    expect(blocchi).not.toBeNull();
    expect(blocchi!.join('\n')).toContain('Nuova prenotazione Airbnb aggiunta');
  });
});
