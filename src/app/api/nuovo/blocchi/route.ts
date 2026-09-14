import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { creaBloccoCalendario, leggiBlocchiCalendario, eliminaBloccoCalendario } from '@/lib/db/mutations';

// Blocchi manuali di date (uso personale/manutenzione) per un alloggio — niente ospite,
// niente importi, non toccano il foglio Google né il bot. Entrano solo nell'export iCal
// (/api/ical/<alloggio>.ics), quindi bloccano le date anche su Airbnb/Booking.
//  GET  ?alloggio=<id>                              → elenco blocchi futuri/in corso
//  POST { alloggioId, checkin, checkout, nota? }     → crea un blocco
//  POST { rimuovi: <id> }                            → elimina un blocco

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const alloggioId = req.nextUrl.searchParams.get('alloggio');
  if (!alloggioId) return NextResponse.json({ ok: false, error: 'alloggio mancante' }, { status: 400 });
  const blocchi = await leggiBlocchiCalendario(alloggioId);
  return NextResponse.json({ ok: true, blocchi });
}

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare' && check.sessione.ruolo !== 'Collaboratore') {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  }
  let body: { alloggioId?: string; checkin?: string; checkout?: string; nota?: string; rimuovi?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 }); }

  if (body.rimuovi) {
    await eliminaBloccoCalendario(body.rimuovi);
    return NextResponse.json({ ok: true });
  }
  if (!body.alloggioId || !body.checkin || !body.checkout) {
    return NextResponse.json({ ok: false, error: 'alloggioId, checkin, checkout obbligatori' }, { status: 400 });
  }
  if (body.checkout <= body.checkin) {
    return NextResponse.json({ ok: false, error: 'Il check-out deve essere dopo il check-in' }, { status: 400 });
  }
  const r = await creaBloccoCalendario({ alloggioId: body.alloggioId, checkin: body.checkin, checkout: body.checkout, nota: body.nota });
  return NextResponse.json({ ok: true, blocco: r });
}
