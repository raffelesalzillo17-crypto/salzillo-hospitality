/**
 * Analisi di mercato settimanale (PDF via email, ogni sabato 8:00) — aggiunta il 29/09/2026 su
 * richiesta di Raffaele. Combina dati REALI del proprio sistema (occupazione, prezzo medio,
 * andamento) con una ricerca di mercato fatta da Gemini con accesso a Google (stesso meccanismo
 * già usato per gli eventi locali in telegramDigest.ts) — non uno scraping vero di Booking.com,
 * troppo fragile da far girare in automatico ogni settimana (rischio concreto di essere
 * bloccati). Discusso e approvato da Raffaele il 29/09/2026.
 */
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sql } from 'drizzle-orm';
import { getDb } from './index';
import { LOGO_SALZILLO_PNG_BASE64 } from './logoSalzillo';

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Stesso helper di retry già in uso in telegramDigest.ts e nei digest — il tier gratuito di
// Gemini va spesso in overload (503) negli orari di punta.
async function conRetry<T>(fn: () => Promise<T>, tentativi = 3, attesaMs = 3000): Promise<T> {
  for (let i = 0; i < tentativi; i++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const riprovabile = /503|UNAVAILABLE|overloaded|high demand/i.test(msg);
      if (!riprovabile || i === tentativi - 1) throw err;
      await new Promise((r) => setTimeout(r, attesaMs * 2 ** i));
    }
  }
  throw new Error('conRetry: mai raggiunto');
}

// db.execute() di drizzle-orm/neon-http a volte torna un array direttamente, a volte
// {rows: [...]} — stesso caso già gestito in report-notturno/route.ts.
function righeDi<T>(res: unknown): T[] {
  return Array.isArray(res) ? (res as T[]) : ((res as { rows?: T[] }).rows ?? []);
}

function readDecisioni(): string {
  const dir = path.join(process.cwd(), 'data', 'wiki', 'decisioni');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'decisioni.md')
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n\n---\n\n');
}

type RigaOccupazione = {
  alloggio: string; immobile: string;
  prenotazioniProssimi45: number; nottiPrenotateProssimi45: number;
  prenotazioniUltimi30: number; lordoUltimi30: number;
  otaUltimi90: number; lordoOtaUltimi90: number;
};

/** Notti coperte da prenotazioni Attive che si sovrappongono a [da, a) — conta le notti uniche,
 *  non le prenotazioni, per gestire correttamente eventuali sovrapposizioni. */
function nottiNellaFinestra(prenotazioni: { checkin: string; checkout: string }[], da: Date, a: Date): number {
  const notti = new Set<string>();
  for (const p of prenotazioni) {
    let cur = new Date(Math.max(new Date(p.checkin).getTime(), da.getTime()));
    const fine = new Date(Math.min(new Date(p.checkout).getTime(), a.getTime()));
    while (cur < fine) { notti.add(cur.toISOString().slice(0, 10)); cur = new Date(cur.getTime() + 86400000); }
  }
  return notti.size;
}

async function datiOccupazioneReale(): Promise<{ righe: RigaOccupazione[]; nettoUltimi6Mesi: { mese: string; netto: number }[] }> {
  const db = getDb();
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0);
  const fra45 = new Date(oggi.getTime() + 45 * 86400000);
  const fa30 = new Date(oggi.getTime() - 30 * 86400000);
  const fa90 = new Date(oggi.getTime() - 90 * 86400000);

  const alloggiAttivi = await db.execute(sql`
    SELECT a.id, a.nome AS alloggio, im.nome AS immobile
    FROM alloggi a JOIN immobili im ON im.id = a.immobile_id
    WHERE a.attivo = true ORDER BY a.nome
  `);

  const righe: RigaOccupazione[] = [];
  for (const al of righeDi<{ id: string; alloggio: string; immobile: string }>(alloggiAttivi)) {
    const pren = await db.execute(sql`
      SELECT checkin::text, checkout::text, canale, lordo::numeric AS lordo
      FROM prenotazioni
      WHERE alloggio_id = ${al.id} AND stato = 'Attiva'
        AND checkin < ${fra45.toISOString().slice(0, 10)} AND checkout > ${fa90.toISOString().slice(0, 10)}
    `);
    const rows = righeDi<{ checkin: string; checkout: string; canale: string; lordo: string }>(pren);
    const prossimi45 = rows.filter((r) => new Date(r.checkout) > oggi && new Date(r.checkin) < fra45);
    const ultimi30 = rows.filter((r) => new Date(r.checkin) >= fa30 && new Date(r.checkin) <= oggi);
    const ota90 = rows.filter((r) => (r.canale === 'Airbnb' || r.canale === 'Booking') && new Date(r.checkin) >= fa90);
    righe.push({
      alloggio: al.alloggio, immobile: al.immobile,
      prenotazioniProssimi45: prossimi45.length,
      nottiPrenotateProssimi45: nottiNellaFinestra(prossimi45, oggi, fra45),
      prenotazioniUltimi30: ultimi30.length,
      lordoUltimi30: ultimi30.reduce((s, r) => s + Number(r.lordo), 0),
      otaUltimi90: ota90.length,
      lordoOtaUltimi90: ota90.reduce((s, r) => s + Number(r.lordo), 0),
    });
  }

  const seiMesiFa = new Date(oggi.getFullYear(), oggi.getMonth() - 5, 1).toISOString().slice(0, 10);
  const mensile = await db.execute(sql`
    SELECT to_char(checkin, 'YYYY-MM') AS mese, SUM(netto_proprietario)::numeric AS netto
    FROM prenotazioni WHERE stato = 'Attiva' AND checkin >= ${seiMesiFa}
    GROUP BY 1 ORDER BY 1
  `);
  const nettoUltimi6Mesi = righeDi<{ mese: string; netto: string }>(mensile).map((r) => ({ mese: r.mese, netto: Number(r.netto) }));

  return { righe, nettoUltimi6Mesi };
}

type EsitoAnalisi = { sintesi: string; quadroMercato: string[]; osservazioniAndamento: string[]; suggerimenti: string[] };

async function chiediAnalisiAGemini(dati: Awaited<ReturnType<typeof datiOccupazioneReale>>): Promise<EsitoAnalisi> {
  const oggiStr = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const datiText = dati.righe.map((r) =>
    `- ${r.alloggio} (${r.immobile}): ${r.nottiPrenotateProssimi45}/45 notti già prenotate nei prossimi 45 giorni (${r.prenotazioniProssimi45} prenotazioni); ultimi 30 giorni ${r.prenotazioniUltimi30} prenotazioni per ${r.lordoUltimi30.toFixed(2)}€ lordo; canale OTA (Airbnb/Booking) ultimi 90 giorni: ${r.otaUltimi90} prenotazioni, ${r.lordoOtaUltimi90.toFixed(2)}€.`,
  ).join('\n');
  const trendText = dati.nettoUltimi6Mesi.map((m) => `${m.mese}: ${m.netto.toFixed(2)}€ netto`).join(', ');

  const response = await conRetry(() => genai.models.generateContent({
    model: 'gemini-3.6-flash',
    contents: `Oggi è ${oggiStr}. Ecco i dati REALI del sistema di gestione di Salzillo Hospitality (Marcianise, CE), da usare come base certa dell'analisi:

Occupazione e andamento per struttura:
${datiText || '(nessun dato)'}

Andamento del netto mensile complessivo (ultimi mesi): ${trendText || '(nessun dato)'}

Regole/decisioni operative già stabilite da Raffaele (rispettale, non contraddirle):
${readDecisioni()}

Cerca ora su Google la situazione attuale del mercato degli affitti brevi/B&B a Marcianise e nella zona di Caserta (prezzi praticati, disponibilità residua dei concorrenti, eventuali segnali di domanda) per le prossime settimane. Poi scrivi un'analisi.`,
    config: {
      maxOutputTokens: 1500,
      tools: [{ googleSearch: {} }],
      systemInstruction: `Sei l'analista di mercato di Salzillo Hospitality. Scrivi un'analisi settimanale seria e concreta, basata SOLO sui dati reali forniti e su quello che trovi davvero cercando su Google — non inventare numeri o disponibilità che non hai verificato. Se la ricerca web non trova nulla di verificabile su un punto, dillo esplicitamente invece di inventare.

Rispondi ESCLUSIVAMENTE con un blocco \`\`\`json contenente un oggetto con questi campi:
- "sintesi": una frase (max 200 caratteri) che riassume la situazione della settimana
- "quadroMercato": array di stringhe, 3-6 osservazioni sul mercato esterno (prezzi/concorrenti/domanda in zona), ognuna con la fonte se possibile
- "osservazioniAndamento": array di stringhe, 3-6 osservazioni sui DATI REALI forniti (occupazione, canali, trend)
- "suggerimenti": array di stringhe, 2-5 azioni concrete e specifiche che Raffaele potrebbe valutare (es. su quale struttura e in che periodo alzare/abbassare un prezzo, dove manca visibilità online, dove l'occupazione è bassa) — sempre coerenti con le regole/decisioni sopra (es. non basarti su sagre/eventi locali per il pricing, solo su festività italiane)

Nessun testo fuori dal blocco json.`,
    },
  }));

  const testo = response.text ?? '';
  const m = testo.match(/```(?:json)?\s*([\s\S]*?)```/) || testo.match(/(\{[\s\S]*\})/);
  if (!m) return { sintesi: 'Analisi non disponibile questa settimana.', quadroMercato: [], osservazioniAndamento: [], suggerimenti: [] };
  try {
    const parsed = JSON.parse(m[1]);
    return {
      sintesi: parsed.sintesi || '',
      quadroMercato: Array.isArray(parsed.quadroMercato) ? parsed.quadroMercato : [],
      osservazioniAndamento: Array.isArray(parsed.osservazioniAndamento) ? parsed.osservazioniAndamento : [],
      suggerimenti: Array.isArray(parsed.suggerimenti) ? parsed.suggerimenti : [],
    };
  } catch {
    return { sintesi: 'Analisi non disponibile questa settimana (risposta non valida).', quadroMercato: [], osservazioniAndamento: [], suggerimenti: [] };
  }
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

export async function generaAnalisiMercatoPdf(): Promise<{ bytes: Uint8Array; nome: string }> {
  const dati = await datiOccupazioneReale();
  const analisi = await chiediAnalisiAGemini(dati);

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
  const M = 50, R = 545;
  let y = 790;
  const text = (s: string, x: number, size = 10, f = font, color = ink) => page.drawText(s, { x, y, size, font: f, color });
  const nl = (n = 15) => { y -= n; if (y < 60) { page = pdf.addPage([595.28, 841.89]); y = 790; } };
  const rule = (yy = y) => page.drawLine({ start: { x: M, y: yy }, end: { x: R, y: yy }, thickness: 0.7, color: muted });
  const sezione = (titolo: string) => { nl(6); text(titolo.toUpperCase(), M, 9, bold, muted); nl(14); };
  const elenco = (voci: string[]) => {
    if (voci.length === 0) { text('(nessuna osservazione)', M + 4, 9, font, muted); nl(13); return; }
    for (const v of voci) for (const riga of spezza(`- ${v}`, 100)) { text(riga, M + 4, 9, font, ink); nl(12.5); }
  };

  const oggi = new Date();
  if (logo) { const w = 74, h = (w * logo.height) / logo.width; page.drawImage(logo, { x: M, y: 836 - h, width: w, height: h }); }
  page.drawText('Analisi di mercato settimanale', { x: 140, y: 806, size: 17, font: bold, color: ink });
  page.drawText(`Marcianise e zona · ${oggi.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: 140, y: 790, size: 10, font, color: muted });
  y = 762; rule(); nl(20);

  page.drawRectangle({ x: M, y: y - 34, width: R - M, height: 38, color: wash });
  for (const riga of spezza(analisi.sintesi || '(sintesi non disponibile)', 95)) { page.drawText(riga, { x: M + 10, y: y - 14, size: 10, font: bold, color: coral }); nl(13); }
  nl(20);

  sezione('Il tuo andamento (dati reali)');
  elenco(analisi.osservazioniAndamento);

  sezione('Quadro di mercato in zona');
  elenco(analisi.quadroMercato);

  sezione('Suggerimenti');
  elenco(analisi.suggerimenti);

  sezione('Dettaglio occupazione per struttura');
  for (const r of dati.righe) {
    text(`${r.alloggio} (${r.immobile})`, M, 9, bold); nl(12);
    text(`Prossimi 45 giorni: ${r.nottiPrenotateProssimi45}/45 notti prenotate (${r.prenotazioniProssimi45} prenotazioni)`, M + 6, 8.5, font, muted); nl(11);
    text(`Ultimi 30 giorni: ${r.prenotazioniUltimi30} prenotazioni, ${r.lordoUltimi30.toFixed(2)}€ lordo`, M + 6, 8.5, font, muted); nl(11);
    text(`Canale OTA (Airbnb/Booking) ultimi 90 giorni: ${r.otaUltimi90} prenotazioni, ${r.lordoOtaUltimi90.toFixed(2)}€`, M + 6, 8.5, font, muted); nl(15);
  }

  nl(10); rule(); nl(14);
  const righeMetodo = spezza('Metodo: dati di occupazione/prezzo dal database di produzione; quadro di mercato e suggerimenti generati da un modello IA con ricerca web (non uno screenshot letterale di Booking.com) - da leggere come materiale di supporto, non come verita assoluta.', 100);
  for (const riga of righeMetodo) { text(riga, M, 7, font, muted); nl(10); }

  const bytes = await pdf.save();
  const nome = `analisi-mercato-${oggi.toISOString().slice(0, 10)}.pdf`;
  return { bytes, nome };
}
