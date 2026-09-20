import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { generateToken, ricevuta } from '@/lib/alloggiatiWebService';

// Scarica la ricevuta ufficiale (PDF) di un giorno di invii — obbligo distinto dall'invio
// stesso: il gestore deve poter esibire la ricevuta di ogni giorno in cui ha trasmesso
// schedine, non solo averle inviate. Vedi src/lib/alloggiatiWebService.ts (ricevuta()) per il
// dettaglio e l'avviso "non ancora testato contro il servizio reale" — nessun invio vero è mai
// stato fatto finora, quindi questa route non ha ancora potuto essere provata su un giorno reale.
//
// Solo il Titolare, sempre un click esplicito — stesso spirito di /api/nuovo/alloggiati/invia.

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body non valido' }, { status: 400 });
  }
  const data = body.data;
  if (typeof data !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return NextResponse.json({ ok: false, error: 'data mancante o non in formato YYYY-MM-DD' }, { status: 400 });
  }

  try {
    const tokenRes = await generateToken();
    if (!tokenRes.esito.esito || !tokenRes.token) {
      return NextResponse.json({ ok: false, error: `Autenticazione ad Alloggiati Web fallita: ${tokenRes.esito.erroreDes || 'nessun token ricevuto'}` }, { status: 502 });
    }

    const res = await ricevuta(tokenRes.token, data);
    if (!res.pdfBase64) {
      const motivo = res.esito.erroreDes || 'nessuna ricevuta disponibile per questa data (il portale la emette solo per i giorni in cui è stato fatto un invio vero)';
      return NextResponse.json({ ok: false, error: motivo }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data, pdfBase64: res.pdfBase64 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
