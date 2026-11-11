import { NextRequest, NextResponse } from 'next/server';
import { verificaLinkPersonale, creaToken, COOKIE, OPZIONI_COOKIE } from '@/lib/db/auth';

// Link personale del Titolare: /api/nuovo/entra?k=<chiave> apre la sessione senza username e
// password e porta su /nuovo (vedi src/lib/db/auth.ts). Chi ha il link entra come lui.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const utenteId = await verificaLinkPersonale(req.nextUrl.searchParams.get('k') || '');
  const res = NextResponse.redirect(new URL('/nuovo', req.nextUrl.origin));
  // La chiave non deve finire altrove né restare in una copia salvata della risposta.
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Cache-Control', 'no-store');
  if (utenteId) res.cookies.set(COOKIE, creaToken(utenteId), OPZIONI_COOKIE);
  return res;
}
