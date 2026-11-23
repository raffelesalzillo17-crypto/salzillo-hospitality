import { describe, it, expect } from 'vitest';
import { chiaveTitoloScadenza, prossimaScadenza, trovaDuplicatiScadenze } from '../src/lib/scadenzeRegole';

describe('scadenze: regole pure', () => {
  it('la stessa scadenza scritta in modi diversi ha la stessa chiave', () => {
    expect(chiaveTitoloScadenza('Cedolare secca — 1° acconto')).toBe(chiaveTitoloScadenza('cedolare  secca - 1 acconto'));
    expect(chiaveTitoloScadenza('Imposta di soggiorno — versamento')).not.toBe(chiaveTitoloScadenza('Cedolare secca — 1° acconto'));
  });
  it('la data successiva parte dalla data PREVISTA, non da quando la si fa', () => {
    expect(prossimaScadenza('2026-11-30', 'Annuale')).toBe('2027-11-30');
    expect(prossimaScadenza('2026-10-16', 'Mensile')).toBe('2026-11-16');
    expect(prossimaScadenza('2026-01-31', 'Mensile')).toBe('2026-02-28');
    expect(prossimaScadenza('2026-06-30', 'Semestrale')).toBe('2026-12-30');
    expect(prossimaScadenza('2026-06-30', 'Una tantum')).toBeNull();
  });
  it('trova i doppioni (anche con un ente solo da una parte) ma non enti diversi né le archiviate', () => {
    const v = (id: string, titolo: string, ente: string | null, stato = 'Aperta') => ({ id, titolo, ente, ricorrenza: 'Annuale', origine: 'Database', stato });
    const g = trovaDuplicatiScadenze([
      v('1', 'Cedolare secca — 1° acconto', 'Agenzia delle Entrate'), v('2', 'Cedolare secca — 1° acconto', null),
      v('3', 'Versamento', 'Comune'), v('4', 'Versamento', 'Regione Campania'),
      v('5', 'Rinnovo CIN', 'Ministero del Turismo'), v('6', 'Rinnovo CIN', 'Ministero del Turismo', 'Fatta'),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].ids.sort()).toEqual(['1', '2']);
  });
});
