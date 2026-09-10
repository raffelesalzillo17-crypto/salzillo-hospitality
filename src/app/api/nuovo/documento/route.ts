import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { pdfConfermaPrenotazione, pdfPreventivo, pdfContrattoGestione } from '@/lib/db/documentiPdf';

// Genera un PDF: ?tipo=conferma&prenotazione=<id>  |  ?tipo=preventivo&...  |  ?tipo=contratto-gestione&contratto=<id>

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;

  const q = req.nextUrl.searchParams;
  const tipo = q.get('tipo');
  try {
    let out: { bytes: Uint8Array; nome: string } | null = null;
    if (tipo === 'conferma') {
      out = await pdfConfermaPrenotazione(q.get('prenotazione') || '');
    } else if (tipo === 'preventivo') {
      out = await pdfPreventivo({
        alloggioId: q.get('alloggio') || '', checkin: q.get('checkin') || '', checkout: q.get('checkout') || '',
        numeroOspiti: Number(q.get('ospiti') || '1'), prezzo: Number(q.get('prezzo') || '0'),
        nomeCliente: q.get('cliente') || undefined, note: q.get('note') || undefined,
      });
    } else if (tipo === 'contratto-gestione') {
      out = await pdfContrattoGestione(q.get('contratto') || '');
    } else {
      return NextResponse.json({ ok: false, error: 'tipo non valido' }, { status: 400 });
    }
    if (!out) return NextResponse.json({ ok: false, error: 'Dati non trovati' }, { status: 404 });
    return new NextResponse(Buffer.from(out.bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${out.nome}"` },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
