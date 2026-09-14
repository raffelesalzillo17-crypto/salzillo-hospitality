import { NextRequest, NextResponse } from 'next/server';
import { leggiPrenotazioniDb, leggiAlloggiDb, leggiPulizieDb } from '@/lib/db/queries';

// Vista di sola lettura per la famiglia di Raffaele — link condivisibile senza login,
// protetto da un token lungo nella query string invece che da username/password (chi non
// ha il link non vede nulla). Espone TUTTO quello che vede Raffaele, dati economici inclusi
// (esplicitamente richiesto da Raffaele) — la protezione qui è solo il token nel link, non
// un livello di permessi separato: chi ha il link vede quanto Raffaele stesso, in sola lettura.

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k');
  const atteso = process.env.FAMIGLIA_TOKEN;
  if (!atteso || k !== atteso) {
    return NextResponse.json({ ok: false, error: 'Link non valido' }, { status: 401 });
  }
  try {
    const [prenotazioniComplete, alloggi, pulizieComplete] = await Promise.all([
      leggiPrenotazioniDb(), leggiAlloggiDb(), leggiPulizieDb(),
    ]);
    const prenotazioni = prenotazioniComplete
      .filter((p) => p.stato === 'Attiva')
      .map((p) => ({
        id: p.id, checkin: p.checkin, checkout: p.checkout, ospite: p.ospite, telefono: p.telefono,
        alloggio: p.alloggio, canale: p.canale, numeroOspiti: p.numeroOspiti,
        lordo: p.lordo, commissione: p.commissione, cedolare: p.cedolare, costoPulizia: p.costoPulizia,
        feeGestione: p.feeGestione, utile: p.utile, nettoProprietario: p.nettoProprietario,
      }));
    const pulizie = pulizieComplete.map((p) => ({
      id: p.id, data: p.data, alloggio: p.alloggio, fatta: p.confermataIl != null,
    }));
    return NextResponse.json({
      ok: true,
      alloggi: alloggi.filter((a) => a.attivo).map((a) => ({ id: a.id, nome: a.nome, emoji: a.emoji })),
      prenotazioni,
      pulizie,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
