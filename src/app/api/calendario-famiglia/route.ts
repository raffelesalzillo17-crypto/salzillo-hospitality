import { NextRequest, NextResponse } from 'next/server';
import { leggiPrenotazioniDb, leggiAlloggiDb } from '@/lib/db/queries';

// Vista di sola lettura per la famiglia di Raffaele — link condivisibile senza login,
// protetto da un token lungo nella query string invece che da username/password (chi non
// ha il link non vede nulla). Espone SOLO i dati operativi (chi arriva/parte, quando, dove),
// MAI quelli economici (lordo, utile, commissioni, netto proprietario) — quelli restano
// visibili solo a Raffaele dentro /nuovo.

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k');
  const atteso = process.env.FAMIGLIA_TOKEN;
  if (!atteso || k !== atteso) {
    return NextResponse.json({ ok: false, error: 'Link non valido' }, { status: 401 });
  }
  try {
    const [prenotazioniComplete, alloggi] = await Promise.all([leggiPrenotazioniDb(), leggiAlloggiDb()]);
    const prenotazioni = prenotazioniComplete
      .filter((p) => p.stato === 'Attiva')
      .map((p) => ({
        id: p.id, checkin: p.checkin, checkout: p.checkout, ospite: p.ospite, telefono: p.telefono,
        alloggio: p.alloggio, canale: p.canale, numeroOspiti: p.numeroOspiti,
      }));
    return NextResponse.json({
      ok: true,
      alloggi: alloggi.filter((a) => a.attivo).map((a) => ({ id: a.id, nome: a.nome, emoji: a.emoji })),
      prenotazioni,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
