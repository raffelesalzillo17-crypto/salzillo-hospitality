import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { generateToken, ricevuta } from '@/lib/alloggiatiWebService';
import { getDb } from '@/lib/db/index';
import { schedine, prenotazioni, ospiti } from '@/lib/db/schema';
import { registraDocumento } from '@/lib/documenti';

// Scarica la ricevuta ufficiale (PDF) di un giorno di invii — obbligo distinto dall'invio
// stesso: il gestore deve poter esibire la ricevuta di ogni giorno in cui ha trasmesso
// schedine, non solo averle inviate. Vedi src/lib/alloggiatiWebService.ts (ricevuta()) per il
// dettaglio e l'avviso "non ancora testato contro il servizio reale" — nessun invio vero è mai
// stato fatto finora, quindi questa route non ha ancora potuto essere provata su un giorno reale.
//
// Solo il Titolare, sempre un click esplicito — stesso spirito di /api/nuovo/alloggiati/invia.
//
// Salvataggio su Drive (aggiunto 20/09/2026, richiesta di Raffaele — "come succede per i
// preventivi"): una ricevuta copre TUTTE le schedine inviate quel giorno per la struttura, non
// una sola prenotazione — quindi si registra una copia per ciascuna prenotazione le cui
// schedine risultano "Inviata" quel giorno (stessa PDF, una riga in `documenti` per ospite/
// prenotazione, tramite registraDocumento — lo stesso meccanismo già usato per preventivi e
// contratti). Se non risultano invii quel giorno (non dovrebbe succedere: Ricevuta() stessa
// avrebbe già dato esito negativo) il download avviene comunque, solo senza salvataggio.

export const dynamic = 'force-dynamic';

function dataRomaDaTimestamp(ts: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ts);
}

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

    // Trova le prenotazioni le cui schedine sono state inviate proprio in questa data (ora
    // italiana) — sono quelle coperte da questa ricevuta.
    const db = getDb();
    const righeInviate = await db.select({
      prenotazioneId: prenotazioni.id, ospiteId: ospiti.id, ospiteNome: ospiti.nome, ospiteCognome: ospiti.cognome,
      inviataIl: schedine.inviata_il,
    })
      .from(schedine)
      .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
      .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
      .where(eq(schedine.stato, 'Inviata'));

    const prenotazioniDelGiorno = new Map<string, { ospiteId: string; ospiteNome: string }>();
    for (const r of righeInviate) {
      if (r.inviataIl && dataRomaDaTimestamp(new Date(r.inviataIl)) === data) {
        prenotazioniDelGiorno.set(r.prenotazioneId, { ospiteId: r.ospiteId, ospiteNome: `${r.ospiteNome} ${r.ospiteCognome}`.trim() });
      }
    }

    const nomeFile = `Ricevuta Alloggiati ${data}.pdf`;
    const pdfBuffer = Buffer.from(res.pdfBase64, 'base64');
    const salvate: string[] = [];
    const nonSalvate: string[] = [];
    for (const [prenotazioneId, info] of prenotazioniDelGiorno) {
      try {
        await registraDocumento({
          ospiteId: info.ospiteId, nomeOspite: info.ospiteNome, nomeFile, contenuto: pdfBuffer,
          tipo: 'Ricevuta Alloggiati', prenotazioneId,
        });
        salvate.push(info.ospiteNome);
      } catch (e) {
        nonSalvate.push(`${info.ospiteNome} (${e instanceof Error ? e.message : String(e)})`);
      }
    }

    return NextResponse.json({ ok: true, data, pdfBase64: res.pdfBase64, salvateSuDrive: salvate, nonSalvateSuDrive: nonSalvate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
