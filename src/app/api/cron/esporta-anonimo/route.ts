import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { esportaPrenotazioniAnonime } from '@/lib/esportaAnonimo';

// Aggiorna ogni giorno il foglio Google «Prenotazioni (anonimo)» per gli assistenti esterni di
// Raffaele (Grok Bot, 19/11/2026). Solo alloggio, date, notti, canale e stato: vedi la lista dei
// campi vietati in src/lib/esportaAnonimo.ts. Risponde con il numero di righe, mai con i dati.
//
// Accessi validi: quelli dei cron (CRON_SECRET / EXTERNAL_PING_SECRET) oppure, per aggiornare il
// foglio a mano dopo una prenotazione nuova, la chiave dedicata ESPORTA_ANONIMO_KEY (`?key=...`).
// Per revocarla basta toglierla o cambiarla su Vercel. Non dà accesso ad altre rotte.

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function chiaveDedicata(req: NextRequest): boolean {
  const attesa = (process.env.ESPORTA_ANONIMO_KEY ?? '').trim();
  const data = req.nextUrl.searchParams.get('key') ?? '';
  if (attesa.length < 32 || data.length !== attesa.length) return false;
  return timingSafeEqual(Buffer.from(data), Buffer.from(attesa));
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req) && !chiaveDedicata(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const r = await esportaPrenotazioniAnonime();
    return NextResponse.json({ ok: true, righe: r.righe, creato: r.creato, account: r.account, condiviso: r.condiviso });
  } catch (err) {
    console.error('[esporta-anonimo] ERRORE:', err instanceof Error ? err.message : err);
    await alertCronFailure('esportazione anonima delle prenotazioni', err);
    return NextResponse.json({ ok: false, error: 'Esportazione non riuscita', dettaglio: err instanceof Error ? err.message.slice(0, 200) : 'errore sconosciuto' }, { status: 500 });
  }
}
