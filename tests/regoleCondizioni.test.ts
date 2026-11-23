import { describe, it, expect } from 'vitest';
import { condizioneVera, pianifica, riepilogoSoggiorno, rispettaFiltri, type AttivitaEsistente, type Regola, type Soggiorno } from '../src/lib/regole';

const soggiorno = (o: Partial<Soggiorno> = {}): Soggiorno => ({
  prenotazioneId: 'p1', alloggioId: 'a1', alloggioNome: 'Il Tulipano', checkin: '2026-12-20', checkout: '2026-12-22', canale: 'Diretto',
  ospiteNome: 'Prova', ospiteCognome: 'Finta', telefono: '+393331112222', creatoIl: new Date('2026-11-01T10:00:00Z'),
  documentiCaricati: false, caparraIncassata: false, saldoResiduo: 200, ...o,
});
const regola = (o: Partial<Regola> = {}): Regola => ({
  id: 'r1', nome: 'Documenti', attiva: true, evento: 'Check-in', offsetGiorni: -3, ora: '10:00', azione: 'Messaggio ospite',
  modello: 'Ciao {nome}, servono i documenti per {alloggio} del {checkin}', alloggioId: null, canale: null, minNotti: null, condizione: 'documenti-mancanti', ...o,
});
const adesso = new Date('2026-12-10T09:00:00Z');

describe('condizioni delle regole', () => {
  it('documenti: vale solo se mancano', () => {
    expect(condizioneVera('documenti-mancanti', soggiorno({ documentiCaricati: false }))).toBe(true);
    expect(condizioneVera('documenti-mancanti', soggiorno({ documentiCaricati: true }))).toBe(false);
    expect(condizioneVera('documenti-mancanti', soggiorno({ documentiCaricati: undefined }))).toBe(false); // dato ignoto: niente messaggio a caso
  });
  it('caparra e saldo valgono solo per le prenotazioni dirette', () => {
    expect(condizioneVera('caparra-da-incassare', soggiorno())).toBe(true);
    expect(condizioneVera('caparra-da-incassare', soggiorno({ caparraIncassata: true }))).toBe(false);
    expect(condizioneVera('caparra-da-incassare', soggiorno({ canale: 'Airbnb' }))).toBe(false);
    expect(condizioneVera('saldo-da-incassare', soggiorno({ saldoResiduo: 0 }))).toBe(false);
    expect(condizioneVera('saldo-da-incassare', soggiorno({ canale: 'Booking' }))).toBe(false);
    expect(condizioneVera('saldo-da-incassare', soggiorno())).toBe(true);
  });
  it('senza condizione vale sempre; il motore scarta le regole a condizione falsa', () => {
    expect(condizioneVera(null, soggiorno())).toBe(true);
    expect(rispettaFiltri(regola(), soggiorno({ documentiCaricati: true }))).toBe(false);
    const ops = pianifica({ regole: [regola()], soggiorni: [soggiorno({ documentiCaricati: true })], esistenti: [], adesso, extra: () => ({}) });
    expect(ops).toEqual([]);
    const ops2 = pianifica({ regole: [regola()], soggiorni: [soggiorno()], esistenti: [], adesso, extra: () => ({}) });
    expect(ops2).toHaveLength(1);
  });
  it('se i documenti arrivano dopo, l\'attività aperta si annulla', () => {
    const esistente: AttivitaEsistente = { id: 'x', regolaId: 'r1', alloggioId: 'a1', checkin: '2026-12-20', scadenza: new Date('2026-12-17T09:00:00Z'), stato: 'Da fare', testo: 't' };
    const ops = pianifica({ regole: [regola()], soggiorni: [soggiorno({ documentiCaricati: true })], esistenti: [esistente], adesso, extra: () => ({}) });
    expect(ops).toEqual([{ tipo: 'annulla', id: 'x' }]);
  });
});

describe('riepilogo per prenotazione', () => {
  const rie = (s: Soggiorno, r: Regola[], esistenti: AttivitaEsistente[] = []) => riepilogoSoggiorno({ regole: r, soggiorno: s, esistenti, adesso, extra: {} });
  it('spiega perché non serve', () => {
    const [x] = rie(soggiorno({ documentiCaricati: true }), [regola()]);
    expect(x).toMatchObject({ stato: 'Non necessario', motivo: 'documenti già caricati' });
    const [y] = rie(soggiorno({ canale: 'Airbnb' }), [regola({ condizione: 'caparra-da-incassare' })]);
    expect(y.motivo).toContain('Airbnb');
  });
  it('in programma, pronto, inviato, saltato', () => {
    expect(rie(soggiorno(), [regola()])[0].stato).toBe('In programma');
    const base = { id: 'x', regolaId: 'r1', alloggioId: 'a1', checkin: '2026-12-20', testo: 'testo' };
    expect(rie(soggiorno(), [regola()], [{ ...base, scadenza: new Date('2026-12-10T08:00:00Z'), stato: 'Da fare' }])[0].stato).toBe('Pronto');
    expect(rie(soggiorno(), [regola()], [{ ...base, scadenza: new Date('2026-12-10T08:00:00Z'), stato: 'Fatta' }])[0].stato).toBe('Inviato');
    expect(rie(soggiorno(), [regola()], [{ ...base, scadenza: new Date('2026-12-10T08:00:00Z'), stato: 'Saltata' }])[0].stato).toBe('Saltato');
  });
  it('bloccato se manca il contatto o un segnaposto', () => {
    const base = { id: 'x', regolaId: 'r1', alloggioId: 'a1', checkin: '2026-12-20', testo: 'testo', scadenza: new Date('2026-12-10T08:00:00Z'), stato: 'Da fare' as const };
    const [a] = rie(soggiorno({ telefono: null, email: null }), [regola()], [base]);
    expect(a).toMatchObject({ stato: 'Bloccato' });
    expect(a.motivo).toContain('telefono');
    const [b] = rie(soggiorno({ telefono: null, email: 'a@b.it' }), [regola()], [base]);
    expect(b.stato).toBe('Pronto'); // con l'email si può scrivere lo stesso
    const [c] = rie(soggiorno(), [regola({ modello: 'Ciao {nome} {link_checkin}' })]);
    expect(c).toMatchObject({ stato: 'Bloccato', motivo: 'manca: link_checkin' });
  });
  it('ignora regole disattivate o fuori filtro', () => {
    expect(rie(soggiorno(), [regola({ attiva: false })])).toEqual([]);
    expect(rie(soggiorno(), [regola({ canale: 'Airbnb' })])).toEqual([]);
  });
});
