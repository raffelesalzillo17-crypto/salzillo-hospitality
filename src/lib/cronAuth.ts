import { NextRequest } from 'next/server';

// Autenticazione condivisa per le rotte /api/cron/*. Due modi validi, entrambi accettati:
// 1. Header `Authorization: Bearer $CRON_SECRET` — quello che manda Vercel Cron in automatico.
// 2. Query param `?key=$EXTERNAL_PING_SECRET` — per un pinger esterno di terze parti (es.
//    cron-job.org), usato come backup più affidabile perché il piano Vercel Hobby non
//    garantisce l'orario esatto di esecuzione dei cron interni (vedi wiki/entita/salzillo-hospitality.md,
//    sezione "Promemoria automatici che non arrivavano"). Secret separato da CRON_SECRET
//    apposta: se un domani va rigenerato/revocato, non tocca l'automazione interna di Vercel.
export function isAuthorizedCron(req: NextRequest): boolean {
  const header = req.headers.get('authorization');
  if (process.env.CRON_SECRET && header === `Bearer ${process.env.CRON_SECRET}`) return true;

  const key = req.nextUrl.searchParams.get('key');
  if (process.env.EXTERNAL_PING_SECRET && key === process.env.EXTERNAL_PING_SECRET) return true;

  return false;
}
