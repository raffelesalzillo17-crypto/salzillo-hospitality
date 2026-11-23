import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { importaDaSheets } from '@/lib/db/importDaSheets';

// Sincronizza il database Neon col Google Sheet, che resta la fonte viva durante le fasi
// 2-4 del piano (vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md).
// Rilancia l'import completo (TRUNCATE + reload): a questi volumi (62 prenotazioni) è veloce
// e non c'è bisogno di un dual-write rischioso — Raffaele continua a usare il foglio e il
// database lo insegue da solo. Quando si passerà a "database come fonte" (fase 4→5) questo
// cron si spegne.

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  // Punto 16 (23/11/2026): il database è la fonte ufficiale; il foglio è solo un export. Il cron è tolto da vercel.json
  // e questa rotta non importa più nulla (prima rifaceva TRUNCATE + reload dal foglio). Per riattivarla: SYNC_DB_ATTIVO=1.
  if (process.env.SYNC_DB_ATTIVO !== '1') {
    return NextResponse.json({ ok: false, error: 'Importazione dal foglio disattivata: il database è la fonte ufficiale' }, { status: 410 });
  }
  try {
    const r = await importaDaSheets();
    if (r.prenotazioniScartate.length > 0) {
      const elenco = r.prenotazioniScartate.join(' | ');
      await alertCronFailure('sincronizzazione database (prenotazioni scartate)',
        new Error(`${r.prenotazioniScartate.length} prenotazione/i del foglio non importate: ${elenco}`));
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    console.error('[sync-db] ERRORE:', err);
    await alertCronFailure('sincronizzazione database', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
