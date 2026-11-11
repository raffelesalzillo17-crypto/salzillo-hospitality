import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione, creaLinkPersonale } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { utenti } from '@/lib/db/schema';

// Restituisce al Titolare, già dentro l'app, il SUO link personale (vedi /api/nuovo/entra).

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });
  const [u] = await getDb().select().from(utenti).where(eq(utenti.id, check.sessione.id));
  if (!u?.password_hash) return NextResponse.json({ ok: false, error: 'Account senza password' }, { status: 400 });
  const url = `${req.nextUrl.origin}/api/nuovo/entra?k=${creaLinkPersonale(u.id, u.password_hash)}`;
  return NextResponse.json({ ok: true, url }, { headers: { 'Cache-Control': 'no-store' } });
}
