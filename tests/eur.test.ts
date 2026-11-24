import { describe, it, expect } from 'vitest';
import { eur } from '../src/app/nuovo/utilita';

describe('formato euro', () => {
  it('punto delle migliaia, virgola dei decimali, segno meno', () => {
    expect(eur(1471)).toBe('1.471,00\u00a0€');
    expect(eur(875.67)).toBe('875,67\u00a0€');
    expect(eur(1234567.5)).toBe('1.234.567,50\u00a0€');
    expect(eur(0)).toBe('0,00\u00a0€');
    expect(eur(-20)).toBe('-20,00\u00a0€');
  });
});
