import { NextRequest, NextResponse } from 'next/server';
import { accessoIcalConsentito, generaIcalAlloggio } from '@/lib/db/ical';

// Feed iCal di un alloggio, da incollare nella sezione "importa calendario" di Airbnb e Booking: le prenotazioni e i blocchi
// registrati qui bloccano quelle date anche lì.
//   https://salzillo-hospitality.vercel.app/api/ical/<id-alloggio>.ics            → link vecchio (solo id), ancora valido
//   https://salzillo-hospitality.vercel.app/api/ical/<id-alloggio>.ics?t=<token>  → link protetto (punto 2, 23/11/2026)
// Quando per l'alloggio è stato generato un token, il link senza token (o con un token vecchio) risponde 404.
// Il Titolare genera o rigenera il token dalla scheda "calendari" dell'alloggio.

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ alloggio: string }> }) {
  const { alloggio } = await params;
  const id = alloggio.replace(/\.ics$/i, '');
  if (!(await accessoIcalConsentito(id, req.nextUrl.searchParams.get('t')))) return NextResponse.json({ error: 'Alloggio non trovato' }, { status: 404 });
  const ics = await generaIcalAlloggio(id);
  if (ics == null) return NextResponse.json({ error: 'Alloggio non trovato' }, { status: 404 });
  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="${id}.ics"`,
      'Cache-Control': 'public, max-age=900',
    },
  });
}
