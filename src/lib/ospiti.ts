import { getSheetsClient, ensureSheetWithHeaders, readAllRows, findFirstFreeRow, sheetExists, fileIdForTab } from './sheets';
import { randomBytes } from 'crypto';

// Anagrafica ospiti/clienti — prima pietra dell'architettura "pensata per un cliente, non solo
// per una prenotazione" discussa con Raffaele il 09/09/2026 (vedi
// wiki/decisioni/architettura-dati-pronta-per-server-domestico.md). Oggi ogni prenotazione è
// una riga isolata su DATABASE, senza nessun collegamento tra soggiorni diversi della stessa
// persona, e senza un posto dove agganciare i suoi documenti (contratto, ricevuta, schedina).
// Questo file introduce quel collegamento: un ospite è un'entità propria, con un id stabile,
// a cui prenotazioni e documenti si agganciano.
//
// Deduplica onesta, non perfetta: l'unico dato davvero univoco che abbiamo oggi al momento
// della prenotazione è il telefono (facoltativo, aggiunto il 07/09/2026). Quando c'è, è la
// chiave. Quando manca, si fa fallback sul nome esatto (case-insensitive) — impreciso (due
// "Mario Rossi" diversi finirebbero collegati), ma è il massimo che i dati disponibili oggi
// permettono senza inventare un identificativo che non esiste. Va migliorato quando si
// raccoglierà un dato più affidabile (es. codice fiscale, chiesto solo più avanti nel
// check-in per Alloggiati Web).

export const OSPITI_SHEET_NAME = 'OSPITI';
export const OSPITI_HEADERS = ['OspiteId', 'Nome', 'Telefono', 'CodiceFiscale', 'Note', 'CreatoIl', 'AggiornatoIl'] as const;

const COL_ID = 0;
const COL_NOME = 1;
const COL_TELEFONO = 2;
const COL_CF = 3;
const COL_NOTE = 4;
const COL_CREATO = 5;
const COL_AGGIORNATO = 6;
const OSPITI_NUM_COLS = COL_AGGIORNATO + 1; // 7 (A..G)

export type Ospite = {
  row: number;
  ospiteId: string;
  nome: string;
  telefono: string;
  codiceFiscale: string;
  note: string;
  creatoIl: string;
  aggiornatoIl: string;
};

function normalizzaTelefono(tel: string): string {
  return tel.replace(/[^\d+]/g, '');
}

function rowToOspite(row: number, values: unknown[]): Ospite {
  const v = (i: number) => String(values[i] ?? '');
  return {
    row,
    ospiteId: v(COL_ID),
    nome: v(COL_NOME),
    telefono: v(COL_TELEFONO),
    codiceFiscale: v(COL_CF),
    note: v(COL_NOTE),
    creatoIl: v(COL_CREATO),
    aggiornatoIl: v(COL_AGGIORNATO),
  };
}

function nuovoOspiteId(): string {
  return 'osp_' + randomBytes(6).toString('hex');
}

async function ensureOspitiSheet(sheets: ReturnType<typeof getSheetsClient>): Promise<void> {
  return ensureSheetWithHeaders(sheets, OSPITI_SHEET_NAME, OSPITI_HEADERS, 'ospiti');
}

export async function elencoOspiti(): Promise<Ospite[]> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  if (!(await sheetExists(sheets, OSPITI_SHEET_NAME))) return [];
  const rows = await readAllRows(sheets, OSPITI_SHEET_NAME, OSPITI_NUM_COLS);
  return rows.map((r) => rowToOspite(r.row, r.values));
}

export async function trovaOspite(ospiteId: string): Promise<Ospite | null> {
  const tutti = await elencoOspiti();
  return tutti.find((o) => o.ospiteId === ospiteId) ?? null;
}

/**
 * Trova o crea l'ospite corrispondente a nome/telefono di una prenotazione. Pensata per
 * essere chiamata da /api/prenotazione ad ogni nuova prenotazione — mai bloccante: un errore
 * qui non deve mai impedire il salvataggio della prenotazione stessa (stesso principio già
 * usato per Calendar e per gli audit trail).
 */
export async function trovaOCreaOspite(nome: string, telefono: string): Promise<Ospite> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  await ensureOspitiSheet(sheets);

  const nomeNorm = nome.trim();
  const telNorm = telefono ? normalizzaTelefono(telefono) : '';

  const tutti = await elencoOspiti();
  const esistente = telNorm
    ? tutti.find((o) => o.telefono && normalizzaTelefono(o.telefono) === telNorm)
    : tutti.find((o) => o.nome.trim().toLowerCase() === nomeNorm.toLowerCase() && !o.telefono);

  const ora = new Date().toISOString();

  if (esistente) {
    // Aggiorna il telefono se prima mancava ed è arrivato ora, e "tocca" aggiornatoIl.
    if (telNorm && !esistente.telefono) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: fileIdForTab('OSPITI'),
        range: `${OSPITI_SHEET_NAME}!C${esistente.row}:C${esistente.row}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[telefono]] },
      });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('OSPITI'),
      range: `${OSPITI_SHEET_NAME}!G${esistente.row}:G${esistente.row}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[ora]] },
    });
    return { ...esistente, telefono: esistente.telefono || telefono, aggiornatoIl: ora };
  }

  const ospiteId = nuovoOspiteId();
  const targetRow = await findFirstFreeRow(sheets, OSPITI_SHEET_NAME);
  const values = [ospiteId, nomeNorm, telefono ?? '', '', '', ora, ora];
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileIdForTab('OSPITI'),
    range: `${OSPITI_SHEET_NAME}!A${targetRow}:G${targetRow}`,
    valueInputOption: 'RAW',
    requestBody: { values: [values] },
  });

  return { row: targetRow, ospiteId, nome: nomeNorm, telefono: telefono ?? '', codiceFiscale: '', note: '', creatoIl: ora, aggiornatoIl: ora };
}

export async function aggiornaCodiceFiscale(ospiteId: string, codiceFiscale: string): Promise<void> {
  const ospite = await trovaOspite(ospiteId);
  if (!ospite) throw new Error(`Ospite "${ospiteId}" non trovato`);
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  await sheets.spreadsheets.values.update({
    spreadsheetId: fileIdForTab('OSPITI'),
    range: `${OSPITI_SHEET_NAME}!D${ospite.row}:D${ospite.row}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[codiceFiscale]] },
  });
}
