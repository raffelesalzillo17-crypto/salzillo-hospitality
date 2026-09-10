import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/index';
import { utenti } from '@/lib/db/schema';
import { verificaPassword, creaToken, COOKIE, leggiSessione } from '@/lib/db/auth';

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const username = (body.username ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!username || !password) return NextResponse.json({ ok: false, error: 'Username e password obbligatori' }, { status: 400 });

  const db = getDb();
  const [u] = await db.select().from(utenti).where(eq(utenti.username, username));
  if (!u || !u.attivo || !verificaPassword(password, u.password_hash)) {
    return NextResponse.json({ ok: false, error: 'Username o password non corretti' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, creaToken(u.id), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 30 * 24 * 60 * 60 });
  return res;
}

export async function GET(req: NextRequest) {
  const s = await leggiSessione(req);
  return NextResponse.json({ ok: true, sessione: s });
}
