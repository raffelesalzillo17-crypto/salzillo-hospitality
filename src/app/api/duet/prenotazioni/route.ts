import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { leggiPrenotazioni } from '@/lib/prenotazioni';

// Lettura delle prenotazioni riservata a Duet, l'assistente di Raffaele (13/11/2026). È un accesso
// dedicato, in sola lettura e revocabile: serve la chiave DUET_LETTURA_KEY nell'intestazione
// x-duet-key (la stessa chiave sta nelle variabili d'ambiente di Vercel di questo progetto e di
// plancia-raffaele; per revocarla basta cambiarla o toglierla). Restituisce SOLO ciò che serve a
// Duet: niente telefono, incassi, utile, penali né id degli eventi. Non tocca il sito `/` né la
// rotta aperta /api/prenotazioni, che restano com'erano (decisione del 10/09/2026).

export const dynamic = 'force-dynamic';

function chiaveValida(req: NextRequest): boolean {
  const attesa = process.env.DUET_LETTURA_KEY || '';
  const data = req.headers.get('x-duet-key') || '';
  if (attesa.length < 32 || data.length !== attesa.length) return false;
  return timingSafeEqual(Buffer.from(data), Buffer.from(attesa));
}

export async function GET(req: NextRequest) {
  if (!chiaveValida(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const tutte = await leggiPrenotazioni();
    const prenotazioni = tutte.map((p) => ({ checkin: p.checkin, checkout: p.checkout, ospite: p.ospite, stanza: p.stanza, canale: p.canale, stato: p.stato }));
    return NextResponse.json({ ok: true, prenotazioni });
  } catch (err) {
    console.error('[duet/prenotazioni] ERRORE:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Lettura non riuscita' }, { status: 500 });
  }
}
