import { NextRequest, NextResponse } from 'next/server';
import { rendicontoProprietarioDb } from '@/lib/db/queries';
import { richiediSessione } from '@/lib/db/auth';

// Rendiconto mensile di un proprietario (dati per PDF + pagina proprietario).

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  const proprietarioId = req.nextUrl.searchParams.get('proprietario');
  const anno = Number(req.nextUrl.searchParams.get('anno'));
  const mese = Number(req.nextUrl.searchParams.get('mese'));
  if (!proprietarioId || !anno || !mese) {
    return NextResponse.json({ ok: false, error: 'Parametri mancanti (proprietario, anno, mese)' }, { status: 400 });
  }
  if (sess.ruolo === 'Proprietario' && sess.proprietarioId !== proprietarioId) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  }
  try {
    const r = await rendicontoProprietarioDb(proprietarioId, anno, mese);
    if (!r) return NextResponse.json({ ok: false, error: 'Proprietario non trovato' }, { status: 404 });
    return NextResponse.json({ ok: true, rendiconto: r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
