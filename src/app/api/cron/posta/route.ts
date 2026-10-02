import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { scansionaPosta } from '@/lib/posta';

// Legge TUTTE le email in arrivo nella casella del B&B, le riassume e avvisa su Telegram (inviti
// con tasti Partecipo/No/Forse). Pensato per essere chiamato spesso (ogni ~30 minuti) dal pinger
// esterno cron-job.org (il piano Hobby di Vercel permette cron interni solo giornalieri; ce n'è
// uno giornaliero di riserva in vercel.json). Vedi src/lib/posta.ts.
// GET /api/cron/posta[?dryRun=1]  — dryRun legge e classifica ma non scrive né avvisa.

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  try {
    const esito = await scansionaPosta({ dryRun });
    return NextResponse.json({ ok: true, dryRun, ...esito });
  } catch (err) {
    console.error('Errore nella scansione della posta:', err);
    if (!dryRun) await alertCronFailure('scansione posta', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
