import { describe, it, expect } from 'vitest';
import { leggiCsv, numeroIt, dataIso, proponiMappa, interpretaEstratto, chiaveImport, suggerisciCategoria, prossimaData, dateDaGenerare } from '../src/lib/estrattoConto';

describe('leggiCsv', () => {
  it('separatore ; con virgolette e BOM', () => {
    const r = leggiCsv('﻿Data;Descrizione;Importo\n03/11/2026;"Bolletta; luce";-45,20\n');
    expect(r).toEqual([['Data', 'Descrizione', 'Importo'], ['03/11/2026', 'Bolletta; luce', '-45,20']]);
  });
  it('separatore , e virgolette doppie dentro il campo', () => {
    expect(leggiCsv('a,b\n"dice ""ciao""",2')[1]).toEqual(['dice "ciao"', '2']);
  });
});

describe('numeroIt e dataIso', () => {
  it('importi in vari formati', () => {
    expect(numeroIt('1.234,56')).toBe(1234.56);
    expect(numeroIt('-12,30')).toBe(-12.3);
    expect(numeroIt('€ 12,30')).toBe(12.3);
    expect(numeroIt('(12,30)')).toBe(-12.3);
    expect(numeroIt('1,234.50')).toBe(1234.5);
    expect(numeroIt('45,20-')).toBe(-45.2);
    expect(numeroIt('abc')).toBeNull();
    expect(numeroIt('')).toBeNull();
  });
  it('date in vari formati, e rifiuta quelle impossibili', () => {
    expect(dataIso('03/11/2026')).toBe('2026-11-03');
    expect(dataIso('3-11-26')).toBe('2026-11-03');
    expect(dataIso('2026-11-03')).toBe('2026-11-03');
    expect(dataIso('31/02/2026')).toBeNull();
    expect(dataIso('ieri')).toBeNull();
  });
});

describe('interpretaEstratto', () => {
  const csv = 'Data;Descrizione;Importo\n03/11/2026;ENEL ENERGIA luce;-45,20\n04/11/2026;Bonifico da ospite;120,00\n05/11/2026;;-9,90\n99/99/2026;errore;-1,00\n06/11/2026;Rata;\n';
  it('tiene solo le uscite, conta le entrate e segnala le righe scartate', () => {
    const righe = leggiCsv(csv);
    const m = proponiMappa(righe);
    expect(m.intestazione).toBe(true);
    const e = interpretaEstratto(righe, m);
    expect(e.uscite.map((x) => [x.data, x.importo])).toEqual([['2026-11-03', 45.2], ['2026-11-05', 9.9]]);
    expect(e.uscite[1].descrizione).toBe('(senza descrizione)');
    expect(e.entrate).toBe(1);
    expect(e.ignorate.map((x) => x.riga)).toEqual([5, 6]);
  });
  it('colonne dare/avere separate', () => {
    const righe = leggiCsv('Data;Causale;Dare;Avere\n01/10/2026;Acqua;30,00;\n02/10/2026;Incasso;;80,00');
    const e = interpretaEstratto(righe, proponiMappa(righe));
    expect(e.uscite).toHaveLength(1);
    expect(e.uscite[0].importo).toBe(30);
    expect(e.entrate).toBe(1);
  });
  it('la stessa riga ha sempre la stessa chiave di import', () => {
    expect(chiaveImport('2026-11-03', 45.2, 'ENEL  Energia, luce')).toBe(chiaveImport('2026-11-03', 45.2, 'enel energia luce'));
    expect(chiaveImport('2026-11-03', 45.2, 'a')).not.toBe(chiaveImport('2026-11-04', 45.2, 'a'));
  });
});

describe('suggerisciCategoria', () => {
  const cat = [{ id: 'u', nome: 'Utenze' }, { id: 'm', nome: 'Manutenzione' }, { id: 't', nome: 'Tasse' }];
  it('impara dalle spese già registrate', () => {
    expect(suggerisciCategoria('Pagamento Rossi Idraulica', [{ descrizione: 'Rossi idraulica riparazione', categoriaId: 'm' }], cat).categoriaId).toBe('m');
  });
  it('usa le parole chiave note', () => {
    expect(suggerisciCategoria('ENEL ENERGIA SPA', [], cat).categoriaId).toBe('u');
    expect(suggerisciCategoria('F24 versamento', [], cat).categoriaId).toBe('t');
  });
  it('non indovina se non sa', () => {
    expect(suggerisciCategoria('Cena con amici', [], cat).categoriaId).toBeNull();
  });
});

describe('spese ricorrenti', () => {
  it('mantiene il giorno e accorcia nei mesi corti', () => {
    expect(prossimaData('2026-01-31', 'Mensile', 31)).toBe('2026-02-28');
    expect(prossimaData('2026-02-28', 'Mensile', 31)).toBe('2026-03-31');
    expect(prossimaData('2026-11-15', 'Trimestrale', 15)).toBe('2027-02-15');
    expect(prossimaData('2026-06-10', 'Annuale', 10)).toBe('2027-06-10');
  });
  it('genera tutte le date arretrate fino a oggi e rispetta la fine', () => {
    const r = dateDaGenerare('2026-09-05', 'Mensile', 5, '2026-11-23');
    expect(r.date).toEqual(['2026-09-05', '2026-10-05', '2026-11-05']);
    expect(r.prossimaDopo).toBe('2026-12-05');
    expect(dateDaGenerare('2026-09-05', 'Mensile', 5, '2026-11-23', '2026-10-31').date).toEqual(['2026-09-05', '2026-10-05']);
    expect(dateDaGenerare('2026-12-05', 'Mensile', 5, '2026-11-23').date).toEqual([]);
  });
});
