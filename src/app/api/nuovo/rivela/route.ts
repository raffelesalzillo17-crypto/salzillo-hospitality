import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { alloggi, schedine } from '@/lib/db/schema';
import { registra } from '@/lib/db/registro';

// Unico punto da cui escono per intero la password WiFi di un alloggio e il numero di un documento
// (punto 5 delle richieste, 23/11/2026). Solo il Titolare; ogni visualizzazione finisce nel
// registro delle azioni con chi, cosa e quando (il valore NON viene scritto nel registro).
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  if (sess.ruolo !== 'Titolare') {
    await registra(sess, 'rivela-negato', null, null, 'tentativo senza permesso');
    return NextResponse.json({ ok: false, error: 'Solo il Titolare può vedere questo dato per intero' }, { status: 403 });
  }

  let body: { tipo?: string; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ ok: false, error: "Manca l'id" }, { status: 400 });

  const db = getDb();
  if (body.tipo === 'wifi') {
    const [a] = await db.select({ p: alloggi.wifi_password }).from(alloggi).where(eq(alloggi.id, body.id));
    if (!a) return NextResponse.json({ ok: false, error: 'Alloggio non trovato' }, { status: 404 });
    await registra(sess, 'mostra-password-wifi', 'alloggio', body.id);
    return NextResponse.json({ ok: true, valore: a.p ?? '' });
  }
  if (body.tipo === 'documento') {
    const [s] = await db.select({ n: schedine.numero_documento }).from(schedine).where(eq(schedine.id, body.id));
    if (!s) return NextResponse.json({ ok: false, error: 'Schedina non trovata' }, { status: 404 });
    await registra(sess, 'mostra-numero-documento', 'schedina', body.id);
    return NextResponse.json({ ok: true, valore: s.n ?? '' });
  }
  return NextResponse.json({ ok: false, error: 'Tipo non valido' }, { status: 400 });
}
