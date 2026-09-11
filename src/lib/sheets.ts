import { google, sheets_v4 } from "googleapis";
import path from "path";

// Libreria condivisa per tutte le route che leggono/scrivono sul foglio Google
// SalzilloFlow_2026 (prenotazioni, scadenze, pulizie, spese, schedine, contratti,
// tracciamento email prenotazioni...). Prima dell'08/09/2026 ogni route duplicava
// (quasi identiche, copia-incolla) le stesse funzioni getAuth/colLetter/ensureSheet/
// readAllRows — bug o modifiche fatte in una route non si propagavano alle altre.
// Consolidato in un unico posto su richiesta di Raffaele ("rivedi il back office").
//
// Comportamento INVARIATO rispetto a prima: stessa auth (service account via
// GOOGLE_CREDENTIALS_JSON o google-credentials.json), stesso schema "crea la scheda
// se manca + scrivi intestazioni se mancano", stessa tecnica per la prima riga libera.

// Fino al 10/09/2026 tutto stava in un unico foglio "SalzilloFlow 2026" (26 tab). Su
// richiesta di Raffaele ("archivio separato e catalogato") i dati operativi sono stati
// spostati in 3 file distinti su Drive (cartella "Archivio — Salzillo Hospitality"). Questo
// ID resta quello del file originale: contiene ancora i 12 fogli mensili di contabilità
// (GENNAIO…DICEMBRE) + RECAP + CONFIG, che il codice non tocca, ed è il fallback quando le
// variabili SPREADSHEET_ID_* non sono impostate (es. in locale) — così niente si rompe
// prima che la migrazione sia completa. La migrazione ha COPIATO i tab (copyTo, non
// spostato): i vecchi tab restano nel file originale come backup finché il nuovo assetto
// non è verificato in produzione.
export const SPREADSHEET_ID = "11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys";

const FILE_PRENOTAZIONI = process.env.SPREADSHEET_ID_PRENOTAZIONI || SPREADSHEET_ID;
const FILE_GESTIONE = process.env.SPREADSHEET_ID_GESTIONE || SPREADSHEET_ID;
const FILE_SISTEMA = process.env.SPREADSHEET_ID_SISTEMA || SPREADSHEET_ID;

// Mappa tab -> file di destinazione. Un tab non elencato (es. i fogli mensili di
// contabilità) resta sul file originale.
const TAB_FILE: Record<string, string> = {
  DATABASE: FILE_PRENOTAZIONI,
  OSPITI: FILE_PRENOTAZIONI,
  SCHEDINE: FILE_PRENOTAZIONI,
  CONTRATTI: FILE_PRENOTAZIONI,
  PREVENTIVI: FILE_PRENOTAZIONI,
  PAGAMENTI: FILE_PRENOTAZIONI,
  PULIZIE: FILE_GESTIONE,
  SPESE: FILE_GESTIONE,
  SCADENZE: FILE_GESTIONE,
  CONTI: FILE_GESTIONE,
  EVENTI_LOCALI: FILE_GESTIONE,
  PROPRIETARI: FILE_GESTIONE,
  IMMOBILI: FILE_GESTIONE,
  ALLOGGI: FILE_GESTIONE,
  CONTRATTI_GESTIONE: FILE_GESTIONE,
  PREZZI_PERIODO: FILE_GESTIONE,
  ACCESSI: FILE_SISTEMA,
  BOT_STATE: FILE_SISTEMA,
  TELEGRAM_LOG: FILE_SISTEMA,
  EmailProcessate: FILE_SISTEMA,
  CREDENZIALI: FILE_SISTEMA,
};

/** ID del file Google Sheets che contiene questo tab. Fallback al file originale per i tab
 *  non ancora migrati (o quando le variabili d'ambiente non sono impostate). */
export function fileIdForTab(tab: string): string {
  return TAB_FILE[tab] ?? SPREADSHEET_ID;
}

export function getAuth(scopes: string[]) {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
      scopes,
    });
  }
  return new google.auth.GoogleAuth({
    keyFile: path.join(process.cwd(), "google-credentials.json"),
    scopes,
  });
}

/** Client Sheets pronto all'uso con lo scope richiesto (default: sola lettura). */
export function getSheetsClient(
  scopes: string[] = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
): sheets_v4.Sheets {
  return google.sheets({ version: "v4", auth: getAuth(scopes) });
}

/** Indice colonna 0-based -> lettera A1 (A, B, C... sufficiente per le tabelle di questo progetto). */
export function colLetter(idx: number): string {
  return String.fromCharCode(65 + idx);
}

/**
 * Crea la scheda `sheetName` (con intestazioni) sullo spreadsheet condiviso se non esiste
 * ancora. Idempotente: se due richieste corrono in parallelo e la creazione fallisce perché
 * la scheda esiste già, l'errore "already exists" viene ignorato (stesso comportamento delle
 * versioni duplicate che sostituisce).
 */
export async function ensureSheetWithHeaders(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  headers: readonly string[],
  logLabel: string = sheetName
): Promise<void> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId: fileIdForTab(sheetName),
    fields: "sheets.properties.title",
  });
  const exists = (meta.data.sheets ?? []).some((s) => s.properties?.title === sheetName);

  if (!exists) {
    try {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: fileIdForTab(sheetName),
        requestBody: { requests: [{ addSheet: { properties: { title: sheetName } } }] },
      });
      console.log(`[${logLabel}] scheda "${sheetName}" creata`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/already exists/i.test(msg)) throw e;
      console.log(`[${logLabel}] scheda "${sheetName}" già creata da un'altra richiesta in parallelo`);
    }
  }

  const lastCol = colLetter(headers.length - 1);
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab(sheetName),
    range: `${sheetName}!A1:${lastCol}1`,
  });
  const headerRow = headerRes.data.values?.[0];
  if (!headerRow || headerRow.length === 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab(sheetName),
      range: `${sheetName}!A1:${lastCol}1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers as string[]] },
    });
    console.log(`[${logLabel}] intestazioni scritte`);
  }
}

/** True se la scheda esiste già (senza crearla) — usato dalle GET per evitare di richiedere
 *  lo scope di scrittura solo per verificare l'esistenza. */
export async function sheetExists(sheets: sheets_v4.Sheets, sheetName: string): Promise<boolean> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: fileIdForTab(sheetName), fields: "sheets.properties.title" });
  return (meta.data.sheets ?? []).some((s) => s.properties?.title === sheetName);
}

/** sheetId numerico (diverso dal nome) — serve per operazioni come deleteDimension. */
export async function getSheetIdByName(sheets: sheets_v4.Sheets, sheetName: string): Promise<number | null> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: fileIdForTab(sheetName), fields: "sheets.properties" });
  const props = (meta.data.sheets ?? []).find((s) => s.properties?.title === sheetName)?.properties;
  return props?.sheetId ?? null;
}

/** Tutte le righe non vuote a partire dalla riga 2 (la 1 è l'intestazione), con il numero di
 *  riga reale sul foglio (per poter poi fare update/delete mirati).
 *  `valueRenderOption: 'UNFORMATTED_VALUE'` serve per colonne numeriche (es. Importo in
 *  src/app/api/spese/route.ts): senza, Sheets può restituire il valore troncato se la cella
 *  ha un formato a 0 decimali — il default resta FORMATTED_VALUE (comportamento di sempre
 *  per scadenze/pulizie/schedine, che leggono solo testo). */
export async function readAllRows(
  sheets: sheets_v4.Sheets,
  sheetName: string,
  numCols: number,
  maxRow: number = 1000,
  valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE'
): Promise<{ row: number; values: unknown[] }[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab(sheetName),
    range: `${sheetName}!A2:${colLetter(numCols - 1)}${maxRow}`,
    ...(valueRenderOption ? { valueRenderOption } : {}),
  });
  const rows = res.data.values ?? [];
  return rows
    .map((values, idx) => ({ row: idx + 2, values }))
    .filter((r) => r.values.some((c) => String(c ?? "").trim() !== ""));
}

/** Prima riga libera dopo l'ultima occupata in colonna A (evita di sovrascrivere righe se ce
 *  ne sono di "sporche"/vuote in mezzo — stessa tecnica usata in tutte le route esistenti). */
export async function findFirstFreeRow(sheets: sheets_v4.Sheets, sheetName: string): Promise<number> {
  const colARes = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab(sheetName),
    range: `${sheetName}!A:A`,
  });
  return (colARes.data.values?.length ?? 1) + 1;
}

