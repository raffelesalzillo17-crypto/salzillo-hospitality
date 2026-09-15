import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, eseguiSyncEmailPrenotazioni, testoEventiLocali } from '@/lib/telegramDigest';

// Digest serale UNICO (21:00 Europe/Rome) — sostituisce dal 15/09/2026 il sync email
// prenotazioni delle 12:15 UTC e la ricerca eventi locali del lunedì mattina, uniti in un solo
// messaggio invece di due sparsi durante il giorno (stessa richiesta di Raffaele del digest
// mattutino — vedi /api/cron/digest-mattina). Gli eventi locali restano cercati una volta a
// settimana (il lunedì) per non sprecare chiamate a Claude+ricerca web ogni sera per nulla.

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : req.nextUrl.origin;

  try {
    const blocchi: string[] = [];
    blocchi.push(...await eseguiSyncEmailPrenotazioni(origin, dryRun));

    const oggiLunedi = new Date().getDay() === 1;
    if (oggiLunedi) {
      const testoEventi = await testoEventiLocali(dryRun);
      if (testoEventi) blocchi.push(testoEventi);
    }

    if (blocchi.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Niente da segnalare stasera', dryRun });
    }

    const text = blocchi.join('\n\n━━━━━━━━━━\n\n');
    if (!dryRun) await inviaTelegram(text);
    return NextResponse.json({ ok: true, sent: !dryRun, blocchi: blocchi.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel digest serale:', err);
    if (!dryRun) await alertCronFailure('digest serale', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
