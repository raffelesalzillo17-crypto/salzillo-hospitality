import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { eseguiBackup } from '@/lib/backupDb';

// Backup settimanale CIFRATO del database su Drive (vedi src/lib/backupDb.ts). Risponde solo con
// i conteggi per tabella, mai con i dati. Accessi validi: i cron (CRON_SECRET / EXTERNAL_PING_SECRET)
// oppure la chiave dedicata BACKUP_RUN_KEY (`?key=...`) per lanciarlo a mano; non dà accesso ad
// altre rotte e si revoca cambiandola su Vercel. BACKUP_KEY (cifratura) è un'altra cosa e non
// passa mai da qui.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function chiaveDedicata(req: NextRequest): boolean {
  const attesa = (process.env.BACKUP_RUN_KEY ?? '').trim();
  const data = req.nextUrl.searchParams.get('key') ?? '';
  if (attesa.length < 32 || data.length !== attesa.length) return false;
  return timingSafeEqual(Buffer.from(data), Buffer.from(attesa));
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req) && !chiaveDedicata(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const r = await eseguiBackup();
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error('[backup-db] ERRORE:', err instanceof Error ? err.message : err);
    await alertCronFailure('backup del database', err);
    return NextResponse.json({ ok: false, error: 'Backup non riuscito', dettaglio: err instanceof Error ? err.message.slice(0, 200) : 'errore sconosciuto' }, { status: 500 });
  }
}
