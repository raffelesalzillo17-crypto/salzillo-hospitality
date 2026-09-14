import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { inviaSchedinaReale } from '@/lib/alloggiatiInvio';

// Invio VERO ad Alloggiati Web — solo il Titolare può innescarlo, sempre una schedina alla
// volta, sempre con un click esplicito (mai automatico). Vedi src/lib/alloggiatiInvio.ts per
// il filtro di sicurezza e la sequenza Test→Send. L'elenco delle schedine da mostrare arriva
// da /api/nuovo/dati (campo schedineAlloggiati), non da qui.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 });
  }
  const schedinaId = body.schedinaId;
  if (typeof schedinaId !== 'string' || !schedinaId.trim()) {
    return NextResponse.json({ ok: false, error: 'schedinaId mancante' }, { status: 400 });
  }

  try {
    const esito = await inviaSchedinaReale(schedinaId);
    return NextResponse.json(esito);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
