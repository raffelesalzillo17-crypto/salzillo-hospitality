import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, testoCheckinOggi, testoCheckoutOggi, testoControlloCalendari, testoPreventiviScadenza, testoPulizieDomani } from '@/lib/telegramDigest';

// Digest mattutino UNICO (06:00 Europe/Rome) — sostituisce dal 15/09/2026 quattro/cinque
// messaggi Telegram separati sparsi tra le 7 e le 9:20 UTC (check-in, check-out, controllo
// calendari, preventivi in scadenza, pulizie di domani): troppi messaggi durante la giornata,
// richiesta esplicita di Raffaele ("uniamoli dove possibile, un messaggio alle 6 e uno alle
// 21"). Ogni blocco resta condizionale (compare solo se c'è qualcosa da segnalare) — la logica
// vera è in src/lib/telegramDigest.ts, condivisa con le vecchie route individuali (rimaste per
// test manuale via ?dryRun=1, non più schedulate da sole in vercel.json).

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const blocchi = (await Promise.all([
      testoCheckinOggi(),
      testoCheckoutOggi(),
      testoControlloCalendari(),
      testoPreventiviScadenza(),
      testoPulizieDomani(),
    ])).filter((b): b is string => !!b);

    if (blocchi.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Niente da segnalare stamattina', dryRun });
    }

    const text = blocchi.join('\n\n━━━━━━━━━━\n\n');
    if (!dryRun) await inviaTelegram(text);
    return NextResponse.json({ ok: true, sent: !dryRun, blocchi: blocchi.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel digest mattutino:', err);
    if (!dryRun) await alertCronFailure('digest mattutino', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
