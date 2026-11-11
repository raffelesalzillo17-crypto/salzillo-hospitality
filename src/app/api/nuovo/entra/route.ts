import { NextRequest, NextResponse } from 'next/server';
import { verificaChiaveAccesso, creaToken, COOKIE, OPZIONI_COOKIE } from '@/lib/db/auth';

// Link personale: /api/nuovo/entra?k=<chiave> apre la sessione della persona a cui appartiene
// la chiave e porta su /nuovo (vedi src/lib/db/auth.ts). È l'unico modo di entrare: username e
// password non esistono più. Chi ha il link entra come quella persona.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const utenteId = await verificaChiaveAccesso(req.nextUrl.searchParams.get('k') || '');
  const res = NextResponse.redirect(new URL('/nuovo', req.nextUrl.origin));
  // La chiave non deve finire altrove né restare in una copia salvata della risposta.
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('Cache-Control', 'no-store');
  if (utenteId) res.cookies.set(COOKIE, creaToken(utenteId), OPZIONI_COOKIE);
  return res;
}
