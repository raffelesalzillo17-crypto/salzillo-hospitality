import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { rendicontoProprietarioDb } from '@/lib/db/queries';
import { richiediSessione } from '@/lib/db/auth';
import { LOGO_SALZILLO_PNG_BASE64 } from '@/lib/db/logoSalzillo';
import { registraDocumentoProprietario } from '@/lib/documenti';

// PDF del rendiconto mensile proprietario — pronto da inviare (WhatsApp/email).
// Riprogettato: intestazione con logo, riquadri di sintesi, confronto con mese
// scorso e stesso mese dell'anno prima, previsione per il mese successivo.

export const dynamic = 'force-dynamic';

const eur = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const eur0 = (n: number) => Math.round(n).toLocaleString('it-IT') + ' €';
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const nomeMese = (anno: number, mese: number) => {
  const s = new Date(anno, mese - 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s[0].toUpperCase() + s.slice(1);
};
// variazione di "ora" (questo mese) rispetto a "prima" (periodo di confronto)
const delta = (ora: number, prima: number) => {
  if (!prima) return '';
  const p = Math.round(((ora - prima) / prima) * 100);
  return `  ${p >= 0 ? '+' : ''}${p}% vs questo mese`;
};
const neg = (n: number) => (n > 0.005 ? '-' : '') + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  const proprietarioParam = req.nextUrl.searchParams.get('proprietario');
  const anno = Number(req.nextUrl.searchParams.get('anno'));
  const mese = Number(req.nextUrl.searchParams.get('mese'));
  if (!proprietarioParam || !anno || !mese) return NextResponse.json({ ok: false, error: 'Parametri mancanti' }, { status: 400 });

  if (proprietarioParam === 'tutti' && sess.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  if (sess.ruolo === 'Proprietario' && sess.proprietarioId !== proprietarioParam) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 });
  const proprietarioId = proprietarioParam === 'tutti' ? null : proprietarioParam;
  const scarica = req.nextUrl.searchParams.get('download') === '1';
  const immobileId = req.nextUrl.searchParams.get('immobile') || undefined;
  const alloggioId = req.nextUrl.searchParams.get('alloggio') || undefined;
  const ambito = alloggioId ? { alloggioId } : immobileId ? { immobileId } : undefined;
  const r = await rendicontoProprietarioDb(proprietarioId, anno, mese, ambito);
  if (!r) return NextResponse.json({ ok: false, error: 'Non trovato' }, { status: 404 });

  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let logo = null;
  try { logo = await pdf.embedPng(Buffer.from(LOGO_SALZILLO_PNG_BASE64, 'base64')); } catch { /* opzionale */ }

  const coral = rgb(1, 0.353, 0.373);
  const ink = rgb(0.11, 0.11, 0.12);
  const muted = rgb(0.43, 0.43, 0.45);
  const wash = rgb(0.97, 0.97, 0.98);
  const coralWash = rgb(1, 0.906, 0.894);
  const M = 50;
  const R = 545;
  let y = 790;

  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const right = (s: string, xr: number, size = 10, f = font, color = ink) => page.drawText(s, { x: xr - f.widthOfTextAtSize(s, size), y, size, font: f, color });
  const nl = (n = 16) => { y -= n; if (y < 70) { page = pdf.addPage([595.28, 841.89]); y = 790; } };
  const rule = (yy = y) => page.drawLine({ start: { x: M, y: yy }, end: { x: R, y: yy }, thickness: 0.7, color: muted });

  // ── Intestazione ────────────────────────────────────────────────────────
  if (logo) {
    const w = 74, h = (w * logo.height) / logo.width;
    page.drawImage(logo, { x: M, y: 836 - h, width: w, height: h });
  }
  page.drawText('Rendiconto di gestione', { x: 140, y: 806, size: 18, font: bold, color: ink });
  const sub = `${r.proprietario}  ·  ${nomeMese(anno, mese)}` + (r.ambito.tipo !== 'tutto' ? `  ·  ${r.ambito.etichetta}` : '');
  page.drawText(sub, { x: 140, y: 790, size: 10, font, color: muted });
  y = 762;
  rule(); nl(20);

  // ── Riquadri di sintesi ─────────────────────────────────────────────────
  const t = r.totali;
  const cards: [string, string][] = [
    ['Prenotazioni', String(t.numPrenotazioni)],
    ['Incassato lordo', eur0(t.lordo)],
    ['Spetta al proprietario', eur0(t.nettoFinale)],
  ];
  const cw = (R - M - 20) / 3;
  cards.forEach(([label, val], i) => {
    const x = M + i * (cw + 10);
    page.drawRectangle({ x, y: y - 42, width: cw, height: 46, color: i === 2 ? coralWash : wash });
    page.drawText(label.toUpperCase(), { x: x + 10, y: y - 12, size: 7, font: bold, color: muted });
    page.drawText(val, { x: x + 10, y: y - 33, size: 16, font: bold, color: i === 2 ? coral : ink });
  });
  nl(64);

  // ── Confronto ───────────────────────────────────────────────────────────
  const c = r.confronti;
  text('CONFRONTO', M, 8, bold, muted); nl(14);
  const cc = [M, M + 250, M + 370, M + 470];
  text('Periodo', cc[0], 8, bold, muted);
  text('Prenot.', cc[1], 8, bold, muted);
  right('Lordo', cc[2] + 40, 8, bold, muted);
  right('Netto propr.', R, 8, bold, muted);
  nl(4); rule(); nl(13);
  const rowConf = (etich: string, n: number, lordo: number, netto: number, forte = false) => {
    text(etich, cc[0], 8.5, forte ? bold : font, ink);
    text(String(n), cc[1], 8.5, forte ? bold : font, ink);
    right(eur(lordo), cc[2] + 40, 8.5, forte ? bold : font, ink);
    right(eur(netto), R, 8.5, forte ? bold : font, ink);
    nl(13);
  };
  rowConf(nomeMese(anno, mese) + '  (questo mese)', t.numPrenotazioni, t.lordo, t.nettoProprietario, true);
  rowConf('Mese scorso (' + nomeMese(c.meseScorso.anno, c.meseScorso.mese) + ')' + delta(t.numPrenotazioni, c.meseScorso.prenotazioni),
    c.meseScorso.prenotazioni, c.meseScorso.lordo, c.meseScorso.nettoProprietario);
  rowConf('Stesso mese ' + (anno - 1) + delta(t.numPrenotazioni, c.annoScorso.prenotazioni),
    c.annoScorso.prenotazioni, c.annoScorso.lordo, c.annoScorso.nettoProprietario);
  if (c.annoScorso.prenotazioni === 0) { text('(nessun dato per ' + nomeMese(anno - 1, mese) + ')', cc[0], 7, font, muted); nl(11); }
  nl(8);

  // ── Dettaglio prenotazioni ──────────────────────────────────────────────
  text('DETTAGLIO PRENOTAZIONI', M, 8, bold, muted); nl(14);
  const col = [M, M + 55, M + 160, M + 212, M + 262, M + 312, M + 362];
  const head = ['Check-in', 'Ospite', 'Canale', 'Lordo', 'Comm.', 'Cedol.', 'Puliz.'];
  head.forEach((h, i) => page.drawText(h, { x: col[i], y, size: 7, font: bold, color: muted }));
  right('Netto propr.', R, 7, bold, muted);
  nl(5); rule(); nl(12);

  for (const x of r.righe) {
    page.drawText(dataIt(x.checkin), { x: col[0], y, size: 7.5, font, color: ink });
    page.drawText((x.ospite || '').slice(0, 20), { x: col[1], y, size: 7.5, font, color: ink });
    page.drawText(x.canale, { x: col[2], y, size: 7.5, font, color: ink });
    right(eur(Number(x.lordo)), col[3] + 42, 7.5, font, ink);
    right(neg(Number(x.commissione)), col[4] + 42, 7.5, font, muted);
    right(neg(Number(x.cedolare)), col[5] + 42, 7.5, font, muted);
    right(neg(Number(x.costoPulizia)), col[6] + 42, 7.5, font, muted);
    right(eur(Number(x.nettoProprietario)), R, 7.5, bold, ink);
    nl(12.5);
  }
  if (r.righe.length === 0) { text('Nessuna prenotazione in questo mese.', M, 8.5, font, muted); nl(13); }

  nl(2); rule(); nl(13);
  text('Totali del mese', M, 8.5, bold, ink);
  right(eur(t.lordo), col[3] + 42, 8, bold, ink);
  right(neg(t.commissione), col[4] + 42, 8, font, muted);
  right(neg(t.cedolare), col[5] + 42, 8, font, muted);
  right(neg(t.costoPulizia), col[6] + 42, 8, font, muted);
  right(eur(t.nettoProprietario), R, 8, bold, ink);
  nl(16);

  text(`Costi di pulizia: ${neg(t.costoPulizia)}    Fee di gestione: ${neg(t.feeGestione)}`, M, 8, font, muted); nl(14);
  if (t.impostaSoggiorno > 0) { text(`Imposta di soggiorno incassata dagli ospiti (da versare al comune): ${eur(t.impostaSoggiorno)}`, M, 8, font, muted); nl(14); }

  // ── Spese ───────────────────────────────────────────────────────────────
  if (r.spese.length > 0) {
    nl(4); text('SPESE DEL MESE', M, 8, bold, muted); nl(14);
    for (const s of r.spese) {
      text(`${dataIt(s.data)}  ${s.categoria} - ${s.descrizione}`.slice(0, 70), M + 4, 8, font, muted);
      right('-' + eur(Number(s.importo)), R, 8, font, ink);
      nl(12);
    }
    nl(2); text('Totale spese', M, 8.5, bold, ink); right('-' + eur(t.totSpese), R, 8.5, bold, ink); nl(16);
  }

  // ── Previsione mese prossimo ────────────────────────────────────────────
  const pv = c.previsione;
  nl(4);
  page.drawRectangle({ x: M, y: y - 44, width: R - M, height: 48, color: wash });
  page.drawText(`PREVISIONE ${nomeMese(pv.anno, pv.mese).toUpperCase()}`, { x: M + 10, y: y - 12, size: 7, font: bold, color: muted });
  page.drawText(
    `Gia' acquisite ${pv.acquisito.prenotazioni} prenotazioni per ${eur(pv.acquisito.lordo)} di lordo.`,
    { x: M + 10, y: y - 27, size: 9, font, color: ink },
  );
  page.drawText(
    `Stesso mese l'anno scorso: ${pv.annoScorso.prenotazioni} prenotazioni, ${eur(pv.annoScorso.lordo)} di lordo.`,
    { x: M + 10, y: y - 39, size: 8, font, color: muted },
  );
  nl(64);

  // ── Spetta al proprietario ─────────────────────────────────────────────
  page.drawRectangle({ x: M, y: y - 8, width: R - M, height: 30, color: coralWash });
  page.drawText('SPETTA AL PROPRIETARIO', { x: M + 12, y, size: 11, font: bold, color: coral });
  right(eur(t.nettoFinale), R - 12, 15, bold, coral);
  nl(34);
  text('Netto dalle prenotazioni meno le spese del mese. Fee di gestione applicata: 0% (immobile di famiglia).', M, 7, font, muted); nl(11);
  text(`Documento generato il ${new Date().toLocaleDateString('it-IT')} - Salzillo Hospitality`, M, 7, font, muted);

  const bytes = await pdf.save();
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const suff = r.ambito.tipo !== 'tutto' ? '-' + slug(r.ambito.etichetta) : '';
  const nomeFile = `rendiconto-${slug(r.proprietario)}${suff}-${anno}-${String(mese).padStart(2, '0')}.pdf`;

  // Salvato su Drive (cartella del proprietario) solo quando c'è un proprietario vero — la
  // vista "tutti i proprietari insieme" non ha un unico destinatario a cui appartenga il file.
  // Aggiunto il 23/09/2026: prima questo PDF veniva solo generato al volo e mai conservato da
  // nessuna parte (vedi audit) — se una prenotazione veniva corretta dopo l'invio, non c'era
  // modo di recuperare cosa fosse stato effettivamente mandato. Non bloccante: un problema di
  // Drive non deve mai impedire di scaricare il rendiconto già generato.
  if (proprietarioId) {
    registraDocumentoProprietario({
      proprietarioId, nomeProprietario: r.proprietario, nomeFile, contenuto: Buffer.from(bytes), tipo: 'Rendiconto',
    }).catch((e) => console.error('[rendiconto/pdf] salvataggio su Drive fallito (non bloccante):', e instanceof Error ? e.message : e));
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      // "inline" apre il PDF navigando la scheda — dentro l'app installata come PWA
      // (standalone, senza barra del browser) questo intrappola chi la usa senza un modo per
      // tornare indietro (bug reale segnalato da Raffaele il 14/09/2026). Con ?download=1 (i
      // link cliccabili nell'app lo passano sempre) forziamo invece il download: il file si
      // salva e l'app resta aperta dov'era.
      'Content-Disposition': `${scarica ? 'attachment' : 'inline'}; filename="${nomeFile}"`,
    },
  });
}
