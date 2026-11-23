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

import { and, desc, eq, ne, gte, isNull } from 'drizzle-orm';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { getDb } from './index';
import { prenotazioni, alloggi, ospiti, calendariIcal, blocchiCalendario, syncIcalLog, conflittiCalendario } from './schema';
import { creaPrenotazione } from './mutations';
import { analizzaFeed, parseIcal, importabile, PREFISSO_SPARITA, type PrenNostra } from '../icalAnalisi';

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

// ── LINK DI EXPORT PROTETTO ──────────────────────────────────────────────────

/** Il link di export è valido se l'alloggio esiste e, quando ha un token, il token coincide. Senza token (link vecchio, solo id) resta aperto,
 *  così i collegamenti già incollati su Airbnb e Booking non si rompono da soli: passa al link protetto solo chi lo genera. */
export async function accessoIcalConsentito(alloggioId: string, token: string | null): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(alloggioId)) return false;
  const [a] = await getDb().select({ token: alloggi.ical_token }).from(alloggi).where(eq(alloggi.id, alloggioId));
  if (!a) return false;
  if (!a.token) return true;
  const x = Buffer.from(token ?? ''), y = Buffer.from(a.token);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Genera (o sostituisce) il token del link di export: il link precedente smette di funzionare. */
export async function rigeneraTokenIcal(alloggioId: string): Promise<string> {
  const token = randomBytes(24).toString('base64url');
  const [r] = await getDb().update(alloggi).set({ ical_token: token }).where(eq(alloggi.id, alloggioId)).returning({ id: alloggi.id });
  if (!r) throw new Error('Alloggio non trovato');
  return token;
}

export async function leggiTokenIcal(alloggioId: string): Promise<string | null> {
  const [a] = await getDb().select({ token: alloggi.ical_token }).from(alloggi).where(eq(alloggi.id, alloggioId));
  return a?.token ?? null;
}

// ── IMPORT / SINCRONIZZAZIONE ────────────────────────────────────────────────

export type EsitoControllo = {
  alloggio: string; calendario: string; eventiLetti: number;
  importate: { start: string; end: string; canale: string }[]; // create ora come segnaposto (prima mancavano da noi)
  mancano: { start: string; end: string; summary: string }[];   // sull'OTA ma non da noi, e non importabili
  inPiu: { start: string; end: string; ospite: string; canale: string }[]; // da noi ma sparite dal feed → "da verificare"
  conflitti: { start: string; end: string; tipo: string; motivo: string }[];
  feedVuoto?: boolean;
  errore?: string;
};

export type OpzioniSync = {
  origine?: 'automatica' | 'manuale';
  /** false = non crea prenotazioni segnaposto (usato dai test, che non devono scrivere su Calendar né su fogli). */
  importa?: boolean;
  /** Per i test: restituisce il testo del feed senza passare dalla rete. */
  scarica?: (url: string) => Promise<string>;
  /** Per i test: la data di "oggi" (AAAA-MM-GG), così si provano date lontane senza toccare le prenotazioni vere. */
  oggi?: string;
};

const NOTA_IMPORT_ICAL = 'Importata da iCal';
const scaricaFeed = async (url: string) => {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/** Un segnaposto già cancellato a mano con le stesse date non va ricreato a ogni controllo. */
async function eraGiaScartata(alloggioId: string, canaleOta: string, start: string, end: string): Promise<boolean> {
  const db = getDb();
  const righe = await db.select({ note: prenotazioni.note }).from(prenotazioni).where(and(
    eq(prenotazioni.alloggio_id, alloggioId), eq(prenotazioni.canale, canaleOta as 'Booking'),
    eq(prenotazioni.checkin, start), eq(prenotazioni.checkout, end), eq(prenotazioni.stato, 'Cancellata'),
  ));
  return righe.some((r) => (r.note ?? '').startsWith(NOTA_IMPORT_ICAL));
}

const itBreve = (d: Date) => d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome' });

export async function controllaCalendariAlloggio(alloggioId: string, opz: OpzioniSync = {}): Promise<EsitoControllo[]> {
  const db = getDb();
  const [a] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, alloggioId));
  if (!a) return [];
  const cals = await db.select().from(calendariIcal).where(and(eq(calendariIcal.alloggio_id, alloggioId), eq(calendariIcal.attivo, true)));
  if (cals.length === 0) return [];
  const oggi = opz.oggi ?? new Date().toISOString().slice(0, 10);

  const esiti: EsitoControllo[] = [];
  for (const c of cals) {
    const t0 = Date.now();
    const esito: EsitoControllo = { alloggio: a.nome, calendario: c.nome, eventiLetti: 0, importate: [], mancano: [], inPiu: [], conflitti: [] };
    let nSparite = 0;
    try {
      const eventi = parseIcal(await (opz.scarica ?? scaricaFeed)(c.url));
      const righe = await db.select({
        id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale, stato: prenotazioni.stato,
        note: prenotazioni.note, daVerificare: prenotazioni.da_verificare, motivo: prenotazioni.da_verificare_motivo, nome: ospiti.nome, cognome: ospiti.cognome,
      }).from(prenotazioni).innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
        .where(and(eq(prenotazioni.alloggio_id, alloggioId), ne(prenotazioni.stato, 'Cancellata'), ne(prenotazioni.stato, 'Cancellata con penale'), gte(prenotazioni.checkout, oggi)));
      const nostre: PrenNostra[] = righe.map((r) => ({ id: r.id, checkin: r.checkin, checkout: r.checkout, canale: r.canale, stato: r.stato, note: r.note, daVerificare: r.daVerificare, motivo: r.motivo }));
      // Booking esporta solo circa 2 settimane: oltre non c'è prova che una prenotazione sia sparita
      const analisi = analizzaFeed(eventi, nostre, c.nome, oggi, 300, c.nome === 'Booking' ? 14 : 300);
      esito.eventiLetti = analisi.eventiLetti; esito.feedVuoto = analisi.feedVuoto;

      // 1) eventi dell'OTA che da noi mancano → prenotazione segnaposto "da completare" (solo date, nessun dato inventato)
      for (const b of analisi.daImportare) {
        const canaleOta = c.nome === 'Booking' || c.nome === 'Airbnb' ? c.nome : null;
        if (opz.importa !== false && canaleOta && importabile(b, canaleOta) && !(await eraGiaScartata(alloggioId, canaleOta, b.start, b.end))) {
          try {
            await creaPrenotazione({
              alloggioId, ospiteNome: 'Ospite', ospiteCognome: `${canaleOta} (da completare)`,
              checkin: b.start, checkout: b.end, canale: canaleOta, lordo: 0, stato: 'In attesa di conferma',
              note: `${NOTA_IMPORT_ICAL} — solo date dal calendario ${canaleOta} (${b.summary || 'senza titolo'}). Completare ospite e importo.`,
            });
            esito.importate.push({ start: b.start, end: b.end, canale: canaleOta });
            continue;
          } catch { /* ripiego: si segnala soltanto */ }
        }
        esito.mancano.push({ start: b.start, end: b.end, summary: b.summary });
      }

      // 2) sovrapposizioni: si registrano (senza duplicati) e si chiudono da sole quando non si rilevano più
      const chiave = (x: { dal: string; al: string; pren: string }) => `${x.dal}|${x.al}|${x.pren}`;
      const attuali = new Set(analisi.conflitti.map((k) => chiave({ dal: k.ota.start, al: k.ota.end, pren: k.prenotazioneId })));
      for (const k of analisi.conflitti) {
        await db.insert(conflittiCalendario).values({ alloggio_id: alloggioId, calendario: c.nome, ota_dal: k.ota.start, ota_al: k.ota.end, prenotazione_id: k.prenotazioneId, tipo: k.tipo, motivo: k.motivo })
          .onConflictDoUpdate({ target: [conflittiCalendario.alloggio_id, conflittiCalendario.calendario, conflittiCalendario.ota_dal, conflittiCalendario.ota_al, conflittiCalendario.prenotazione_id], set: { risolto_il: null, motivo: k.motivo, tipo: k.tipo } });
        esito.conflitti.push({ start: k.ota.start, end: k.ota.end, tipo: k.tipo, motivo: k.motivo });
      }
      const aperti = await db.select({ id: conflittiCalendario.id, dal: conflittiCalendario.ota_dal, al: conflittiCalendario.ota_al, pren: conflittiCalendario.prenotazione_id })
        .from(conflittiCalendario).where(and(eq(conflittiCalendario.alloggio_id, alloggioId), eq(conflittiCalendario.calendario, c.nome), isNull(conflittiCalendario.risolto_il)));
      for (const x of aperti) if (!attuali.has(chiave(x))) await db.update(conflittiCalendario).set({ risolto_il: new Date() }).where(eq(conflittiCalendario.id, x.id));

      // 3) prenotazioni sparite dal feed → "da verificare" (mai cancellate da sole); tornate → si toglie il segno
      for (const p of analisi.sparite) {
        await db.update(prenotazioni).set({ da_verificare: true, da_verificare_motivo: `${PREFISSO_SPARITA} ${c.nome} (controllo del ${itBreve(new Date())})`, aggiornato_il: new Date() }).where(eq(prenotazioni.id, p.id));
        const r = righe.find((x) => x.id === p.id);
        esito.inPiu.push({ start: p.checkin, end: p.checkout, ospite: r ? `${r.nome} ${r.cognome}`.trim() : '', canale: p.canale });
        nSparite++;
      }
      for (const p of analisi.riapparse) await db.update(prenotazioni).set({ da_verificare: false, da_verificare_motivo: null, aggiornato_il: new Date() }).where(eq(prenotazioni.id, p.id));
    } catch (e) {
      esito.errore = e instanceof Error ? e.message : String(e);
    }
    const avvisi = esito.conflitti.length + esito.inPiu.length + esito.mancano.length;
    const testo = esito.errore ? `errore: ${esito.errore}` : avvisi || esito.importate.length
      ? `${esito.importate.length} importate, ${esito.conflitti.length} sovrapposizioni, ${esito.inPiu.length} da verificare, ${esito.mancano.length} non importabili` : 'ok';
    await db.update(calendariIcal).set({ ultimo_controllo: new Date(), ultimo_esito: testo }).where(eq(calendariIcal.id, c.id));
    await db.insert(syncIcalLog).values({
      alloggio_id: alloggioId, calendario: c.nome, origine: opz.origine ?? 'manuale', esito: esito.errore ? 'errore' : avvisi ? 'avvisi' : 'ok',
      eventi_letti: esito.eventiLetti, importate: esito.importate.length, conflitti: esito.conflitti.length, da_verificare: nSparite,
      errore: esito.errore?.slice(0, 300) ?? null, durata_ms: Date.now() - t0,
    });
    esiti.push(esito);
  }
  return esiti;
}

export async function controllaTuttiICalendari(opz: OpzioniSync = {}): Promise<EsitoControllo[]> {
  const db = getDb();
  const alloggiConCal = await db.selectDistinct({ id: calendariIcal.alloggio_id }).from(calendariIcal).where(eq(calendariIcal.attivo, true));
  const out: EsitoControllo[] = [];
  for (const a of alloggiConCal) out.push(...(await controllaCalendariAlloggio(a.id, opz)));
  return out;
}

/** Ultime sincronizzazioni di un alloggio (data e ora, esito, eventi letti, errori). */
export async function leggiLogSync(alloggioId: string, limite = 10) {
  return getDb().select().from(syncIcalLog).where(eq(syncIcalLog.alloggio_id, alloggioId)).orderBy(desc(syncIcalLog.quando)).limit(limite);
}
