import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram } from '@/lib/telegramDigest';
import { sezioneSera, SEPARATORE_BLOCCHI } from '@/lib/digestSezioni';

// Digest serale del SOLO B&B — richiamabile a mano / in dryRun per test, NON schedulato.
//
// Dal 29/09/2026 il messaggio unico della sera lo invia il bot personale di plancia-raffaele
// (cron `/api/cron/digest-sera` lì), che chiede la sezione B&B a /api/digest/sezione. Questa
// route resta per provare la sezione da sola (sync email prenotazioni, eventi locali il lunedì,
// schedine in scadenza): senza dryRun invia con il bot di QUESTO progetto.

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : req.nextUrl.origin;

  try {
    const blocchi = await sezioneSera(origin, dryRun);

    if (blocchi.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Niente da segnalare stasera', dryRun });
    }

    const text = blocchi.join(SEPARATORE_BLOCCHI);
    if (!dryRun) await inviaTelegram(text);
    return NextResponse.json({ ok: true, sent: !dryRun, blocchi: blocchi.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel digest serale:', err);
    if (!dryRun) await alertCronFailure('digest serale', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
