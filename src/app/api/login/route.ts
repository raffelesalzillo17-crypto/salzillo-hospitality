import { NextRequest, NextResponse } from 'next/server';
import { trovaAccessoPerUsername, verifyPassword, creaToken } from '@/lib/accessi';
import { COOKIE_NAME } from '@/lib/requireAccesso';

// Login per il sito prenotazioni condiviso — un utente per collaboratore, non una chiave
// unica. Non rivela mai se è sbagliato lo username o la password (stesso messaggio in
// entrambi i casi), per non aiutare chi tenta di indovinare un account altrui.

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const username = (body.username ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (!username || !password) {
    return NextResponse.json({ error: 'Username e password sono obbligatori' }, { status: 400 });
  }

  const accesso = await trovaAccessoPerUsername(username);
  if (!accesso || !accesso.attivo || !verifyPassword(password, accesso.passwordHash)) {
    return NextResponse.json({ error: 'Username o password non corretti' }, { status: 401 });
  }

  const token = creaToken(accesso.username);
  const res = NextResponse.json({
    ok: true,
    nome: accesso.nome,
    puoCreare: accesso.puoCreare,
    puoCancellare: accesso.puoCancellare,
    puoVedereFinanziario: accesso.puoVedereFinanziario,
  });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60, // 30 giorni, stesso periodo del token stesso
  });
  return res;
}
