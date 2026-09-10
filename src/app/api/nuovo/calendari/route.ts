import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db/index';
import { calendariIcal } from '@/lib/db/schema';
import { controllaCalendariAlloggio } from '@/lib/db/ical';

// Gestione dei calendari iCal esterni di un alloggio + controllo al volo.
//  GET  ?alloggio=<id>            → elenco calendari + esito ultimo controllo
//  GET  ?alloggio=<id>&controlla=1 → esegue il confronto adesso
//  POST { alloggioId, nome, url } → aggiunge/aggiorna un calendario
//  POST { rimuovi: <id> }        → disattiva un calendario

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const alloggioId = req.nextUrl.searchParams.get('alloggio');
  if (!alloggioId) return NextResponse.json({ ok: false, error: 'alloggio mancante' }, { status: 400 });

  if (req.nextUrl.searchParams.get('controlla') === '1') {
    const esiti = await controllaCalendariAlloggio(alloggioId);
    return NextResponse.json({ ok: true, esiti });
  }
  const db = getDb();
  const cals = await db.select().from(calendariIcal).where(eq(calendariIcal.alloggio_id, alloggioId));
  return NextResponse.json({ ok: true, calendari: cals });
}

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare' && check.sessione.ruolo !== 'Collaboratore') {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  }
  let body: { alloggioId?: string; nome?: string; url?: string; rimuovi?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const db = getDb();

  if (body.rimuovi) {
    await db.update(calendariIcal).set({ attivo: false }).where(eq(calendariIcal.id, body.rimuovi));
    return NextResponse.json({ ok: true });
  }
  if (!body.alloggioId || !body.nome || !body.url) return NextResponse.json({ ok: false, error: 'alloggioId, nome, url obbligatori' }, { status: 400 });
  if (!/^https?:\/\//.test(body.url)) return NextResponse.json({ ok: false, error: 'URL non valido' }, { status: 400 });

  await db.insert(calendariIcal).values({ alloggio_id: body.alloggioId, nome: body.nome.trim(), url: body.url.trim() })
    .onConflictDoUpdate({ target: [calendariIcal.alloggio_id, calendariIcal.nome], set: { url: body.url.trim(), attivo: true } });
  return NextResponse.json({ ok: true });
}
