/**
 * Generazione PDF per il nuovo sistema: conferma prenotazione, preventivo, contratto di
 * gestione. Stessa libreria (pdf-lib) e stile di /api/ricevuta e /api/contratto.
 * Il rendiconto proprietario ha il suo file a parte (/api/nuovo/rendiconto/pdf).
 */

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { prenotazioni, ospiti, alloggi, immobili, proprietari, contrattiGestione } from './schema';

const CORAL = rgb(1, 0.353, 0.373);
const INK = rgb(0.11, 0.11, 0.12);
const MUTED = rgb(0.43, 0.43, 0.45);
const eur = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const notti = (ci: string, co: string) => Math.max(1, Math.round((Date.parse(co) - Date.parse(ci)) / 864e5));

class Foglio {
  pdf!: PDFDocument; page!: PDFPage; font!: PDFFont; bold!: PDFFont; y = 790;
  static async crea() {
    const f = new Foglio();
    f.pdf = await PDFDocument.create();
    f.page = f.pdf.addPage([595.28, 841.89]);
    f.font = await f.pdf.embedFont(StandardFonts.Helvetica);
    f.bold = await f.pdf.embedFont(StandardFonts.HelveticaBold);
    return f;
  }
  t(s: string, x = 50, size = 10, grassetto = false, color = INK) {
    this.page.drawText(s, { x, y: this.y, size, font: grassetto ? this.bold : this.font, color });
  }
  nl(n = 15) { this.y -= n; if (this.y < 60) { this.page = this.pdf.addPage([595.28, 841.89]); this.y = 790; } }
  riga(y?: number) { const yy = y ?? this.y; this.page.drawLine({ start: { x: 50, y: yy }, end: { x: 545, y: yy }, thickness: 0.7, color: MUTED }); }
  intestazione(titolo: string) {
    this.t('SALZILLO HOSPITALITY', 50, 9, true, CORAL); this.nl(14);
    this.t(titolo, 50, 20, true); this.nl(26);
  }
  piede() {
    this.nl(30);
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
    alloggio: alloggi.nome, wifiSsid: alloggi.wifi_ssid, wifiPassword: alloggi.wifi_password,
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
  if (p.codiceConferma) righe.push(['Codice prenotazione', p.codiceConferma]);
  for (const [k, v] of righe) { f.t(k, 50, 9, true); f.t(v, 200, 9); f.nl(15); }
  f.nl(6); f.riga(); f.nl(16);
  if (p.wifiSsid) { f.t('WiFi', 50, 9, true); f.t(`rete "${p.wifiSsid}"${p.wifiPassword ? ` · password "${p.wifiPassword}"` : ''}`, 200, 9); f.nl(15); }
  if (p.checkinGuideUrl) { f.t('Guida completa', 50, 9, true); f.t(p.checkinGuideUrl, 200, 8, false, CORAL); f.nl(15); }
  f.nl(10);
  f.t('Per qualsiasi necessità ci trova su WhatsApp. La aspettiamo!', 50, 10, false, MUTED);
  f.piede();
  return { bytes: await f.salva(), nome: `conferma-${p.ospiteCognome}-${p.checkin}.pdf`.toLowerCase().replace(/\s+/g, '-') };
}

// ── Preventivo (per diretto / No Tax) ──────────────────────────────────────
export async function pdfPreventivo(opts: { alloggioId: string; checkin: string; checkout: string; numeroOspiti: number; prezzo: number; nomeCliente?: string; note?: string }): Promise<{ bytes: Uint8Array; nome: string } | null> {
  const db = getDb();
  const [a] = await db.select({ nome: alloggi.nome, immobile: immobili.nome, indirizzo: immobili.indirizzo, comune: immobili.comune })
    .from(alloggi).innerJoin(immobili, eq(immobili.id, alloggi.immobile_id)).where(eq(alloggi.id, opts.alloggioId));
  if (!a) return null;
  const n = notti(opts.checkin, opts.checkout);
  const f = await Foglio.crea();
  f.intestazione('Preventivo');
  if (opts.nomeCliente) { f.t(`Per: ${opts.nomeCliente}`, 50, 10, false, MUTED); f.nl(18); }
  f.riga(); f.nl(14);
  for (const [k, v] of [
    ['Alloggio', `${a.nome} — ${a.immobile}`], ['Indirizzo', `${a.indirizzo}, ${a.comune}`],
    ['Periodo', `${dataIt(opts.checkin)} → ${dataIt(opts.checkout)} (${n} notti)`], ['Ospiti', String(opts.numeroOspiti)],
  ] as [string, string][]) { f.t(k, 50, 9, true); f.t(v, 200, 9); f.nl(15); }
  f.nl(8); f.riga(); f.nl(16);
  f.t('Totale soggiorno', 50, 11, true); f.page.drawText(eur(opts.prezzo), { x: 440, y: f.y, size: 13, font: f.bold, color: CORAL }); f.nl(16);
  f.t(`(${eur(opts.prezzo / n)} a notte)`, 50, 8, false, MUTED); f.nl(20);
  if (opts.note) { f.t(opts.note, 50, 9, false, MUTED); f.nl(15); }
  f.t('Preventivo valido 7 giorni. Per confermare risponda a questo messaggio.', 50, 9, false, MUTED);
  f.piede();
  return { bytes: await f.salva(), nome: `preventivo-${a.nome}-${opts.checkin}.pdf`.toLowerCase().replace(/\s+/g, '-') };
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
