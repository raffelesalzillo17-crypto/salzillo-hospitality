import { NextRequest, NextResponse } from 'next/server';
import { leggiIdeeDoc, aggiungiIdeaDoc, annotaIdeaDoc } from '@/lib/ideeDoc';

// "Idee per Claude" — un Google Doc dove Raffaele scrive idee/richieste (a mano o via bot
// Telegram), lette una volta l'ora da un agente automatico che le esegue quando sicure e
// propone quando rischiose, annotando l'esito accanto a ogni idea nello stesso documento.
// Protetto con lo stesso meccanismo dei cron interni (CRON_SECRET/EXTERNAL_PING_SECRET).

function autorizzato(req: NextRequest): boolean {
  const header = req.headers.get('authorization');
  if (process.env.CRON_SECRET && header === `Bearer ${process.env.CRON_SECRET}`) return true;
  if (process.env.IDEE_SHARED_SECRET && header === `Bearer ${process.env.IDEE_SHARED_SECRET}`) return true;
  const key = req.nextUrl.searchParams.get('key');
  if (process.env.EXTERNAL_PING_SECRET && key === process.env.EXTERNAL_PING_SECRET) return true;
  return false;
}

export async function GET(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const idee = await leggiIdeeDoc();
    return NextResponse.json({ ok: true, idee });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!autorizzato(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const body = await req.json();
    if (body.azione === 'aggiungi') {
      if (!body.testo || typeof body.testo !== 'string') return NextResponse.json({ ok: false, error: 'testo mancante' }, { status: 400 });
      await aggiungiIdeaDoc(body.testo);
      return NextResponse.json({ ok: true });
    }
    if (body.azione === 'annota') {
      if (!body.ideaOriginale || !body.stato) return NextResponse.json({ ok: false, error: 'ideaOriginale/stato mancanti' }, { status: 400 });
      await annotaIdeaDoc(body.ideaOriginale, body.stato, body.nota || '');
      return NextResponse.json({ ok: true });
    }
    if (body.azione === 'notifica') {
      if (!body.testo || typeof body.testo !== 'string') return NextResponse.json({ ok: false, error: 'testo mancante' }, { status: 400 });
      const chatId = process.env.ALLOWED_CHAT_ID;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (chatId && token) {
        const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: body.testo, ...(parseMode ? { parse_mode: parseMode } : {}) }),
        });
        const res = await send('Markdown');
        if (!res.ok) await send();
      }
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: 'azione sconosciuta (usa "aggiungi", "annota" o "notifica")' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
