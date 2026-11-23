import { describe, it, expect } from 'vitest';
import { validaTelefono, validaEmail, validaCodiceFiscale, carattereControlloCF, trovaGruppiDuplicati, sembraInvertito, sembraDiProva, chiaveNomeFoglio } from '../src/lib/ospitiQualita';

describe('validaTelefono', () => {
  it('porta tutto al formato internazionale', () => {
    expect(validaTelefono('333 1234567')).toEqual({ ok: true, valore: '+393331234567' });
    expect(validaTelefono('+39 333 123 4567')).toEqual({ ok: true, valore: '+393331234567' });
    expect(validaTelefono('0039 333-1234567')).toEqual({ ok: true, valore: '+393331234567' });
    expect(validaTelefono('393331234567')).toEqual({ ok: true, valore: '+393331234567' });
    expect(validaTelefono('081 1234567')).toEqual({ ok: true, valore: '+390811234567' });
  });
  it('accetta numeri esteri col +', () => {
    expect(validaTelefono('+44 7911 123456')).toEqual({ ok: true, valore: '+447911123456' });
  });
  it('vuoto è valido', () => {
    expect(validaTelefono('')).toEqual({ ok: true, valore: null });
    expect(validaTelefono(null)).toEqual({ ok: true, valore: null });
  });
  it('rifiuta con un messaggio chiaro', () => {
    for (const x of ['abc', '12345', '+39 12', '333 12a4567', '+', '3331234567890123']) {
      const r = validaTelefono(x);
      expect(r.ok).toBe(false);
      expect(!r.ok && r.errore).toContain('formato internazionale');
    }
  });
});

describe('validaEmail', () => {
  it('valida e normalizza', () => {
    expect(validaEmail(' Mario@Esempio.IT ')).toEqual({ ok: true, valore: 'mario@esempio.it' });
    expect(validaEmail('')).toEqual({ ok: true, valore: null });
  });
  it('rifiuta quelle sbagliate', () => {
    for (const x of ['mario', 'mario@', '@esempio.it', 'mario@esempio', 'ma rio@esempio.it']) expect(validaEmail(x).ok).toBe(false);
  });
});

describe('validaCodiceFiscale', () => {
  // Codice fiscale di esempio pubblico (non di una persona reale), costruito calcolando il carattere finale.
  const base = 'RSSMRA80A01H501';
  const buono = base + carattereControlloCF(base);
  it('accetta un codice con il carattere finale giusto', () => {
    expect(validaCodiceFiscale(buono)).toEqual({ ok: true, valore: buono });
    expect(validaCodiceFiscale(buono.toLowerCase())).toEqual({ ok: true, valore: buono });
  });
  it('conosce il caso di riferimento RSSMRA80A01H501 → carattere U', () => {
    expect(carattereControlloCF('RSSMRA80A01H501')).toBe('U');
  });
  it('rifiuta se il carattere finale è sbagliato', () => {
    const sbagliato = base + (buono.endsWith('A') ? 'B' : 'A');
    const r = validaCodiceFiscale(sbagliato);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errore).toContain('ultimo carattere');
  });
  it('rifiuta il formato sbagliato e accetta il vuoto', () => {
    expect(validaCodiceFiscale('12345').ok).toBe(false);
    expect(validaCodiceFiscale('')).toEqual({ ok: true, valore: null });
  });
});

describe('trovaGruppiDuplicati', () => {
  const o = (id: string, nome: string, cognome: string, telefono: string | null = null) => ({ id, nome, cognome, telefono });
  it('stesso telefono', () => {
    const g = trovaGruppiDuplicati([o('1', 'Mario', 'Rossi', '+393331234567'), o('2', 'M.', 'Rosi', '333 1234567'), o('3', 'Anna', 'Bianchi', '+393339999999')]);
    expect(g).toHaveLength(1);
    expect(g[0].ids.sort()).toEqual(['1', '2']);
    expect(g[0].motivi).toContain('stesso telefono');
  });
  it('stesso nome anche scambiato', () => {
    const g = trovaGruppiDuplicati([o('1', 'Mario', 'Rossi'), o('2', 'Rossi', 'Mario'), o('3', 'Luca', 'Verdi')]);
    expect(g).toHaveLength(1);
    expect(g[0].motivi.join()).toContain('scambiati');
  });
  it('errore di battitura, ma non se i telefoni sono diversi', () => {
    expect(trovaGruppiDuplicati([o('1', 'Veronica', 'Palmieri', '+393331111111'), o('2', 'Veronica', 'Palmiero', '+393332222222')])).toHaveLength(0);
    expect(trovaGruppiDuplicati([o('1', 'Veronica', 'Palmieri'), o('2', 'Veronica', 'Palmiero')])).toHaveLength(1);
  });
  it('solo il nome contro nome e cognome', () => {
    const g = trovaGruppiDuplicati([o('1', 'Luca', ''), o('2', 'Luca', 'Vannucci')]);
    expect(g).toHaveLength(1);
    expect(trovaGruppiDuplicati([o('1', 'Luca', '', '+393331111111'), o('2', 'Luca', 'Vannucci', '+393332222222')])).toHaveLength(0);
  });
  it('persone diverse con lo stesso nome e telefoni diversi non si accoppiano per un cognome simile', () => {
    expect(trovaGruppiDuplicati([o('1', 'Giuseppe', 'Tartaglione', '+393331111111'), o('2', 'Giuseppe', 'Sanfilippo', '+393332222222')])).toHaveLength(0);
  });
});

describe('altre utilità', () => {
  it('riconosce un nome scritto al contrario', () => {
    expect(sembraInvertito('Rossi', 'Maria')).toBe(true);
    expect(sembraInvertito('Maria', 'Rossi')).toBe(false);
    expect(sembraInvertito('', 'Maria')).toBe(false);
  });
  it('riconosce i record di prova', () => {
    expect(sembraDiProva('TEST SYNC', 'PAGAMENTO')).toBe(true);
    expect(sembraDiProva('__TEST', 'no-auth__')).toBe(true);
    expect(sembraDiProva('Mario', 'Rossi')).toBe(false);
    expect(sembraDiProva('Contestabile', 'Prova')).toBe(true);
    expect(sembraDiProva('Contestabile', 'Rossi')).toBe(false);
  });
  it('la chiave del foglio è nome e cognome in minuscolo', () => {
    expect(chiaveNomeFoglio('Mario', 'Rossi')).toBe('mario rossi');
    expect(chiaveNomeFoglio('Luca', '')).toBe('luca');
  });
});
