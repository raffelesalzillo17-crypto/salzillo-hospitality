// Lettura (parsing) delle email di conferma Airbnb — estratta da telegramDigest.ts il 26/10/2026 per poterla
// provare con test automatici senza toccare Gmail, Google Sheets o il database.
//
// 28/10/2026 — caso Giuseppe Zampella: in produzione la sua email (24/10) risultò "dati incompleti
// (nome ospite; check-in; check-out)" anche se vista in Gmail era chiara: il testo GREZZO che legge il
// sistema non ha lo stesso impaginato di quello copiato da Gmail. Per questo ora ogni dato si cerca con
// più strategie indipendenti (layout in colonne o in righe, oggetto dell'email, notti dal prezzo) e non
// dipende più da un'unica frase esatta.

// Chiave = prime 3 lettere del mese (italiano e inglese), così "ott", "ottobre", "Oct", "October" valgono uguale.
export const MESI_ABBR: Record<string, string> = {
  gen: '01', jan: '01', feb: '02', mar: '03', apr: '04', mag: '05', may: '05', giu: '06', jun: '06',
  lug: '07', jul: '07', ago: '08', aug: '08', set: '09', sep: '09', ott: '10', oct: '10', nov: '11', dic: '12', dec: '12',
};
const MESE = '(?:gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic|jan|may|jun|jul|aug|sep|oct|dec)';

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
function aggiungiGiorni(d: DataYMD, n: number): DataYMD {
  const t = new Date(Date.UTC(d.year, d.month - 1, d.day + n));
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}

// ── Nome dell'ospite ─────────────────────────────────────────────────────────

// Una riga è un nome se sono 1-5 parole di lettere (qualunque alfabeto latino), con apostrofi, trattini e punti
// dentro la parola ("D'Amico", "Jean-Luc", "Łukasz", "Mc Donald", "J. Smith").
const RIGA_NOME = /^\p{L}[\p{L}'’.\-]*(?: \p{L}[\p{L}'’.\-]*){0,4}$/u;
const NON_NOMI = /^(airbnb|stanza|ospite|ospiti|host|check-?in|check-?out|prenotazione|chi ha prenotato)$/i;
// Cosa sta subito sotto al nome nell'email: stato dell'identità e recensioni (italiano e inglese).
const MARCATORE_OSPITE = /Identità (?:non )?verificata|Nuovo su Airbnb|\d+\s+recension|Identity (?:not )?verified|New to Airbnb|\d+\s+reviews?\b/i;

/** Toglie dal testo grezzo i pezzi che non sono contenuto: link tra < >, tag HTML, segnaposto [image: ...]. */
function pulisciRiga(l: string): string {
  return l.replace(/<[^>]*>/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Nome completo dall'OGGETTO dell'email: "Prenotazione confermata - Giuseppe Zampella arriverà il 24 ott". */
export function nomeDaOggetto(oggetto?: string): string | undefined {
  const m = oggetto?.match(/Prenotazione confermata\s*[-–—:]\s*(.+?)\s+arriver/i);
  const nome = m?.[1].trim();
  return nome && RIGA_NOME.test(nome) ? nome : undefined;
}

export function extractGuestName(body: string, oggetto?: string): string | undefined {
  const daOggetto = nomeDaOggetto(oggetto);
  if (daOggetto) return daOggetto;
  const markerMatch = body.match(MARCATORE_OSPITE);
  if (!markerMatch || markerMatch.index == null) return undefined;
  // Si parte dall'inizio della riga del marcatore: "Identità non verificata · 0 recensioni" trova il marcatore
  // a metà riga, ma il nome sta sulle righe PRIMA.
  const inizioRiga = body.lastIndexOf('\n', markerMatch.index) + 1;
  const prima = body.slice(Math.max(0, inizioRiga - 800), inizioRiga);
  const righe = prima.split(/\r?\n/).map(pulisciRiga).filter((l) => l.length > 0);
  // La riga più vicina al marcatore che sia davvero un nome (entro 6 righe).
  for (const riga of righe.slice(-6).reverse()) {
    if (RIGA_NOME.test(riga) && !NON_NOMI.test(riga)) return riga;
  }
  return undefined;
}

// ── Date ─────────────────────────────────────────────────────────────────────

/** Le prime due date ("24 ott", "25 ottobre", "24 Oct") dopo l'etichetta Check-in, qualunque sia l'impaginato:
 *  una sotto l'altra, affiancate in colonne, o sulla stessa riga. Si ferma prima di Ospiti/Codice di conferma. */
function dateDopoCheckin(body: string): [string, string][] {
  const i = body.search(/Check-?in/i);
  if (i < 0) return [];
  let parte = body.slice(i);
  const fine = parte.search(/\b(?:Ospiti|Guests|Codice di conferma|Confirmation code)\b/i);
  if (fine > 0) parte = parte.slice(0, fine);
  const re = new RegExp(`\\b(\\d{1,2})\\s+(${MESE})\\p{L}*`, 'giu');
  return [...parte.matchAll(re)].slice(0, 2).map((m) => [m[1], m[2]]);
}

/** Arrivo dall'oggetto: "... arriverà il 24 ott". */
function arrivoDaOggetto(oggetto?: string): [string, string] | undefined {
  const m = oggetto?.match(new RegExp(`arriver\\p{L}*\\s+(?:il\\s+)?(\\d{1,2})\\s+(${MESE})`, 'iu'));
  return m ? [m[1], m[2]] : undefined;
}

// ── Importi ──────────────────────────────────────────────────────────────────

/** "1.234,50" (it), "1,234.50" (en), "60", "60,00" → numero. L'ultimo separatore con 1-2 cifre dopo è il decimale. */
function leggiImporto(testo: string): number {
  const m = testo.match(/^(.*)[.,](\d{1,2})$/);
  const intero = (m ? m[1] : testo).replace(/[.,]/g, '');
  return parseFloat(m ? `${intero}.${m[2]}` : intero);
}

export type AirbnbParsed = {
  complete: boolean; missing: string[]; ospite?: string; stanza?: string;
  checkinISO?: string; checkoutISO?: string; checkinIt?: string; checkoutIt?: string; lordo?: number;
  /** Codice di conferma Airbnb (es. HM353YWJXC) — opzionale: se manca la prenotazione si crea lo stesso. */
  codice?: string;
};

/** `oggetto` (Subject dell'email) è facoltativo ma consigliato: dà nome completo e giorno di arrivo anche
 *  quando il corpo ha un impaginato inatteso. */
export function parseAirbnbEmail(body: string, emailDate: Date, oggetto?: string): AirbnbParsed {
  const missing: string[] = [];
  let stanza: string | undefined;
  if (/tulipano/i.test(body)) stanza = 'Tulipano';
  else if (/\brosa\b/i.test(body)) stanza = 'Rosa';
  if (!stanza) missing.push('stanza (né "Tulipano" né "Rosa" trovati nel testo)');
  const ospite = extractGuestName(body, oggetto);
  if (!ospite) missing.push('nome ospite');

  // Check-in / check-out: prima dal corpo (due date dopo "Check-in"), poi dall'oggetto (arrivo) + notti del prezzo.
  let checkinD: DataYMD | null = null;
  let checkoutD: DataYMD | null = null;
  const trovate = dateDopoCheckin(body);
  if (trovate[0]) checkinD = buildDateFromAbbrev(trovate[0][0], trovate[0][1], emailDate);
  if (trovate[1]) checkoutD = buildDateFromAbbrev(trovate[1][0], trovate[1][1], emailDate);
  if (!checkinD) {
    const a = arrivoDaOggetto(oggetto);
    if (a) checkinD = buildDateFromAbbrev(a[0], a[1], emailDate);
  }
  if (checkinD && !checkoutD) {
    const notti = body.match(/[x×]\s*(\d{1,3})\s*nott/i) ?? body.match(/(\d{1,3})\s*nott[ei]\b/i);
    if (notti) checkoutD = aggiungiGiorni(checkinD, parseInt(notti[1], 10));
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
  const codice = body.match(/Codice di conferma\s+([A-Z0-9]{8,12})/)?.[1];
  return {
    complete: missing.length === 0, missing, ospite, stanza, codice,
    checkinISO: checkinD ? toISO(checkinD) : undefined, checkoutISO: checkoutD ? toISO(checkoutD) : undefined,
    checkinIt: checkinD ? toItFmt(checkinD) : undefined, checkoutIt: checkoutD ? toItFmt(checkoutD) : undefined, lordo,
  };
}

/** Un estratto compatto del corpo intorno a "Check-in", da conservare quando la lettura fallisce: serve a
 *  vedere com'è fatto il testo grezzo senza dover riaprire Gmail. */
export function estrattoDiagnostico(body: string): string {
  const i = Math.max(0, body.search(/Check-?in/i));
  return body.slice(Math.max(0, i - 120), i + 260).replace(/\r/g, '').replace(/\n/g, '⏎').replace(/\t/g, '⇥');
}
