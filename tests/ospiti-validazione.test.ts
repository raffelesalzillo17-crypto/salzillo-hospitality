// Un dato sbagliato viene rifiutato PRIMA di toccare il database o i fogli: nessun accesso esterno in questi casi.
import { describe, it, expect } from 'vitest';
import { creaOspite, aggiornaOspite } from '../src/lib/db/mutations';

describe('creaOspite / aggiornaOspite rifiutano i dati sbagliati con un messaggio chiaro', () => {
  it('telefono non valido', async () => {
    await expect(creaOspite({ nome: 'Prova', cognome: 'Finto', telefono: '12ab' })).rejects.toThrow('formato internazionale');
    await expect(aggiornaOspite('00000000-0000-0000-0000-000000000000', { telefono: '999' })).rejects.toThrow('formato internazionale');
  });
  it('email non valida', async () => {
    await expect(creaOspite({ nome: 'Prova', cognome: 'Finto', email: 'non-una-email' })).rejects.toThrow('email non valido');
  });
  it('codice fiscale con carattere finale sbagliato', async () => {
    await expect(creaOspite({ nome: 'Prova', cognome: 'Finto', codiceFiscale: 'RSSMRA80A01H501A' })).rejects.toThrow('ultimo carattere');
  });
});
