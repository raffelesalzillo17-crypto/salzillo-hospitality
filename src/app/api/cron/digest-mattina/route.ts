import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, testoCheckinOggi, testoCheckoutOggi, testoControlloCalendari, testoPreventiviScadenza, testoPulizieDomani, testoSchedineInScadenza } from '@/lib/telegramDigest';

// Digest mattutino UNICO (06:00 Europe/Rome) — sostituisce dal 15/09/2026 quattro/cinque
// messaggi Telegram separati sparsi tra le 7 e le 9:20 UTC (check-in, check-out, controllo
// calendari, preventivi in scadenza, pulizie di domani): troppi messaggi durante la giornata,
// richiesta esplicita di Raffaele ("uniamoli dove possibile, un messaggio alle 6 e uno alle
// 21"). Ogni blocco resta condizionale (compare solo se c'è qualcosa da segnalare) — la logica
// vera è in src/lib/telegramDigest.ts, condivisa con le vecchie route individuali (rimaste per
// test manuale via ?dryRun=1, non più schedulate da sole in vercel.json).
//
// Fuso orario (corretto il 23/09/2026): Vercel Cron accetta solo orari UTC, senza fuso orario
// nativo — un singolo "0 4 * * *" era corretto solo durante l'ora legale (CEST) e sarebbe
// scattato un'ora troppo presto per 5 mesi l'anno con l'ora solare (CET), lo stesso bug già
// scoperto e "risolto" disattivando /api/cron/report-notturno. Soluzione: due voci cron in
// vercel.json sullo stesso path, una per i mesi CEST (aprile-ottobre, 04:00 UTC = 06:00 locali)
// e una per i mesi CET (novembre-marzo, 05:00 UTC = 06:00 locali). Resta un'imprecisione di
// un'ora per le settimane di transizione effettiva (fine marzo/fine ottobre, il cambio non
// cade mai esattamente a inizio/fine mese) — inevitabile senza fuso orario nativo, ma molto
// meglio di 5 mesi sbagliati l'anno.

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
      testoSchedineInScadenza(),
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
