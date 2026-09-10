import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { getSheetsClient, ensureSheetWithHeaders, fileIdForTab } from '@/lib/sheets';

// Legge la casella salzillohospitality@gmail.com e trasforma le conferme di prenotazione
// Airbnb/Booking.com in nuove righe sul foglio, senza intervento manuale — vedi
// wiki/entita/salzillo-hospitality.md, "Sync email prenotazioni" (08/09/2026) per il contesto
// e per il perché Booking.com resta ad alert (la mail di Booking non contiene i dati, solo
// un numero di prenotazione e un link all'Extranet).
//
// Airbnb: se TUTTI i campi necessari si leggono con sicurezza dall'email, la prenotazione
// viene creata in automatico (stessa API POST /api/prenotazione usata dal resto del sito) e
// Raffaele riceve solo una conferma. Se anche un solo campo manca, NON si inventa nulla:
// arriva un alert Telegram con quello che si è capito, da completare a mano su Motore Rafilu
// — vedi CLAUDE.md del vault, "Non inventare".
//
// Deduplica: un tab dedicato "EmailProcessate" sullo stesso foglio Google (creato al primo
// avvio se non esiste) tiene traccia degli ID email già gestiti, per non ricreare la stessa
// prenotazione o rimandare lo stesso alert ad ogni esecuzione del cron.

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

// ---- Gmail (OAuth utente, stesso client di Calendar dall'08/09/2026 — vedi assistantCore.ts) ----

function getGmailClient() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: 'v1', auth: client });
}

function decodeBody(payload: unknown): string {
  type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
  function walk(part: Part | undefined): string | null {
    if (!part) return null;
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf8');
    }
    if (part.parts) {
      for (const p of part.parts) {
        const found = walk(p);
        if (found) return found;
      }
    }
    return null;
  }
  const p = payload as Part;
  return walk(p) || (p?.body?.data ? Buffer.from(p.body.data, 'base64url').toString('utf8') : '');
}

// ---- Sheets (service account, come /api/prenotazione — auth/creazione scheda condivise in
// src/lib/sheets.ts dall'08/09/2026) ----

type SheetsClient = ReturnType<typeof google.sheets>;

function ensureTrackingSheet(sheets: SheetsClient) {
  return ensureSheetWithHeaders(sheets, TRACKING_SHEET, TRACKING_HEADERS, 'sync-email-prenotazioni');
}

async function getProcessedIds(sheets: SheetsClient): Promise<Set<string>> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('EmailProcessate'), range: `${TRACKING_SHEET}!A2:A` });
  return new Set((res.data.values ?? []).map((r) => String(r[0])));
}

async function markProcessed(sheets: SheetsClient, id: string, tipo: string, esito: string) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: fileIdForTab('EmailProcessate'),
    range: `${TRACKING_SHEET}!A:D`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [[id, tipo, new Date().toISOString(), esito]] },
  });
}

// ---- Parsing Airbnb ----

type DataYMD = { year: number; month: number; day: number };

// Sempre in UTC "puro" sui soli componenti — mai Date costruiti da stringhe locali, altrimenti
// il fuso orario di chi esegue il codice può far slittare la data di un giorno.
function buildDateFromAbbrev(day: string, meseAbbr: string, refDate: Date): DataYMD | null {
  const mm = MESI_ABBR[meseAbbr.toLowerCase()];
  if (!mm) return null;
  const dayNum = parseInt(day, 10);
  const monthNum = parseInt(mm, 10);
  let year = refDate.getUTCFullYear();
  let ts = Date.UTC(year, monthNum - 1, dayNum);
  const refMidnightTs = Date.UTC(refDate.getUTCFullYear(), refDate.getUTCMonth(), refDate.getUTCDate());
  if (ts < refMidnightTs - 3 * 24 * 60 * 60 * 1000) {
    year += 1;
    ts = Date.UTC(year, monthNum - 1, dayNum);
  }
  return { year, month: monthNum, day: dayNum };
}
function toISO(d: DataYMD): string { return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`; }
function toItFmt(d: DataYMD): string { return `${String(d.day).padStart(2, '0')}/${String(d.month).padStart(2, '0')}/${d.year}`; }

// L'ultima riga di testo "pulita" (non vuota, non un URL/immagine) subito prima del primo
// marcatore di profilo ospite — più robusto di un match in avanti, perché quel marcatore
// compare una volta sola e la riga del nome è sempre l'ultima riga di testo vero prima,
// con solo righe di link in mezzo (verificato sulla vera email, non solo per ragionamento).
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
  complete: boolean; missing: string[];
  ospite?: string; stanza?: string;
  checkinISO?: string; checkoutISO?: string; checkinIt?: string; checkoutIt?: string;
  lordo?: number;
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
    checkinISO: checkinD ? toISO(checkinD) : undefined,
    checkoutISO: checkoutD ? toISO(checkoutD) : undefined,
    checkinIt: checkinD ? toItFmt(checkinD) : undefined,
    checkoutIt: checkoutD ? toItFmt(checkoutD) : undefined,
    lordo,
  };
}

// ---- Parsing Booking.com (solo id + data d'arrivo dall'oggetto: il corpo non contiene altro) ----

function parseBookingSubject(subject: string): { reservationId?: string; arrivalIt?: string } {
  const m = subject.match(/\((\d+),\s*([^)]+)\)/);
  if (!m) return {};
  const reservationId = m[1];
  const dateMatch = m[2].match(/(\d{1,2})\s+([a-zàèéìòù]+)\s+(\d{4})/i);
  let arrivalIt: string | undefined;
  if (dateMatch) {
    const mm = MESI_FULL[dateMatch[2].toLowerCase()];
    if (mm) arrivalIt = `${dateMatch[1].padStart(2, '0')}/${mm}/${dateMatch[3]}`;
  }
  return { reservationId, arrivalIt };
}

// ---- Telegram (stesso pattern a doppio tentativo Markdown/plain delle altre route cron) ----

async function sendTelegram(chatId: string | undefined, token: string | undefined, text: string) {
  if (!chatId || !token) return;
  const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
  });
  const res = await send('Markdown');
  if (!res.ok) await send();
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const gmail = getGmailClient();
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    await ensureTrackingSheet(sheets);
    const processed = await getProcessedIds(sheets);

    const esiti: Array<Record<string, unknown>> = [];

    // ---- Airbnb ----
    const airbnbList = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:automated@airbnb.com subject:"Prenotazione confermata" newer_than:30d',
      maxResults: 20,
    });
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
          // /api/prenotazione è protetta da requireAccesso (09/09/2026): questo cron si
          // autentica con la chiave di Motore Rafilu, accettata come credenziale piena.
          const res = await fetch(`${origin}/api/prenotazione`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-plancia-key': process.env.PLANCIA_ACCESS_KEY || '' },
            body: JSON.stringify({
              checkin: parsed.checkinISO, checkout: parsed.checkoutISO,
              ospite: parsed.ospite, stanza: parsed.stanza, canale: 'Airbnb', lordo: parsed.lordo,
            }),
          });
          const json = await res.json();
          if (!res.ok || json.error) throw new Error(`Creazione prenotazione Airbnb fallita (${parsed.ospite}): ${json.error || res.status}`);
          await markProcessed(sheets, m.id, 'Airbnb', 'creata');
          await sendTelegram(chatId, token, `✅ *Nuova prenotazione Airbnb aggiunta*\n👤 ${parsed.ospite} — ${parsed.stanza}\n📅 ${parsed.checkinIt} → ${parsed.checkoutIt}\n💶 ${parsed.lordo}€`);
        }
      } else {
        if (!dryRun) {
          await markProcessed(sheets, m.id, 'Airbnb', `alert-dati-incompleti (${parsed.missing.join('; ')})`);
          await sendTelegram(chatId, token, `📩 *Email Airbnb trovata, ma non tutti i dati sono leggibili con sicurezza*\nCapito finora: ${parsed.ospite ?? '?'} — ${parsed.stanza ?? '?'} — ${parsed.checkinIt ?? '?'} → ${parsed.checkoutIt ?? '?'} — ${parsed.lordo != null ? parsed.lordo + '€' : '?'}\nMancano: ${parsed.missing.join(', ')}\nAggiungila a mano su Motore Rafilu.`);
        }
      }
      esiti.push({ id: m.id, tipo: 'Airbnb', ...parsed });
    }

    // ---- Booking.com (solo alert: la mail non contiene i dati) ----
    const bookingList = await gmail.users.messages.list({
      userId: 'me',
      q: 'from:noreply@booking.com subject:"Hai una nuova prenotazione" newer_than:30d',
      maxResults: 20,
    });
    for (const m of bookingList.data.messages ?? []) {
      if (!m.id || processed.has(m.id)) continue;
      const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['Subject'] });
      const subject = full.data.payload?.headers?.find((h) => h.name === 'Subject')?.value ?? '';
      const parsed = parseBookingSubject(subject);
      if (!dryRun) {
        await markProcessed(sheets, m.id, 'Booking', 'alert-inviato');
        await sendTelegram(chatId, token, `📩 *Nuova prenotazione Booking.com*\nID: ${parsed.reservationId ?? '?'}\nArrivo: ${parsed.arrivalIt ?? '(non riconosciuto, controlla l\'oggetto dell\'email)'}\n👉 La mail di Booking non contiene ospite/prezzo — apri l'Extranet per i dettagli e aggiungila su Motore Rafilu.`);
      }
      esiti.push({ id: m.id, tipo: 'Booking', subject, ...parsed });
    }

    return NextResponse.json({ ok: true, dryRun, count: esiti.length, esiti });
  } catch (err) {
    console.error('Errore nel sync email prenotazioni:', err);
    if (!dryRun) await alertCronFailure('sync email prenotazioni', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
