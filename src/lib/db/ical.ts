/**
 * iCal per gli alloggi.
 *
 * EXPORT — feed .ics con le prenotazioni attive di un alloggio, da incollare in Airbnb/
 * Booking per bloccare quelle date anche lì (evita il doppio booking quando si registra
 * una prenotazione diretta o No Tax).
 *
 * IMPORT/CHECK — scarica i calendari iCal di Airbnb/Booking e li confronta con le nostre
 * prenotazioni: segnala se una piattaforma ha una prenotazione che noi non abbiamo (o
 * viceversa). Dal 10/11/2026 una prenotazione che c'è sull'OTA ma non da noi viene importata
 * in automatico come segnaposto "In attesa di conferma" (solo date), da completare a mano.
 */

import { and, eq, ne, gte } from 'drizzle-orm';
import { getDb } from './index';
import { prenotazioni, alloggi, ospiti, calendariIcal, blocchiCalendario } from './schema';
import { creaPrenotazione } from './mutations';

// ── EXPORT ───────────────────────────────────────────────────────────────────

function dt(iso: string): string { return iso.replace(/-/g, ''); } // YYYYMMDD (evento tutto-il-giorno)

export async function generaIcalAlloggio(alloggioId: string): Promise<string | null> {
  const db = getDb();
  const [a] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, alloggioId));
  if (!a) return null;

  const oggi = new Date(); oggi.setMonth(oggi.getMonth() - 2);
  const da = oggi.toISOString().slice(0, 10);
  const righe = await db.select({
    id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout,
    stato: prenotazioni.stato, canale: prenotazioni.canale,
  }).from(prenotazioni).where(and(
    eq(prenotazioni.alloggio_id, alloggioId),
    gte(prenotazioni.checkout, da),
  ));
  const attive = righe.filter((r) => r.stato === 'Attiva' || r.stato === 'In attesa di conferma');

  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const eventi = attive.map((r) =>
    ['BEGIN:VEVENT',
      `UID:sh-${r.id}@salzillo-hospitality`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dt(r.checkin)}`,
      `DTEND;VALUE=DATE:${dt(r.checkout)}`,
      'SUMMARY:Prenotato (Salzillo Hospitality)',
      `DESCRIPTION:Canale ${r.canale}${r.stato === 'In attesa di conferma' ? ' — in attesa di conferma' : ''}`,
      'END:VEVENT'].join('\r\n'));

  // Blocchi manuali (uso personale/manutenzione): stesso trattamento, date bloccate anche su
  // Airbnb/Booking, ma senza passare da una prenotazione vera (niente ospite/importi).
  const blocchi = await db.select({
    id: blocchiCalendario.id, checkin: blocchiCalendario.checkin, checkout: blocchiCalendario.checkout, nota: blocchiCalendario.nota,
  }).from(blocchiCalendario).where(and(eq(blocchiCalendario.alloggio_id, alloggioId), gte(blocchiCalendario.checkout, da)));
  const eventiBlocchi = blocchi.map((b) =>
    ['BEGIN:VEVENT',
      `UID:sh-blocco-${b.id}@salzillo-hospitality`,
      `DTSTAMP:${now}`,
      `DTSTART;VALUE=DATE:${dt(b.checkin)}`,
      `DTEND;VALUE=DATE:${dt(b.checkout)}`,
      'SUMMARY:Bloccato (Salzillo Hospitality)',
      `DESCRIPTION:Blocco manuale${b.nota ? ` — ${b.nota}` : ''}`,
      'END:VEVENT'].join('\r\n'));

  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Salzillo Hospitality//IT',
    `X-WR-CALNAME:${a.nome} — Salzillo Hospitality`, ...eventi, ...eventiBlocchi, 'END:VCALENDAR'].join('\r\n') + '\r\n';
}

// ── IMPORT / CHECK ───────────────────────────────────────────────────────────

type Blocco = { start: string; end: string; summary: string };

/** Parser iCal minimale: estrae i VEVENT con date (Airbnb/Booking usano VALUE=DATE). */
function parseIcal(testo: string): Blocco[] {
  const unfold = testo.replace(/\r\n[ \t]/g, '').split(/\r?\n/);
  const blocchi: Blocco[] = [];
  let cur: Partial<Blocco> | null = null;
  for (const riga of unfold) {
    if (riga === 'BEGIN:VEVENT') cur = {};
    else if (riga === 'END:VEVENT') { if (cur?.start && cur.end) blocchi.push({ start: cur.start, end: cur.end, summary: cur.summary || '' }); cur = null; }
    else if (cur) {
      const m = riga.match(/^(DTSTART|DTEND|SUMMARY)[^:]*:(.+)$/);
      if (!m) continue;
      const val = m[2].trim();
      if (m[1] === 'DTSTART') cur.start = normalizzaData(val);
      else if (m[1] === 'DTEND') cur.end = normalizzaData(val);
      else if (m[1] === 'SUMMARY') cur.summary = val;
    }
  }
  return blocchi;
}
function normalizzaData(v: string): string {
  const d = v.slice(0, 8); // YYYYMMDD
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
}

const sovrappone = (aS: string, aE: string, bS: string, bE: string) => aS < bE && bS < aE;
const nottiTra = (s: string, e: string) => Math.round((Date.parse(e) - Date.parse(s)) / 864e5);
// Airbnb/Booking esportano anche le chiusure di disponibilità come eventi lunghissimi
// ("CLOSED - Not available", "Not available"): non sono prenotazioni, vanno ignorate nel confronto.
const MAX_NOTTI_SOGGIORNO = 21;
function eBlocco(b: Blocco): boolean {
  if (nottiTra(b.start, b.end) > MAX_NOTTI_SOGGIORNO) return true;
  return /not available|unavailable|non disponibile|blocked/i.test(b.summary) && nottiTra(b.start, b.end) > 10;
}

/** Segna come "da importare" solo le prenotazioni vere: niente eco dei nostri stessi blocchi
 *  (riesportati da Airbnb/Booking) e, su Airbnb, niente blocchi manuali "Not available". */
function importabile(b: Blocco, canale: string): boolean {
  if (/salzillo hospitality/i.test(b.summary)) return false;
  if (canale === 'Airbnb' && /not available|unavailable|non disponibile|blocked/i.test(b.summary)) return false;
  return true;
}

export type EsitoControllo = {
  alloggio: string; calendario: string;
  importate: { start: string; end: string; canale: string }[]; // create ora come segnaposto (prima mancavano da noi)
  mancano: { start: string; end: string; summary: string }[];   // sull'OTA ma non da noi
  inPiu: { start: string; end: string; ospite: string; canale: string }[]; // da noi ma non sull'OTA (stesso canale)
  errore?: string;
};

const NOTA_IMPORT_ICAL = 'Importata da iCal';

/** Un segnaposto già cancellato a mano con le stesse date non va ricreato a ogni controllo. */
async function eraGiaScartata(alloggioId: string, canaleOta: string, start: string, end: string): Promise<boolean> {
  const db = getDb();
  const righe = await db.select({ note: prenotazioni.note }).from(prenotazioni).where(and(
    eq(prenotazioni.alloggio_id, alloggioId), eq(prenotazioni.canale, canaleOta as 'Booking'),
    eq(prenotazioni.checkin, start), eq(prenotazioni.checkout, end), eq(prenotazioni.stato, 'Cancellata'),
  ));
  return righe.some((r) => (r.note ?? '').startsWith(NOTA_IMPORT_ICAL));
}

export async function controllaCalendariAlloggio(alloggioId: string): Promise<EsitoControllo[]> {
  const db = getDb();
  const [a] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, alloggioId));
  if (!a) return [];
  const cals = await db.select().from(calendariIcal).where(and(eq(calendariIcal.alloggio_id, alloggioId), eq(calendariIcal.attivo, true)));
  if (cals.length === 0) return [];

  const oggi = new Date().toISOString().slice(0, 10);
  const orizzonte = new Date(Date.now() + 300 * 864e5).toISOString().slice(0, 10); // ~10 mesi avanti
  const nostre = (await db.select({
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale,
    ospiteNome: ospiti.nome, ospiteCognome: ospiti.cognome,
  }).from(prenotazioni).innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(and(eq(prenotazioni.alloggio_id, alloggioId), ne(prenotazioni.stato, 'Cancellata'), gte(prenotazioni.checkout, oggi))))
    .filter((p) => p.checkin);

  const esiti: EsitoControllo[] = [];
  for (const c of cals) {
    const esito: EsitoControllo = { alloggio: a.nome, calendario: c.nome, importate: [], mancano: [], inPiu: [] };
    try {
      const res = await fetch(c.url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blocchi = parseIcal(await res.text()).filter((b) => b.end >= oggi);
      // prenotazioni vere: eventi brevi, non chiusure di disponibilità, entro l'orizzonte utile
      const prenOta = blocchi.filter((b) => !eBlocco(b) && b.start <= orizzonte);

      for (const b of prenOta) {
        if (nostre.some((p) => sovrappone(p.checkin, p.checkout, b.start, b.end))) continue;
        // Import automatico come segnaposto "In attesa di conferma" (solo date: l'iCal non ha
        // ospite né importi). Le date restano bloccate sugli altri canali; i dati veri si
        // completano a mano. Se l'import non riesce (blocco manuale, errore) resta in "mancano".
        const canaleOta = c.nome === 'Booking' || c.nome === 'Airbnb' ? c.nome : null;
        if (canaleOta && importabile(b, canaleOta) && !(await eraGiaScartata(alloggioId, canaleOta, b.start, b.end))) {
          try {
            await creaPrenotazione({
              alloggioId, ospiteNome: 'Ospite', ospiteCognome: `${canaleOta} (da completare)`,
              checkin: b.start, checkout: b.end, canale: canaleOta, lordo: 0, stato: 'In attesa di conferma',
              note: `${NOTA_IMPORT_ICAL} — solo date dal calendario ${canaleOta} (${b.summary || 'senza titolo'}). Completare ospite e importo.`,
            });
            esito.importate.push({ start: b.start, end: b.end, canale: canaleOta });
            continue;
          } catch { /* ripiego: segnala soltanto */ }
        }
        esito.mancano.push({ start: b.start, end: b.end, summary: b.summary });
      }
      for (const p of nostre.filter((p) => p.canale.toLowerCase() === c.nome.toLowerCase())) {
        if (!blocchi.some((b) => sovrappone(p.checkin, p.checkout, b.start, b.end))) {
          esito.inPiu.push({ start: p.checkin, end: p.checkout, ospite: `${p.ospiteNome} ${p.ospiteCognome}`.trim(), canale: p.canale });
        }
      }
    } catch (e) {
      esito.errore = e instanceof Error ? e.message : String(e);
    }
    const testo = esito.errore ? `errore: ${esito.errore}` : (esito.mancano.length || esito.inPiu.length || esito.importate.length)
      ? `${esito.importate.length} importate, ${esito.mancano.length} da noi mancanti, ${esito.inPiu.length} in più` : 'ok';
    await db.update(calendariIcal).set({ ultimo_controllo: new Date(), ultimo_esito: testo }).where(eq(calendariIcal.id, c.id));
    esiti.push(esito);
  }
  return esiti;
}

export async function controllaTuttiICalendari(): Promise<EsitoControllo[]> {
  const db = getDb();
  const alloggiConCal = await db.selectDistinct({ id: calendariIcal.alloggio_id }).from(calendariIcal).where(eq(calendariIcal.attivo, true));
  const out: EsitoControllo[] = [];
  for (const a of alloggiConCal) out.push(...(await controllaCalendariAlloggio(a.id)));
  return out;
}
