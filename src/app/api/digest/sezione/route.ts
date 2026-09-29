import { NextRequest, NextResponse } from 'next/server';
import { sezioneMattina, sezioneSera, SEPARATORE_BLOCCHI } from '@/lib/digestSezioni';

// Sezione B&B del digest unico. Chiamata dal cron di plancia-raffaele (che invia il messaggio
// Telegram unico con il bot personale) — NON invia nulla da sola.
//
// GET /api/digest/sezione?tipo=mattina|sera[&dryRun=1]
// Auth: `Authorization: Bearer $DIGEST_SHARED_SECRET` (segreto condiviso solo con plancia-raffaele,
// separato da CRON_SECRET/EXTERNAL_PING_SECRET apposta: se va ruotato non tocca i cron interni).
//
// Risposta: { ok, tipo, blocchi: string[], testo: string } — `testo` è vuoto se non c'è niente
// da segnalare. dryRun=1 evita gli effetti collaterali della sera (sync email, eventi locali).

export const maxDuration = 90;

export async function GET(req: NextRequest) {
  const segreto = process.env.DIGEST_SHARED_SECRET;
  if (!segreto || req.headers.get('authorization') !== `Bearer ${segreto}`) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const tipo = req.nextUrl.searchParams.get('tipo');
  if (tipo !== 'mattina' && tipo !== 'sera') {
    return NextResponse.json({ ok: false, error: 'tipo deve essere "mattina" o "sera"' }, { status: 400 });
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : req.nextUrl.origin;

  try {
    const blocchi = tipo === 'mattina' ? await sezioneMattina() : await sezioneSera(origin, dryRun);
    return NextResponse.json({ ok: true, tipo, dryRun, blocchi, testo: blocchi.join(SEPARATORE_BLOCCHI) });
  } catch (err) {
    console.error(`Errore nella sezione digest ${tipo}:`, err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
