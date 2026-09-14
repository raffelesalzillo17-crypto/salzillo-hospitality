import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { pdfConfermaPrenotazione, pdfPreventivo, pdfPreventivoDaId, pdfContrattoGestione } from '@/lib/db/documentiPdf';

// Genera un PDF: ?tipo=conferma&prenotazione=<id>  |  ?tipo=preventivo&...  |  ?tipo=contratto-gestione&contratto=<id>

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tipo = q.get('tipo');

  // Un preventivo già salvato (tipo=preventivo&id=...) o la conferma di una prenotazione
  // (tipo=conferma&prenotazione=...) sono pensati per essere condivisi con l'ospite via
  // WhatsApp — niente sessione richiesta, l'unico "segreto" è l'id/prenotazione (uuid, non
  // enumerabile), stesso modello di un link di condivisione. Il contratto di gestione (tra
  // Raffaele e il proprietario, non per l'ospite) e l'anteprima live di un preventivo non
  // ancora salvato restano dietro login, come prima.
  const condivisibile = (tipo === 'preventivo' && !!q.get('id')) || (tipo === 'conferma' && !!q.get('prenotazione'));
  if (!condivisibile) {
    const check = await richiediSessione(req);
    if ('risposta' in check) return check.risposta;
  }
  try {
    let out: { bytes: Uint8Array; nome: string } | null = null;
    if (tipo === 'conferma') {
      out = await pdfConfermaPrenotazione(q.get('prenotazione') || '');
    } else if (tipo === 'preventivo' && q.get('id')) {
      out = await pdfPreventivoDaId(q.get('id') || '');
    } else if (tipo === 'preventivo') {
      out = await pdfPreventivo({
        alloggioId: q.get('alloggio') || '', checkin: q.get('checkin') || '', checkout: q.get('checkout') || '',
        numeroOspiti: Number(q.get('ospiti') || '1'),
        prezzo: q.get('prezzo') ? Number(q.get('prezzo')) : undefined,
        prezzoNotte: q.get('prezzoNotte') ? Number(q.get('prezzoNotte')) : undefined,
        sconto: q.get('sconto') ? Number(q.get('sconto')) : undefined,
        scontoTipo: q.get('scontoTipo') === 'percento' ? 'percento' : q.get('scontoTipo') === 'euro' ? 'euro' : undefined,
        nomeCliente: q.get('cliente') || undefined, telefonoCliente: q.get('tel') || undefined,
        validoOre: q.get('ore') ? Number(q.get('ore')) : undefined, note: q.get('note') || undefined,
      });
    } else if (tipo === 'contratto-gestione') {
      out = await pdfContrattoGestione(q.get('contratto') || '');
    } else {
      return NextResponse.json({ ok: false, error: 'tipo non valido' }, { status: 400 });
    }
    if (!out) return NextResponse.json({ ok: false, error: 'Dati non trovati' }, { status: 404 });
    // "inline" apre il PDF navigando la scheda — dentro l'app installata come PWA (standalone,
    // senza barra del browser) questo intrappola chi la usa senza un modo per tornare indietro
    // (bug reale segnalato da Raffaele il 14/09/2026). Resta "inline" di default (serve
    // all'anteprima nell'iframe, e va bene per l'ospite che apre il link da WhatsApp nel suo
    // browser); i link cliccabili dentro /nuovo passano sempre ?download=1 per forzare invece
    // il download, che non naviga via dall'app.
    const scarica = q.get('download') === '1';
    return new NextResponse(Buffer.from(out.bytes), {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${scarica ? 'attachment' : 'inline'}; filename="${out.nome}"` },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
