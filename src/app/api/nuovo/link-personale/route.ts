import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione, linkAccesso } from '@/lib/db/auth';
import { chiaveAccessoUtente } from '@/lib/db/mutations';

// Restituisce a chi è già dentro l'app il SUO link personale (vedi /api/nuovo/entra), da
// salvare nei preferiti o usare su un altro dispositivo. Non lo cambia: se non c'è lo crea.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const chiave = await chiaveAccessoUtente(check.sessione.id, false);
  return NextResponse.json({ ok: true, url: linkAccesso(req.nextUrl.origin, chiave) }, { headers: { 'Cache-Control': 'no-store' } });
}
