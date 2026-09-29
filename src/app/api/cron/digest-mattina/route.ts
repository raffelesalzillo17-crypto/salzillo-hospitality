import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram } from '@/lib/telegramDigest';
import { sezioneMattina, SEPARATORE_BLOCCHI } from '@/lib/digestSezioni';

// Digest mattutino del SOLO B&B — richiamabile a mano / in dryRun per test, NON schedulato.
//
// Dal 29/09/2026 il messaggio unico della mattina lo invia il bot personale di plancia-raffaele
// (cron `/api/cron/digest-mattina` lì), che chiede la sezione B&B a /api/digest/sezione e ci
// aggiunge il recap personale. Questa route resta solo per provare la sezione B&B da sola:
// se la chiami senza dryRun invia un messaggio Telegram con il bot di QUESTO progetto.
// Storia (15/09/2026): unisce check-in, check-out, controllo calendari, preventivi in scadenza,
// pulizie di domani, schedine in scadenza in un unico messaggio invece di cinque.

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  
  try {
    const blocchi = await sezioneMattina();

    if (blocchi.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Niente da segnalare stamattina', dryRun });
    }

    const text = ['☀️ *B&B — solo sezione Hospitality*', ...blocchi].join(SEPARATORE_BLOCCHI);
    if (!dryRun) await inviaTelegram(text);
    return NextResponse.json({ ok: true, sent: !dryRun, blocchi: blocchi.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel digest mattutino:', err);
    if (!dryRun) await alertCronFailure('digest mattutino', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
