import { describe, it, expect } from 'vitest';
import { CHECKLIST_PREDEFINITA, checklistDi, oggiRoma, oraValida, puoSegnarsiFatta, urgenzaPulizia } from '../src/lib/pulizieRegole';

describe('regole delle pulizie', () => {
  it('si può segnare fatta solo dal giorno del check-out', () => {
    expect(puoSegnarsiFatta('2026-11-24', '2026-11-23')).toBe(false);
    expect(puoSegnarsiFatta('2026-11-23', '2026-11-23')).toBe(true);
    expect(puoSegnarsiFatta('2026-11-20', '2026-11-23')).toBe(true);
  });
  it('urgenza: stesso giorno, presto, nessuna', () => {
    expect(urgenzaPulizia('2026-11-23', '2026-11-23')).toBe('stesso-giorno');
    expect(urgenzaPulizia('2026-11-23', '2026-11-24')).toBe('presto');
    expect(urgenzaPulizia('2026-11-23', '2026-11-25')).toBe('presto');
    expect(urgenzaPulizia('2026-11-23', '2026-11-30')).toBeNull();
    expect(urgenzaPulizia('2026-11-23', null)).toBeNull();
  });
  it('checklist: voci dell\'alloggio o predefinite', () => {
    expect(checklistDi(null)).toEqual(CHECKLIST_PREDEFINITA);
    expect(checklistDi('  \n ')).toEqual(CHECKLIST_PREDEFINITA);
    expect(checklistDi('Biancheria\r\nCaffè\n\nBiancheria')).toEqual(['Biancheria', 'Caffè']);
  });
  it('orario valido o errore chiaro', () => {
    expect(oraValida('')).toBeNull();
    expect(oraValida('09:05')).toBe('09:05');
    expect(() => oraValida('25:00')).toThrow('Orario non valido');
    expect(() => oraValida('9.30')).toThrow('Orario non valido');
  });
  it('oggi a Roma ha il formato AAAA-MM-GG', () => {
    expect(oggiRoma(new Date('2026-11-23T23:30:00Z'))).toBe('2026-11-24'); // a mezzanotte e mezza a Roma è già il giorno dopo
    expect(oggiRoma(new Date('2026-07-01T10:00:00Z'))).toBe('2026-07-01');
  });
});
