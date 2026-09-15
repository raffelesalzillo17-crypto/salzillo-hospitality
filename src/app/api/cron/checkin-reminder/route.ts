import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, testoCheckinOggi } from '@/lib/telegramDigest';

// Promemoria check-in di oggi. Dal 15/09/2026 non è più schedulato da solo in vercel.json —
// confluisce in /api/cron/digest-mattina (troppi messaggi Telegram sparsi durante il giorno).
// Resta qui, richiamabile a mano (anche con ?dryRun=1), per test/debug mirati; la logica vera è
// condivisa in src/lib/telegramDigest.ts.

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  try {
    const text = await testoCheckinOggi();
    if (!text) return NextResponse.json({ ok: true, sent: false, note: 'Nessun check-in oggi', dryRun });
    if (!dryRun) await inviaTelegram(text);
    return NextResponse.json({ ok: true, sent: !dryRun, text, dryRun });
  } catch (err) {
    console.error('Errore nel promemoria check-in:', err);
    if (!dryRun) await alertCronFailure('promemoria check-in', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
