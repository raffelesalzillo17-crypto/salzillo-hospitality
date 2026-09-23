import { google } from 'googleapis';
import { GoogleGenAI, FunctionCallingConfigMode, type FunctionDeclaration, type Content, type Part } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { NOMI_STRUTTURE } from '@/lib/strutture';
import { leggiPrenotazioni } from '@/lib/prenotazioni';

// /api/prenotazione, /api/cancella e /api/prenotazioni sono protette da requireAccesso
// (09/09/2026). L'assistente gira sempre lato server (dashboard o bot Telegram) e non ha
// un cookie di sessione: si autentica con la chiave di Motore Rafilu, che requireAccesso
// accetta come credenziale piena. Per le sole letture di /api/prenotazioni si usa invece
// leggiPrenotazioni() direttamente, senza passare dall'HTTP.
function plancHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...(extra || {}), 'x-plancia-key': process.env.PLANCIA_ACCESS_KEY || '' };
}

// Cuore condiviso dell'assistente digitale di Raffaele: stessa logica usata sia dalla barra
// della dashboard Motore Rafilu (stato tenuto dal browser) sia dal bot Telegram (stato su
// Google Sheets) — solo il "dove vive lo stato" cambia, il ciclo agentico è identico.
// Wiki: copia in sola lettura bundlata in data/wiki (vedi next.config.ts, outputFileTracingIncludes),
// sincronizzata a mano dal wiki locale e ripulita dei dati sensibili, perché queste route non hanno
// un login: non solo le tabelle di credenziali/password, ma anche (dal 22/09/2026, revisione fatta
// per il passaggio a Gemini — vedi sotto) codici fiscali, numeri di carta d'identità/patente, IBAN,
// tessere sanitarie ed estremi di atti di nascita — vedi wiki/decisioni/due-livelli-credenziali.md
// nel wiki locale per la regola completa. Invio file NON incluso: raw/ è troppo grande per essere
// bundlata; resta disponibile solo nel bot Telegram quando gira sul PC locale di Raffaele.

// Dal 23/09/2026 il motore è Gemini invece di Claude Sonnet: credito Anthropic esaurito (stesso
// motivo, stessa migrazione già fatta in plancia-raffaele il 22/09/2026 — vedi src/lib/assistantCore.ts
// lì per il dettaglio completo della scelta). Tier gratuito (Raffaele non vuole fatturazione): sul
// tier gratuito Google può usare prompt/output per addestrare i modelli — mitigato irrobustendo la
// redazione della copia cloud del wiki (sopra), non pagando. Modello 'gemini-3.6-flash', non
// 'gemini-2.5-flash' (non più disponibile per nuove chiavi, 404 dall'API). Vedi wiki/decisioni/ nel
// wiki locale.
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3.6-flash';

const WIKI_DIR = path.join(process.cwd(), 'data', 'wiki');
const WIKI_STOPWORDS = new Set(['che', 'chi', 'con', 'per', 'sono', 'delle', 'degli', 'della', 'dello',
  'alla', 'allo', 'agli', 'alle', 'dal', 'dai', 'dalla', 'dalle', 'del', 'dei', 'una', 'uno', 'gli',
  'nella', 'nello', 'nelle', 'negli', 'nel', 'nei', 'sul', 'sulla', 'sullo', 'sui', 'sulle', 'tra',
  'fra', 'come', 'anche', 'questo', 'questa', 'questi', 'queste', 'suo', 'sua', 'suoi', 'sue', 'più',
  'ora', 'già', 'poi', 'solo', 'ogni', 'tutti', 'tutte', 'tutto', 'stato', 'stata',
  'mandami', 'dammi', 'voglio', 'vorrei', 'puoi', 'potresti', 'dimmi']);
const WIKI_PAGES_LIMIT = 5;
const WIKI_MAX_CHARS_PER_PAGE = 2500;
// Parametri BM25 (standard, k1=1.2-2, b=0.75) per pesare i risultati — vedi searchWiki sotto
// per il perché rispetto al vecchio conteggio grezzo di sottostringhe.
const BM25_K1 = 1.5;
const BM25_B = 0.75;

function listWikiFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(listWikiFiles(full));
    else if (entry.name.endsWith('.md')) results.push(full);
  }
  return results;
}

// Trascrizione audio via Groq (Whisper large-v3-turbo, endpoint compatibile OpenAI) — condivisa
// tra il bot Telegram e il microfono della dashboard. `filename` deve avere un'estensione tra
// quelle accettate (flac/mp3/mp4/mpeg/mpga/m4a/ogg/opus/wav/webm), altrimenti Groq rifiuta il file
// anche se il contenuto è valido.
export async function transcribeAudioViaGroq(buf: Buffer, filename: string, mimeType: string): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buf)], { type: mimeType }), filename);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('language', 'it');
  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Trascrizione fallita: HTTP ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.text || '').trim();
}

// Bug trovato l'08/09/2026 (Raffaele: "mandami i dati del mio diploma" non funzionava mai):
// 1. `lower.split(w).length - 1` conta le SOTTOSTRINGHE, non le parole intere — "nato" risultava
//    "presente" in ogni pagina solo perché è sottostringa di "aggiornato" (nel frontmatter di
//    ogni pagina). Corretto: tokenizzazione e confronto per parola intera.
// 2. Il conteggio grezzo (non pesato) faceva vincere pagine lunghe/generiche che ripetono tanto
//    parole comuni come "dati" (es. log.md, la pagina del bot) rispetto alla pagina realmente
//    pertinente ma più corta. Corretto: punteggio BM25 (standard nell'information retrieval) —
//    pesa le parole rare/specifiche della query più di quelle comuni (idf) e non lascia che le
//    pagine lunghe vincano solo per la loro lunghezza (normalizzazione per lunghezza pagina).
// 3. log.md escluso dalla ricerca: è uno storico operativo (cosa abbiamo cambiato e quando), quasi
//    mai la risposta a una domanda sui fatti — e la sua lunghezza crescente inquinava i punteggi.
// Limite pagine alzato da 3 a 5 per lasciare più margine quando la pagina giusta non è la prima
// per punteggio ma è comunque tra le prime (costo aggiuntivo modesto, ~2 pagine x 2500 caratteri).
function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[a-zàèéìòù0-9]+/g) || [];
}

function searchWiki(query: string): string {
  const queryWords = tokenize(query).filter((w) => w.length >= 3 && !WIKI_STOPWORDS.has(w));
  if (!queryWords.length) return 'Nessuna pagina del wiki corrisponde a questa ricerca.';

  const files = listWikiFiles(WIKI_DIR).filter((f) => path.basename(f) !== 'log.md');
  const docs = files.map((f) => {
    const content = fs.readFileSync(f, 'utf8');
    const tokens = tokenize(content);
    return { f, content, tokens, len: tokens.length || 1 };
  });
  if (!docs.length) return 'Nessuna pagina del wiki corrisponde a questa ricerca.';
  const avgLen = docs.reduce((sum, d) => sum + d.len, 0) / docs.length;

  const countWord = (tokens: string[], w: string) => tokens.reduce((c, t) => c + (t === w ? 1 : 0), 0);
  const idf: Record<string, number> = {};
  for (const w of queryWords) {
    const df = docs.filter((d) => countWord(d.tokens, w) > 0).length;
    idf[w] = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
  }

  const scored = docs.map((d) => {
    let score = 0;
    for (const w of queryWords) {
      const tf = countWord(d.tokens, w);
      if (!tf) continue;
      const denom = tf + BM25_K1 * (1 - BM25_B + BM25_B * (d.len / avgLen));
      score += idf[w] * ((tf * (BM25_K1 + 1)) / denom);
    }
    return { f: d.f, content: d.content, score };
  });

  const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, WIKI_PAGES_LIMIT);
  if (!top.length) return 'Nessuna pagina del wiki corrisponde a questa ricerca.';
  return top.map((s) => `--- ${path.relative(WIKI_DIR, s.f)} ---\n${s.content.slice(0, WIKI_MAX_CHARS_PER_PAGE)}`).join('\n\n');
}

// Elenco strutture ora centralizzato in src/lib/strutture.ts (09/09/2026).
const STANZE_VALIDE = NOMI_STRUTTURE;
const CANALI_VALIDI = ['Airbnb', 'Booking', 'Diretto', 'No Tax'];
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type PendingAction =
  | { type: 'new_booking'; data: { checkin: string; checkout: string; ospite: string; stanza: string; canale: string; lordo: number; telefono?: string } }
  | { type: 'cancel_booking'; data: { row: number; stanza: string; ospite: string; eventId: string; penaleType: 'nessuna' | 'penale'; importoPenale?: number } }
  | { type: 'calendar_event'; data: { summary: string; start: string; end: string; description: string; allDay: boolean } };

function isAffirmative(text: string) {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, '');
  return ['sì', 'si', 'ok', 'va bene', 'vabbene', 'procedi', 'conferma', 'confermo', 'vai', 'esatto', 'giusto', 'yes'].includes(t);
}
function isNegative(text: string) {
  const t = text.trim().toLowerCase().replace(/[.!]+$/, '');
  return ['no', 'annulla', 'stop', 'lascia stare', 'no grazie', 'cancella', 'niente'].includes(t);
}

// Stesso client OAuth di Gmail (GMAIL_OAUTH_CLIENT_ID/SECRET) dall'08/09/2026 — vedi
// src/app/api/calendario/route.ts per il perché. Solo il refresh token resta separato.
function getCalendarOAuthClient() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN });
  return client;
}

// ---- Esecuzione delle azioni confermate ----

async function createBookingViaApi(origin: string, data: { checkin: string; checkout: string; ospite: string; stanza: string; canale: string; lordo: number; telefono?: string }) {
  const res = await fetch(`${origin}/api/prenotazione`, {
    method: 'POST',
    headers: plancHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json as { ok: true; utile: number; calWarning?: string };
}

async function cancelBookingViaApi(origin: string, data: { row: number; stanza: string; ospite: string; eventId: string; penaleType: 'nessuna' | 'penale'; importoPenale?: number }) {
  const res = await fetch(`${origin}/api/cancella`, {
    method: 'POST',
    headers: plancHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || `HTTP ${res.status}`);
  return json as { ok: true; stato: string; calResult: string };
}

async function createCalendarEvent(data: { summary: string; start: string; end: string; description: string; allDay: boolean }) {
  const auth = getCalendarOAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.insert({
    calendarId: CALENDAR_ID,
    requestBody: {
      summary: data.summary,
      description: data.description,
      start: data.allDay ? { date: data.start } : { dateTime: data.start },
      end: data.allDay ? { date: data.end } : { dateTime: data.end },
    },
  });
  return res.data;
}

// ---- Strumenti "propose_*": chiamano Gemini con un tool forzato (toolConfig ANY) per ottenere JSON pulito ----
// thinkingBudget 0: sono estrazioni deterministiche (data/nome/importo da testo libero), non
// serve ragionamento esteso — meglio veloci, il ragionamento vero resta nel ciclo agentico sotto.

async function proposeNewBooking(question: string) {
  const today = new Date();
  const system = `Sei l'assistente che registra nuove prenotazioni per il B&B di Raffaele Salzillo, a partire da messaggi in linguaggio naturale italiano.
Data di oggi: ${today.toISOString().slice(0, 10)}. Se non specifica l'anno, assumi l'anno corrente o il prossimo se la data è già passata.
Stanze valide (usa esattamente questi nomi): ${STANZE_VALIDE.join(', ')}.
Canali validi (usa esattamente questi nomi): ${CANALI_VALIDI.join(', ')}. Se Raffaele dice "in nero"/"contanti"/"senza fattura", usa "No Tax". Se non è chiaro, chiedilo nel summary_for_user invece di indovinare.
Se Raffaele fornisce anche il numero di telefono dell'ospite, includilo in "telefono" (facoltativo — non chiederlo se non lo dà spontaneamente).
Non inventare dettagli che Raffaele non ha detto.`;
  const declaration: FunctionDeclaration = {
    name: 'propose_booking',
    description: 'Proponi una nuova prenotazione da registrare.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        checkin: { type: 'string', description: 'Data di check-in, formato ISO "YYYY-MM-DD".' },
        checkout: { type: 'string', description: 'Data di check-out, formato ISO "YYYY-MM-DD".' },
        ospite: { type: 'string' },
        stanza: { type: 'string', enum: STANZE_VALIDE },
        canale: { type: 'string', enum: CANALI_VALIDI },
        lordo: { type: 'number' },
        telefono: { type: 'string', description: 'Numero di telefono dell\'ospite, solo se Raffaele lo ha fornito spontaneamente.' },
        summary_for_user: { type: 'string', description: 'Riassunto breve e amichevole di cosa stai per registrare, per chiedere conferma.' },
      },
      required: ['checkin', 'checkout', 'ospite', 'stanza', 'canale', 'lordo', 'summary_for_user'],
    },
  };
  const response = await genai.models.generateContent({
    model: MODEL,
    contents: question,
    config: {
      systemInstruction: system,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
      tools: [{ functionDeclarations: [declaration] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['propose_booking'] } },
    },
  });
  const fc = response.functionCalls?.[0];
  if (!fc?.args) throw new Error('Nessuna proposta di prenotazione valida.');
  return fc.args as unknown as { checkin: string; checkout: string; ospite: string; stanza: string; canale: string; lordo: number; telefono?: string; summary_for_user: string };
}

async function proposeCancellation(question: string, activeBookingsText: string) {
  const today = new Date();
  const system = `Sei l'assistente che identifica quale prenotazione cancellare per il B&B di Raffaele Salzillo.
Data di oggi: ${today.toISOString().slice(0, 10)}.
Ti vengono fornite le prenotazioni attive esistenti: trova quella a cui Raffaele si riferisce (nome ospite, date, stanza). Se più di una corrisponde plausibilmente, o nessuna, imposta found=false e chiedi chiarimento nel summary_for_user invece di indovinare.
Non inventare mai un numero di riga che non è nell'elenco fornito.`;
  const declaration: FunctionDeclaration = {
    name: 'propose_cancellation',
    description: 'Identifica quale prenotazione esistente cancellare.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        found: { type: 'boolean' },
        row: { type: 'number' },
        ospite: { type: 'string' },
        stanza: { type: 'string' },
        eventId: { type: 'string' },
        penale_type: { type: 'string', enum: ['nessuna', 'penale'] },
        importo_penale: { type: 'number' },
        summary_for_user: { type: 'string' },
      },
      required: ['found', 'summary_for_user'],
    },
  };
  const response = await genai.models.generateContent({
    model: MODEL,
    contents: `Prenotazioni attive:\n${activeBookingsText}\n\nRichiesta di Raffaele: "${question}"`,
    config: {
      systemInstruction: system,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
      tools: [{ functionDeclarations: [declaration] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['propose_cancellation'] } },
    },
  });
  const fc = response.functionCalls?.[0];
  if (!fc?.args) throw new Error('Nessuna proposta di cancellazione valida.');
  return fc.args as unknown as { found: boolean; row?: number; ospite?: string; stanza?: string; eventId?: string; penale_type?: 'nessuna' | 'penale'; importo_penale?: number; summary_for_user: string };
}

async function proposeCalendarEventFn(question: string, existingEventsText: string) {
  const now = new Date();
  const system = `Sei l'assistente che crea eventi/promemoria sul Google Calendar di Raffaele Salzillo, a partire da richieste in linguaggio naturale italiano.
Data e ora attuali: ${now.toISOString()} (fuso orario Europe/Rome).
Se Raffaele non specifica un orario preciso, crea un evento per l'intera giornata (all_day: true). Se specifica un'ora ma non una durata, usa 1 ora. Se non specifica l'anno, assumi l'anno corrente o il prossimo se già passato.
Non inventare dettagli che Raffaele non ha detto.`;
  const declaration: FunctionDeclaration = {
    name: 'propose_calendar_event',
    description: 'Proponi un nuovo evento/promemoria sul calendario.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        all_day: { type: 'boolean' },
        start: { type: 'string', description: 'Se all_day: "YYYY-MM-DD". Altrimenti ISO 8601 con offset, es "2026-09-05T15:00:00+02:00".' },
        end: { type: 'string' },
        description: { type: 'string' },
        summary_for_user: { type: 'string' },
      },
      required: ['summary', 'all_day', 'start', 'end', 'summary_for_user'],
    },
  };
  const response = await genai.models.generateContent({
    model: MODEL,
    contents: `Eventi già presenti nei prossimi giorni (per evitare doppioni ovvi):\n${existingEventsText || '(nessuno)'}\n\nRichiesta di Raffaele: "${question}"`,
    config: {
      systemInstruction: system,
      maxOutputTokens: 1024,
      thinkingConfig: { thinkingBudget: 0 },
      tools: [{ functionDeclarations: [declaration] }],
      toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ['propose_calendar_event'] } },
    },
  });
  const fc = response.functionCalls?.[0];
  if (!fc?.args) throw new Error('Nessuna proposta di evento valida.');
  return fc.args as unknown as { summary: string; all_day: boolean; start: string; end: string; description?: string; summary_for_user: string };
}

// ---- Tool "di lettura", tutti basati sulle stesse API già live della dashboard ----

type ToolSpec = { name: string; description: string; input_schema: Record<string, unknown> };

const TOOLS: ToolSpec[] = [
  { name: 'search_wiki', description: 'Cerca nel wiki personale di Raffaele (il suo "secondo cervello": pagine su di lui, la sua famiglia, la sua carriera, il B&B/Salzillo Hospitality, ecc.). Usalo per qualsiasi domanda su fatti/dati/storia personale o del business che potrebbero essere documentati lì.', input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Parole chiave da cercare, in italiano.' } }, required: ['query'] } },
  { name: 'get_bookings', description: 'Recupera i dati LIVE delle prenotazioni del B&B (ospiti in casa, partenze di oggi, prossimi arrivi nei 14 giorni). Usa SEMPRE questo per domande su ospiti/prenotazioni/occupazione.', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_calendar_events', description: 'Recupera gli eventi dal Google Calendar di Raffaele (personale + B&B). Usa SEMPRE questo per domande su agenda/impegni/appuntamenti.', input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Giorni in avanti da oggi, default 14.' } }, required: [] } },
  { name: 'get_news', description: 'Recupera le notizie più fresche (ANSA, BBC World, Il Sole 24 Ore).', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_markets', description: 'Recupera una panoramica di mercato aggiornata (S&P 500, Nasdaq, FTSE MIB, EUR/USD, il PAC di Raffaele).', input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'get_weather', description: 'Recupera la temperatura attuale. Senza specificare una città restituisce sia Marcianise sia Feltre (le due città di Raffaele). Usa SEMPRE questo per domande sul meteo, mai a memoria.', input_schema: { type: 'object', properties: { city: { type: 'string', description: 'Nome città. Vuoto per Marcianise+Feltre.' } }, required: [] } },
  { name: 'propose_new_booking_from_chat', description: 'Prepara una nuova prenotazione da registrare, a partire da una richiesta in linguaggio naturale. Mostra la proposta e aspetta conferma sì/no — dopo averlo chiamato non aggiungere altro testo.', input_schema: { type: 'object', properties: { request: { type: 'string' } }, required: ['request'] } },
  { name: 'propose_cancel_booking_from_chat', description: 'Prepara la cancellazione di una prenotazione esistente. Mostra la proposta e aspetta conferma sì/no — dopo averlo chiamato non aggiungere altro testo (eccetto se serve chiarimento).', input_schema: { type: 'object', properties: { request: { type: 'string' } }, required: ['request'] } },
  { name: 'propose_calendar_event_from_chat', description: 'Prepara un nuovo evento/promemoria sul calendario. Mostra la proposta e aspetta conferma sì/no — dopo averlo chiamato non aggiungere altro testo.', input_schema: { type: 'object', properties: { request: { type: 'string' } }, required: ['request'] } },
];

const TOOL_DECLARATIONS: FunctionDeclaration[] = TOOLS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.input_schema }));

const SYSTEM_PROMPT = `Sei l'assistente digitale personale di Raffaele Salzillo. Tono amichevole e diretto, frasi brevi, elenchi puntati invece di prosa lunga quando elenchi più cose.
Per il grassetto usa un solo asterisco, es. *così*. Non usare mai [[pagina]] con doppie parentesi quadre.

IMPORTANTE: da qui NON puoi mandare file (serve il PC locale di Raffaele) — se te lo chiede, digli gentilmente che al momento non è disponibile da qui. Hai invece accesso in sola lettura a una copia ridotta del suo wiki personale (search_wiki): alcuni dettagli di accesso ai suoi account sono stati tolti apposta da questa copia, quindi se servono digli che sono disponibili solo dal wiki sul PC.

Hai questi strumenti per dati veri e aggiornati, usali sempre quando la domanda li richiede:
- Fatti su Raffaele, la sua famiglia, la sua carriera, Salzillo Hospitality → search_wiki.
- Ospiti/prenotazioni/occupazione → SEMPRE get_bookings.
- Agenda/calendario/impegni → SEMPRE get_calendar_events.
- Notizie → get_news. Mercati finanziari → get_markets. Meteo → get_weather.
- Registrare una nuova prenotazione → propose_new_booking_from_chat.
- Cancellare una prenotazione esistente → propose_cancel_booking_from_chat.
- Nuovo promemoria/evento in calendario → propose_calendar_event_from_chat.
Questi tre mostrano già una proposta e aspettano conferma: dopo averli chiamati non scrivere altro testo (eccezione: propose_cancel_booking_from_chat può chiedere chiarimento se non è chiaro a quale prenotazione riferirsi).
Usa solo informazioni verificate dagli strumenti, mai a memoria e mai inventate.`;

function currentDateTimeLine() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('it-IT', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Rome' });
  const timeStr = now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' });
  return `\n\nOGGI è ${dateStr}, ore ${timeStr} (fuso orario Europe/Rome). Usa sempre questa come data di riferimento.`;
}

async function buildBookingsContext() {
  const prenotazioni = await leggiPrenotazioni();
  type Row = { row: number; checkin: string; checkout: string; ospite: string; stanza: string; canale: string; lordo: number; utile: number; stato: string; penale: string; eventId: string };
  const parseIt = (s: string) => { const [d, m, y] = s.split('/').map(Number); return d && m && y ? new Date(y, m - 1, d) : null; };
  const active = (prenotazioni as Row[])
    .filter((b) => (b.stato || '').toLowerCase() === 'attiva')
    .map((b) => ({ ...b, ci: parseIt(b.checkin), co: parseIt(b.checkout) }))
    .filter((b) => b.ci && b.co);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const orizzonte = new Date(today.getTime() + 14 * 86400000);
  const fmt = (b: Row) => `[riga ${b.row}] ${b.checkin} → ${b.checkout} | ospite: ${b.ospite} | stanza: ${b.stanza} | canale: ${b.canale} | lordo: €${b.lordo} | utile: €${b.utile} | stato: ${b.stato}`;
  const inCorso = active.filter((b) => b.ci! <= today && b.co! > today);
  const partenzeOggi = active.filter((b) => b.co!.getTime() === today.getTime());
  const prossimiArrivi = active.filter((b) => b.ci! > today && b.ci! <= orizzonte).sort((a, b) => a.ci!.getTime() - b.ci!.getTime());
  const list = (l: Row[]) => (l.length ? l.map(fmt).join('\n') : '(nessuna)');
  return `Dati live, oggi è ${today.toLocaleDateString('it-IT')}:\n\nOspiti in casa:\n${list(inCorso)}\n\nPartenze oggi:\n${list(partenzeOggi)}\n\nProssimi arrivi (14gg):\n${list(prossimiArrivi)}`;
}

async function executeTool(name: string, input: Record<string, unknown>, origin: string, pending: { current: PendingAction | null }): Promise<string> {
  switch (name) {
    case 'search_wiki':
      return searchWiki((input.query as string) || '');
    case 'get_bookings':
      return await buildBookingsContext().catch((e: Error) => `Errore: ${e.message}`);
    case 'get_calendar_events': {
      const days = (input.days as number) || 14;
      const res = await fetch(`${origin}/api/calendario?days=${days}`);
      const data = await res.json();
      if (!data.ok) return `Errore calendario: ${data.error}`;
      type Ev = { start: string; summary: string; allDay: boolean; calendarName: string };
      const fmt = (e: Ev) => `${e.allDay ? e.start : new Date(e.start).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })} — ${e.summary} (${e.calendarName})`;
      return data.events.length ? data.events.map(fmt).join('\n') : '(nessun evento in programma)';
    }
    case 'get_news': {
      const res = await fetch(`${origin}/api/notizie`);
      const data = await res.json();
      if (!data.ok) return 'Notizie non disponibili.';
      type N = { source: string; title: string; snippet: string; link: string };
      return data.news.map((n: N, i: number) => `${i + 1}. [${n.source}] ${n.title} — ${n.snippet} (${n.link})`).join('\n');
    }
    case 'get_markets': {
      const res = await fetch(`${origin}/api/mercati`);
      const data = await res.json();
      if (!data.ok) return 'Dati di mercato non disponibili.';
      type M = { label: string; price?: number; currency?: string; changePercent?: number };
      return data.markets.map((m: M) => `${m.label}: ${m.price?.toFixed(2)} ${m.currency} (${(m.changePercent ?? 0) >= 0 ? '+' : ''}${m.changePercent?.toFixed(2)}% oggi)`).join('\n');
    }
    case 'get_weather': {
      const fetchTemp = async (lat: number, lon: number) => {
        const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`);
        const d = await r.json();
        return d.current?.temperature_2m as number | undefined;
      };
      const city = ((input.city as string) || '').trim();
      if (!city) {
        const [m, f] = await Promise.all([fetchTemp(41.0333, 14.2833), fetchTemp(46.0167, 11.9)]);
        return `Marcianise: ${m ?? '?'}°C\nFeltre: ${f ?? '?'}°C`;
      }
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=it`);
      const geoData = await geoRes.json();
      const place = geoData.results?.[0];
      if (!place) return `Non ho trovato la città "${city}".`;
      const temp = await fetchTemp(place.latitude, place.longitude);
      return `${place.name}: ${temp ?? '?'}°C`;
    }
    case 'propose_new_booking_from_chat': {
      const proposed = await proposeNewBooking((input.request as string) || '');
      pending.current = { type: 'new_booking', data: { checkin: proposed.checkin, checkout: proposed.checkout, ospite: proposed.ospite, stanza: proposed.stanza, canale: proposed.canale, lordo: proposed.lordo, telefono: proposed.telefono } };
      return `__ANSWER__${proposed.summary_for_user}\n\nConfermi? Rispondi *sì* per registrare, *no* per annullare.`;
    }
    case 'propose_cancel_booking_from_chat': {
      const prenotazioni = await leggiPrenotazioni();
      type Row = { row: number; checkin: string; checkout: string; ospite: string; stanza: string; canale: string; lordo: number; utile: number; stato: string };
      const active = (prenotazioni as Row[]).filter((b) => (b.stato || '').toLowerCase() === 'attiva');
      const activeText = active.map((b) => `[riga ${b.row}] ${b.checkin} → ${b.checkout} | ospite: ${b.ospite} | stanza: ${b.stanza} | canale: ${b.canale}`).join('\n');
      const proposed = await proposeCancellation((input.request as string) || '', activeText);
      if (!proposed.found) return `Non sono riuscito a identificare con certezza quale prenotazione cancellare. ${proposed.summary_for_user}`;
      pending.current = { type: 'cancel_booking', data: { row: proposed.row!, stanza: proposed.stanza!, ospite: proposed.ospite!, eventId: proposed.eventId || '', penaleType: proposed.penale_type || 'nessuna', importoPenale: proposed.importo_penale } };
      return `__ANSWER__${proposed.summary_for_user}\n\nConfermi? Rispondi *sì* per cancellare, *no* per annullare.`;
    }
    case 'propose_calendar_event_from_chat': {
      const evRes = await fetch(`${origin}/api/calendario?days=14`);
      const evData = await evRes.json();
      type Ev = { start: string; summary: string; allDay: boolean };
      const existingText = evData.ok ? (evData.events as Ev[]).map((e) => `${e.allDay ? e.start : e.start} — ${e.summary}`).join('\n') : '';
      const proposed = await proposeCalendarEventFn((input.request as string) || '', existingText);
      pending.current = { type: 'calendar_event', data: { summary: proposed.summary, start: proposed.start, end: proposed.end, description: proposed.description || '', allDay: proposed.all_day } };
      return `__ANSWER__${proposed.summary_for_user}\n\nConfermi? Rispondi *sì* per salvare, *no* per annullare.`;
    }
    default:
      return `Strumento sconosciuto: ${name}`;
  }
}

export type TurnResult = { answer: string; history: ChatMessage[]; pendingAction: PendingAction | null };
export type ImageInput = { base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' };

function toGeminiContents(history: ChatMessage[]): Content[] {
  return history.map((h) => ({ role: h.role === 'assistant' ? 'model' : 'user', parts: [{ text: h.content }] }));
}

// Un turno completo: gestisce sia la conferma/rifiuto di una proposta in sospeso sia,
// altrimenti, un giro completo del ciclo agentico con gli strumenti. `image`, se presente
// (bot Telegram: foto ricevuta), va in aggiunta al testo — la cronologia salvata resta
// sempre solo testo (l'immagine non serve più una volta risposto).
export async function runAgentTurn(origin: string, message: string, history: ChatMessage[], pendingAction: PendingAction | null, image?: ImageInput): Promise<TurnResult> {
  if (pendingAction) {
    if (isAffirmative(message)) {
      let answer: string;
      try {
        if (pendingAction.type === 'new_booking') {
          const result = await createBookingViaApi(origin, pendingAction.data);
          const calNote = result.calWarning ? `\n⚠️ ${result.calWarning}` : '';
          answer = `✅ Fatto! Prenotazione di *${pendingAction.data.ospite}* registrata (utile stimato: €${result.utile}).${calNote}`;
        } else if (pendingAction.type === 'cancel_booking') {
          const result = await cancelBookingViaApi(origin, pendingAction.data);
          answer = `✅ Fatto! Prenotazione di *${pendingAction.data.ospite}* segnata come "${result.stato}".`;
        } else {
          await createCalendarEvent(pendingAction.data);
          answer = `✅ Fatto! Ho aggiunto *${pendingAction.data.summary}* al calendario.`;
        }
      } catch (err) {
        answer = `⚠️ Non sono riuscito a salvare: ${err instanceof Error ? err.message : String(err)}`;
      }
      const newHistory = [...history, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: answer }].slice(-12);
      return { answer, history: newHistory, pendingAction: null };
    }
    if (isNegative(message)) {
      const answer = 'Ok, annullato ❌ Non ho fatto nulla.';
      const newHistory = [...history, { role: 'user' as const, content: message }, { role: 'assistant' as const, content: answer }].slice(-12);
      return { answer, history: newHistory, pendingAction: null };
    }
    // Né sì né no: la proposta decade, si prosegue normalmente col nuovo messaggio.
  }

  const pending = { current: null as PendingAction | null };
  const userParts: Part[] = [];
  if (image) userParts.push({ inlineData: { mimeType: image.mediaType, data: image.base64 } });
  userParts.push({ text: message || (image ? 'Guarda questa immagine e dimmi cosa vedi/cosa devo saperne.' : '') });

  const workingContents: Content[] = [...toGeminiContents(history), { role: 'user', parts: userParts }];
  const system = SYSTEM_PROMPT + currentDateTimeLine();
  let finalAnswer: string | null = null;
  let alreadyAnswered = false;
  let loopGuard = 0;

  while (loopGuard++ < 6) {
    const response = await genai.models.generateContent({
      model: MODEL,
      contents: workingContents,
      config: {
        systemInstruction: system,
        // Un po' più alto del vecchio limite Claude (1536): a differenza di Claude, i token
        // di "pensiero" di Gemini rientrano nello stesso budget di output.
        maxOutputTokens: 2048,
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
      },
    });
    const calls = response.functionCalls;
    if (!calls || !calls.length) {
      finalAnswer = response.text ?? '';
      break;
    }
    const modelParts = response.candidates?.[0]?.content?.parts ?? calls.map((c) => ({ functionCall: c }));
    workingContents.push({ role: 'model', parts: modelParts });

    const responseParts: Part[] = [];
    for (const fc of calls) {
      let result: string;
      try {
        result = await executeTool(fc.name || '', (fc.args as Record<string, unknown>) || {}, origin, pending);
      } catch (err) {
        result = `Errore eseguendo ${fc.name}: ${err instanceof Error ? err.message : String(err)}`;
      }
      if (result.startsWith('__ANSWER__')) {
        finalAnswer = result.slice('__ANSWER__'.length);
        alreadyAnswered = true;
      }
      responseParts.push({
        functionResponse: {
          ...(fc.id ? { id: fc.id } : {}),
          name: fc.name || '',
          response: { output: result.replace(/^__ANSWER__/, '') },
        },
      });
    }
    workingContents.push({ role: 'user', parts: responseParts });
    if (alreadyAnswered) break;
  }

  const answer = finalAnswer !== null ? finalAnswer : 'Mi sono perso in troppi passaggi per rispondere a questo 😅 riprova magari riformulando.';
  const historyText = message || (image ? '[foto]' : '');
  const newHistory = [...history, { role: 'user' as const, content: historyText }, { role: 'assistant' as const, content: answer }].slice(-12);
  return { answer, history: newHistory, pendingAction: pending.current };
}
