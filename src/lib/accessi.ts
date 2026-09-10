import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'crypto';
import { getSheetsClient, ensureSheetWithHeaders, readAllRows, findFirstFreeRow, sheetExists, fileIdForTab } from './sheets';

// Sistema di accessi per il sito prenotazioni condiviso (src/app/page.tsx) — costruito il
// 09/09/2026 dopo aver scoperto che quel sito e le sue API (/api/prenotazione, /api/cancella,
// /api/prenotazioni) non avevano NESSUN controllo di autenticazione: chiunque conoscesse l'URL
// poteva creare o cancellare prenotazioni reali. Vedi wiki/entita/salzillo-hospitality.md e
// wiki/decisioni/non-toccare-sito-prenotazioni.md per il contesto — Raffaele ha approvato
// esplicitamente questo come evoluzione del modello di sicurezza del sito, non una violazione
// della regola "non toccare la funzionalità" (quella regola vieta cambiamenti NON concordati).
//
// Un utente per persona (nome + password), non una chiave condivisa: se un accesso va
// revocato, si tocca solo quella riga, non tutti gli altri. Le password non sono mai
// recuperabili in chiaro dopo la creazione — solo un nuovo reset (mostrato una volta, poi
// solo l'hash resta salvato). Permessi semplici (creare/cancellare/vedere i dati finanziari),
// non una griglia enorme — si espande solo se emerge un bisogno reale.
//
// Motore Rafilu (/plancia) NON usa questo sistema — resta solo di Raffaele, protetto da
// PLANCIA_ACCESS_KEY come già era.

export const ACCESSI_SHEET_NAME = 'ACCESSI';
export const ACCESSI_HEADERS = ['Username', 'Nome', 'PasswordHash', 'Ruolo', 'PuoCreare', 'PuoCancellare', 'PuoVedereFinanziario', 'Attivo', 'CreatoIl'] as const;

const COL_USERNAME = 0;
const COL_NOME = 1;
const COL_PASSWORD_HASH = 2;
const COL_RUOLO = 3;
const COL_PUO_CREARE = 4;
const COL_PUO_CANCELLARE = 5;
const COL_PUO_VEDERE_FINANZIARIO = 6;
const COL_ATTIVO = 7;
const COL_CREATO_IL = 8;
const ACCESSI_NUM_COLS = COL_CREATO_IL + 1; // 9 (A..I)

export type Accesso = {
  row: number;
  username: string;
  nome: string;
  passwordHash: string;
  ruolo: string;
  puoCreare: boolean;
  puoCancellare: boolean;
  puoVedereFinanziario: boolean;
  attivo: boolean;
  creatoIl: string;
};

export type Permessi = {
  username: string;
  nome: string;
  puoCreare: boolean;
  puoCancellare: boolean;
  puoVedereFinanziario: boolean;
};

function ensureAccessiSheet(sheets: ReturnType<typeof getSheetsClient>): Promise<void> {
  return ensureSheetWithHeaders(sheets, ACCESSI_SHEET_NAME, ACCESSI_HEADERS, 'accessi');
}

function truthy(v: unknown): boolean {
  const s = String(v ?? '').trim().toUpperCase();
  return s === 'SI' || s === 'TRUE' || s === '1' || s === 'X';
}

function rowToAccesso(row: number, values: unknown[]): Accesso {
  const v = (i: number) => String(values[i] ?? '');
  return {
    row,
    username: v(COL_USERNAME),
    nome: v(COL_NOME),
    passwordHash: v(COL_PASSWORD_HASH),
    ruolo: v(COL_RUOLO),
    puoCreare: truthy(values[COL_PUO_CREARE]),
    puoCancellare: truthy(values[COL_PUO_CANCELLARE]),
    puoVedereFinanziario: truthy(values[COL_PUO_VEDERE_FINANZIARIO]),
    attivo: truthy(values[COL_ATTIVO]),
    creatoIl: v(COL_CREATO_IL),
  };
}

// ---- Password: scrypt (nativo in Node, nessuna dipendenza nuova) — mai salvate in chiaro ----

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(candidate, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Parole italiane semplici e riconoscibili — niente parole ambigue da scrivere/leggere al
// telefono. Passphrase tipo "sole-monte-27": memorizzabile quel poco che basta per scriverla
// su un foglietto, molto più difficile da indovinare di "Cognome2024".
const PAROLE_PASSPHRASE = [
  'sole', 'luna', 'monte', 'mare', 'fiume', 'vento', 'stella', 'nuvola', 'prato', 'bosco',
  'porto', 'ponte', 'faro', 'campo', 'torre', 'strada', 'piazza', 'giardino', 'lago', 'isola',
  'gatto', 'cane', 'lupo', 'volpe', 'aquila', 'delfino', 'cavallo', 'leone', 'orso', 'falco',
  'rosso', 'verde', 'blu', 'giallo', 'nero', 'bianco', 'viola', 'arancio', 'rosa', 'grigio',
];

export function generaPassphrase(): string {
  const pick = () => PAROLE_PASSPHRASE[Math.floor(Math.random() * PAROLE_PASSPHRASE.length)];
  const numero = Math.floor(Math.random() * 90) + 10; // 10-99
  return `${pick()}-${pick()}-${numero}`;
}

// ---- Token di sessione: HMAC firmato server-side, stateless (nessuna tabella sessioni da
// gestire/pulire) — stesso spirito "poco stato, tutto derivabile" del resto del progetto ----

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 giorni: collaboratori di famiglia, non serve un login ogni giorno

function getTokenSecret(): string {
  const secret = process.env.ACCESSI_SECRET;
  if (!secret) throw new Error('ACCESSI_SECRET mancante — va impostata su Vercel prima di poter emettere token di accesso');
  return secret;
}

export function creaToken(username: string): string {
  const expires = Date.now() + TOKEN_TTL_MS;
  const payload = `${username}:${expires}`;
  const firma = createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
  return Buffer.from(`${payload}:${firma}`).toString('base64url');
}

/** Ritorna lo username se il token è valido e non scaduto, altrimenti null. Non fa nessuna
 *  chiamata al foglio — solo verifica crittografica, veloce, per ogni richiesta protetta. */
export function verificaToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parti = decoded.split(':');
    if (parti.length !== 3) return null;
    const [username, expiresStr, firma] = parti;
    const payload = `${username}:${expiresStr}`;
    const firmaAttesa = createHmac('sha256', getTokenSecret()).update(payload).digest('hex');
    const a = Buffer.from(firma, 'hex');
    const b = Buffer.from(firmaAttesa, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() > Number(expiresStr)) return null;
    return username;
  } catch {
    return null;
  }
}

// ---- Lettura/scrittura scheda ACCESSI ----

export async function trovaAccessoPerUsername(username: string): Promise<Accesso | null> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  if (!(await sheetExists(sheets, ACCESSI_SHEET_NAME))) return null;
  const rows = await readAllRows(sheets, ACCESSI_SHEET_NAME, ACCESSI_NUM_COLS);
  const match = rows.find((r) => String(r.values[COL_USERNAME] ?? '').toLowerCase() === username.toLowerCase());
  return match ? rowToAccesso(match.row, match.values) : null;
}

/** Dato un token già verificato (username estratto), ritorna i permessi correnti — sempre
 *  letti dal foglio al momento della richiesta, mai fidandosi di quanto c'era nel token: così
 *  un cambio di permessi o una disattivazione ha effetto immediato, non alla scadenza del token. */
export async function getPermessi(username: string): Promise<Permessi | null> {
  const accesso = await trovaAccessoPerUsername(username);
  if (!accesso || !accesso.attivo) return null;
  return {
    username: accesso.username,
    nome: accesso.nome,
    puoCreare: accesso.puoCreare,
    puoCancellare: accesso.puoCancellare,
    puoVedereFinanziario: accesso.puoVedereFinanziario,
  };
}

export async function elencoAccessi(): Promise<Accesso[]> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  if (!(await sheetExists(sheets, ACCESSI_SHEET_NAME))) return [];
  const rows = await readAllRows(sheets, ACCESSI_SHEET_NAME, ACCESSI_NUM_COLS);
  return rows.map((r) => rowToAccesso(r.row, r.values));
}

export async function creaAccesso(input: {
  username: string; nome: string; ruolo: string;
  puoCreare: boolean; puoCancellare: boolean; puoVedereFinanziario: boolean;
}): Promise<{ accesso: Accesso; passwordInChiaro: string }> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  await ensureAccessiSheet(sheets);

  const esistente = await trovaAccessoPerUsername(input.username);
  if (esistente) throw new Error(`Esiste già un accesso con username "${input.username}"`);

  const passwordInChiaro = generaPassphrase();
  const targetRow = await findFirstFreeRow(sheets, ACCESSI_SHEET_NAME);
  const values: unknown[] = new Array(ACCESSI_NUM_COLS).fill('');
  values[COL_USERNAME] = input.username.toLowerCase().trim();
  values[COL_NOME] = input.nome.trim();
  values[COL_PASSWORD_HASH] = hashPassword(passwordInChiaro);
  values[COL_RUOLO] = input.ruolo.trim();
  values[COL_PUO_CREARE] = input.puoCreare ? 'SI' : '';
  values[COL_PUO_CANCELLARE] = input.puoCancellare ? 'SI' : '';
  values[COL_PUO_VEDERE_FINANZIARIO] = input.puoVedereFinanziario ? 'SI' : '';
  values[COL_ATTIVO] = 'SI';
  values[COL_CREATO_IL] = new Date().toISOString();

  await sheets.spreadsheets.values.update({
    spreadsheetId: fileIdForTab('ACCESSI'),
    range: `${ACCESSI_SHEET_NAME}!A${targetRow}:${String.fromCharCode(65 + ACCESSI_NUM_COLS - 1)}${targetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });

  return { accesso: rowToAccesso(targetRow, values), passwordInChiaro };
}

/** Genera una nuova password per un accesso esistente (la vecchia smette di funzionare subito)
 *  — l'unico modo per "recuperare" un accesso dimenticato, mai una rilettura della vecchia. */
export async function resettaPassword(username: string): Promise<string> {
  const accesso = await trovaAccessoPerUsername(username);
  if (!accesso) throw new Error(`Nessun accesso trovato per "${username}"`);

  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  const passwordInChiaro = generaPassphrase();
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileIdForTab('ACCESSI'),
    range: `${ACCESSI_SHEET_NAME}!${String.fromCharCode(65 + COL_PASSWORD_HASH)}${accesso.row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[hashPassword(passwordInChiaro)]] },
  });
  return passwordInChiaro;
}

export async function impostaAttivo(username: string, attivo: boolean): Promise<void> {
  const accesso = await trovaAccessoPerUsername(username);
  if (!accesso) throw new Error(`Nessun accesso trovato per "${username}"`);

  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileIdForTab('ACCESSI'),
    range: `${ACCESSI_SHEET_NAME}!${String.fromCharCode(65 + COL_ATTIVO)}${accesso.row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[attivo ? 'SI' : '']] },
  });
}
