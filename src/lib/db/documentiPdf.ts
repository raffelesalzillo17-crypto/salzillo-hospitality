/**
 * Generazione PDF per il nuovo sistema: conferma prenotazione, preventivo, contratto di
 * gestione. Stessa libreria (pdf-lib) e stile di /api/ricevuta e /api/contratto.
 * Il rendiconto proprietario ha il suo file a parte (/api/nuovo/rendiconto/pdf).
 */

import { PDFDocument, PDFFont, PDFImage, PDFName, PDFPage, PDFString, StandardFonts, rgb } from 'pdf-lib';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { prenotazioni, ospiti, alloggi, immobili, proprietari, contrattiGestione } from './schema';
import { LOGO_SALZILLO_PNG_BASE64 } from './logoSalzillo';
import { preventivoPerPdf } from './queries';

const CORAL = rgb(1, 0.353, 0.373);
const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.43, 0.43, 0.45);
const eur = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const notti = (ci: string, co: string) => Math.max(1, Math.round((Date.parse(co) - Date.parse(ci)) / 864e5));

// Le font standard di pdf-lib usano la codifica WinAnsi: caratteri come → – — " " … •
// mandano in errore. Questa funzione li converte in equivalenti sicuri e toglie il resto —
// va applicata a QUALSIASI testo (soprattutto quello scritto dall'utente: note, nomi).
const RIMPIAZZI: Record<string, string> = {
  '→': '->', '←': '<-', '↔': '<->', '⇒': '=>', '–': '-', '—': '-', '‐': '-', '‑': '-',
  '“': '"', '”': '"', '„': '"', '‘': "'", '’': "'", '‚': "'", '…': '...', '•': '-',
  '·': '.', '×': 'x', '™': '(TM)', '®': '(R)', '©': '(C)', ' ': ' ', '\t': ' ',
};
function pulisci(s: unknown): string {
  let t = String(s ?? '');
  for (const [k, v] of Object.entries(RIMPIAZZI)) t = t.split(k).join(v);
  // togli tutto ciò che non è Latin-1 stampabile (mantiene accenti, €, £, ecc.)
  return t.replace(/[^\x20-\x7E¡-ÿ€£]/g, '');
}

class Foglio {
  pdf!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; logo?: PDFImage; y = 790;
  static async crea() {
    const f = new Foglio();
    f.pdf = await PDFDocument.create();
    f.page = f.pdf.addPage([595.28, 841.89]);
    f.font = await f.pdf.embedFont(StandardFonts.Helvetica);
    f.bold = await f.pdf.embedFont(StandardFonts.HelveticaBold);
    try { f.logo = await f.pdf.embedPng(Buffer.from(LOGO_SALZILLO_PNG_BASE64, 'base64')); } catch { /* logo opzionale */ }
    return f;
  }
  t(s: string, x = 50, size = 10, grassetto = false, color = INK) {
    this.page.drawText(pulisci(s), { x, y: this.y, size, font: grassetto ? this.bold : this.font, color });
  }
  /** Come t(), ma il testo è un vero link cliccabile nel PDF (annotazione /Link, non solo testo
   *  colorato — un lettore PDF non fa mai diventare cliccabile del testo blu per magia). */
  link(url: string, x = 50, size = 10, color = CORAL) {
    const testo = pulisci(url);
    this.page.drawText(testo, { x, y: this.y, size, font: this.font, color });
    const larghezza = this.font.widthOfTextAtSize(testo, size);
    const annot = this.pdf.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [x, this.y - 2, x + larghezza, this.y + size + 1],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    const ref = this.pdf.context.register(annot);
    const annots = this.page.node.Annots();
    if (annots) annots.push(ref);
    else this.page.node.set(PDFName.of('Annots'), this.pdf.context.obj([ref]));
  }
  nl(n = 15) { this.y -= n; if (this.y < 60) { this.page = this.pdf.addPage([595.28, 841.89]); this.y = 790; } }
  riga(y?: number) { const yy = y ?? this.y; this.page.drawLine({ start: { x: 50, y: yy }, end: { x: 545, y: yy }, thickness: 0.7, color: MUTED }); }
  intestazione(titolo: string) {
    if (this.logo) {
      const w = 74, h = (w * this.logo.height) / this.logo.width;
      this.page.drawImage(this.logo, { x: 50, y: 836 - h, width: w, height: h });
    } else {
      this.page.drawText('SALZILLO HOSPITALITY', { x: 50, y: 818, size: 10, font: this.bold, color: CORAL });
    }
    this.page.drawText(pulisci(titolo), { x: 140, y: 800, size: 20, font: this.bold, color: INK });
    this.y = 776;
    this.riga(this.y); this.nl(18);
  }
  piede() {
    this.nl(30);
    this.riga(this.y + 8);
    this.t(`Documento generato il ${new Date().toLocaleDateString('it-IT')} — Salzillo Hospitality`, 50, 7, false, MUTED);
  }
  async salva() { return this.pdf.save(); }
}

async function datiPrenotazione(prenotazioneId: string) {
  const db = getDb();
  const [r] = await db.select({
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale,
    numeroOspiti: prenotazioni.numero_ospiti, lordo: prenotazioni.lordo, note: prenotazioni.note,
    codiceConferma: prenotazioni.codice_conferma_canale,
    ospiteNome: ospiti.nome, ospiteCognome: ospiti.cognome, ospiteTelefono: ospiti.telefono, ospiteEmail: ospiti.email,
    alloggio: alloggi.nome,
    checkinGuideUrl: alloggi.checkin_guide_url, immobile: immobili.nome, indirizzo: immobili.indirizzo, comune: immobili.comune,
  }).from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .where(eq(prenotazioni.id, prenotazioneId));
  return r ?? null;
}

// ── Conferma di prenotazione (per l'ospite) ────────────────────────────────
export async function pdfConfermaPrenotazione(prenotazioneId: string): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const p = await datiPrenotazione(prenotazioneId);
  if (!p) return null;
  const f = await Foglio.crea();
  f.intestazione('Conferma di prenotazione');
  f.t(`Gentile ${p.ospiteNome} ${p.ospiteCognome},`, 50, 11); f.nl(18);
  f.t('la sua prenotazione è confermata. Ecco i dettagli:', 50, 10, false, MUTED); f.nl(24);
  f.riga(); f.nl(14);
  const righe: [string, string][] = [
    ['Alloggio', `${p.alloggio} — ${p.immobile}`],
    ['Indirizzo', `${p.indirizzo}, ${p.comune}`],
    ['Check-in', `${dataIt(p.checkin)} (dalle 15:00)`],
    ['Check-out', `${dataIt(p.checkout)} (entro le 10:00)`],
    ['Notti', String(notti(p.checkin, p.checkout))],
    ['Ospiti', String(p.numeroOspiti)],
    ['Canale', p.canale],
  ];
  // Solo per Diretto/No Tax: il prezzo lo fissa Raffaele stesso col cliente, quindi va
  // ribadito qui (utile soprattutto quando cambia dopo la conferma, es. una notte in più).
  // Per Airbnb/Booking il prezzo lo vede l'ospite sulla piattaforma — ripeterlo qui rischia
  // solo di confondere se non torna per via delle commissioni.
  if (p.canale === 'Diretto' || p.canale === 'No Tax') righe.push(['Totale concordato', eur(Number(p.lordo))]);
  if (p.codiceConferma) righe.push(['Codice prenotazione', p.codiceConferma]);
  for (const [k, v] of righe) { f.t(k, 50, 9, true); f.t(v, 200, 9); f.nl(15); }
  f.nl(6); f.riga(); f.nl(16);
  // Il WiFi non si ripete qui: è già nella pagina guida linkata sotto — un dato solo, non due
  // copie da tenere allineate (e da aggiornare in due posti se la password cambia).
  if (p.checkinGuideUrl) { f.t('Guida completa (WiFi, ingresso, regole)', 50, 9, true); f.link(p.checkinGuideUrl, 200, 8); f.nl(15); }
  f.nl(10);
  f.t('Per qualsiasi necessità ci trova su WhatsApp. La aspettiamo!', 50, 10, false, MUTED);
  f.piede();
  return { bytes: await f.salva(), nome: `conferma-${p.ospiteCognome}-${p.checkin}.pdf`.toLowerCase().replace(/\s+/g, '-') };
}

// ── Preventivo (per diretto / No Tax) ──────────────────────────────────────
export async function pdfPreventivo(opts: {
  alloggioId: string; checkin: string; checkout: string; numeroOspiti: number;
  prezzo?: number; prezzoNotte?: number; sconto?: number; scontoTipo?: 'euro' | 'percento';
  nomeCliente?: string; telefonoCliente?: string; validoOre?: number; note?: string; codice?: string;
}): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const db = getDb();
  const [a] = await db.select({ nome: alloggi.nome, immobile: immobili.nome, indirizzo: immobili.indirizzo, comune: immobili.comune })
    .from(alloggi).innerJoin(immobili, eq(immobili.id, alloggi.immobile_id)).where(eq(alloggi.id, opts.alloggioId));
  if (!a) return null;
  const n = notti(opts.checkin, opts.checkout);
  // si può dare il totale OPPURE il prezzo a notte: l'altro si calcola
  const prezzoNotte = opts.prezzoNotte ?? (opts.prezzo ? opts.prezzo / n : 0);
  const totalePieno = opts.prezzo ?? Math.round(prezzoNotte * n * 100) / 100;
  // sconto facoltativo: in euro o in percentuale sul totale pieno
  const sconto = opts.sconto && opts.sconto > 0
    ? (opts.scontoTipo === 'percento' ? Math.round(totalePieno * opts.sconto) / 100 : Math.round(opts.sconto * 100) / 100)
    : 0;
  const totale = Math.round((totalePieno - sconto) * 100) / 100;

  const oggi = new Date();
  const dataOggiIt = `${String(oggi.getDate()).padStart(2, '0')}/${String(oggi.getMonth() + 1).padStart(2, '0')}/${oggi.getFullYear()}`;

  const f = await Foglio.crea();
  f.intestazione('Preventivo');
  f.t(`${opts.codice ? opts.codice + '  -  ' : ''}Data preventivo: ${dataOggiIt}`, 50, 9, false, MUTED); f.nl(15);
  if (opts.nomeCliente || opts.telefonoCliente) {
    const chi = [opts.nomeCliente, opts.telefonoCliente].filter(Boolean).join('  -  ');
    f.t(`Per: ${chi}`, 50, 10, true); f.nl(18);
  }
  f.riga(); f.nl(14);
  for (const [k, v] of [
    ['Alloggio', `${a.nome} - ${a.immobile}`], ['Indirizzo', `${a.indirizzo}, ${a.comune}`],
    ['Check-in', dataIt(opts.checkin)], ['Check-out', dataIt(opts.checkout)],
    ['Notti', String(n)], ['Ospiti', String(opts.numeroOspiti)],
    ['Prezzo a notte', eur(prezzoNotte)],
  ] as [string, string][]) { f.t(k, 50, 9, true); f.t(v, 200, 9); f.nl(15); }
  f.nl(8); f.riga(); f.nl(16);
  if (sconto > 0) {
    f.t('Prezzo pieno', 50, 10, true); f.page.drawText(eur(totalePieno), { x: 430, y: f.y, size: 11, font: f.bold, color: MUTED }); f.nl(15);
    const etich = opts.scontoTipo === 'percento' ? `Sconto ${opts.sconto}%` : 'Sconto';
    f.t(etich, 50, 10, true, CORAL); f.page.drawText(`- ${eur(sconto)}`, { x: 430, y: f.y, size: 11, font: f.bold, color: CORAL }); f.nl(16);
  }
  f.t('Totale soggiorno', 50, 11, true); f.page.drawText(eur(totale), { x: 430, y: f.y, size: 13, font: f.bold, color: CORAL }); f.nl(16);
  f.t(`${n} notti x ${eur(prezzoNotte)}${sconto > 0 ? `  -  sconto ${eur(sconto)}` : ''}`, 50, 8, false, MUTED); f.nl(20);
  if (opts.note) { f.nl(4); for (const l of spezza(opts.note, 95)) { f.t(l, 50, 9, false, MUTED); f.nl(12); } }
  f.nl(10); f.riga(); f.nl(14);
  f.t('Condizioni di cancellazione', 50, 9, true); f.nl(13);
  for (const l of [
    'Cancellazione gratuita fino a 48 ore prima del check-in: rimborso completo.',
    "Entro le 48 ore prima del check-in, o in caso di mancato arrivo, l'importo non e' rimborsabile.",
  ]) { f.t(l, 50, 9, false, MUTED); f.nl(12); }
  f.nl(10);
  const ore = opts.validoOre && opts.validoOre > 0 ? Math.round(opts.validoOre) : 24;
  f.t('Validita e prenotazione', 50, 9, true); f.nl(13);
  for (const l of [
    `Questo preventivo e' valido ${ore} ore dall'invio.`,
    `Entro questo termine teniamo l'alloggio bloccato e riservato a lei per le date indicate.`,
    `Trascorse le ${ore} ore senza conferma, le date tornano disponibili per altri ospiti.`,
    `Per confermare risponda a questo messaggio.`,
  ]) { f.t(l, 50, 9, false, MUTED); f.nl(12); }
  f.piede();
  const slug = (s: string) => s.toLowerCase().replace(/[àáâä]/g, 'a').replace(/[èéêë]/g, 'e').replace(/[ìíîï]/g, 'i').replace(/[òóôö]/g, 'o').replace(/[ùúûü]/g, 'u').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const dataFile = `${String(oggi.getDate()).padStart(2, '0')}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${oggi.getFullYear()}`;
  const chi = opts.nomeCliente ? `-${slug(opts.nomeCliente)}` : '';
  return { bytes: await f.salva(), nome: `preventivo-${slug(a.nome)}${chi}-${dataFile}.pdf` };
}

/** PDF di un preventivo salvato (dalla sezione Documenti). */
export async function pdfPreventivoDaId(id: string): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const p = await preventivoPerPdf(id);
  if (!p) return null;
  const nome = `${p.ospiteNome ?? ''} ${p.ospiteCognome ?? ''}`.trim();
  return pdfPreventivo({
    alloggioId: p.alloggioId, checkin: p.checkin, checkout: p.checkout, numeroOspiti: p.numeroOspiti,
    prezzoNotte: p.prezzoNotte ? Number(p.prezzoNotte) : undefined,
    sconto: p.sconto ? Number(p.sconto) : undefined,
    scontoTipo: p.scontoTipo === 'percento' ? 'percento' : 'euro',
    validoOre: p.validoOre, note: p.note ?? undefined,
    nomeCliente: nome || undefined, telefonoCliente: p.ospiteTelefono ?? undefined, codice: p.codice,
  });
}

// ── Contratto di gestione (tra Salzillo Hospitality e il proprietario) ─────
export async function pdfContrattoGestione(contrattoId: string): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const db = getDb();
  const [c] = await db.select().from(contrattiGestione).where(eq(contrattiGestione.id, contrattoId));
  if (!c) return null;
  const [pr] = await db.select().from(proprietari).where(eq(proprietari.id, c.proprietario_id));
  const imm = await db.select().from(immobili).where(eq(immobili.proprietario_id, c.proprietario_id));
  const f = await Foglio.crea();
  f.intestazione('Contratto di gestione');
  f.t('BOZZA — da far controllare a un commercialista/legale prima dell\'uso reale.', 50, 8, true, CORAL); f.nl(20);
  f.t(`Tra ${pr?.nome ?? '(proprietario)'} (di seguito "il Proprietario")`, 50, 10); f.nl(15);
  f.t('e Raffaele Salzillo, per Salzillo Hospitality (di seguito "il Gestore").', 50, 10); f.nl(22);
  f.riga(); f.nl(16);
  const clausole = [
    ['Oggetto', `Il Proprietario affida al Gestore la gestione degli affitti brevi dei seguenti immobili: ${imm.map((i) => i.nome).join(', ') || '(da specificare)'}.`],
    ['Decorrenza', `Dal ${dataIt(c.dal)}${c.al ? ` al ${dataIt(c.al)}` : ' a tempo indeterminato'}.`],
    ['Compenso del Gestore', `${Number(c.percentuale_fee)}% sul lordo incassato per ogni prenotazione.`],
    ['Incasso', c.direzione_incasso === 'Proprietario'
      ? 'Gli importi dei portali vengono accreditati direttamente al Proprietario, che corrisponde al Gestore il compenso pattuito.'
      : 'Gli importi dei portali vengono accreditati al Gestore, che trasferisce al Proprietario il netto dopo commissioni, imposte, costi di pulizia e compenso di gestione.'],
    ['Rendicontazione', 'Il Gestore fornisce al Proprietario un rendiconto mensile con il dettaglio di prenotazioni, incassi, costi e netto spettante.'],
    ['Adempimenti', 'Il Gestore cura le comunicazioni alla Questura (Alloggiati Web), i flussi al portale regionale e il calcolo dell\'imposta di soggiorno dove dovuta.'],
  ];
  for (const [k, v] of clausole as [string, string][]) {
    f.t(k, 50, 9, true); f.nl(13);
    for (const linea of spezza(v, 95)) { f.t(linea, 50, 9, false, MUTED); f.nl(12); }
    f.nl(6);
  }
  if (c.condizioni) { f.t('Condizioni particolari', 50, 9, true); f.nl(13); for (const l of spezza(c.condizioni, 95)) { f.t(l, 50, 9, false, MUTED); f.nl(12); } }
  f.nl(30);
  f.t('Il Proprietario ______________________', 50, 9);
  f.t('Il Gestore ______________________', 320, 9);
  f.piede();
  return { bytes: await f.salva(), nome: `contratto-gestione-${(pr?.nome ?? 'proprietario').replace(/\s+/g, '-').toLowerCase()}.pdf` };
}

function spezza(testo: string, maxCar: number): string[] {
  const parole = testo.split(' ');
  const righe: string[] = []; let cur = '';
  for (const p of parole) {
    if ((cur + ' ' + p).trim().length > maxCar) { righe.push(cur.trim()); cur = p; }
    else cur = (cur + ' ' + p).trim();
  }
  if (cur) righe.push(cur);
  return righe;
}
