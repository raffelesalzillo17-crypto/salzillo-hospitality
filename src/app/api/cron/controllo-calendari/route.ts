import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, testoControlloCalendari } from '@/lib/telegramDigest';

// Controllo iCal Airbnb/Booking vs le nostre prenotazioni. Dal 15/09/2026 non è più schedulato
// da solo in vercel.json — confluisce in /api/cron/digest-mattina (troppi messaggi Telegram
// sparsi durante il giorno). Resta qui, richiamabile a mano, per test/debug mirati; la logica
// vera è condivisa in src/lib/telegramDigest.ts.

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const text = await testoControlloCalendari();
    if (text) await inviaTelegram(text);
    return NextResponse.json({ ok: true, sent: !!text, text });
  } catch (err) {
    await alertCronFailure('controllo calendari', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
