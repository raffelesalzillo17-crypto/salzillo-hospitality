import { getSheetsClient, ensureSheetWithHeaders, findFirstFreeRow, fileIdForTab } from './sheets';

// Log permanente delle conversazioni del bot Telegram — scoperto mancante il 09/09/2026
// durante un giro di controllo generale: il vecchio bot.js locale scriveva ogni turno in
// assistente-telegram/conversation-logs/{data}.jsonl (formato {ts, chatId, role, text}), letto
// dal task schedulato "sync-conversazioni" (vedi CLAUDE.md del vault) per ingerire idee/fatti
// nel wiki. Dal 02/09/2026 il bot gira solo su Vercel (vedi
// wiki/decisioni/un-solo-canale-bot-telegram.md) — funzioni serverless, filesystem effimero,
// quindi bot.js non scrive più nulla e quei file locali sono fermi da allora. Il webhook su
// Vercel (src/app/api/telegram-webhook/route.ts) non aveva MAI sostituito quella scrittura:
// da una settimana le conversazioni non venivano registrate da nessuna parte.
//
// Fix: stesso schema {ts, chatId, role, text}, stessa idea di "un file/riga per turno", ma
// scritto su una tab dedicata del foglio Google invece che su un file locale — coerente con
// come già gira tutto il resto su Vercel (BOT_STATE, CONTI, CONTRATTI...). Il task
// "sync-conversazioni" andrà aggiornato per leggere da qui invece che dai vecchi .jsonl locali
// (che restano validi come archivio storico fino al 02/09/2026, mai sovrascritti).

const SHEET_NAME = 'TELEGRAM_LOG';
const HEADERS = ['ts', 'chat_id', 'role', 'text'] as const;

export type Ruolo = 'user' | 'assistant';

function ensureSheetExists(sheets: ReturnType<typeof import('googleapis').google.sheets>) {
  return ensureSheetWithHeaders(sheets, SHEET_NAME, HEADERS, 'telegramLog');
}

/**
 * Registra un turno di conversazione (domanda o risposta). Best-effort e non-bloccante per
 * design: chi la chiama deve continuare a rispondere all'ospite/webhook anche se la scrittura
 * del log fallisce — il log è un di più, non deve mai rompere la conversazione vera.
 */
export async function logTurn(chatId: number, role: Ruolo, text: string): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    await ensureSheetExists(sheets);
    const targetRow = await findFirstFreeRow(sheets, SHEET_NAME);
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('TELEGRAM_LOG'),
      range: `${SHEET_NAME}!A${targetRow}:D${targetRow}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[new Date().toISOString(), String(chatId), role, text]] },
    });
  } catch (err) {
    console.error('[telegramLog] scrittura fallita (non bloccante):', err instanceof Error ? err.message : err);
  }
}
