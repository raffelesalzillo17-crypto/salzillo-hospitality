import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { google, sheets_v4 } from 'googleapis';
import path from 'path';
import { getScia } from '@/lib/strutture';

export const runtime = 'nodejs';

// ATTENZIONE: contratto generato in automatico, NON revisionato da un legale.
// Vedi il testo BOZZA stampato su ogni pagina del PDF: non usare con ospiti reali
// prima di far controllare il testo a un commercialista/legale.
//
// Audit trail: dopo aver generato il PDF con successo, viene scritta una riga sulla scheda
// "CONTRATTI" dello stesso spreadsheet SalzilloFlow_2026 usato da /api/prenotazioni,
// /api/spese, /api/scadenze ecc. — stesso pattern di autenticazione/creazione automatica
// della scheda di src/app/api/pulizie-stato/route.ts. File self-contained (nessun import da
// src/lib/) perché quella parte è in refactor in parallelo su un altro file.
// Non tocca in alcun modo il testo/le clausole del contratto qui sopra: logga solo i dati
// reali già presenti nella richiesta (mai valori inventati) ed è non-bloccante — un errore di
// scrittura sul foglio non deve mai impedire la restituzione del PDF già generato.

// Elenco strutture centralizzato in src/lib/strutture.ts (09/09/2026) — qui restano solo i
// dati fiscali di default per ciascuna SCIA, specifici di questa route.
const DEFAULT_TULIPANO = {
  intestatario: 'Luigi Salzillo',
  indirizzoStruttura: 'Via Clanio 60, Marcianise (CE)',
  cf: 'SLZLGU74C08E932O',
};

// Via Campania (Piano Terra/Primo Piano/Secondo Piano, rinominate da Stanza 3/4/5 l'08/09/2026): intestatario non confermato dalle fonti — nessun default,
// va compilato a mano nel form prima di generare il contratto.
const DEFAULT_ALTRO = {
  intestatario: '',
  indirizzoStruttura: '',
  cf: '',
};

type ContrattoBody = {
  ospite: string;
  stanza: string;
  checkin: string;   // DD/MM/YYYY
  checkout: string;  // DD/MM/YYYY
  canale?: string;
  lordo: number;
  intestatario?: string;
  indirizzoStruttura?: string;
  cf?: string;
  documentoOspite?: string; // tipo + numero documento, facoltativo (spazio bianco se assente)
  cfOspite?: string;
  cauzione?: number | null;
  giorniPreavvisoCancellazione?: number; // default 3
  luogo?: string;
  dataContratto?: string; // DD/MM/YYYY, default oggi
};

const BOZZA_TESTO = 'BOZZA — CONTRATTO NON REVISIONATO DA UN LEGALE. NON UTILIZZARE CON OSPITI REALI PRIMA DI FAR CONTROLLARE IL TESTO A UN COMMERCIALISTA/LEGALE.';

function fmtEuro(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function oggiIt(): string {
  const d = new Date();
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const PAGE_W = 595.28;
const PAGE_H = 841.89; // A4
const MARGIN_X = 56;

function wrapText(text: string, font: import('pdf-lib').PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function generaPdf(body: ContrattoBody): Promise<Uint8Array> {
  const defaults = getScia(body.stanza) === 'tulipano' ? DEFAULT_TULIPANO : DEFAULT_ALTRO;

  const intestatario = body.intestatario?.trim() || defaults.intestatario;
  const indirizzoStruttura = body.indirizzoStruttura?.trim() || defaults.indirizzoStruttura;
  const cf = body.cf?.trim() || defaults.cf;
  const dataContratto = body.dataContratto?.trim() || oggiIt();
  const luogo = body.luogo?.trim() || 'Marcianise';
  const lordo = Number.isFinite(body.lordo) ? body.lordo : 0;
  const cauzione = typeof body.cauzione === 'number' && Number.isFinite(body.cauzione) ? body.cauzione : 0;
  const giorniPreavviso = Number.isFinite(body.giorniPreavvisoCancellazione)
    ? Math.max(0, Math.trunc(body.giorniPreavvisoCancellazione as number))
    : 3;
  const documentoOspite = body.documentoOspite?.trim() || '';
  const cfOspite = body.cfOspite?.trim() || '';

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.44);
  const bozzaColor = rgb(0.78, 0.09, 0.09);

  let page!: import('pdf-lib').PDFPage;
  let y = 0;
  const contentWidth = PAGE_W - 2 * MARGIN_X;
  const bottomLimit = 70; // riservato per il banner BOZZA di fondo pagina

  function addPage() {
    page = pdf.addPage([PAGE_W, PAGE_H]);
    y = PAGE_H - 40;
    // Banner BOZZA in testa, ben visibile
    const bannerLines = wrapText(BOZZA_TESTO, fontBold, 10, contentWidth);
    for (const line of bannerLines) {
      page.drawText(line, { x: MARGIN_X, y, size: 10, font: fontBold, color: bozzaColor });
      y -= 13;
    }
    page.drawLine({ start: { x: MARGIN_X, y: y - 2 }, end: { x: PAGE_W - MARGIN_X, y: y - 2 }, thickness: 1, color: bozzaColor });
    y -= 22;

    // Banner BOZZA in fondo, ben visibile
    let footerY = 48;
    const footerLines = wrapText(BOZZA_TESTO, fontBold, 9, contentWidth);
    page.drawLine({ start: { x: MARGIN_X, y: footerY + footerLines.length * 12 + 6 }, end: { x: PAGE_W - MARGIN_X, y: footerY + footerLines.length * 12 + 6 }, thickness: 1, color: bozzaColor });
    for (const line of footerLines) {
      page.drawText(line, { x: MARGIN_X, y: footerY, size: 9, font: fontBold, color: bozzaColor });
      footerY -= 12;
    }
  }

  function ensureSpace(needed: number) {
    if (y - needed < bottomLimit) addPage();
  }

  function draw(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; maxWidth?: number } = {}) {
    const { size = 10.5, bold = false, color = ink, x = MARGIN_X, maxWidth = contentWidth - (x - MARGIN_X) } = opts;
    const f = bold ? fontBold : font;
    const lines = wrapText(text, f, size, maxWidth);
    for (const line of lines) {
      ensureSpace(size + 4);
      page.drawText(line, { x, y, size, font: f, color });
      y -= size + 4;
    }
  }

  function gap(n = 10) {
    ensureSpace(n);
    y -= n;
  }

  function heading(text: string) {
    gap(10);
    ensureSpace(18);
    page.drawText(text, { x: MARGIN_X, y, size: 12.5, font: fontBold, color: ink });
    y -= 16;
    page.drawLine({ start: { x: MARGIN_X, y: y + 4 }, end: { x: PAGE_W - MARGIN_X, y: y + 4 }, thickness: 0.5, color: rgb(0.82, 0.82, 0.82) });
    gap(6);
  }

  addPage();

  // Titolo
  ensureSpace(24);
  page.drawText('CONTRATTO DI LOCAZIONE TURISTICA', { x: MARGIN_X, y, size: 16, font: fontBold, color: ink });
  y -= 22;
  draw(`Contratto del ${dataContratto} — ${luogo}`, { size: 9.5, color: muted });
  gap(14);

  // Locatore / Conduttore
  heading('Locatore (proprietario/gestore)');
  draw(intestatario || '(intestatario da definire — compilare a mano prima della firma)', { bold: true, size: 11.5 });
  if (indirizzoStruttura) draw(`Indirizzo: ${indirizzoStruttura}`, { size: 10 });
  if (cf) draw(`Codice fiscale/P.IVA: ${cf}`, { size: 10 });
  draw('(di seguito "il Locatore")', { size: 9.5, color: muted });

  heading('Conduttore (ospite)');
  draw(body.ospite || '(nome ospite da definire)', { bold: true, size: 11.5 });
  draw(`Documento di identità: ${documentoOspite || '_______________________________ (da compilare a mano)'}`, { size: 10 });
  draw(`Codice fiscale: ${cfOspite || '_______________________________ (da compilare a mano, se disponibile)'}`, { size: 10 });
  draw('(di seguito "il Conduttore")', { size: 9.5, color: muted });

  heading('Oggetto della locazione');
  draw(`Il Locatore concede in locazione turistica al Conduttore l'unità abitativa/camera "${body.stanza}", sita in ${indirizzoStruttura || '_______________________________ (indirizzo da definire)'}, per uso esclusivamente turistico/ricettivo, con esclusione di ogni destinazione ad uso abitativo stabile.`);

  heading('Durata del soggiorno');
  draw(`Check-in: ${body.checkin || '__/__/____'}, a partire dalle ore 15:00 (orario indicativo).`);
  draw(`Check-out: ${body.checkout || '__/__/____'}, entro le ore 10:00.`);
  draw('Gli orari sopra indicati sono indicativi: eventuali anticipi/posticipi vanno concordati preventivamente con il Locatore.', { size: 9.5, color: muted });

  heading('Corrispettivo e modalità di pagamento');
  draw(`Il corrispettivo pattuito per l'intero soggiorno è pari a € ${fmtEuro(lordo)}${body.canale ? ` (prenotazione tramite canale: ${body.canale})` : ''}.`);
  draw('Il pagamento avviene secondo le modalità concordate tra le parti (bonifico bancario, contanti, piattaforma di prenotazione o altro mezzo tracciabile), da saldare entro il check-in salvo diverso accordo scritto.');

  heading('Deposito cauzionale');
  draw(cauzione > 0
    ? `Il Conduttore versa al Locatore, a titolo di deposito cauzionale a garanzia di eventuali danni all'immobile o alle sue dotazioni, l'importo di € ${fmtEuro(cauzione)}, restituito entro 7 giorni dal check-out, salvo detrazioni per danni accertati.`
    : "Deposito cauzionale: € ____________ (importo da definire — campo lasciato vuoto/0 di default, da compilare prima della firma). A garanzia di eventuali danni all'immobile o alle sue dotazioni, restituito entro 7 giorni dal check-out salvo detrazioni per danni accertati."
  );

  heading('Cancellazione e recesso');
  draw(`Il Conduttore può cancellare la prenotazione gratuitamente fino a ${giorniPreavviso} giorni prima della data di check-in, con diritto al rimborso integrale delle somme già versate (esclusa l'eventuale caparra/acconto già trattenuta secondo le condizioni del canale di prenotazione).`);
  draw(`In caso di cancellazione comunicata a meno di ${giorniPreavviso} giorni dal check-in, o di mancata presentazione ("no-show"), il Locatore trattiene la caparra/l'acconto versato a titolo di penale, fatto salvo il diritto ad un maggior danno.`);
  draw(`Nota: il termine di ${giorniPreavviso} giorni è un valore standard modificabile — va adeguato alle condizioni realmente applicate (incluse eventuali policy del canale di prenotazione, es. Airbnb/Booking).`, { size: 9, color: bozzaColor });

  heading('Regole della casa');
  const regole = [
    "Non è consentito fumare all'interno dell'unità abitativa (consentito negli spazi esterni).",
    'Animali domestici ammessi solo di piccola taglia, previo accordo con il Locatore.',
    "Non sono ammesse feste o eventi all'interno dell'unità abitativa.",
    'Silenzio dopo le ore 22:00, nel rispetto degli altri ospiti e del vicinato.',
    'Ospiti aggiuntivi rispetto a quelli registrati vanno concordati preventivamente con il Locatore, con eventuale supplemento.',
  ];
  for (const r of regole) draw(`• ${r}`, { size: 10 });

  heading('Registrazione ospiti (obbligo di legge)');
  draw("Il Conduttore prende atto che i propri dati anagrafici e documento di identità saranno comunicati dal Locatore alle autorità competenti (Alloggiati Web — Polizia di Stato; Sinfonia Turismo Smart — Regione Campania) come previsto dalla normativa vigente sulle locazioni turistiche.");

  heading('Foro competente');
  draw('Per qualsiasi controversia relativa al presente contratto sarà competente il Foro del luogo in cui è ubicato l\'immobile, salvo diversa inderogabile disposizione di legge (es. foro del consumatore).');

  heading('Data, luogo e firme');
  draw(`${luogo}, ${dataContratto}`, { size: 10.5 });
  gap(28);
  ensureSpace(40);
  page.drawText('Il Locatore', { x: MARGIN_X, y, size: 10, font, color: muted });
  page.drawText('Il Conduttore', { x: MARGIN_X + 280, y, size: 10, font, color: muted });
  y -= 6;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: MARGIN_X + 200, y }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });
  page.drawLine({ start: { x: MARGIN_X + 280, y }, end: { x: MARGIN_X + 480, y }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });

  return pdf.save();
}

// ---- Audit trail "CONTRATTI" (Google Sheets) -------------------------------------------

// La scheda CONTRATTI è stata spostata nel file "SH · Prenotazioni & Ospiti" il 10/09/2026
// (vedi src/lib/sheets.ts). Fallback al file originale se la variabile non è impostata.
const SPREADSHEET_ID = process.env.SPREADSHEET_ID_PRENOTAZIONI || '11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys';

const CONTRATTI_SHEET_NAME = 'CONTRATTI';

const CONTRATTI_HEADERS = [
  'Data generazione', 'Ospite', 'Stanza', 'Check-in', 'Check-out', 'Canale', 'Importo lordo', 'Note',
];

const COL_DATA_GENERAZIONE = 0;
const COL_OSPITE = 1;
const COL_STANZA = 2;
const COL_CHECKIN = 3;
const COL_CHECKOUT = 4;
const COL_CANALE = 5;
const COL_IMPORTO_LORDO = 6;
const COL_NOTE = 7;
const CONTRATTI_NUM_COLS = COL_NOTE + 1; // 8 (A..H)

type ContrattoLoggato = {
  row: number;
  dataGenerazione: string; // ISO
  ospite: string;
  stanza: string;
  checkin: string;
  checkout: string;
  canale: string;
  importoLordo: number | null;
  note: string;
};

function getAuth(scopes: string[]) {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON), scopes });
  }
  return new google.auth.GoogleAuth({ keyFile: path.join(process.cwd(), 'google-credentials.json'), scopes });
}

function colLetter(idx: number): string {
  return String.fromCharCode(65 + idx);
}

// Crea la scheda "CONTRATTI" (con intestazioni) se non esiste ancora. Idempotente come
// ensurePulizieSheet in src/app/api/pulizie-stato/route.ts.
async function ensureContrattiSheet(sheets: sheets_v4.Sheets): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: SPREADSHEET_ID,
    fields: 'sheets.properties.title',
  });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === CONTRATTI_SHEET_NAME);

  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: CONTRATTI_SHEET_NAME } } }] },
      });
      console.log('[contratto] scheda "CONTRATTI" creata');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already exists/i.test(msg)) throw e;
      console.log('[contratto] scheda "CONTRATTI" già creata da un\'altra richiesta in parallelo');
    }
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CONTRATTI_SHEET_NAME}!A1:${colLetter(CONTRATTI_NUM_COLS - 1)}1`,
  });
  const headerRow = headerRes.data.values?.[0];
  if (!headerRow || headerRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONTRATTI_SHEET_NAME}!A1:${colLetter(CONTRATTI_NUM_COLS - 1)}1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [CONTRATTI_HEADERS] },
    });
    console.log('[contratto] intestazioni scritte');
  }
}

function rowToContrattoLoggato(row: number, values: unknown[]): ContrattoLoggato {
  const v = (i: number) => String(values[i] ?? '');
  const importoRaw = values[COL_IMPORTO_LORDO];
  const importoLordo = typeof importoRaw === 'number' && Number.isFinite(importoRaw) ? importoRaw : null;
  return {
    row,
    dataGenerazione: v(COL_DATA_GENERAZIONE),
    ospite: v(COL_OSPITE),
    stanza: v(COL_STANZA),
    checkin: v(COL_CHECKIN),
    checkout: v(COL_CHECKOUT),
    canale: v(COL_CANALE),
    importoLordo,
    note: v(COL_NOTE),
  };
}

// Estrae l'importo lordo direttamente dal body grezzo della richiesta (non dal ContrattoBody già
// "difestato" da parseBody, che porta lordo mancante/non valido a 0): un default a 0 introdotto a
// valle sembrerebbe un vero importo di €0, mentre qui vogliamo loggare vuoto quando il dato non
// era davvero disponibile. Mai inventare: solo ciò che è realmente presente nella richiesta.
function estraiLordoPerLog(json: unknown): number | null {
  if (!json || typeof json !== 'object') return null;
  const raw = (json as Record<string, unknown>).lordo;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const n = parseFloat(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

// Scrive una riga di audit trail sulla scheda "CONTRATTI" dopo la generazione riuscita del PDF.
// Chiamata dal POST solo dopo generaPdf() con successo; il chiamante la avvolge in try/catch
// (non-bloccante: un errore qui non deve mai impedire la restituzione del PDF).
async function logContrattoGenerato(body: ContrattoBody, lordoPerLog: number | null): Promise<void> {
  const scopes = ['https://www.googleapis.com/auth/spreadsheets'];
  const auth = getAuth(scopes);
  const sheets = google.sheets({ version: 'v4', auth });

  await ensureContrattiSheet(sheets);

  // Stessa tecnica di src/app/api/spese/route.ts: prima riga libera dopo l'ultima riga
  // occupata in colonna A.
  const colARes = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CONTRATTI_SHEET_NAME}!A:A`,
  });
  const targetRow = (colARes.data.values?.length ?? 1) + 1;

  const values: unknown[] = new Array(CONTRATTI_NUM_COLS).fill('');
  values[COL_DATA_GENERAZIONE] = new Date().toISOString();
  values[COL_OSPITE] = body.ospite ?? '';
  values[COL_STANZA] = body.stanza ?? '';
  values[COL_CHECKIN] = body.checkin ?? '';
  values[COL_CHECKOUT] = body.checkout ?? '';
  values[COL_CANALE] = body.canale?.trim() || '';
  values[COL_IMPORTO_LORDO] = lordoPerLog ?? '';
  values[COL_NOTE] = '';

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${CONTRATTI_SHEET_NAME}!A${targetRow}:${colLetter(CONTRATTI_NUM_COLS - 1)}${targetRow}`,
    // RAW come in src/app/api/spese/route.ts: evita che Sheets converta le date DD/MM/YYYY in
    // date vere, cosa che romperebbe la lettura testuale in GET.
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });
}

async function sheetContrattiExists(sheets: sheets_v4.Sheets): Promise<boolean> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID, fields: 'sheets.properties.title' });
  return (meta.data.sheets ?? []).some((s) => s.properties?.title === CONTRATTI_SHEET_NAME);
}

// GET: elenco degli ultimi contratti generati (per la UI "nice to have" in plancia). Sola
// lettura, scope readonly, nessuna scrittura.
export async function GET() {
  try {
    const auth = getAuth(['https://www.googleapis.com/auth/spreadsheets.readonly']);
    const sheets = google.sheets({ version: 'v4', auth });

    if (!(await sheetContrattiExists(sheets))) {
      return NextResponse.json({ ok: true, contratti: [] });
    }

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${CONTRATTI_SHEET_NAME}!A2:${colLetter(CONTRATTI_NUM_COLS - 1)}1000`,
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const rows = res.data.values ?? [];
    const contratti = rows
      .map((values, idx) => ({ row: idx + 2, values }))
      .filter((r) => r.values.some((c) => String(c ?? '').trim() !== ''))
      .map((r) => rowToContrattoLoggato(r.row, r.values))
      .sort((a, b) => b.dataGenerazione.localeCompare(a.dataGenerazione)) // ISO: ordine lessicografico = cronologico
      .slice(0, 20);

    return NextResponse.json({ ok: true, contratti });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[contratto] GET ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ---- fine audit trail --------------------------------------------------------------------

function parseBody(json: unknown): ContrattoBody | null {
  if (!json || typeof json !== 'object') return null;
  const b = json as Record<string, unknown>;
  if (typeof b.ospite !== 'string' || !b.ospite.trim()) return null;
  if (typeof b.stanza !== 'string' || !b.stanza.trim()) return null;
  if (typeof b.checkin !== 'string' || typeof b.checkout !== 'string') return null;
  const lordo = typeof b.lordo === 'number' ? b.lordo : parseFloat(String(b.lordo ?? 0));
  const giorni = typeof b.giorniPreavvisoCancellazione === 'number'
    ? b.giorniPreavvisoCancellazione
    : (b.giorniPreavvisoCancellazione !== undefined ? parseFloat(String(b.giorniPreavvisoCancellazione)) : 3);
  return {
    ospite: b.ospite,
    stanza: b.stanza,
    checkin: b.checkin,
    checkout: b.checkout,
    canale: typeof b.canale === 'string' ? b.canale : undefined,
    lordo: Number.isFinite(lordo) ? lordo : 0,
    intestatario: typeof b.intestatario === 'string' ? b.intestatario : undefined,
    indirizzoStruttura: typeof b.indirizzoStruttura === 'string' ? b.indirizzoStruttura : undefined,
    cf: typeof b.cf === 'string' ? b.cf : undefined,
    documentoOspite: typeof b.documentoOspite === 'string' ? b.documentoOspite : undefined,
    cfOspite: typeof b.cfOspite === 'string' ? b.cfOspite : undefined,
    cauzione: typeof b.cauzione === 'number' ? b.cauzione : null,
    giorniPreavvisoCancellazione: Number.isFinite(giorni) ? giorni : 3,
    luogo: typeof b.luogo === 'string' ? b.luogo : undefined,
    dataContratto: typeof b.dataContratto === 'string' ? b.dataContratto : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = parseBody(json);
    if (!body) {
      return NextResponse.json({ error: 'Dati mancanti: servono almeno ospite, stanza, checkin, checkout, lordo.' }, { status: 400 });
    }
    const pdfBytes = await generaPdf(body);
    const nome = `bozza-contratto-${body.stanza.replace(/\s+/g, '')}-${body.ospite.replace(/\s+/g, '')}.pdf`.toLowerCase();

    // Audit trail: SOLO dopo la generazione riuscita del PDF. Non-bloccante — se la scrittura
    // sul foglio fallisce, il PDF va comunque restituito all'utente (solo log dell'errore).
    try {
      await logContrattoGenerato(body, estraiLordoPerLog(json));
    } catch (auditErr) {
      const auditMsg = auditErr instanceof Error ? auditErr.message : String(auditErr);
      console.error('[contratto] ERRORE scrittura audit trail su "CONTRATTI" (PDF comunque restituito):', auditMsg);
    }

    // Salva il PDF nella cartella Drive dell'ospite — non-bloccante, stesso principio
    // dell'audit trail sopra: se Drive non è ancora configurato o fallisce, il PDF va
    // comunque restituito. Vedi src/lib/documenti.ts.
    try {
      const { trovaOCreaOspite } = await import('@/lib/ospiti');
      const { registraDocumento } = await import('@/lib/documenti');
      const ospite = await trovaOCreaOspite(body.ospite, '');
      await registraDocumento({ ospiteId: ospite.ospiteId, nomeOspite: ospite.nome, nomeFile: nome, contenuto: Buffer.from(pdfBytes), tipo: 'Contratto ospite' });
    } catch (docErr) {
      const docMsg = docErr instanceof Error ? docErr.message : String(docErr);
      console.error('[contratto] ERRORE salvataggio documento su Drive (PDF comunque restituito):', docMsg);
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nome}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[contratto] ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
