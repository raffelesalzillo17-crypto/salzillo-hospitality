import { describe, it, expect } from 'vitest';
import { analizzaFeed, parseIcal, eChiusura, type PrenNostra } from '../src/lib/icalAnalisi';

const ICS = (ev: { s: string; e: string; t?: string }[]) => ['BEGIN:VCALENDAR', 'VERSION:2.0', ...ev.flatMap((x) => ['BEGIN:VEVENT', `DTSTART;VALUE=DATE:${x.s.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${x.e.replace(/-/g, '')}`, `SUMMARY:${x.t ?? 'Reserved'}`, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const pn = (id: string, ci: string, co: string, canale: string, extra: Partial<PrenNostra> = {}): PrenNostra => ({ id, checkin: ci, checkout: co, canale, stato: 'Attiva', note: null, daVerificare: false, motivo: null, ...extra });
const OGGI = '2099-03-01';

describe('parseIcal', () => {
  it('legge gli eventi con date e titolo, anche con righe spezzate', () => {
    const t = ICS([{ s: '2099-03-10', e: '2099-03-12', t: 'Reserved' }, { s: '2099-04-01', e: '2099-04-03' }]).replace('SUMMARY:Reserved', 'SUMMARY:Reser\r\n ved');
    expect(parseIcal(t)).toEqual([{ start: '2099-03-10', end: '2099-03-12', summary: 'Reserved' }, { start: '2099-04-01', end: '2099-04-03', summary: 'Reserved' }]);
  });
  it('riconosce le chiusure di disponibilità', () => {
    expect(eChiusura({ start: '2099-03-01', end: '2099-06-01', summary: 'x' })).toBe(true);
    expect(eChiusura({ start: '2099-03-01', end: '2099-03-03', summary: 'Reserved' })).toBe(false);
  });
});

describe('analizzaFeed', () => {
  it('un evento che non c\'è da noi si importa; uno che coincide no', () => {
    const ev = parseIcal(ICS([{ s: '2099-03-10', e: '2099-03-12' }, { s: '2099-03-20', e: '2099-03-22' }]));
    const a = analizzaFeed(ev, [pn('p1', '2099-03-10', '2099-03-12', 'Booking')], 'Booking', OGGI);
    expect(a.daImportare.map((x) => x.start)).toEqual(['2099-03-20']);
    expect(a.conflitti).toEqual([]);
  });
  it('un evento che si accavalla con una nostra prenotazione di un ALTRO canale è una doppia vendita', () => {
    const ev = parseIcal(ICS([{ s: '2099-03-10', e: '2099-03-12' }]));
    const a = analizzaFeed(ev, [pn('d1', '2099-03-11', '2099-03-14', 'Diretto')], 'Booking', OGGI);
    expect(a.conflitti).toHaveLength(1);
    expect(a.conflitti[0]).toMatchObject({ tipo: 'doppia', prenotazioneId: 'd1' });
    expect(a.conflitti[0].motivo).toContain('doppia vendita');
    expect(a.daImportare).toEqual([]);
  });
  it('un blocco manuale sul sito (Not available) sopra una nostra prenotazione NON è una sovrapposizione né una prenotazione da importare', () => {
    const ev = parseIcal(ICS([{ s: '2099-03-10', e: '2099-03-14', t: 'Airbnb (Not available)' }]));
    const a = analizzaFeed(ev, [pn('d1', '2099-03-10', '2099-03-17', 'Diretto')], 'Airbnb', OGGI);
    expect(a.conflitti).toEqual([]);
    expect(a.daImportare).toEqual([]);
  });
  it('stesso canale ma date diverse: avviso "date diverse"', () => {
    const a = analizzaFeed(parseIcal(ICS([{ s: '2099-03-10', e: '2099-03-13' }])), [pn('b1', '2099-03-10', '2099-03-12', 'Booking')], 'Booking', OGGI);
    expect(a.conflitti[0]).toMatchObject({ tipo: 'date diverse', prenotazioneId: 'b1' });
  });
  it('l\'eco dei nostri blocchi non conta né come conflitto né come prenotazione', () => {
    const ev = parseIcal(ICS([{ s: '2099-03-10', e: '2099-03-12', t: 'Prenotato (Salzillo Hospitality)' }]));
    const a = analizzaFeed(ev, [pn('d1', '2099-03-10', '2099-03-12', 'Diretto')], 'Booking', OGGI);
    expect(a.conflitti).toEqual([]);
    expect(a.daImportare).toEqual([]);
  });
  it('una prenotazione sparita dal feed si segna da verificare, ma solo dentro l\'orizzonte e mai con il feed vuoto', () => {
    const ev = parseIcal(ICS([{ s: '2099-03-05', e: '2099-03-07' }]));
    const nostre = [pn('b1', '2099-03-10', '2099-03-12', 'Booking'), pn('b2', '2099-05-10', '2099-05-12', 'Booking'), pn('b3', '2099-03-05', '2099-03-07', 'Booking'), pn('d1', '2099-03-20', '2099-03-22', 'Diretto')];
    const a = analizzaFeed(ev, nostre, 'Booking', OGGI, 300, 14);
    expect(a.sparite.map((p) => p.id)).toEqual(['b1']); // b2 è oltre i 14 giorni (nessuna prova), b3 c'è, d1 è di un altro canale
    expect(analizzaFeed([], nostre, 'Booking', OGGI, 300, 14).sparite).toEqual([]); // feed vuoto: inconcludente
    expect(analizzaFeed([], nostre, 'Booking', OGGI, 300, 14).feedVuoto).toBe(true);
  });
  it('una prenotazione già segnata non si segna due volte, e se l\'evento torna si toglie il segno', () => {
    const ev = parseIcal(ICS([{ s: '2099-03-10', e: '2099-03-12' }]));
    const gia = pn('b1', '2099-03-10', '2099-03-12', 'Booking', { daVerificare: true, motivo: 'Sparita dal calendario Booking (controllo del 01/03)' });
    const a = analizzaFeed(ev, [gia], 'Booking', OGGI);
    expect(a.riapparse.map((p) => p.id)).toEqual(['b1']);
    expect(analizzaFeed(parseIcal(ICS([{ s: '2099-04-10', e: '2099-04-12' }])), [gia], 'Booking', OGGI).sparite).toEqual([]);
    const altro = pn('b2', '2099-03-10', '2099-03-12', 'Booking', { daVerificare: true, motivo: 'Segnata a mano' });
    expect(analizzaFeed(ev, [altro], 'Booking', OGGI).riapparse).toEqual([]); // un "da verificare" messo a mano non si toglie da solo
  });
});
