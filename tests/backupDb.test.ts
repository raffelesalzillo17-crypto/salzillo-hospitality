import { describe, it, expect } from 'vitest';


import { impacchetta, spacchetta, decifra } from '../src/lib/backupCifratura';

describe('backup cifrato', () => {
  const chiave = 'x'.repeat(40);
  const tabelle = { ospiti: [{ id: 1, nome: 'Finto Nome', nato: new Date('2000-01-01') }], pagamenti: [] };

  it('si decifra con la chiave giusta e il testo non si legge nel file', () => {
    const blob = impacchetta(tabelle, chiave);
    expect(blob.toString('latin1')).not.toContain('Finto');
    const r = spacchetta(blob, chiave);
    expect(r.versione).toBe(1);
    expect(r.tabelle.ospiti[0]).toMatchObject({ id: 1, nome: 'Finto Nome' });
  });

  it('con una chiave sbagliata fallisce', () => {
    expect(() => decifra(impacchetta(tabelle, chiave), 'y'.repeat(40))).toThrow();
  });

  it('rifiuta una chiave troppo corta', () => {
    expect(() => impacchetta(tabelle, 'corta')).toThrow();
  });
});
