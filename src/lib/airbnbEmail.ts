// Lettura (parsing) delle email di conferma Airbnb — estratta da telegramDigest.ts il 26/10/2026 per poterla
// provare con test automatici senza toccare Gmail, Google Sheets o il database.
//
// Resa più tollerante il 26/10/2026 dopo le prove "cattive" (tests/sync-email-airbnb.test.ts): nomi con
// apostrofo/trattino/accenti insoliti, ospite senza identità verificata, mesi scritti per esteso o in
// inglese, prezzo con € davanti o EUR dopo. Quello che non si legge con sicurezza resta in `missing`.

// Chiave = prime 3 lettere del mese (italiano e inglese), così "ott", "ottobre", "Oct", "October" valgono uguale.
export const MESI_ABBR: Record<string, string> = {
  gen: '01', jan: '01', feb: '02', mar: '03', apr: '04', mag: '05', may: '05', giu: '06', jun: '06',
  lug: '07', jul: '07', ago: '08', aug: '08', set: '09', sep: '09', ott: '10', oct: '10', nov: '11', dic: '12', dec: '12',
};

export type DataYMD = { year: number; month: number; day: number };
export function buildDateFromAbbrev(day: string, meseAbbr: string, refDate: Date): DataYMD | null {
  const mm = MESI_ABBR[meseAbbr.toLowerCase().slice(0, 3)];
  if (!mm) return null;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(mm, 10);
  let year = refDate.getUTCFullYear();
  let ts = Date.UTC(year, monthNum - 1, dayNum);
  const refMidnightTs = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate());
  if (ts < refMidnightTs - 3 * 24 * 60 * 60 * 1000) { year += 1; ts = Date.UTC(year, monthNum - 1, dayNum); }
  return { year, month: monthNum, day: dayNum };
}
function toISO(d: DataYMD): string { return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`; }
function toItFmt(d: DataYMD): string { return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`; }

// Una riga è un nome se sono 1-5 parole di lettere (qualunque alfabeto latino), con apostrofi, trattini e punti
// dentro la parola ("D'Amico", "Jean-Luc", "Łukasz", "Mc Donald", "J. Smith").
const RIGA_NOME = /^\p{L}[\p{L}'’.\-]*(?: \p{L}[\p{L}'’.\-]*){0,4}$/u;
// Cosa sta subito sotto al nome nell'email: stato dell'identità e recensioni (italiano e inglese).
const MARCATORE_OSPITE = /Identità (?:non )?verificata|Nuovo su Airbnb|\d+\s+recension|Identity (?:not )?verified|New to Airbnb|\d+\s+reviews?\b/i;

export function extractGuestName(body: string): string | undefined {
  const markerMatch = body.match(MARCATORE_OSPITE);
  if (!markerMatch || markerMatch.index == null) return undefined;
  // Si parte dall'inizio della riga del marcatore: "Identità non verificata · 0 recensioni" trova il marcatore
  // a metà riga, ma il nome sta sulla riga PRIMA.
  const inizioRiga = body.lastIndexOf('\n', markerMatch.index) + 1;
  const before = body.slice(Math.max(0, inizioRiga - 500), inizioRiga);
  const lines = before.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^</.test(l) && !/^https?:/i.test(l) && !/^\[image:/i.test(l));
  const last = lines[lines.length - 1];
  if (last && RIGA_NOME.test(last)) return last;
  return undefined;
}

/** "1.234,50" (it), "1,234.50" (en), "60", "60,00" → numero. L'ultimo separatore con 1-2 cifre dopo è il decimale. */
function leggiImporto(testo: string): number {
  const m = testo.match(/^(.*)[.,](\d{1,2})$/);
  const intero = (m ? m[1] : testo).replace(/[.,]/g, '');
  return parseFloat(m ? `${intero}.${m[2]}` : intero);
}

export type AirbnbParsed = {
  complete: boolean; missing: string[]; ospite?: string; stanza?: string;
  checkinISO?: string; checkoutISO?: string; checkinIt?: string; checkoutIt?: string; lordo?: number;
};
export function parseAirbnbEmail(body: string, emailDate: Date): AirbnbParsed {
  const missing: string[] = [];
  let stanza: string | undefined;
  if (/tulipano/i.test(body)) stanza = 'Tulipano';
  else if (/\brosa\b/i.test(body)) stanza = 'Rosa';
  if (!stanza) missing.push('stanza (né "Tulipano" né "Rosa" trovati nel testo)');
  const ospite = extractGuestName(body);
  if (!ospite) missing.push('nome ospite');
  let checkinD: DataYMD | null = null;
  let checkoutD: DataYMD | null = null;
  const datesMatch = body.match(/Check-in\s+\p{L}+\s+(\d{1,2})\s+(\p{L}+)\s+(\d{1,2}:\d{2})\s+Check-out\s+\p{L}+\s+(\d{1,2})\s+(\p{L}+)\s+(\d{1,2}:\d{2})/iu);
  if (datesMatch) {
    checkinD = buildDateFromAbbrev(datesMatch[1], datesMatch[2], emailDate);
    checkoutD = checkinD ? buildDateFromAbbrev(datesMatch[4], datesMatch[5], emailDate) : null;
  }
  if (!checkinD) missing.push('check-in');
  if (!checkoutD) missing.push('check-out');
  if (checkinD && checkoutD && toISO(checkoutD) <= toISO(checkinD)) {
    missing.push('date incoerenti (check-out non dopo il check-in)');
  }
  let lordo: number | undefined;
  const priceMatch = body.match(/Totale \(EUR\)\s*€?\s*([\d.,]+)/i);
  if (priceMatch) lordo = leggiImporto(priceMatch[1]);
  if (lordo == null || Number.isNaN(lordo)) missing.push('prezzo');
  return {
    complete: missing.length === 0, missing, ospite, stanza,
    checkinISO: checkinD ? toISO(checkinD) : undefined, checkoutISO: checkoutD ? toISO(checkoutD) : undefined,
    checkinIt: checkinD ? toItFmt(checkinD) : undefined, checkoutIt: checkoutD ? toItFmt(checkoutD) : undefined, lordo,
  };
}
