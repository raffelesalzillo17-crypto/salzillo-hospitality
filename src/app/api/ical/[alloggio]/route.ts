import { NextRequest, NextResponse } from 'next/server';
import { generaIcalAlloggio } from '@/lib/db/ical';

// Feed iCal PUBBLICO di un alloggio (l'URL stesso è il segreto — è così che funzionano
// Airbnb e Booking). Da incollare nella sezione "importa calendario" della piattaforma:
// le prenotazioni attive nostre bloccano quelle date anche lì.
//   https://salzillo-hospitality.vercel.app/api/ical/<id-alloggio>.ics

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ alloggio: string }> }) {
  const { alloggio } = await params;
  const id = alloggio.replace(/\.ics$/i, '');
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
