import { describe, it, expect } from 'vitest';
import { mascheraDocumento } from '../src/lib/mascheratura';

describe('mascheraDocumento', () => {
  it('lascia solo le ultime 4 cifre di un numero normale', () => {
    expect(mascheraDocumento('AX1234567')).toBe('•••••4567');
  });
  it('lascia 3 cifre se il numero è corto', () => {
    expect(mascheraDocumento('AB123')).toBe('•••123');
  });
  it('non rivela nulla di un numero cortissimo', () => {
    expect(mascheraDocumento('AB1')).toBe('•••');
  });
  it('vuoto resta vuoto', () => {
    expect(mascheraDocumento('')).toBe('');
    expect(mascheraDocumento(null)).toBe('');
  });
});
