import { describe, it, expect } from 'vitest';
import { controlloOspitiSchedine } from '../src/lib/controlloOspiti';

describe('controlloOspitiSchedine', () => {
  it('nessun avviso se le schedine sono tante quanti gli ospiti', () => {
    expect(controlloOspitiSchedine(1, 1)).toBeNull();
    expect(controlloOspitiSchedine(3, 3)).toBeNull();
  });
  it('avvisa se manca una schedina (caso reale: 2 ospiti, 1 schedina)', () => {
    const m = controlloOspitiSchedine(2, 1);
    expect(m).toContain('2 ospiti');
    expect(m).toContain('solo 1 schedina');
    expect(m).toContain('mancante');
  });
  it('avvisa se ce ne sono di troppo (caso reale: 1 ospite, 2 schedine)', () => {
    const m = controlloOspitiSchedine(1, 2);
    expect(m).toContain('1 ospite');
    expect(m).toContain('2 schedine');
  });
  it('un numero ospiti vuoto o zero vale 1', () => {
    expect(controlloOspitiSchedine(null, 1)).toBeNull();
    expect(controlloOspitiSchedine(0, 1)).toBeNull();
    expect(controlloOspitiSchedine(undefined, 2)).not.toBeNull();
  });
});
