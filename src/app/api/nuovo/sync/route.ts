import { NextRequest, NextResponse } from 'next/server';
import { importaDaSheets } from '@/lib/db/importDaSheets';
import { richiediSessione } from '@/lib/db/auth';

// Riallinea il database al Google Sheet su richiesta (bottone "Aggiorna dal foglio" in /nuovo).
// Il cron giornaliero /api/cron/sync-db fa lo stesso una volta al giorno; questo serve quando
// Raffaele guarda l'anteprima e vuole i dati freschi subito.

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });
  try {
    const r = await importaDaSheets();
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
