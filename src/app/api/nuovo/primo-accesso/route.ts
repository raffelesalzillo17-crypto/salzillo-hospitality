import { NextRequest, NextResponse } from 'next/server';
import { completaPrimoAccesso } from '@/lib/db/mutations';

// Pubblica di proposito: chi arriva qui non ha ancora un account. Serve solo il codice
// invito (dato a voce/di persona dal Titolare) per abbinarsi a una scheda già creata —
// username e password li sceglie la persona stessa, qui, la prima volta.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: { codiceInvito?: string; username?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  if (!body.codiceInvito || !body.username || !body.password) {
    return NextResponse.json({ ok: false, error: 'Codice invito, username e password sono obbligatori' }, { status: 400 });
  }
  try {
    await completaPrimoAccesso({ codiceInvito: body.codiceInvito, username: body.username, password: body.password });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}
