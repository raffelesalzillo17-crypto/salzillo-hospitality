import { describe, it, expect } from 'vitest';
import { formatSchedinaRecord, validateSchedina, SCHEDINA_RECORD_LENGTH, type DatiSchedina } from '../src/lib/alloggiatiRecordFormat';
import { CODICE_ITALIA } from '../src/lib/alloggiatiTabelle';

const capofamiglia: DatiSchedina = {
  tipoAlloggiato: '16', dataArrivo: '21/10/2026', numeroGiorniPermanenza: 3,
  cognome: 'Rossi', nome: 'Mario', sesso: '1', dataNascita: '01/02/1980',
  comuneNascita: '412059999', provinciaNascita: 'CE', statoNascita: CODICE_ITALIA, cittadinanza: CODICE_ITALIA,
  tipoDocumento: 'IDENT', numeroDocumento: 'AX1234567', luogoRilascioDocumento: '412059999',
};

describe('tracciato schedina Alloggiati Web (168 caratteri)', () => {
  it('produce sempre esattamente 168 caratteri', () => {
    expect(SCHEDINA_RECORD_LENGTH).toBe(168);
    expect(formatSchedinaRecord(capofamiglia)).toHaveLength(168);
  });

  it('campi nelle posizioni del tracciato ufficiale', () => {
    const r = formatSchedinaRecord(capofamiglia);
    expect(r.slice(0, 2)).toBe('16');                      // tipo alloggiato
    expect(r.slice(2, 12)).toBe('21/10/2026');             // data arrivo
    expect(r.slice(12, 14)).toBe('03');                    // giorni: numerico, zeri a sinistra
    expect(r.slice(14, 64)).toBe('Rossi'.padEnd(50, ' ')); // cognome: testo, spazi a destra
    expect(r.slice(64, 94)).toBe('Mario'.padEnd(30, ' '));
    expect(r.slice(94, 95)).toBe('1');                     // sesso
    expect(r.slice(95, 105)).toBe('01/02/1980');
    expect(r.slice(105, 114)).toBe('412059999');
    expect(r.slice(114, 116)).toBe('CE');
    expect(r.slice(116, 125)).toBe(CODICE_ITALIA.padEnd(9, ' '));
    expect(r.slice(134, 139)).toBe('IDENT');
    expect(r.slice(139, 159)).toBe('AX1234567'.padEnd(20, ' '));
  });

  it('per i familiari (19/20) i campi documento restano vuoti anche se passati', () => {
    const r = formatSchedinaRecord({ ...capofamiglia, tipoAlloggiato: '19' });
    expect(r.slice(134, 168).trim()).toBe('');
  });

  it('rifiuta dati non validi invece di troncarli in silenzio', () => {
    expect(() => formatSchedinaRecord({ ...capofamiglia, cognome: 'X'.repeat(51) })).toThrow(/troppo lungo/);
    expect(() => formatSchedinaRecord({ ...capofamiglia, numeroGiorniPermanenza: 31 })).toThrow(/1-30/);
    expect(() => formatSchedinaRecord({ ...capofamiglia, dataArrivo: '2026-10-21' })).toThrow(/gg\/mm\/aaaa/);
  });
});

describe('validateSchedina', () => {
  it('dati corretti: nessun errore', () => {
    expect(validateSchedina(capofamiglia)).toEqual([]);
  });
  it('capofamiglia senza tipo documento: errore', () => {
    expect(validateSchedina({ ...capofamiglia, tipoDocumento: '' }).join(' ')).toMatch(/Tipo Documento mancante/);
  });
  it('nato in Italia senza comune o provincia: errore', () => {
    const e = validateSchedina({ ...capofamiglia, comuneNascita: '', provinciaNascita: '' }).join(' ');
    expect(e).toMatch(/Comune Nascita mancante/);
    expect(e).toMatch(/Provincia Nascita mancante/);
  });
  it('sesso, tipo alloggiato e giorni fuori range sono segnalati', () => {
    const e = validateSchedina({
      ...capofamiglia, sesso: '3' as '1', tipoAlloggiato: '99' as '16', numeroGiorniPermanenza: 0,
    }).join(' ');
    expect(e).toMatch(/Sesso non valido/);
    expect(e).toMatch(/Tipo Alloggiato non valido/);
    expect(e).toMatch(/fuori range/);
  });
});
