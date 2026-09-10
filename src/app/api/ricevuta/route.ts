import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getScia } from '@/lib/strutture';

export const runtime = 'nodejs';

// Elenco strutture centralizzato in src/lib/strutture.ts (09/09/2026) — qui restano solo i
// dati fiscali di default per ciascuna SCIA, specifici di questa route.
const DEFAULT_TULIPANO = {
  intestatario: 'Luigi Salzillo',
  indirizzoStruttura: 'Via Clanio 60, Marcianise (CE)',
  pIva: '',
  cf: 'SLZLGU74C08E932O',
};

// Via Campania (Piano Terra/Primo Piano/Secondo Piano, rinominate da Stanza 3/4/5 l'08/09/2026): intestatario non confermato dalle fonti — nessun default,
// va compilato a mano nel form prima di generare la ricevuta.
const DEFAULT_ALTRO = {
  intestatario: '',
  indirizzoStruttura: '',
  pIva: '',
  cf: '',
};

type RicevutaBody = {
  ospite: string;
  stanza: string;
  checkin: string;   // DD/MM/YYYY
  checkout: string;  // DD/MM/YYYY
  canale?: string;
  lordo: number;
  intestatario?: string;
  indirizzoStruttura?: string;
  pIva?: string;
  cf?: string;
  impostaSoggiorno?: number | null;
  luogo?: string;
  dataEmissione?: string; // DD/MM/YYYY, default oggi
};

function fmtEuro(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function oggiIt(): string {
  const d = new Date();
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function numeroRicevuta(dataEmissione: string, ospite: string): string {
  const [gg, mm, aaaa] = dataEmissione.split('/');
  const iniziali = ospite
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return `${aaaa ?? ''}${mm ?? ''}${gg ?? ''}-${iniziali}`;
}

async function generaPdf(body: RicevutaBody): Promise<Uint8Array> {
  const defaults = getScia(body.stanza) === 'tulipano' ? DEFAULT_TULIPANO : DEFAULT_ALTRO;

  const intestatario = body.intestatario?.trim() || defaults.intestatario;
  const indirizzoStruttura = body.indirizzoStruttura?.trim() || defaults.indirizzoStruttura;
  const pIva = body.pIva?.trim() || defaults.pIva;
  const cf = body.cf?.trim() || defaults.cf;
  const dataEmissione = body.dataEmissione?.trim() || oggiIt();
  const luogo = body.luogo?.trim() || 'Marcianise';
  const lordo = Number.isFinite(body.lordo) ? body.lordo : 0;
  const impostaSoggiorno = typeof body.impostaSoggiorno === 'number' && Number.isFinite(body.impostaSoggiorno)
    ? body.impostaSoggiorno
    : null;
  const totale = lordo + (impostaSoggiorno ?? 0);

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const marginX = 56;
  let y = 780;
  const ink = rgb(0.1, 0.1, 0.12);
  const muted = rgb(0.4, 0.4, 0.44);

  const draw = (text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number } = {}) => {
    const { size = 11, bold = false, color = ink, x = marginX } = opts;
    page.drawText(text, { x, y, size, font: bold ? fontBold : font, color });
  };
  const gap = (n = 18) => { y -= n; };

  // Intestazione
  draw(intestatario || '(intestatario da definire)', { size: 15, bold: true });
  gap(20);
  if (indirizzoStruttura) { draw(indirizzoStruttura, { size: 10, color: muted }); gap(14); }
  const fiscale = [pIva ? `P.IVA ${pIva}` : null, cf ? `CF ${cf}` : null].filter(Boolean).join('  —  ');
  if (fiscale) { draw(fiscale, { size: 10, color: muted }); gap(14); }
  gap(10);

  // Titolo + numero ricevuta
  draw('RICEVUTA PER LOCAZIONE TURISTICA', { size: 13, bold: true });
  gap(18);
  draw(`Ricevuta n. ${numeroRicevuta(dataEmissione, body.ospite)}`, { size: 10, color: muted });
  gap(14);
  draw(`Data emissione: ${dataEmissione}`, { size: 10, color: muted });
  gap(28);

  // Linea divisoria
  page.drawLine({ start: { x: marginX, y }, end: { x: 595.28 - marginX, y }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });
  gap(26);

  // Dati ospite / soggiorno
  draw('Ospite', { size: 9, color: muted });
  gap(14);
  draw(body.ospite, { size: 12, bold: true });
  gap(22);

  draw('Stanza', { size: 9, color: muted });
  draw('Check-in', { size: 9, color: muted, x: marginX + 180 });
  draw('Check-out', { size: 9, color: muted, x: marginX + 300 });
  draw('Canale', { size: 9, color: muted, x: marginX + 420 });
  gap(14);
  draw(body.stanza, { size: 11, x: marginX });
  draw(body.checkin, { size: 11, x: marginX + 180 });
  draw(body.checkout, { size: 11, x: marginX + 300 });
  draw(body.canale || '—', { size: 11, x: marginX + 420 });
  gap(32);

  page.drawLine({ start: { x: marginX, y }, end: { x: 595.28 - marginX, y }, thickness: 0.75, color: rgb(0.85, 0.85, 0.85) });
  gap(26);

  // Importi
  const rightX = 595.28 - marginX - 90;
  draw('Importo soggiorno (lordo)', { size: 11 });
  draw(`€ ${fmtEuro(lordo)}`, { size: 11, x: rightX });
  gap(22);

  draw('Imposta di soggiorno', { size: 11 });
  draw(impostaSoggiorno !== null ? `€ ${fmtEuro(impostaSoggiorno)}` : '€ 0,00', { size: 11, x: rightX, color: ink });
  gap(16);
  draw('* Comune di Marcianise: nessuna imposta di soggiorno risulta attualmente in vigore (verificato tramite ricerca, nessun regolamento trovato).', { size: 8, color: muted });
  gap(28);

  page.drawLine({ start: { x: marginX, y }, end: { x: 595.28 - marginX, y }, thickness: 1, color: rgb(0.2, 0.2, 0.2) });
  gap(24);

  draw('TOTALE', { size: 13, bold: true });
  draw(`€ ${fmtEuro(totale)}`, { size: 13, bold: true, x: rightX });
  gap(60);

  draw(`${luogo}, ${dataEmissione}`, { size: 10, color: muted });
  gap(50);

  draw('Firma', { size: 10, color: muted });
  page.drawLine({ start: { x: marginX, y: y - 4 }, end: { x: marginX + 200, y: y - 4 }, thickness: 0.75, color: rgb(0.6, 0.6, 0.6) });

  return pdf.save();
}

function parseBody(json: unknown): RicevutaBody | null {
  if (!json || typeof json !== 'object') return null;
  const b = json as Record<string, unknown>;
  if (typeof b.ospite !== 'string' || !b.ospite.trim()) return null;
  if (typeof b.stanza !== 'string' || !b.stanza.trim()) return null;
  if (typeof b.checkin !== 'string' || typeof b.checkout !== 'string') return null;
  const lordo = typeof b.lordo === 'number' ? b.lordo : parseFloat(String(b.lordo ?? 0));
  return {
    ospite: b.ospite,
    stanza: b.stanza,
    checkin: b.checkin,
    checkout: b.checkout,
    canale: typeof b.canale === 'string' ? b.canale : undefined,
    lordo: Number.isFinite(lordo) ? lordo : 0,
    intestatario: typeof b.intestatario === 'string' ? b.intestatario : undefined,
    indirizzoStruttura: typeof b.indirizzoStruttura === 'string' ? b.indirizzoStruttura : undefined,
    pIva: typeof b.pIva === 'string' ? b.pIva : undefined,
    cf: typeof b.cf === 'string' ? b.cf : undefined,
    impostaSoggiorno: typeof b.impostaSoggiorno === 'number' ? b.impostaSoggiorno : null,
    luogo: typeof b.luogo === 'string' ? b.luogo : undefined,
    dataEmissione: typeof b.dataEmissione === 'string' ? b.dataEmissione : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const body = parseBody(json);
    if (!body) {
      return NextResponse.json({ error: 'Dati mancanti: servono almeno ospite, stanza, checkin, checkout, lordo.' }, { status: 400 });
    }
    if (body.canale === 'No Tax') {
      return NextResponse.json({ error: 'Le prenotazioni No Tax non generano ricevuta.' }, { status: 400 });
    }
    const pdfBytes = await generaPdf(body);
    const nome = `ricevuta-${body.stanza.replace(/\s+/g, '')}-${body.ospite.replace(/\s+/g, '')}.pdf`.toLowerCase();

    // Salva il PDF nella cartella Drive dell'ospite — non-bloccante, la ricevuta va comunque
    // restituita anche se Drive non è configurato o fallisce. Vedi src/lib/documenti.ts.
    try {
      const { trovaOCreaOspite } = await import('@/lib/ospiti');
      const { salvaDocumento } = await import('@/lib/documenti');
      const ospite = await trovaOCreaOspite(body.ospite, '');
      await salvaDocumento(ospite.ospiteId, ospite.nome, nome, Buffer.from(pdfBytes));
    } catch (docErr) {
      const docMsg = docErr instanceof Error ? docErr.message : String(docErr);
      console.error('[ricevuta] ERRORE salvataggio documento su Drive (PDF comunque restituito):', docMsg);
    }

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${nome}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ricevuta] ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
