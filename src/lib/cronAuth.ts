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
  const cron = process.env.CRON_SECRET?.trim();
  if (cron && header === `Bearer ${cron}`) return true;

  const key = req.nextUrl.searchParams.get('key');
  // .trim(): un a-capo finito per errore in fondo al valore su Vercel (successo il 02/10/2026) non
  // deve far rifiutare la chiave giusta.
  const ping = process.env.EXTERNAL_PING_SECRET?.trim();
  if (ping && key === ping) return true;

  return false;
}
