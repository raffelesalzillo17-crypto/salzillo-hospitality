import { google } from 'googleapis';
import type { ChatMessage, PendingAction } from './assistantCore';
import { getSheetsClient, ensureSheetWithHeaders, fileIdForTab } from './sheets';

// Stato persistente del bot Telegram su Vercel: essendo funzioni serverless, non c'è un
// processo sempre acceso con una Map in memoria come nel bot.js originale — lo stato
// (cronologia, proposta in sospeso) va salvato da qualche parte tra un webhook e l'altro.
// Riusa lo stesso foglio Google già usato per le prenotazioni (una tab dedicata "BOT_STATE"),
// così non serve provisionare nessun database nuovo: una riga per chat, chiave=chat_id.
//
// Auth/creazione scheda ora condivise in src/lib/sheets.ts (08/09/2026).

const SHEET_NAME = 'BOT_STATE';
const HEADERS = ['chat_id', 'updated_at', 'state_json'] as const;

export type BotState = { history: ChatMessage[]; pendingAction: PendingAction | null };
const EMPTY_STATE: BotState = { history: [], pendingAction: null };

function ensureSheetExists(sheets: ReturnType<typeof google.sheets>) {
  return ensureSheetWithHeaders(sheets, SHEET_NAME, HEADERS, 'botState');
}

export async function loadBotState(chatId: number): Promise<BotState> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('BOT_STATE'), range: `${SHEET_NAME}!A2:C1000` });
    const rows = res.data.values || [];
    const row = rows.find((r) => String(r[0]) === String(chatId));
    if (!row || !row[2]) return EMPTY_STATE;
    return JSON.parse(row[2]) as BotState;
  } catch (err) {
    // Tab non ancora creata la prima volta: la crea e riparte da stato vuoto.
    if (err instanceof Error && /Unable to parse range|not found/i.test(err.message)) {
      await ensureSheetExists(sheets);
      return EMPTY_STATE;
    }
    console.error('Errore caricando lo stato del bot, riparto da vuoto:', err);
    return EMPTY_STATE;
  }
}

export async function saveBotState(chatId: number, state: BotState): Promise<void> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
  await ensureSheetExists(sheets);

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('BOT_STATE'), range: `${SHEET_NAME}!A2:A1000` });
  const rows = res.data.values || [];
  const idx = rows.findIndex((r) => String(r[0]) === String(chatId));
  const rowNum = idx >= 0 ? idx + 2 : rows.length + 2;
  const values = [[String(chatId), new Date().toISOString(), JSON.stringify(state)]];

  await sheets.spreadsheets.values.update({
    spreadsheetId: fileIdForTab('BOT_STATE'),
    range: `${SHEET_NAME}!A${rowNum}:C${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values },
  });
}
