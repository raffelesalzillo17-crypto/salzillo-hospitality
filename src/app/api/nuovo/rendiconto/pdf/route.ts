import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { rendicontoProprietarioDb } from '@/lib/db/queries';
import { richiediSessione } from '@/lib/db/auth';

// PDF del rendiconto mensile proprietario — pronto da inviare (WhatsApp/email).
// Stessa libreria (pdf-lib) di /api/ricevuta e /api/contratto.

export const dynamic = 'force-dynamic';

const eur = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  const proprietarioId = req.nextUrl.searchParams.get('proprietario');
  const anno = Number(req.nextUrl.searchParams.get('anno'));
  const mese = Number(req.nextUrl.searchParams.get('mese'));
  if (!proprietarioId || !anno || !mese) return NextResponse.json({ ok: false, error: 'Parametri mancanti' }, { status: 400 });

  if (sess.ruolo === 'Proprietario' && sess.proprietarioId !== proprietarioId) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  const r = await rendicontoProprietarioDb(proprietarioId, anno, mese);
  if (!r) return NextResponse.json({ ok: false, error: 'Non trovato' }, { status: 404 });

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const coral = rgb(1, 0.353, 0.373);
  const ink = rgb(0.11, 0.11, 0.12);
  const muted = rgb(0.43, 0.43, 0.45);
  let y = 790;
  const M = 50;

  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const nl = (n = 16) => { y -= n; if (y < 60) { page = pdf.addPage([595.28, 841.89]); y = 790; } };

  text('SALZILLO HOSPITALITY', M, 9, bold, coral); nl(14);
  text('Rendiconto di gestione', M, 20, bold); nl(24);
  const meseNome = new Date(anno, mese - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  text(`${r.proprietario}  ·  ${meseNome[0].toUpperCase() + meseNome.slice(1)}`, M, 12, font, muted); nl(28);

  // Intestazione tabella
  const cols = [M, M + 70, M + 200, M + 270, M + 340, M + 410, M + 475];
  const head = ['Check-in', 'Ospite', 'Canale', 'Lordo', 'Comm.', 'Cedol.', 'Netto'];
  head.forEach((h, i) => page.drawText(h, { x: cols[i], y, size: 8, font: bold, color: muted }));
  nl(6);
  page.drawLine({ start: { x: M, y }, end: { x: 545, y }, thickness: 0.7, color: muted }); nl(12);

  for (const x of r.righe) {
    const vals = [dataIt(x.checkin), (x.ospite || '').slice(0, 22), x.canale, eur(Number(x.lordo)), eur(Number(x.commissione)), eur(Number(x.cedolare)), eur(Number(x.nettoProprietario))];
    vals.forEach((v, i) => page.drawText(String(v), { x: cols[i], y, size: 8, font, color: ink }));
    nl(13);
  }
  if (r.righe.length === 0) { text('Nessuna prenotazione questo mese.', M, 9, font, muted); nl(13); }

  nl(4);
  page.drawLine({ start: { x: M, y }, end: { x: 545, y }, thickness: 0.7, color: muted }); nl(14);
  const tt = r.totali;
  text(`Totale lordo: ${eur(tt.lordo)}`, M, 9, bold); nl(13);
  text(`Commissioni OTA: -${eur(tt.commissione)}    Cedolare secca: -${eur(tt.cedolare)}    Pulizie: -${eur(tt.costoPulizia)}    Fee gestione: -${eur(tt.feeGestione)}`, M, 8, font, muted); nl(16);
  text(`Netto dalle prenotazioni: ${eur(tt.nettoProprietario)}`, M, 10, bold); nl(14);
  if (tt.impostaSoggiorno > 0) { text(`Imposta di soggiorno incassata dagli ospiti (da versare al comune): ${eur(tt.impostaSoggiorno)}`, M, 8, font, muted); nl(13); }

  if (r.spese.length > 0) {
    text('Spese del mese:', M, 9, bold); nl(13);
    for (const s of r.spese) { text(`${dataIt(s.data)}  ${s.categoria} — ${s.descrizione}`, M + 10, 8, font, muted); page.drawText(`-${eur(Number(s.importo))}`, { x: 475, y, size: 8, font }); nl(12); }
    text(`Totale spese: -${eur(tt.totSpese)}`, M, 9, bold); nl(16);
  }

  nl(6);
  page.drawRectangle({ x: M, y: y - 6, width: 495, height: 26, color: rgb(1, 0.906, 0.894) });
  text('SPETTA AL PROPRIETARIO', M + 10, 10, bold, coral);
  page.drawText(eur(tt.nettoFinale), { x: 440, y, size: 13, font: bold, color: coral });
  nl(30);
  text('Fee di gestione applicata: 0% (immobile di famiglia).', M, 7, font, muted); nl(10);
  text(`Documento generato il ${new Date().toLocaleDateString('it-IT')} — Salzillo Hospitality`, M, 7, font, muted);

  const bytes = await pdf.save();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="rendiconto-${r.proprietario.replace(/\s+/g, '-').toLowerCase()}-${anno}-${String(mese).padStart(2, '0')}.pdf"`,
    },
  });
}
