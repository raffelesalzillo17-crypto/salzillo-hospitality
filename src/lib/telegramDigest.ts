// Blocchi di testo condivisi tra i digest (/api/cron/digest-mattina, /api/cron/digest-sera) e
// le vecchie route individuali (checkin-reminder, checkout-reminder, ...), rimaste richiamabili
// a mano/in dryRun per test ma non più schedulate una per una in vercel.json dal 15/09/2026 —
// troppi messaggi Telegram sparsi durante la giornata (richiesta di Raffaele). Ogni funzione
// qui sotto fa SOLO il lavoro (calcolo/lettura dati, eventuali scritture) e ritorna il testo del
// blocco o null se non c'è nulla da segnalare — l'invio vero a Telegram resta a chi chiama,
// così i digest possono incollare più blocchi in un unico messaggio.

import { google } from 'googleapis';
import { leggiPrenotazioni } from './prenotazioni';
import { getStruttura } from './strutture';
import { leggiPulizieDb, leggiPreventiviDb, leggiEventiLocaliDb } from './db/queries';
import { controllaTuttiICalendari } from './db/ical';
import { getSheetsClient, ensureSheetWithHeaders, fileIdForTab } from './sheets';
import { getDb } from './db/index';
import { eventiLocali } from './db/schema';
import { creaEventoLocale } from './db/mutations';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

/** Invio con lo stesso schema a doppio tentativo (Markdown, poi testo semplice se fallisce)
 *  usato ovunque nel progetto — un posto solo invece di 6 copie identiche. */
export async function inviaTelegram(text: string): Promise<void> {
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;
  const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
  });
  const res = await send('Markdown');
  if (!res.ok) await send();
}

type Booking = { checkin: string; checkout: string; ospite: string; stanza: string; stato: string; telefono?: string };

function parseItDate(d: string): Date | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toWaNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  let n = digits.startsWith('+') ? digits.slice(1) : digits;
  if (n.startsWith('00')) n = n.slice(2);
  if (!n.startsWith('39') && n.length <= 10) n = '39' + n;
  return n;
}

// ── Check-in di oggi (ex /api/cron/checkin-reminder) ───────────────────────────
function guideMessage(stanza: string): string | null {
  const s = getStruttura(stanza);
  if (!s?.checkinGuideUrl || !s.guideMessageText) return null;
  return `${s.guideMessageText}\n${s.emoji ?? ''} ${s.checkinGuideUrl}`;
}
export async function testoCheckinOggi(): Promise<string | null> {
  const prenotazioni = await leggiPrenotazioni();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkinOggi = (prenotazioni as Booking[]).filter((b) => b.stato === 'Attiva' && (() => { const ci = parseItDate(b.checkin); return ci ? sameDay(ci, today) : false; })());
  if (checkinOggi.length === 0) return null;
  const righe = checkinOggi.map((b) => {
    const guida = guideMessage(b.stanza);
    const num = b.telefono ? toWaNumber(b.telefono) : null;
    if (!guida) return `👤 *${b.ospite}* — ${b.stanza}\n⚠️ Nessuna guida web per questa stanza ancora — invia le info a mano.`;
    if (!num) return `👤 *${b.ospite}* — ${b.stanza}\n⚠️ Nessun numero registrato, invia a mano la guida di check-in.`;
    const link = `https://wa.me/${num}?text=${encodeURIComponent(guida)}`;
    return `👤 *${b.ospite}* — ${b.stanza}\n👉 [Tocca per inviare la guida di check-in](${link})`;
  });
  return `☀️ *Check-in di oggi*\n\n${righe.join('\n\n')}\n\nMandala con comodo prima delle 15:00, così l'ospite arriva già informato.`;
}

// ── Check-out di oggi (ex /api/cron/checkout-reminder) ─────────────────────────
function reviewMessage(stanza: string): string {
  const link = 'https://g.page/r/CVxuMMgN8XDNEAE/review';
  if (stanza === 'Tulipano') {
    return `Grazie per aver soggiornato al B&B Il Tulipano! 🌷\n\nSperiamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore, per noi è un piccolo gesto che conta davvero.\n\nA presto! 🌷\nSalzillo Hospitality — B&B Il Tulipano`;
  }
  if (stanza === 'Rosa') {
    return `Grazie per aver soggiornato alla Stanza Rosa! 🌸\n\nSperiamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore, per noi è un piccolo gesto che conta davvero.\n\nA presto! 🌸\nSalzillo Hospitality — Stanza Rosa`;
  }
  return `Grazie per aver soggiornato con noi! 🏡\n\nSperiamo che tutto sia andato per il meglio.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore!\n\nA presto!\nSalzillo Hospitality`;
}
export async function testoCheckoutOggi(): Promise<string | null> {
  const prenotazioni = await leggiPrenotazioni();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkoutOggi = (prenotazioni as Booking[]).filter((b) => b.stato === 'Attiva' && (() => { const co = parseItDate(b.checkout); return co ? sameDay(co, today) : false; })());
  if (checkoutOggi.length === 0) return null;
  const righe = checkoutOggi.map((b) => {
    const num = b.telefono ? toWaNumber(b.telefono) : null;
    if (!num) return `👤 *${b.ospite}* — ${b.stanza}\n⚠️ Nessun numero registrato, invia a mano la richiesta recensione.`;
    const testo = encodeURIComponent(reviewMessage(b.stanza));
    const link = `https://wa.me/${num}?text=${testo}`;
    return `👤 *${b.ospite}* — ${b.stanza}\n👉 [Tocca per inviare la richiesta recensione](${link})`;
  });
  return `🌙 *Check-out di oggi*\n\n${righe.join('\n\n')}\n\nSuggerimento: mandalo stasera o domani mattina, non subito — l'ospite è ancora in viaggio.`;
}

// ── Controllo calendari iCal (ex /api/cron/controllo-calendari) ────────────────
export async function testoControlloCalendari(): Promise<string | null> {
  const esiti = await controllaTuttiICalendari();
  const problemi = esiti.filter((e) => e.errore || e.mancano.length || e.inPiu.length);
  if (problemi.length === 0) return null;
  return ['⚠️ *Controllo calendari — qualcosa non torna:*', '',
    ...problemi.map((p) => {
      const righe = [`*${p.alloggio} · ${p.calendario}*`];
      if (p.errore) righe.push(`  errore: ${p.errore}`);
      p.mancano.forEach((m) => righe.push(`  📥 ${m.start}→${m.end}: c'è su ${p.calendario} ma non da noi`));
      p.inPiu.forEach((m) => righe.push(`  📤 ${m.start}→${m.end} (${m.ospite}): da noi ma non su ${p.calendario}`));
      return righe.join('\n');
    })].join('\n');
}

// ── Preventivi in scadenza (ex /api/cron/preventivo-scadenza) ──────────────────
function fmtEuro(n: string | number | null): string {
  const v = typeof n === 'string' ? Number(n) : n ?? 0;
  return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dataItISO(d: string): string {
  const [y, m, gg] = d.split('-');
  return `${gg}/${m}/${y}`;
}
export async function testoPreventiviScadenza(): Promise<string | null> {
  const preventivi = await leggiPreventiviDb();
  const ora = new Date();
  const fraUnGiorno = new Date(ora.getTime() + 24 * 60 * 60 * 1000);
  const inScadenza: string[] = [];
  const giaScaduti: string[] = [];
  for (const p of preventivi) {
    if (p.stato !== 'Inviato') continue;
    const partenza = p.inviatoIl ?? p.creatoIl;
    if (!partenza) continue;
    const scadenza = new Date(new Date(partenza).getTime() + p.validoOre * 60 * 60 * 1000);
    const nome = [p.ospiteNome, p.ospiteCognome].filter(Boolean).join(' ') || '(ospite non indicato)';
    const riga = `• *${p.codice}* — ${nome}, ${p.alloggio}, ${dataItISO(p.checkin)}→${dataItISO(p.checkout)}, ${fmtEuro(p.totale)} €`;
    if (scadenza < ora) giaScaduti.push(riga);
    else if (scadenza <= fraUnGiorno) inScadenza.push(riga);
  }
  if (inScadenza.length === 0 && giaScaduti.length === 0) return null;
  const blocchi: string[] = ['⏳ *Preventivi in scadenza*'];
  if (inScadenza.length > 0) blocchi.push('Scadono entro domani:\n' + inScadenza.join('\n'));
  if (giaScaduti.length > 0) blocchi.push('Già scaduti (ancora segnati "Inviato" — valuta se aggiornarli):\n' + giaScaduti.join('\n'));
  return blocchi.join('\n\n');
}

// ── Pulizie da fare domani (ex /api/cron/pulizie-reminder) ─────────────────────
export async function testoPulizieDomani(): Promise<string | null> {
  const domani = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const tutte = await leggiPulizieDb();
  const daFareDomani = tutte.filter((p) => p.data === domani && !p.confermataIl);
  if (daFareDomani.length === 0) return null;
  const [gg, mm, aa] = [domani.slice(8, 10), domani.slice(5, 7), domani.slice(0, 4)];
  const righe = daFareDomani.map((p) => `🧹 *${p.alloggio}*${p.note ? ` — ${p.note}` : ''}${p.pagata ? ' (pagata dall’ospite)' : ''}`);
  return `🧹 *Pulizie da fare domani (${gg}/${mm}/${aa})*\n\n${righe.join('\n')}\n\nSegna fatta dalla scheda Pulizie appena finita.`;
}

// ── Nuovi eventi in zona (ex /api/cron/eventi-locali, gira una volta a settimana) ──
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
type EventoTrovato = { titolo: string; dal: string; al: string; comune?: string; impatto?: string; note?: string };
function estraiJson(testo: string): EventoTrovato[] {
  const m = testo.match(/```(?:json)?\s*([\s\S]*?)```/) || testo.match(/(\[[\s\S]*\])/);
  if (!m) return [];
  try { const parsed = JSON.parse(m[1]); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}
export async function testoEventiLocali(dryRun: boolean): Promise<string | null> {
  const giaTracciati = await leggiEventiLocaliDb();
  const elencoTracciati = giaTracciati.length > 0
    ? giaTracciati.map((e) => `- ${e.titolo} (${e.dal} → ${e.al}, ${e.comune || '?'})`).join('\n')
    : '(nessuno)';
  const oggi = new Date();
  const fraDueMesi = new Date(oggi.getTime() + 60 * 24 * 60 * 60 * 1000);
  const oggiStr = oggi.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 2000,
    tools: [{
      type: 'web_search_20250305', name: 'web_search', max_uses: 6,
      user_location: { type: 'approximate', city: 'Marcianise', region: 'Campania', country: 'IT', timezone: 'Europe/Rome' },
    }],
    system: `Cerchi eventi reali (sagre, fiere, mercatini, concerti, manifestazioni, ponti festivi) entro circa 30 km da Marcianise (CE), nei prossimi 60 giorni da oggi (${oggiStr}), utili a un B&B locale per capire quando la domanda di alloggio sale. Includi Marcianise, Caserta, Aversa, San Nicola la Strada, Recale, Capua, Napoli e comuni limitrofi.

Non inventare eventi: se non trovi nulla di verificabile con la ricerca web, restituisci una lista vuota. Non includere eventi già tracciati (elenco sotto) — cerca solo novità.

Rispondi ESCLUSIVAMENTE con un blocco \`\`\`json contenente un array di oggetti con questi campi:
- titolo (stringa)
- dal (data ISO YYYY-MM-DD)
- al (data ISO YYYY-MM-DD, uguale a "dal" se un solo giorno)
- comune (stringa)
- impatto: "Alto" | "Medio" | "Basso" — stima di quanto potrebbe aumentare la domanda di alloggio nella zona
- note (breve descrizione, 1 riga, cita da dove viene l'informazione)

Se non trovi eventi validi, rispondi con \`\`\`json\n[]\n\`\`\`. Nessun testo fuori dal blocco json.`,
    messages: [{
      role: 'user',
      content: `Eventi già tracciati (non ripeterli):\n${elencoTracciati}\n\nCerca eventi nuovi tra oggi (${oggiStr}) e ${fraDueMesi.toLocaleDateString('it-IT')}.`,
    }],
  });

  const testo = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const trovati = estraiJson(testo);
  console.log(`[eventi-locali] risposta (${testo.length} caratteri): ${testo.slice(0, 500)}`);
  console.log(`[eventi-locali] blocchi risposta: ${response.content.map((b) => b.type).join(', ')} — trovati: ${trovati.length}`);

  const db = getDb();
  const aggiunti: EventoTrovato[] = [];
  for (const e of trovati) {
    if (!e.titolo || !e.dal) continue;
    const [esiste] = await db.select({ id: eventiLocali.id }).from(eventiLocali)
      .where(and(eq(eventiLocali.titolo, e.titolo.trim()), eq(eventiLocali.dal, e.dal)));
    if (esiste) continue;
    if (!dryRun) await creaEventoLocale({ titolo: e.titolo, dal: e.dal, al: e.al || e.dal, comune: e.comune, impatto: e.impatto, note: e.note });
    aggiunti.push(e);
  }
  if (aggiunti.length === 0) return null;
  const dataIt = (d: string) => { const [y, m, gg] = d.split('-'); return `${gg}/${m}/${y}`; };
  const righe = aggiunti.map((e) => `• *${e.titolo}* — ${e.comune || '?'}, ${dataIt(e.dal)}${e.al && e.al !== e.dal ? `→${dataIt(e.al)}` : ''} (impatto ${e.impatto || 'Medio'})${e.note ? `\n  ${e.note}` : ''}`).join('\n');
  return `🎪 *Nuovi eventi in zona*\n\n${righe}\n\nAggiunti a "Eventi in zona" — dai un'occhiata ai prezzi di quei giorni.`;
}

// ── Sync email prenotazioni (ex /api/cron/sync-email-prenotazioni) ─────────────
// Ha effetti collaterali reali (crea prenotazioni, segna email come processate): a differenza
// dei blocchi sopra ritorna un ARRAY di testi (uno per email nuova trovata, zero o più), non un
// blocco singolo — il chiamante li unisce agli altri.
const TRACKING_SHEET = 'EmailProcessate';
const TRACKING_HEADERS = ['MessageID', 'Tipo', 'Data', 'Esito'] as const;
const MESI_ABBR: Record<string, string> = {
  gen: '01', feb: '02', mar: '03', apr: '04', mag: '05', giu: '06',
  lug: '07', ago: '08', set: '09', ott: '10', nov: '11', dic: '12',
};
const MESI_FULL: Record<string, string> = {
  gennaio: '01', febbraio: '02', marzo: '03', aprile: '04', maggio: '05', giugno: '06',
  luglio: '07', agosto: '08', settembre: '09', ottobre: '10', novembre: '11', dicembre: '12',
};
function getGmailClient() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: client });
}
function decodeBody(payload: unknown): string {
  type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
  function walk(part: Part | undefined): string | null {
    if (!part) return null;
    if (part.mimeType === 'text/plain' && part.body?.data) return Buffer.from(part.body.data, 'base64url').toString('utf8');
    if (part.parts) { for (const p of part.parts) { const found = walk(p); if (found) return found; } }
    return null;
  }
  const p = payload as Part;
  return walk(p) || (p?.body?.data ? Buffer.from(p.body.data, 'base64url').toString('utf8') : '');
}
type SheetsClient = ReturnType<typeof google.sheets>;
function ensureTrackingSheet(sheets: SheetsClient) { return ensureSheetWithHeaders(sheets, TRACKING_SHEET, TRACKING_HEADERS, 'sync-email-prenotazioni'); }
async function getProcessedIds(sheets: SheetsClient): Promise<Set<string>> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('EmailProcessate'), range: `${TRACKING_SHEET}!A2:A` });
  return new Set((res.data.values ?? []).map((r) => String(r[0])));
}
async function markProcessed(sheets: SheetsClient, id: string, tipo: string, esito: string) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: fileIdForTab('EmailProcessate'), range: `${TRACKING_SHEET}!A:D`,
    valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[id, tipo, new Date().toISOString(), esito]] },
  });
}
type DataYMD = { year: number; month: number; day: number };
function buildDateFromAbbrev(day: string, meseAbbr: string, refDate: Date): DataYMD | null {
  const mm = MESI_ABBR[meseAbbr.toLowerCase()];
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
function extractGuestName(body: string): string | undefined {
  const markerMatch = body.match(/Identità verificata|Nuovo su Airbnb|\d+\s+recension/);
  if (!markerMatch || markerMatch.index == null) return undefined;
  const windowStart = Math.max(0, markerMatch.index - 500);
  const before = body.slice(windowStart, markerMatch.index);
  const lines = before.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^</.test(l) && !/^https?:/i.test(l) && !/^\[image:/i.test(l));
  const last = lines[lines.length - 1];
  if (last && /^[A-ZÀ-Ù][a-zà-ù'’-]+(?: [A-ZÀ-Ù][a-zà-ù'’-]+){0,3}$/.test(last)) return last;
  return undefined;
}
type AirbnbParsed = {
  complete: boolean; missing: string[]; ospite?: string; stanza?: string;
  checkinISO?: string; checkoutISO?: string; checkinIt?: string; checkoutIt?: string; lordo?: number;
};
function parseAirbnbEmail(body: string, emailDate: Date): AirbnbParsed {
  const missing: string[] = [];
  let stanza: string | undefined;
  if (/tulipano/i.test(body)) stanza = 'Tulipano';
  else if (/\brosa\b/i.test(body)) stanza = 'Rosa';
  if (!stanza) missing.push('stanza (né "Tulipano" né "Rosa" trovati nel testo)');
  const ospite = extractGuestName(body);
  if (!ospite) missing.push('nome ospite');
  let checkinD: DataYMD | null = null;
  let checkoutD: DataYMD | null = null;
  const datesMatch = body.match(/Check-in\s+\w{3}\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2}:\d{2})\s+Check-out\s+\w{3}\s+(\d{1,2})\s+(\w{3})\s+(\d{1,2}:\d{2})/i);
  if (datesMatch) {
    checkinD = buildDateFromAbbrev(datesMatch[1], datesMatch[2], emailDate);
    checkoutD = checkinD ? buildDateFromAbbrev(datesMatch[4], datesMatch[5], emailDate) : null;
  }
  if (!checkinD) missing.push('check-in');
  if (!checkoutD) missing.push('check-out');
  let lordo: number | undefined;
  const priceMatch = body.match(/Totale \(EUR\)\s+([\d.,]+)\s*€/i);
  if (priceMatch) lordo = parseFloat(priceMatch[1].replace(/\./g, '').replace(',', '.'));
  if (lordo == null || Number.isNaN(lordo)) missing.push('prezzo');
  return {
    complete: missing.length === 0, missing, ospite, stanza,
    checkinISO: checkinD ? toISO(checkinD) : undefined, checkoutISO: checkoutD ? toISO(checkoutD) : undefined,
    checkinIt: checkinD ? toItFmt(checkinD) : undefined, checkoutIt: checkoutD ? toItFmt(checkoutD) : undefined, lordo,
  };
}
function parseBookingSubject(subject: string): { reservationId?: string; arrivalIt?: string } {
  const m = subject.match(/\((\d+),\s*([^)]+)\)/);
  if (!m) return {};
  const reservationId = m[1];
  const dateMatch = m[2].match(/(\d{1,2})\s+([a-zàèéìòù]+)\s+(\d{4})/i);
  let arrivalIt: string | undefined;
  if (dateMatch) { const mm = MESI_FULL[dateMatch[2].toLowerCase()]; if (mm) arrivalIt = `${dateMatch[1].padStart(2, '0')}/${mm}/${dateMatch[3]}`; }
  return { reservationId, arrivalIt };
}
export async function eseguiSyncEmailPrenotazioni(origin: string, dryRun: boolean): Promise<string[]> {
  const testi: string[] = [];
  const gmail = getGmailClient();
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  await ensureTrackingSheet(sheets);
  const processed = await getProcessedIds(sheets);

  const airbnbList = await gmail.users.messages.list({ userId: 'me', q: 'from:automated@airbnb.com subject:"Prenotazione confermata" newer_than:30d', maxResults: 20 });
  for (const m of airbnbList.data.messages ?? []) {
    if (!m.id || processed.has(m.id)) continue;
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' });
    const body = decodeBody(full.data.payload);
    const headers = full.data.payload?.headers ?? [];
    const dateHeader = headers.find((h) => h.name === 'Date')?.value;
    const emailDate = dateHeader ? new Date(dateHeader) : new Date();
    const parsed = parseAirbnbEmail(body, emailDate);
    if (parsed.complete) {
      if (!dryRun) {
        const res = await fetch(`${origin}/api/prenotazione`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-plancia-key': process.env.PLANCIA_ACCESS_KEY || '' },
          body: JSON.stringify({ checkin: parsed.checkinISO, checkout: parsed.checkoutISO, ospite: parsed.ospite, stanza: parsed.stanza, canale: 'Airbnb', lordo: parsed.lordo }),
        });
        const json = await res.json();
        if (!res.ok || json.error) throw new Error(`Creazione prenotazione Airbnb fallita (${parsed.ospite}): ${json.error || res.status}`);
        await markProcessed(sheets, m.id, 'Airbnb', 'creata');
        testi.push(`✅ *Nuova prenotazione Airbnb aggiunta*\n👤 ${parsed.ospite} — ${parsed.stanza}\n📅 ${parsed.checkinIt} → ${parsed.checkoutIt}\n💶 ${parsed.lordo}€`);
      }
    } else if (!dryRun) {
      await markProcessed(sheets, m.id, 'Airbnb', `alert-dati-incompleti (${parsed.missing.join('; ')})`);
      testi.push(`📩 *Email Airbnb trovata, ma non tutti i dati sono leggibili con sicurezza*\nCapito finora: ${parsed.ospite ?? '?'} — ${parsed.stanza ?? '?'} — ${parsed.checkinIt ?? '?'} → ${parsed.checkoutIt ?? '?'} — ${parsed.lordo != null ? parsed.lordo + '€' : '?'}\nMancano: ${parsed.missing.join(', ')}\nAggiungila a mano su Motore Rafilu.`);
    }
  }

  const bookingList = await gmail.users.messages.list({ userId: 'me', q: 'from:noreply@booking.com subject:"Hai una nuova prenotazione" newer_than:30d', maxResults: 20 });
  for (const m of bookingList.data.messages ?? []) {
    if (!m.id || processed.has(m.id)) continue;
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['Subject'] });
    const subject = full.data.payload?.headers?.find((h) => h.name === 'Subject')?.value ?? '';
    const parsed = parseBookingSubject(subject);
    if (!dryRun) {
      await markProcessed(sheets, m.id, 'Booking', 'alert-inviato');
      testi.push(`📩 *Nuova prenotazione Booking.com*\nID: ${parsed.reservationId ?? '?'}\nArrivo: ${parsed.arrivalIt ?? "(non riconosciuto, controlla l'oggetto dell'email)"}\n👉 La mail di Booking non contiene ospite/prezzo — apri l'Extranet per i dettagli e aggiungila su Motore Rafilu.`);
    }
  }
  return testi;
}
