/**
 * Analisi dei calendari iCal di Airbnb e Booking (punto 2 delle richieste, 23/11/2026). Funzioni PURE (niente rete né database):
 * leggono gli eventi del feed e li confrontano con le nostre prenotazioni. La parte che scrive sul database sta in db/ical.ts.
 */

export type EventoOta = { start: string; end: string; summary: string };

/** Parser iCal minimale: estrae i VEVENT con date (Airbnb e Booking usano VALUE=DATE). */
export function parseIcal(testo: string): EventoOta[] {
  const righe = testo.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  const out: EventoOta[] = [];
  let cur: Partial<EventoOta> | null = null;
  for (const riga of righe) {
    if (riga === 'BEGIN:VEVENT') cur = {};
    else if (riga === 'END:VEVENT') { if (cur?.start && cur.end) out.push({ start: cur.start, end: cur.end, summary: cur.summary || '' }); cur = null; }
    else if (cur) {
      const m = riga.match(/^(DTSTART|DTEND|SUMMARY)[^:]*:(.+)$/);
      if (!m) continue;
      const val = m[2].trim();
      if (m[1] === 'DTSTART') cur.start = normalizzaData(val);
      else if (m[1] === 'DTEND') cur.end = normalizzaData(val);
      else cur.summary = val;
    }
  }
  return out;
}
function normalizzaData(v: string): string { const d = v.slice(0, 8); return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`; }

export const sovrappone = (aS: string, aE: string, bS: string, bE: string) => aS < bE && bS < aE;
export const nottiTra = (s: string, e: string) => Math.round((Date.parse(e) - Date.parse(s)) / 864e5);

const MAX_NOTTI_SOGGIORNO = 21;
/** Chiusure di disponibilità ("Not available", eventi lunghissimi): non sono prenotazioni. */
export function eChiusura(b: EventoOta): boolean {
  if (nottiTra(b.start, b.end) > MAX_NOTTI_SOGGIORNO) return true;
  return /not available|unavailable|non disponibile|blocked/i.test(b.summary) && nottiTra(b.start, b.end) > 10;
}
/** L'eco dei nostri stessi blocchi, riesportati dalla piattaforma. */
export const eEco = (b: EventoOta) => /salzillo hospitality/i.test(b.summary);
/** "Not available", "Blocked"… (24/11/2026): date chiuse a mano sulla piattaforma, di solito proprio perché c'è una prenotazione presa altrove. Non sono prenotazioni e non vanno segnalate come sovrapposizioni. */
export const eBloccoManuale = (b: EventoOta) => /not available|unavailable|non disponibile|blocked|closed/i.test(b.summary);

/** Segna come importabile solo una prenotazione vera: niente eco dei nostri blocchi e, su Airbnb, niente blocchi manuali. */
export function importabile(b: EventoOta, canale: string): boolean {
  if (eEco(b)) return false;
  if (canale === 'Airbnb' && /not available|unavailable|non disponibile|blocked/i.test(b.summary)) return false;
  return true;
}

export type PrenNostra = { id: string; checkin: string; checkout: string; canale: string; stato: string; note: string | null; daVerificare: boolean; motivo: string | null };
export type Conflitto = { ota: EventoOta; prenotazioneId: string; tipo: 'doppia' | 'date diverse'; motivo: string };
export type EsitoAnalisi = { eventiLetti: number; daImportare: EventoOta[]; conflitti: Conflitto[]; sparite: PrenNostra[]; riapparse: PrenNostra[]; feedVuoto: boolean };

export const PREFISSO_SPARITA = 'Sparita dal calendario';

const itData = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Confronta il feed di UN calendario con le nostre prenotazioni dello stesso alloggio.
 *  - daImportare: evento sull'OTA che non si accavalla con niente di nostro → diventa una prenotazione "da completare";
 *  - conflitti: si accavalla con una nostra prenotazione di un ALTRO canale ("doppia": rischio di doppia vendita) o dello
 *    stesso canale ma con date diverse ("date diverse": l'ospite ha modificato le date);
 *  - sparite: una nostra prenotazione dello stesso canale non ha più il suo evento nel feed, ma solo dentro `giorniEvidenza`
 *    (Booking esporta solo ~2 settimane: oltre non c'è prova di niente) e mai se il feed è vuoto (potrebbe essere un errore);
 *  - riapparse: era segnata "sparita" e l'evento è tornato.
 * Le prenotazioni cancellate non entrano nel confronto (lo decide il chiamante: `nostre` contiene solo quelle vive).
 */
export function analizzaFeed(eventi: EventoOta[], nostre: PrenNostra[], calendario: string, oggi: string, giorniOrizzonte = 300, giorniEvidenza = 300): EsitoAnalisi {
  const orizzonte = new Date(Date.parse(oggi) + giorniOrizzonte * 864e5).toISOString().slice(0, 10);
  const limiteEvidenza = new Date(Date.parse(oggi) + giorniEvidenza * 864e5).toISOString().slice(0, 10);
  const veri = eventi.filter((b) => b.end >= oggi && !eEco(b));
  const prenOta = veri.filter((b) => !eChiusura(b) && !eBloccoManuale(b) && b.start <= orizzonte);
  const stesso = (p: PrenNostra) => p.canale.toLowerCase() === calendario.toLowerCase();

  const daImportare: EventoOta[] = []; const conflitti: Conflitto[] = [];
  for (const b of prenOta) {
    const ov = nostre.filter((p) => sovrappone(p.checkin, p.checkout, b.start, b.end));
    if (ov.length === 0) { daImportare.push(b); continue; }
    for (const p of ov) {
      if (!stesso(p)) conflitti.push({ ota: b, prenotazioneId: p.id, tipo: 'doppia', motivo: `Su ${calendario} c'è una prenotazione dal ${itData(b.start)} al ${itData(b.end)} che si accavalla con la nostra prenotazione ${p.canale} dal ${itData(p.checkin)} al ${itData(p.checkout)}: rischio di doppia vendita.` });
      else if (p.checkin !== b.start || p.checkout !== b.end) conflitti.push({ ota: b, prenotazioneId: p.id, tipo: 'date diverse', motivo: `Su ${calendario} la prenotazione è dal ${itData(b.start)} al ${itData(b.end)}, da noi dal ${itData(p.checkin)} al ${itData(p.checkout)}: forse l'ospite ha cambiato le date.` });
    }
  }

  const feedVuoto = veri.length === 0;
  const sparite: PrenNostra[] = []; const riapparse: PrenNostra[] = [];
  for (const p of nostre.filter(stesso)) {
    if (p.checkout < oggi || p.checkin > limiteEvidenza) continue;
    const presente = veri.some((b) => sovrappone(p.checkin, p.checkout, b.start, b.end));
    if (!presente && !feedVuoto && !p.daVerificare) sparite.push(p);
    if (presente && p.daVerificare && (p.motivo ?? '').startsWith(PREFISSO_SPARITA)) riapparse.push(p);
  }
  return { eventiLetti: eventi.length, daImportare, conflitti, sparite, riapparse, feedVuoto };
}
