import { NextRequest, NextResponse } from 'next/server';
import { rendicontoProprietarioDb } from '@/lib/db/queries';

// Rendiconto mensile di un proprietario (dati per PDF + pagina proprietario).

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const key = req.headers.get('x-plancia-key');
  if (process.env.PLANCIA_ACCESS_KEY && key !== process.env.PLANCIA_ACCESS_KEY) {
    return NextResponse.json({ ok: false, error: 'Chiave non valida' }, { status: 401 });
  }
  const proprietarioId = req.nextUrl.searchParams.get('proprietario');
  const anno = Number(req.nextUrl.searchParams.get('anno'));
  const mese = Number(req.nextUrl.searchParams.get('mese'));
  if (!proprietarioId || !anno || !mese) {
    return NextResponse.json({ ok: false, error: 'Parametri mancanti (proprietario, anno, mese)' }, { status: 400 });
  }
  try {
    const r = await rendicontoProprietarioDb(proprietarioId, anno, mese);
    if (!r) return NextResponse.json({ ok: false, error: 'Proprietario non trovato' }, { status: 404 });
    return NextResponse.json({ ok: true, rendiconto: r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
