import { describe, it, expect } from 'vitest';
import {
  aggiungiGiorni, nottiTra, istanteRoma, dataRoma, fineGiornoRoma, scadenzaRegola, rispettaFiltri,
  riempiModello, variabiliSoggiorno, pianifica,
  type Regola, type Soggiorno, type AttivitaEsistente,
} from '../src/lib/regole';

const regolaBase: Regola = {
  id: 'R1', nome: 'Benvenuto', attiva: true, evento: 'Check-in', offsetGiorni: -1, ora: '10:00',
  azione: 'Messaggio ospite', modello: 'Ciao {nome}, benvenuto a {alloggio} dal {checkin} al {checkout}',
  alloggioId: null, canale: null, minNotti: null,
};
const sogg = (o: Partial<Soggiorno> = {}): Soggiorno => ({
  prenotazioneId: 'P1', alloggioId: 'A1', alloggioNome: 'Il Tulipano', checkin: '2026-11-10', checkout: '2026-11-12',
  canale: 'Airbnb', ospiteNome: 'Mario', ospiteCognome: 'Rossi', telefono: '+39 333 1234567',
  creatoIl: new Date('2026-10-01T08:00:00Z'), ...o,
});
const adesso = new Date('2026-11-01T09:00:00Z');
const extra = () => ({});

describe('date e fuso orario (Europe/Rome)', () => {
  it('aggiunge giorni anche a cavallo di mese e anno', () => {
    expect(aggiungiGiorni('2026-11-30', 1)).toBe('2026-12-01');
    expect(aggiungiGiorni('2026-12-31', 1)).toBe('2027-01-01');
    expect(aggiungiGiorni('2026-11-10', -1)).toBe('2026-11-09');
  });
  it('conta le notti', () => {
    expect(nottiTra('2026-11-10', '2026-11-12')).toBe(2);
    expect(nottiTra('2026-10-30', '2026-11-02')).toBe(3);
  });
  it('ora solare (inverno): le 10:00 italiane sono le 09:00 UTC', () => {
    expect(istanteRoma('2026-11-09', '10:00').toISOString()).toBe('2026-11-09T09:00:00.000Z');
  });
  it('ora legale (estate): le 10:00 italiane sono le 08:00 UTC', () => {
    expect(istanteRoma('2026-07-15', '10:00').toISOString()).toBe('2026-07-15T08:00:00.000Z');
  });
  it('giorno del cambio ora legale (25/10/2026): 10:00 sono già ora solare', () => {
    expect(istanteRoma('2026-10-25', '10:00').toISOString()).toBe('2026-10-25T09:00:00.000Z');
    expect(istanteRoma('2026-10-24', '10:00').toISOString()).toBe('2026-10-24T08:00:00.000Z');
  });
  it('dataRoma: dopo mezzanotte italiana è già il giorno dopo', () => {
    expect(dataRoma(new Date('2026-11-09T23:30:00Z'))).toBe('2026-11-10');
    expect(dataRoma(new Date('2026-11-09T22:30:00Z'))).toBe('2026-11-09');
  });
  it('fine giornata italiana', () => {
    expect(fineGiornoRoma('2026-11-09').toISOString()).toBe('2026-11-09T22:59:59.999Z');
  });
});

describe('scadenza di una regola', () => {
  it('Check-in, un giorno prima alle 10:00', () => {
    expect(scadenzaRegola(regolaBase, sogg()).toISOString()).toBe('2026-11-09T09:00:00.000Z');
  });
  it('Check-out, il giorno dopo alle 11:30', () => {
    const r = { ...regolaBase, evento: 'Check-out' as const, offsetGiorni: 1, ora: '11:30' };
    expect(scadenzaRegola(r, sogg()).toISOString()).toBe('2026-11-13T10:30:00.000Z');
  });
  it('Conferma prenotazione: si parte dalla data di creazione (giorno italiano)', () => {
    const r = { ...regolaBase, evento: 'Conferma prenotazione' as const, offsetGiorni: 0, ora: '18:00' };
    expect(scadenzaRegola(r, sogg({ creatoIl: new Date('2026-10-01T08:00:00Z') })).toISOString()).toBe('2026-10-01T16:00:00.000Z');
  });
});

describe('filtri', () => {
  it('regola disattivata: mai', () => {
    expect(rispettaFiltri({ ...regolaBase, attiva: false }, sogg())).toBe(false);
  });
  it('filtro per alloggio e per canale', () => {
    expect(rispettaFiltri({ ...regolaBase, alloggioId: 'A2' }, sogg())).toBe(false);
    expect(rispettaFiltri({ ...regolaBase, alloggioId: 'A1' }, sogg())).toBe(true);
    expect(rispettaFiltri({ ...regolaBase, canale: 'Booking' }, sogg())).toBe(false);
    expect(rispettaFiltri({ ...regolaBase, canale: 'Airbnb' }, sogg())).toBe(true);
  });
  it('minimo di notti', () => {
    expect(rispettaFiltri({ ...regolaBase, minNotti: 3 }, sogg())).toBe(false);
    expect(rispettaFiltri({ ...regolaBase, minNotti: 2 }, sogg())).toBe(true);
  });
});

describe('modelli di testo', () => {
  it('sostituisce i segnaposto', () => {
    const { testo, mancanti } = riempiModello(regolaBase.modello, variabiliSoggiorno(sogg()));
    expect(testo).toBe('Ciao Mario, benvenuto a Il Tulipano dal 10/11 al 12/11');
    expect(mancanti).toEqual([]);
  });
  it('segnala i segnaposto vuoti o sconosciuti', () => {
    const r = riempiModello('Link: {link_info} {boh}', variabiliSoggiorno(sogg()));
    expect(r.mancanti).toEqual(['link_info', 'boh']);
  });
  it('l\'emoji vuota non blocca il testo', () => {
    const r = riempiModello('{messaggio_guida}\n{emoji} {link_info}', variabiliSoggiorno(sogg(), { messaggioGuida: 'Ecco:', linkInfo: 'https://x.it/a' }));
    expect(r.mancanti).toEqual([]);
    expect(r.testo).toBe('Ecco:\nhttps://x.it/a');
  });
});

describe('pianifica', () => {
  it('crea l\'attività con scadenza nel futuro', () => {
    const ops = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [], adesso, extra });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ tipo: 'scrivi', stato: 'Da fare', alloggioId: 'A1', checkin: '2026-11-10', ospiteNome: 'Mario Rossi' });
    if (ops[0].tipo === 'scrivi') expect(ops[0].scadenza.toISOString()).toBe('2026-11-09T09:00:00.000Z');
  });

  it('è idempotente: rilanciata con l\'attività già presente non fa nulla', () => {
    const prima = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [], adesso, extra });
    const o = prima[0];
    if (o.tipo !== 'scrivi') throw new Error();
    const esistente: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: o.scadenza, stato: 'Da fare', testo: o.testo };
    expect(pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [esistente], adesso, extra })).toEqual([]);
  });

  it('se la prenotazione cambia date, riprogramma l\'attività aperta', () => {
    const esistente: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: new Date('2026-11-08T09:00:00Z'), stato: 'Notificata', testo: 'vecchio' };
    const ops = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [esistente], adesso, extra });
    expect(ops).toHaveLength(1);
    if (ops[0].tipo !== 'scrivi') throw new Error();
    expect(ops[0].id).toBe('X1');
    expect(ops[0].scadenza.toISOString()).toBe('2026-11-09T09:00:00.000Z');
    expect(ops[0].stato).toBe('Da fare'); // spostata: si riavvisa
  });

  it('se cambia solo il testo di una già notificata, non la riavvisa', () => {
    const esistente: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: new Date('2026-11-09T09:00:00Z'), stato: 'Notificata', testo: 'vecchio' };
    const ops = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [esistente], adesso, extra });
    expect(ops).toHaveLength(1);
    if (ops[0].tipo !== 'scrivi') throw new Error();
    expect(ops[0].stato).toBeUndefined();
  });

  it('prenotazione cancellata (assente dai soggiorni): annulla le attività aperte', () => {
    const esistente: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: new Date('2026-11-09T09:00:00Z'), stato: 'Da fare', testo: 't' };
    expect(pianifica({ regole: [regolaBase], soggiorni: [], esistenti: [esistente], adesso, extra })).toEqual([{ tipo: 'annulla', id: 'X1' }]);
  });

  it('regola disattivata: annulla le attività aperte ma non tocca quelle fatte', () => {
    const aperte: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: new Date('2026-11-09T09:00:00Z'), stato: 'Da fare', testo: 't' };
    const fatta: AttivitaEsistente = { ...aperte, id: 'X2', alloggioId: 'A2', stato: 'Fatta' };
    const ops = pianifica({ regole: [{ ...regolaBase, attiva: false }], soggiorni: [sogg()], esistenti: [aperte, fatta], adesso, extra });
    expect(ops).toEqual([{ tipo: 'annulla', id: 'X1' }]);
  });

  it('un\'attività fatta o saltata non viene mai riaperta, anche se le date cambiano', () => {
    for (const stato of ['Fatta', 'Saltata'] as const) {
      const e: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: new Date('2026-11-01T09:00:00Z'), stato, testo: 'vecchio' };
      expect(pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [e], adesso, extra })).toEqual([]);
    }
  });

  it('prenotazione riattivata dopo una cancellazione: l\'attività annullata torna', () => {
    const e: AttivitaEsistente = { id: 'X1', regolaId: 'R1', alloggioId: 'A1', checkin: '2026-11-10', scadenza: new Date('2026-11-09T09:00:00Z'), stato: 'Annullata', testo: 't' };
    const ops = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [e], adesso, extra });
    expect(ops).toHaveLength(1);
    if (ops[0].tipo !== 'scrivi') throw new Error();
    expect(ops[0]).toMatchObject({ id: 'X1', stato: 'Da fare' });
  });

  it('prenotazione dell\'ultimo minuto: orario già passato ma arrivo ancora da venire → da fare subito', () => {
    const tardi = new Date('2026-11-09T12:00:00Z'); // dopo le 10:00 del giorno prima
    const ops = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [], adesso: tardi, extra });
    if (ops[0].tipo !== 'scrivi') throw new Error();
    expect(ops[0].stato).toBe('Da fare');
    expect(ops[0].scadenza.getTime()).toBe(tardi.getTime());
  });

  it('messaggio dopo il soggiorno (offset positivo) con orario già passato: saltato', () => {
    const r: Regola = { ...regolaBase, evento: 'Check-out', offsetGiorni: 1, ora: '10:00' };
    const dopo = new Date('2026-11-20T12:00:00Z');
    const ops = pianifica({ regole: [r], soggiorni: [sogg()], esistenti: [], adesso: dopo, extra });
    if (ops[0].tipo !== 'scrivi') throw new Error();
    expect(ops[0].stato).toBe('Saltata');
  });

  it('arrivo già passato (soggiorno in corso) per un messaggio "prima dell\'arrivo": saltato', () => {
    const inCorso = new Date('2026-11-11T12:00:00Z');
    const ops = pianifica({ regole: [regolaBase], soggiorni: [sogg()], esistenti: [], adesso: inCorso, extra });
    if (ops[0].tipo !== 'scrivi') throw new Error();
    expect(ops[0].stato).toBe('Saltata');
  });

  it('segnaposto mancante (alloggio senza link): nessuna attività a metà', () => {
    const r: Regola = { ...regolaBase, modello: 'Ecco: {link_info}' };
    expect(pianifica({ regole: [r], soggiorni: [sogg()], esistenti: [], adesso, extra })).toEqual([]);
  });

  it('filtro per alloggio: crea solo per l\'alloggio giusto', () => {
    const r: Regola = { ...regolaBase, alloggioId: 'A2' };
    const ops = pianifica({
      regole: [r],
      soggiorni: [sogg(), sogg({ alloggioId: 'A2', alloggioNome: 'Stanza Rosa', prenotazioneId: 'P2' })],
      esistenti: [], adesso, extra,
    });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ alloggioId: 'A2' });
  });

  it('due regole sullo stesso soggiorno producono due attività distinte', () => {
    const r2: Regola = { ...regolaBase, id: 'R2', nome: 'Promemoria', azione: 'Promemoria per me', offsetGiorni: -2 };
    const ops = pianifica({ regole: [regolaBase, r2], soggiorni: [sogg()], esistenti: [], adesso, extra });
    expect(ops.map((o) => (o.tipo === 'scrivi' ? o.regolaId : ''))).toEqual(['R1', 'R2']);
  });
});

import { formattaBloccoPromemoria, linkWhatsapp, type AttivitaVista } from '../src/lib/db/regole';

const vista = (o: Partial<AttivitaVista> = {}): AttivitaVista => ({
  id: 'T1', regolaId: 'R1', regola: 'Link ospite il giorno prima', azione: 'Messaggio ospite', alloggio: 'Il Tulipano',
  checkin: '2026-10-24', checkout: '2026-10-25', ospite: 'Carmen Rossi', scadenza: '2026-10-23T08:00:00.000Z',
  stato: 'Da fare', testo: 'Ecco tutto (info_utili) *importante*!', fattaIl: null,
  linkWhatsapp: linkWhatsapp('+39 333 1234567', 'Ecco tutto (info_utili) *importante*!'), ...o,
});

describe('digest: blocco promemoria', () => {
  it('nessuna attività: nessun blocco', () => {
    expect(formattaBloccoPromemoria([])).toBeNull();
  });
  it('messaggio ospite: nome, alloggio, arrivo e link WhatsApp', () => {
    const t = formattaBloccoPromemoria([vista()])!;
    expect(t).toContain('📋 *Promemoria da fare* (1)');
    expect(t).toContain('*Carmen Rossi* — Il Tulipano, arrivo 24/10');
    expect(t).toContain('[💬 Apri WhatsApp](https://wa.me/393331234567?text=');
  });
  it('il link non contiene caratteri che rompono il Markdown di Telegram', () => {
    const url = vista().linkWhatsapp!;
    expect(url).not.toMatch(/[()*_!']/);
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Ecco tutto (info_utili) *importante*!');
  });
  it('senza telefono: avvisa invece di mostrare un link vuoto', () => {
    const t = formattaBloccoPromemoria([vista({ linkWhatsapp: null })])!;
    expect(t).toContain('manca il numero di telefono');
    expect(t).not.toContain('wa.me');
  });
  it('promemoria per me: mostra il testo', () => {
    const t = formattaBloccoPromemoria([vista({ azione: 'Promemoria per me', testo: 'Controlla i documenti di Carmen', linkWhatsapp: null })])!;
    expect(t).toContain('• 🔔 Controlla i documenti di Carmen');
  });
  it('oltre il massimo: rimanda al gestionale', () => {
    const molti = Array.from({ length: 10 }, (_, i) => vista({ id: 'T' + i }));
    const t = formattaBloccoPromemoria(molti, 8)!;
    expect(t).toContain('(10)');
    expect(t).toContain('…e altri 2 nel gestionale.');
  });
});

describe('linkWhatsapp', () => {
  it('numero italiano senza prefisso: aggiunge 39', () => {
    expect(linkWhatsapp('333 1234567', 'ciao')).toBe('https://wa.me/393331234567?text=ciao');
  });
  it('senza telefono: nessun link', () => {
    expect(linkWhatsapp(null, 'ciao')).toBeNull();
    expect(linkWhatsapp('', 'ciao')).toBeNull();
  });
});
