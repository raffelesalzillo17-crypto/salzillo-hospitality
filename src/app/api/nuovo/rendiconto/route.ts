import { NextRequest, NextResponse } from 'next/server';
import { rendicontoProprietarioDb } from '@/lib/db/queries';
import { richiediSessione } from '@/lib/db/auth';

// Rendiconto mensile di un proprietario (dati per PDF + pagina proprietario).

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  const proprietarioParam = req.nextUrl.searchParams.get('proprietario');
  const anno = Number(req.nextUrl.searchParams.get('anno'));
  const mese = Number(req.nextUrl.searchParams.get('mese'));
  if (!proprietarioParam || !anno || !mese) {
    return NextResponse.json({ ok: false, error: 'Parametri mancanti (proprietario, anno, mese)' }, { status: 400 });
  }
  // 'tutti' = quadro generale su tutti i proprietari insieme — solo il Titolare può vederlo.
  if (proprietarioParam === 'tutti' && sess.ruolo !== 'Titolare') {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  }
  if (sess.ruolo === 'Proprietario' && sess.proprietarioId !== proprietarioParam) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  }
  const proprietarioId = proprietarioParam === 'tutti' ? null : proprietarioParam;
  const immobileId = req.nextUrl.searchParams.get('immobile') || undefined;
  const alloggioId = req.nextUrl.searchParams.get('alloggio') || undefined;
  const ambito = alloggioId ? { alloggioId } : immobileId ? { immobileId } : undefined;
  try {
    const r = await rendicontoProprietarioDb(proprietarioId, anno, mese, ambito);
    if (!r) return NextResponse.json({ ok: false, error: 'Proprietario non trovato' }, { status: 404 });
    return NextResponse.json({ ok: true, rendiconto: r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
