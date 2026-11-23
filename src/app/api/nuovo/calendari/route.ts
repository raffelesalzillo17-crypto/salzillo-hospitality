import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db/index';
import { calendariIcal } from '@/lib/db/schema';
import { controllaCalendariAlloggio, controllaTuttiICalendari, leggiLogSync, leggiTokenIcal, rigeneraTokenIcal } from '@/lib/db/ical';
import { registra } from '@/lib/db/registro';

// Gestione dei calendari iCal esterni di un alloggio + controllo al volo.
//  GET  ?alloggio=<id>            → elenco calendari + esito ultimo controllo
//  GET  ?alloggio=<id>&controlla=1 → esegue il confronto adesso
//  POST { alloggioId, nome, url } → aggiunge/aggiorna un calendario
//  POST { rimuovi: <id> }        → disattiva un calendario
//  GET  ?tutti=1                  → sincronizza adesso TUTTI i calendari ("Sincronizza ora")
//  POST { rigenera: <alloggioId> } → genera o sostituisce il token del link di export (solo Titolare): il link vecchio smette di funzionare

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const puoGestire = check.sessione.ruolo === 'Titolare' || check.sessione.ruolo === 'Collaboratore';
  if (req.nextUrl.searchParams.get('tutti') === '1') {
    if (!puoGestire) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
    const esiti = await controllaTuttiICalendari({ origine: 'manuale' });
    await registra(check.sessione, 'sincronizza-calendari', 'calendari', null, `${esiti.length} calendari`);
    return NextResponse.json({ ok: true, esiti });
  }
  const alloggioId = req.nextUrl.searchParams.get('alloggio');
  if (!alloggioId) return NextResponse.json({ ok: false, error: 'alloggio mancante' }, { status: 400 });

  if (req.nextUrl.searchParams.get('controlla') === '1') {
    if (!puoGestire) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
    const esiti = await controllaCalendariAlloggio(alloggioId, { origine: 'manuale' });
    return NextResponse.json({ ok: true, esiti });
  }
  const db = getDb();
  const cals = await db.select().from(calendariIcal).where(eq(calendariIcal.alloggio_id, alloggioId));
  const token = puoGestire ? await leggiTokenIcal(alloggioId) : null;
  return NextResponse.json({ ok: true, calendari: cals, log: puoGestire ? await leggiLogSync(alloggioId, 10) : [], token });
}

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare' && check.sessione.ruolo !== 'Collaboratore') {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  }
  let body: { alloggioId?: string; nome?: string; url?: string; rimuovi?: string; rigenera?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }
  const db = getDb();

  if (body.rigenera) {
    if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il Titolare può cambiare il link' }, { status: 403 });
    const token = await rigeneraTokenIcal(body.rigenera);
    await registra(check.sessione, 'rigenera-link-ical', 'alloggio', body.rigenera);
    return NextResponse.json({ ok: true, token });
  }
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
