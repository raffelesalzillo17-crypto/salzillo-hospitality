import { NextRequest, NextResponse } from 'next/server';
import { runAgentTurn, transcribeAudioViaGroq, type ImageInput } from '@/lib/assistantCore';
import { loadBotState, saveBotState } from '@/lib/botState';
import { logTurn } from '@/lib/telegramLog';

// Bot Telegram di Raffaele, versione cloud (sempre acceso, gira su Vercel via webhook invece
// che sul suo PC via polling). Stesso ciclo agentico della barra della dashboard — vedi
// src/lib/assistantCore.ts. Foto: scaricate e passate come immagine a Claude. Vocali: scaricati
// e trascritti via Groq (Whisper) — nessuna delle due ha più bisogno del PC di Raffaele acceso.
// Resta solo locale: invio file da raw/ (troppo grande per stare nel deploy cloud).

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_CHAT_ID = process.env.ALLOWED_CHAT_ID;
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function getTelegramFilePath(fileId: string): Promise<string> {
  const fileRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  if (!fileData.ok) throw new Error(fileData.description || 'getFile fallito');
  return fileData.result.file_path as string;
}

async function downloadTelegramFile(fileId: string): Promise<Buffer> {
  const filePath = await getTelegramFilePath(fileId);
  const url = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download fallito: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

// Vocali Telegram: sempre OGG/Opus indipendentemente dall'estensione del file_path originale.
async function transcribeVoice(fileId: string): Promise<string> {
  const buf = await downloadTelegramFile(fileId);
  return transcribeAudioViaGroq(buf, 'voice.ogg', 'audio/ogg');
}

async function sendTelegramMessage(chatId: number, text: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const send = (parseMode?: string) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
  });
  const res = await send('Markdown');
  if (!res.ok) await send(); // Markdown non valido per questo testo: rimando come testo semplice.
}

export async function POST(req: NextRequest) {
  // Verifica che la richiesta arrivi davvero da Telegram (secret token impostato con setWebhook).
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (!WEBHOOK_SECRET || secretHeader !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  let update: { message?: { chat: { id: number }; text?: string; caption?: string; photo?: { file_id: string }[]; voice?: { file_id: string } } };
  try {
    update = await req.json();
  } catch {
    return NextResponse.json({ ok: true }); // body non valido, ack comunque a Telegram
  }

  const message = update.message;
  if (!message) return NextResponse.json({ ok: true }); // altri tipi di update, ignorati

  const chatId = message.chat.id;
  if (!ALLOWED_CHAT_ID || String(chatId) !== String(ALLOWED_CHAT_ID)) {
    return NextResponse.json({ ok: true }); // whitelist: ignora chiunque altro in silenzio
  }

  try {
    let image: ImageInput | undefined;
    let transcribedVoice: string | null = null;

    if (message.photo && message.photo.length) {
      const largest = message.photo[message.photo.length - 1]; // Telegram manda più risoluzioni, l'ultima è la più grande.
      const base64 = await downloadTelegramFile(largest.file_id).then((b) => b.toString('base64')).catch((err) => {
        console.error('Errore scaricando la foto:', err);
        return null;
      });
      if (!base64) {
        await sendTelegramMessage(chatId, 'Non sono riuscito a scaricare la foto 😕 riprova.');
        return NextResponse.json({ ok: true });
      }
      image = { base64, mediaType: 'image/jpeg' };
    } else if (message.voice) {
      if (!GROQ_API_KEY) {
        await sendTelegramMessage(chatId, 'Trascrizione vocale non configurata da qui 🙏 riprova quando il PC è acceso.');
        return NextResponse.json({ ok: true });
      }
      transcribedVoice = await transcribeVoice(message.voice.file_id).catch((err) => {
        console.error('Errore trascrivendo il vocale:', err);
        return null;
      });
      if (!transcribedVoice) {
        await sendTelegramMessage(chatId, '🎤 Non sono riuscito a trascrivere il vocale, riprova magari parlando più chiaro.');
        return NextResponse.json({ ok: true });
      }
      await sendTelegramMessage(chatId, `🎤 Ho capito: _"${transcribedVoice}"_`);
    } else if (!message.text) {
      await sendTelegramMessage(chatId, 'Da qui (versione cloud) non gestisco ancora questo tipo di messaggio 🙏 se ti serve, per ora funziona solo sul bot quando il tuo PC è acceso.');
      return NextResponse.json({ ok: true });
    }

    const state = await loadBotState(chatId);
    const origin = req.nextUrl.origin;
    const textInput = message.text || transcribedVoice || message.caption || '';
    // await, non fire-and-forget: su Vercel una funzione serverless può essere terminata
    // subito dopo la risposta HTTP, quindi una scrittura non attesa rischierebbe di sparire
    // in silenzio — esattamente il bug che questo log doveva risolvere (vedi src/lib/telegramLog.ts).
    if (textInput) await logTurn(chatId, 'user', textInput);

    const result = await runAgentTurn(origin, textInput, state.history, state.pendingAction, image);

    await saveBotState(chatId, { history: result.history, pendingAction: result.pendingAction });
    await sendTelegramMessage(chatId, result.answer);
    await logTurn(chatId, 'assistant', result.answer);
  } catch (err) {
    console.error('Errore nel webhook Telegram:', err);
    await sendTelegramMessage(chatId, 'Ops, ho avuto un problema a elaborare questo messaggio 😅 riprova.').catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
