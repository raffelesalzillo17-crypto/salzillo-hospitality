/**
 * Scritture sul database (Neon). Contraltare di queries.ts.
 * Ogni record creato qui ha origine='Database' → il sync da Google Sheets NON lo tocca.
 *
 * Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md.
 */

import { and, eq, isNull, lte, gte, or, sql } from 'drizzle-orm';
import { getDb } from './index';
import {
  proprietari, immobili, alloggi, ospiti, prenotazioni, pagamenti, spese, scadenze, categorieSpesa,
  pulizie, contrattiGestione, preventivi, eventiLocali, prezziPeriodo, utenti, blocchiCalendario,
  permessiImmobile, richiestePubbliche, ospitiPrenotazione, schedine, documenti,
} from './schema';
import { hashPassword } from './auth';
import { creaEventoPrenotazione, eliminaEventoPrenotazione } from './calendario';
import {
  scriviNuovaPrenotazioneSuFoglio, aggiornaPrenotazioneSuFoglio,
  scriviSpesaSuFoglio, scriviScadenzaSuFoglio, aggiornaScadenzaSuFoglio,
  scriviOspiteSuFoglio, aggiornaOspiteSuFoglio, confermaPuliziaSuFoglio,
  scriviPreventivoSuFoglio, aggiornaPreventivoSuFoglio,
  scriviEventoLocaleSuFoglio, aggiornaEventoLocaleSuFoglio, eliminaEventoLocaleSuFoglio,
  scriviProprietarioSuFoglio, scriviImmobileSuFoglio, scriviAlloggioSuFoglio,
  scriviContrattoGestioneSuFoglio, aggiornaContrattoGestioneSuFoglio,
  scriviPrezzoPeriodoSuFoglio, eliminaPrezzoPeriodoSuFoglio, scriviPagamentoSuFoglio,
} from './syncFoglio';

const s = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const oggiISO = () => new Date().toISOString().slice(0, 10);
const nottiTra = (ci: string, co: string) => Math.max(1, Math.round((Date.parse(co) - Date.parse(ci)) / 864e5));

const COMM_RATE: Record<string, number> = { Airbnb: 0.1891, Booking: 0.2015, Diretto: 0, 'No Tax': 0 };

/** Calcola gli importi di una prenotazione dal listino attuale dell'alloggio + il contratto
 *  di gestione attivo del suo proprietario. Le prenotazioni SALVANO questi valori: se il
 *  regime dell'alloggio cambia domani, le prenotazioni di oggi restano com'erano. */
export async function calcolaImportiPrenotazione(opts: {
  alloggioId: string; canale: string; lordo: number;
}): Promise<{ commissione: number; cedolare: number; costoPulizia: number; feeGestione: number; utile: number; nettoProprietario: number }> {
  const db = getDb();
  const [a] = await db.select({
    regime: alloggi.regime_fiscale, costoPulizia: alloggi.costo_pulizia, immobileId: alloggi.immobile_id,
  }).from(alloggi).where(eq(alloggi.id, opts.alloggioId));
  if (!a) throw new Error('Alloggio non trovato');

  const [im] = await db.select({ proprietarioId: immobili.proprietario_id }).from(immobili).where(eq(immobili.id, a.immobileId));
  const contratti = im ? await db.select().from(contrattiGestione).where(and(
    eq(contrattiGestione.proprietario_id, im.proprietarioId),
    lte(contrattiGestione.dal, oggiISO()),
    or(isNull(contrattiGestione.al), gte(contrattiGestione.al, oggiISO())),
  )) : [];
  const percFee = contratti.length ? Number(contratti[0].percentuale_fee) : 0;

  const lordo = opts.lordo;
  const commissione = Math.round(lordo * (COMM_RATE[opts.canale] ?? 0) * 100) / 100;
  const cedolare = (a.regime === 'Con cedolare' && opts.canale !== 'No Tax') ? Math.round(lordo * 0.21 * 100) / 100 : 0;
  const costoPulizia = Number(a.costoPulizia);
  const feeGestione = Math.round(lordo * (percFee / 100) * 100) / 100;
  const utile = Math.round((lordo - commissione - cedolare - costoPulizia) * 100) / 100;
  const nettoProprietario = Math.round((utile - feeGestione) * 100) / 100;
  return { commissione, cedolare, costoPulizia, feeGestione, utile, nettoProprietario };
}

// ── Anagrafica ───────────────────────────────────────────────────────────────

function rigaProprietarioDa(p: typeof proprietari.$inferSelect) {
  return { nome: p.nome, tipo: p.tipo, codiceFiscalePiva: p.codice_fiscale_piva, email: p.email, telefono: p.telefono, iban: p.iban, note: p.note };
}

export async function creaProprietario(d: { nome: string; tipo?: string; codiceFiscalePiva?: string; email?: string; telefono?: string; iban?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(proprietari).values({
    nome: d.nome.trim(), tipo: (d.tipo as 'Persona fisica') || 'Persona fisica',
    codice_fiscale_piva: d.codiceFiscalePiva || null, email: d.email || null,
    telefono: d.telefono || null, iban: d.iban || null, note: d.note || null,
  }).returning();
  await scriviProprietarioSuFoglio(rigaProprietarioDa(r));
  return r;
}
export async function aggiornaProprietario(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ nome: d.nome, tipo: d.tipo, codice_fiscale_piva: d.codiceFiscalePiva, email: d.email, telefono: d.telefono, iban: d.iban, note: d.note })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(proprietari).set(set).where(eq(proprietari.id, id)).returning();
  await scriviProprietarioSuFoglio(rigaProprietarioDa(r));
  return r;
}

async function proprietarioNomePerFoglio(id: string): Promise<string> {
  const [p] = await getDb().select({ nome: proprietari.nome }).from(proprietari).where(eq(proprietari.id, id));
  return p?.nome ?? '';
}
async function scriviImmobileSuFoglioDa(r: typeof immobili.$inferSelect) {
  const proprietarioNome = await proprietarioNomePerFoglio(r.proprietario_id);
  await scriviImmobileSuFoglio({ nome: r.nome, proprietarioNome, indirizzo: r.indirizzo, comune: r.comune, provincia: r.provincia, cin: r.cin, cir: r.cir, note: r.note });
}

export async function creaImmobile(d: { proprietarioId: string; nome: string; indirizzo: string; comune: string; provincia: string; cin?: string; cir?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(immobili).values({
    proprietario_id: d.proprietarioId, nome: d.nome.trim(), indirizzo: d.indirizzo.trim(),
    comune: d.comune.trim(), provincia: d.provincia.trim().toUpperCase(),
    cin: d.cin || null, cir: d.cir || null, note: d.note || null,
  }).returning();
  await scriviImmobileSuFoglioDa(r);
  return r;
}
export async function aggiornaImmobile(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ nome: d.nome, indirizzo: d.indirizzo, comune: d.comune, provincia: d.provincia, cin: d.cin, cir: d.cir, note: d.note, proprietario_id: d.proprietarioId })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(immobili).set(set).where(eq(immobili.id, id)).returning();
  await scriviImmobileSuFoglioDa(r);
  return r;
}

async function immobileNomePerFoglio(id: string): Promise<string> {
  const [i] = await getDb().select({ nome: immobili.nome }).from(immobili).where(eq(immobili.id, id));
  return i?.nome ?? '';
}
async function scriviAlloggioSuFoglioDa(r: typeof alloggi.$inferSelect) {
  const immobileNome = await immobileNomePerFoglio(r.immobile_id);
  await scriviAlloggioSuFoglio({
    nome: r.nome, immobileNome, regimeFiscale: r.regime_fiscale, costoPulizia: Number(r.costo_pulizia), attivo: r.attivo,
    wifiSsid: r.wifi_ssid, trasmetteAlloggiati: r.trasmette_alloggiati, impostaSoggiornoComune: r.imposta_soggiorno_comune,
    impostaSoggiornoImporto: Number(r.imposta_soggiorno_importo),
  });
}

export async function creaAlloggio(d: { immobileId: string; nome: string; regimeFiscale?: string; costoPulizia?: number; emoji?: string; wifiSsid?: string; wifiPassword?: string; haSelfCheckin?: boolean; trasmetteAlloggiati?: boolean; trasmetteRegione?: boolean; impostaSoggiornoComune?: string; impostaSoggiornoImporto?: number }) {
  const db = getDb();
  const [r] = await db.insert(alloggi).values({
    immobile_id: d.immobileId, nome: d.nome.trim(),
    regime_fiscale: (d.regimeFiscale as 'No tax') || 'No tax',
    costo_pulizia: s(d.costoPulizia ?? 20), emoji: d.emoji || null,
    wifi_ssid: d.wifiSsid || null, wifi_password: d.wifiPassword || null,
    ha_self_checkin: d.haSelfCheckin ?? false, trasmette_alloggiati: d.trasmetteAlloggiati ?? false,
    trasmette_regione: d.trasmetteRegione ?? false,
    imposta_soggiorno_comune: d.impostaSoggiornoComune || null,
    imposta_soggiorno_importo: s(d.impostaSoggiornoImporto ?? 0),
  }).returning();
  await scriviAlloggioSuFoglioDa(r);
  return r;
}
export async function aggiornaAlloggio(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const map: Record<string, unknown> = {
    nome: d.nome, regime_fiscale: d.regimeFiscale, costo_pulizia: d.costoPulizia != null ? s(Number(d.costoPulizia)) : undefined,
    emoji: d.emoji, wifi_ssid: d.wifiSsid, wifi_password: d.wifiPassword, attivo: d.attivo,
    ha_self_checkin: d.haSelfCheckin, trasmette_alloggiati: d.trasmetteAlloggiati, trasmette_regione: d.trasmetteRegione,
    imposta_soggiorno_comune: d.impostaSoggiornoComune,
    imposta_soggiorno_importo: d.impostaSoggiornoImporto != null ? s(Number(d.impostaSoggiornoImporto)) : undefined,
    messaggio_guida: d.messaggioGuida, promemoria_pulizia: d.promemoriaPulizia,
  };
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries(map)) if (v !== undefined) set[k] = v === '' ? null : v;
  const [r] = await db.update(alloggi).set(set).where(eq(alloggi.id, id)).returning();
  await scriviAlloggioSuFoglioDa(r);
  return r;
}

// ── Ospiti ───────────────────────────────────────────────────────────────────

export async function creaOspite(d: { nome: string; cognome: string; telefono?: string; email?: string; codiceFiscale?: string; valutazione?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(ospiti).values({
    nome: d.nome.trim(), cognome: d.cognome.trim(), telefono: d.telefono || null, email: d.email || null,
    codice_fiscale: d.codiceFiscale || null, valutazione: (d.valutazione as 'Neutro') || 'Neutro', note: d.note || null,
  }).returning();
  await scriviOspiteSuFoglio({ id: r.id, nomeCompleto: `${r.nome} ${r.cognome}`.trim(), telefono: r.telefono, codiceFiscale: r.codice_fiscale, note: r.note });
  return r;
}
export async function aggiornaOspite(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ nome: d.nome, cognome: d.cognome, telefono: d.telefono, email: d.email, codice_fiscale: d.codiceFiscale, valutazione: d.valutazione, note: d.note })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(ospiti).set(set).where(eq(ospiti.id, id)).returning();
  await aggiornaOspiteSuFoglio({ id: r.id, nomeCompleto: `${r.nome} ${r.cognome}`.trim(), telefono: r.telefono, codiceFiscale: r.codice_fiscale, note: r.note });
  return r;
}
/** Elimina un ospite SOLO se non è agganciato a niente di reale (prenotazione, preventivo,
 *  documento, schedina) — pensato per ripulire i doppioni creati da un sync o dei test,
 *  mai per un ospite con dati veri dietro. Non tocca la riga sul foglio Google (resta lì
 *  come storico secondario, stesso trattamento di eliminaPreventivo). */
export async function eliminaOspite(id: string) {
  const db = getDb();
  const [pren] = await db.select({ n: sql<number>`count(*)` }).from(prenotazioni).where(eq(prenotazioni.ospite_id, id));
  const [op] = await db.select({ n: sql<number>`count(*)` }).from(ospitiPrenotazione).where(eq(ospitiPrenotazione.ospite_id, id));
  const [prev] = await db.select({ n: sql<number>`count(*)` }).from(preventivi).where(eq(preventivi.ospite_id, id));
  const [doc] = await db.select({ n: sql<number>`count(*)` }).from(documenti).where(eq(documenti.ospite_id, id));
  const [sch] = await db.select({ n: sql<number>`count(*)` }).from(schedine).where(eq(schedine.ospite_id, id));
  const totale = Number(pren.n) + Number(op.n) + Number(prev.n) + Number(doc.n) + Number(sch.n);
  if (totale > 0) throw new Error(`Questo ospite ha ${totale} prenotazione/documento agganciati — non si può eliminare.`);
  await db.delete(ospiti).where(eq(ospiti.id, id));
  return { ok: true };
}

// ── Prenotazioni ─────────────────────────────────────────────────────────────

export async function creaPrenotazione(d: {
  alloggioId: string; ospiteId?: string; ospiteNome?: string; ospiteCognome?: string; ospiteTelefono?: string;
  checkin: string; checkout: string; numeroOspiti?: number; canale: string; lordo: number;
  codiceConfermaCanale?: string; note?: string; creataDa?: string; stato?: string;
}) {
  const db = getDb();
  let ospiteId = d.ospiteId;
  if (!ospiteId) {
    if (!d.ospiteNome || !d.ospiteCognome) throw new Error('Serve un ospite (id, oppure nome + cognome)');
    const o = await creaOspite({ nome: d.ospiteNome, cognome: d.ospiteCognome, telefono: d.ospiteTelefono });
    ospiteId = o.id;
  }
  const imp = await calcolaImportiPrenotazione({ alloggioId: d.alloggioId, canale: d.canale, lordo: d.lordo });

  // evento Google Calendar (best-effort — un calendario per immobile se impostato)
  const [ctx] = await db.select({
    alloggio: alloggi.nome, immobileId: alloggi.immobile_id, calendarId: immobili.calendar_id, telefono: ospiti.telefono,
  }).from(alloggi).innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .leftJoin(ospiti, eq(ospiti.id, ospiteId!)).where(eq(alloggi.id, d.alloggioId));
  const [o] = await db.select({ nome: ospiti.nome, cognome: ospiti.cognome }).from(ospiti).where(eq(ospiti.id, ospiteId!));
  const eventId = await creaEventoPrenotazione({
    calendarId: ctx?.calendarId ?? null, alloggio: ctx?.alloggio ?? '', ospite: `${o?.nome ?? ''} ${o?.cognome ?? ''}`.trim(),
    canale: d.canale, checkin: d.checkin, checkout: d.checkout, lordo: d.lordo, utile: imp.utile, telefono: ctx?.telefono,
  });

  const [r] = await db.insert(prenotazioni).values({
    origine: 'Database', alloggio_id: d.alloggioId, ospite_id: ospiteId,
    checkin: d.checkin, checkout: d.checkout, numero_ospiti: d.numeroOspiti ?? 1,
    canale: d.canale as 'Airbnb', codice_conferma_canale: d.codiceConfermaCanale || null,
    lordo: s(d.lordo), commissione: s(imp.commissione), cedolare: s(imp.cedolare),
    costo_pulizia: s(imp.costoPulizia), fee_gestione: s(imp.feeGestione), utile: s(imp.utile),
    netto_proprietario: s(imp.nettoProprietario), calendar_event_id: eventId,
    stato: (d.stato as 'Attiva') || 'Attiva', note: d.note || null, creata_da: d.creataDa || null,
  }).returning();

  await scriviNuovaPrenotazioneSuFoglio({
    alloggioNome: ctx?.alloggio ?? '', checkin: d.checkin, checkout: d.checkout,
    ospiteNomeCompleto: `${o?.nome ?? ''} ${o?.cognome ?? ''}`.trim(), canale: d.canale, lordo: d.lordo,
    stato: r.stato, eventId, telefono: ctx?.telefono,
  });

  // Pulizia agganciata al check-out — creata in automatico, non deve essere aggiunta a mano.
  await db.insert(pulizie).values({ alloggio_id: d.alloggioId, prenotazione_id: r.id, data: r.checkout });

  return r;
}

/** Alloggio, ospite e importi di una prenotazione — serve a syncFoglio.ts per scrivere/
 *  aggiornare la riga corrispondente sul vecchio foglio dopo una modifica o cancellazione. */
async function contestoPrenotazionePerFoglio(p: typeof prenotazioni.$inferSelect) {
  const db = getDb();
  const [alloggio] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, p.alloggio_id));
  const [ospite] = await db.select({ nome: ospiti.nome, cognome: ospiti.cognome, telefono: ospiti.telefono }).from(ospiti).where(eq(ospiti.id, p.ospite_id));
  return {
    alloggioNome: alloggio?.nome ?? '', ospiteNomeCompleto: `${ospite?.nome ?? ''} ${ospite?.cognome ?? ''}`.trim(),
    telefono: ospite?.telefono ?? null,
  };
}

export async function aggiornaPrenotazione(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const [attuale] = await db.select().from(prenotazioni).where(eq(prenotazioni.id, id));
  if (!attuale) throw new Error('Prenotazione non trovata');

  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({
    checkin: d.checkin, checkout: d.checkout, numero_ospiti: d.numeroOspiti,
    codice_conferma_canale: d.codiceConfermaCanale, note: d.note, stato: d.stato,
    penale_importo: d.penaleImporto != null ? s(Number(d.penaleImporto)) : undefined,
  })) if (v !== undefined) set[k] = v;

  // se cambiano lordo/canale/alloggio → ricalcola gli importi
  if (d.lordo !== undefined || d.canale !== undefined || d.alloggioId !== undefined) {
    const lordo = d.lordo !== undefined ? Number(d.lordo) : Number(attuale.lordo);
    const canale = (d.canale as string) ?? attuale.canale;
    const alloggioId = (d.alloggioId as string) ?? attuale.alloggio_id;
    const imp = await calcolaImportiPrenotazione({ alloggioId, canale, lordo });
    Object.assign(set, {
      lordo: s(lordo), canale, alloggio_id: alloggioId, commissione: s(imp.commissione), cedolare: s(imp.cedolare),
      costo_pulizia: s(imp.costoPulizia), fee_gestione: s(imp.feeGestione), utile: s(imp.utile), netto_proprietario: s(imp.nettoProprietario),
    });
  }
  const [r] = await db.update(prenotazioni).set(set).where(eq(prenotazioni.id, id)).returning();

  if (r.origine === 'Database') {
    const ctx = await contestoPrenotazionePerFoglio(attuale);
    await aggiornaPrenotazioneSuFoglio({
      alloggioNome: ctx.alloggioNome, checkin: attuale.checkin, checkout: r.checkout,
      ospiteNomeCompleto: ctx.ospiteNomeCompleto, canale: r.canale, lordo: Number(r.lordo),
      stato: r.stato, penale: r.penale_importo != null ? Number(r.penale_importo) : null,
      eventId: r.calendar_event_id, telefono: ctx.telefono,
    });
  }

  // Cambio check-out o alloggio → sposta la pulizia agganciata, se non è già stata fatta.
  // Cancellazione → la pulizia agganciata non serve più.
  if (r.checkout !== attuale.checkout || r.alloggio_id !== attuale.alloggio_id || (d.stato && r.stato !== 'Attiva')) {
    if (d.stato && r.stato !== 'Attiva') {
      await db.delete(pulizie).where(and(eq(pulizie.prenotazione_id, id), isNull(pulizie.confermata_il)));
    } else {
      await db.update(pulizie).set({ data: r.checkout, alloggio_id: r.alloggio_id, aggiornato_il: new Date() })
        .where(and(eq(pulizie.prenotazione_id, id), isNull(pulizie.confermata_il)));
    }
  }
  return r;
}

export async function cancellaPrenotazione(id: string, conPenale: boolean, importoPenale?: number) {
  const db = getDb();
  const [attuale] = await db.select().from(prenotazioni).where(eq(prenotazioni.id, id));
  if (!attuale) throw new Error('Prenotazione non trovata');
  if (attuale.calendar_event_id) {
    const [im] = await db.select({ calendarId: immobili.calendar_id }).from(alloggi).innerJoin(immobili, eq(immobili.id, alloggi.immobile_id)).where(eq(alloggi.id, attuale.alloggio_id));
    await eliminaEventoPrenotazione(im?.calendarId ?? null, attuale.calendar_event_id);
  }
  const [r] = await db.update(prenotazioni).set({
    stato: conPenale ? 'Cancellata con penale' : 'Cancellata',
    penale_importo: conPenale && importoPenale ? s(importoPenale) : null,
    calendar_event_id: null,
    aggiornato_il: new Date(),
  }).where(eq(prenotazioni.id, id)).returning();

  if (r.origine === 'Database') {
    const ctx = await contestoPrenotazionePerFoglio(attuale);
    await aggiornaPrenotazioneSuFoglio({
      alloggioNome: ctx.alloggioNome, checkin: attuale.checkin, checkout: attuale.checkout,
      ospiteNomeCompleto: ctx.ospiteNomeCompleto, canale: attuale.canale, lordo: Number(attuale.lordo),
      stato: r.stato, penale: r.penale_importo != null ? Number(r.penale_importo) : null,
      eventId: attuale.calendar_event_id, telefono: ctx.telefono,
    });
  }
  // La pulizia agganciata al check-out non serve più se non è già stata fatta.
  await db.delete(pulizie).where(and(eq(pulizie.prenotazione_id, id), isNull(pulizie.confermata_il)));
  return r;
}

// ── Preventivi ───────────────────────────────────────────────────────────────

/** Calcolo economico di un preventivo: prezzo/notte o totale, meno lo sconto (€ o %). */
export function calcolaPreventivo(d: { prezzo?: number; prezzoNotte?: number; notti: number; sconto?: number; scontoTipo?: string }) {
  const prezzoNotte = d.prezzoNotte ?? (d.prezzo ? d.prezzo / d.notti : 0);
  const totalePieno = d.prezzo ?? Math.round(prezzoNotte * d.notti * 100) / 100;
  const sc = d.sconto && d.sconto > 0
    ? (d.scontoTipo === 'percento' ? Math.round(totalePieno * d.sconto) / 100 : Math.round(d.sconto * 100) / 100)
    : 0;
  return {
    prezzoNotte: Math.round(prezzoNotte * 100) / 100,
    totalePieno: Math.round(totalePieno * 100) / 100,
    sconto: sc,
    totale: Math.round((totalePieno - sc) * 100) / 100,
  };
}

async function prossimoCodicePreventivo(db: ReturnType<typeof getDb>): Promise<string> {
  const [r] = await db.select({ max: sql<string | null>`max(${preventivi.codice})`.as('max') }).from(preventivi);
  const n = r?.max ? parseInt(String(r.max).replace(/\D/g, ''), 10) + 1 : 1;
  return `PR-${String(n).padStart(4, '0')}`;
}

export async function creaPreventivo(d: {
  alloggioId: string; checkin: string; checkout: string; numeroOspiti?: number;
  prezzo?: number; prezzoNotte?: number; sconto?: number; scontoTipo?: string; validoOre?: number;
  ospiteId?: string; ospiteNome?: string; ospiteCognome?: string; ospiteTelefono?: string;
  note?: string; creatoDa?: string;
}) {
  const db = getDb();
  let ospiteId = d.ospiteId || undefined;
  if (ospiteId) {
    // Se l'ospite scelto in una pagina rimasta aperta a lungo non esiste più (es. cancellato
    // da un "aggiorna dal foglio" nel frattempo), meglio un errore chiaro che un errore SQL
    // grezzo — vedi il fix del 14/09/2026 in importDaSheets.ts per la causa reale.
    const [esiste] = await db.select({ id: ospiti.id }).from(ospiti).where(eq(ospiti.id, ospiteId));
    if (!esiste) throw new Error('Questo ospite non esiste più — ricarica la pagina e riprova a scegliere/creare l\'ospite.');
  }
  if (!ospiteId && (d.ospiteNome || d.ospiteCognome || d.ospiteTelefono)) {
    const o = await creaOspite({
      nome: (d.ospiteNome || '').trim() || '—',
      cognome: (d.ospiteCognome || '').trim() || (d.ospiteNome ? '' : 'Da definire'),
      telefono: d.ospiteTelefono,
    });
    ospiteId = o.id;
  } else if (ospiteId && d.ospiteTelefono) {
    await db.update(ospiti).set({ telefono: d.ospiteTelefono, aggiornato_il: new Date() })
      .where(and(eq(ospiti.id, ospiteId), isNull(ospiti.telefono)));
  }
  const notti = nottiTra(d.checkin, d.checkout);
  const c = calcolaPreventivo({ prezzo: d.prezzo, prezzoNotte: d.prezzoNotte, notti, sconto: d.sconto, scontoTipo: d.scontoTipo });
  const codice = await prossimoCodicePreventivo(db);
  const [r] = await db.insert(preventivi).values({
    codice, ospite_id: ospiteId ?? null, alloggio_id: d.alloggioId,
    checkin: d.checkin, checkout: d.checkout, numero_ospiti: d.numeroOspiti ?? 1,
    prezzo_notte: s(c.prezzoNotte), totale_pieno: s(c.totalePieno), sconto: s(c.sconto),
    sconto_tipo: d.scontoTipo === 'percento' ? 'percento' : 'euro', totale: s(c.totale),
    valido_ore: d.validoOre && d.validoOre > 0 ? Math.round(d.validoOre) : 24,
    note: d.note || null, stato: 'Bozza', creato_da: d.creatoDa || null,
  }).returning();

  const ctx = await contestoPreventivoPerFoglio(r);
  await scriviPreventivoSuFoglio(rigaPreventivoDa(r, ctx));
  return r;
}

// ── Richieste dal sito vetrina ──────────────────────────────────────────────
// Deliberatamente NON scritte su Google Sheets e senza creare un ospite: sono solo un
// promemoria leggero finché Raffaele non decide di trasformarle in un vero preventivo.

export async function creaRichiestaPubblica(d: {
  alloggioId: string; checkin: string; checkout: string; numeroOspiti: number; nome: string; telefono: string; note?: string;
}) {
  const db = getDb();
  const [r] = await db.insert(richiestePubbliche).values({
    alloggio_id: d.alloggioId, checkin: d.checkin, checkout: d.checkout,
    numero_ospiti: d.numeroOspiti, nome: d.nome.trim(), telefono: d.telefono.trim(),
    note: d.note || null,
  }).returning();
  return r;
}

/** Crea il preventivo vero da una richiesta (Raffaele sceglie il prezzo) e la segna Gestita. */
export async function creaPreventivoDaRichiesta(richiestaId: string, d: {
  prezzo?: number; prezzoNotte?: number; sconto?: number; scontoTipo?: string; validoOre?: number; note?: string; creatoDa?: string;
}) {
  const db = getDb();
  const [ri] = await db.select().from(richiestePubbliche).where(eq(richiestePubbliche.id, richiestaId));
  if (!ri) throw new Error('Richiesta non trovata');
  const p = await creaPreventivo({
    alloggioId: ri.alloggio_id, checkin: ri.checkin, checkout: ri.checkout, numeroOspiti: ri.numero_ospiti,
    prezzo: d.prezzo, prezzoNotte: d.prezzoNotte, sconto: d.sconto, scontoTipo: d.scontoTipo, validoOre: d.validoOre,
    ospiteNome: ri.nome, ospiteTelefono: ri.telefono,
    note: d.note || ri.note || undefined, creatoDa: d.creatoDa,
  });
  await db.update(richiestePubbliche).set({ stato: 'Gestita', preventivo_id: p.id, aggiornato_il: new Date() }).where(eq(richiestePubbliche.id, richiestaId));
  return p;
}

export async function ignoraRichiestaPubblica(id: string) {
  const db = getDb();
  await db.update(richiestePubbliche).set({ stato: 'Gestita', aggiornato_il: new Date() }).where(eq(richiestePubbliche.id, id));
  return { ok: true };
}

/** Alloggio e ospite di un preventivo — serve a syncFoglio.ts per scrivere/aggiornare la
 *  riga corrispondente sul tab PREVENTIVI del vecchio foglio. */
async function contestoPreventivoPerFoglio(p: typeof preventivi.$inferSelect) {
  const db = getDb();
  const [alloggio] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, p.alloggio_id));
  let ospiteNomeCompleto = '';
  if (p.ospite_id) {
    const [ospite] = await db.select({ nome: ospiti.nome, cognome: ospiti.cognome }).from(ospiti).where(eq(ospiti.id, p.ospite_id));
    ospiteNomeCompleto = `${ospite?.nome ?? ''} ${ospite?.cognome ?? ''}`.trim();
  }
  return { alloggioNome: alloggio?.nome ?? '', ospiteNomeCompleto };
}

function rigaPreventivoDa(p: typeof preventivi.$inferSelect, ctx: { alloggioNome: string; ospiteNomeCompleto: string }) {
  return {
    codice: p.codice, checkin: p.checkin, checkout: p.checkout,
    ospiteNomeCompleto: ctx.ospiteNomeCompleto, alloggioNome: ctx.alloggioNome,
    prezzoNotte: p.prezzo_notte != null ? Number(p.prezzo_notte) : null,
    totale: Number(p.totale), sconto: Number(p.sconto), stato: p.stato,
    validoOre: p.valido_ore, note: p.note,
  };
}

/** Elimina del tutto un preventivo (es. prove/test) — non tocca la riga sul foglio Google,
 *  che resta come storico secondario. Solo per uso interno, mai chiamata dal sito pubblico.
 *  Se il preventivo era nato da una richiesta del sito, quella richiesta torna "Nuova" (si
 *  può rifare) invece di restare agganciata a un preventivo che non esiste più. */
export async function eliminaPreventivo(id: string) {
  const db = getDb();
  await db.update(richiestePubbliche).set({ stato: 'Nuova', preventivo_id: null, aggiornato_il: new Date() }).where(eq(richiestePubbliche.preventivo_id, id));
  await db.delete(preventivi).where(eq(preventivi.id, id));
  return { ok: true };
}

export async function aggiornaStatoPreventivo(id: string, stato: string) {
  const db = getDb();
  const set: Record<string, unknown> = { stato: stato as 'Bozza', aggiornato_il: new Date() };
  if (stato === 'Inviato') set.inviato_il = new Date();
  const [r] = await db.update(preventivi).set(set).where(eq(preventivi.id, id)).returning();

  const ctx = await contestoPreventivoPerFoglio(r);
  await aggiornaPreventivoSuFoglio(rigaPreventivoDa(r, ctx));
  return r;
}

/** "Segna accettato": crea la prenotazione vera (canale Diretto) e la lega al preventivo.
 *  La prenotazione crea l'evento su Google Calendar e finisce nel feed iCal → blocca le OTA. */
export async function accettaPreventivo(id: string, utenteId?: string) {
  const db = getDb();
  const [p] = await db.select().from(preventivi).where(eq(preventivi.id, id));
  if (!p) throw new Error('Preventivo non trovato');
  if (p.prenotazione_id) throw new Error('Questo preventivo è già stato accettato');
  if (!p.ospite_id) throw new Error("Aggiungi nome e cognome dell'ospite prima di accettare");
  const pren = await creaPrenotazione({
    alloggioId: p.alloggio_id, ospiteId: p.ospite_id,
    checkin: p.checkin, checkout: p.checkout, numeroOspiti: p.numero_ospiti,
    canale: 'Diretto', lordo: Number(p.totale), note: `Da preventivo ${p.codice}`, creataDa: utenteId,
  });
  const [r] = await db.update(preventivi).set({
    stato: 'Accettato', prenotazione_id: pren.id, accettato_il: new Date(), aggiornato_il: new Date(),
  }).where(eq(preventivi.id, id)).returning();

  const ctx = await contestoPreventivoPerFoglio(r);
  await aggiornaPreventivoSuFoglio(rigaPreventivoDa(r, ctx));
  return { preventivo: r, prenotazione: pren };
}

// ── Eventi locali / Prezzi per periodo ──────────────────────────────────────

function rigaEventoLocaleDa(e: typeof eventiLocali.$inferSelect) {
  return { titolo: e.titolo, dal: e.dal, al: e.al, comune: e.comune, impatto: e.impatto, note: e.note };
}

export async function creaEventoLocale(d: { titolo: string; dal: string; al: string; comune?: string; impatto?: string; note?: string }) {
  const [r] = await getDb().insert(eventiLocali).values({
    titolo: d.titolo.trim(), dal: d.dal, al: d.al || d.dal, comune: d.comune || null,
    impatto: (d.impatto as 'Medio') || 'Medio', note: d.note || null,
  }).returning();
  await scriviEventoLocaleSuFoglio(rigaEventoLocaleDa(r));
  return r;
}
export async function aggiornaEventoLocale(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const [prima] = await db.select().from(eventiLocali).where(eq(eventiLocali.id, id));
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ titolo: d.titolo, dal: d.dal, al: d.al, comune: d.comune, impatto: d.impatto, note: d.note })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(eventiLocali).set(set).where(eq(eventiLocali.id, id)).returning();
  if (prima) await aggiornaEventoLocaleSuFoglio({ titolo: prima.titolo, dal: prima.dal }, rigaEventoLocaleDa(r));
  return r;
}
export async function cancellaEventoLocale(id: string) {
  const db = getDb();
  const [e] = await db.select().from(eventiLocali).where(eq(eventiLocali.id, id));
  await db.delete(eventiLocali).where(eq(eventiLocali.id, id));
  if (e) await eliminaEventoLocaleSuFoglio(e.titolo, e.dal);
  return { ok: true };
}

export async function creaPrezzoPeriodo(d: { alloggioId?: string; dal: string; al: string; prezzoNotte: number; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(prezziPeriodo).values({
    alloggio_id: d.alloggioId || null, dal: d.dal, al: d.al || d.dal,
    prezzo_notte: s(d.prezzoNotte), note: d.note || null,
  }).returning();
  const alloggioNome = r.alloggio_id ? await immobileOAlloggioNomePerFoglio(r.alloggio_id) : '';
  await scriviPrezzoPeriodoSuFoglio({ alloggioNome, dal: r.dal, al: r.al, prezzoNotte: Number(r.prezzo_notte), note: r.note });
  return r;
}
export async function cancellaPrezzoPeriodo(id: string) {
  const db = getDb();
  const [r] = await db.select().from(prezziPeriodo).where(eq(prezziPeriodo.id, id));
  await db.delete(prezziPeriodo).where(eq(prezziPeriodo.id, id));
  if (r) {
    const alloggioNome = r.alloggio_id ? await immobileOAlloggioNomePerFoglio(r.alloggio_id) : '';
    await eliminaPrezzoPeriodoSuFoglio({ alloggioNome, dal: r.dal, al: r.al, prezzoNotte: Number(r.prezzo_notte) });
  }
  return { ok: true };
}
async function immobileOAlloggioNomePerFoglio(alloggioId: string): Promise<string> {
  const [a] = await getDb().select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, alloggioId));
  return a?.nome ?? '';
}

// ── Pagamenti ────────────────────────────────────────────────────────────────

export async function aggiungiPagamento(d: { prenotazioneId: string; tipo: string; importo: number; data?: string; metodo?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(pagamenti).values({
    prenotazione_id: d.prenotazioneId, tipo: d.tipo as 'Caparra', importo: s(d.importo),
    data: d.data || oggiISO(), metodo: (d.metodo as 'Bonifico') || null, note: d.note || null,
  }).returning();

  const [pren] = await db.select({ checkin: prenotazioni.checkin, alloggio_id: prenotazioni.alloggio_id, ospite_id: prenotazioni.ospite_id }).from(prenotazioni).where(eq(prenotazioni.id, d.prenotazioneId));
  if (pren) {
    const [alloggio] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, pren.alloggio_id));
    const [ospite] = await db.select({ nome: ospiti.nome, cognome: ospiti.cognome }).from(ospiti).where(eq(ospiti.id, pren.ospite_id));
    await scriviPagamentoSuFoglio({
      ospiteNomeCompleto: `${ospite?.nome ?? ''} ${ospite?.cognome ?? ''}`.trim(), checkinPrenotazione: pren.checkin,
      alloggioNome: alloggio?.nome ?? '', tipo: r.tipo, data: r.data, importo: Number(r.importo), metodo: r.metodo, note: r.note,
    });
  }
  return r;
}

// ── Spese / Scadenze / Pulizie ──────────────────────────────────────────────

export async function creaSpesa(d: { immobileId?: string; categoriaId: string; data?: string; descrizione: string; importo: number; metodoPagamento?: string; note?: string; daRimborsareProprietario?: boolean }) {
  const db = getDb();
  const [r] = await db.insert(spese).values({
    origine: 'Database', immobile_id: d.immobileId || null, categoria_id: d.categoriaId,
    data: d.data || oggiISO(), descrizione: d.descrizione.trim(), importo: s(d.importo),
    metodo_pagamento: (d.metodoPagamento as 'Bonifico') || null,
    da_rimborsare_proprietario: d.daRimborsareProprietario ?? false, note: d.note || null,
  }).returning();

  const [cat] = await db.select({ nome: categorieSpesa.nome }).from(categorieSpesa).where(eq(categorieSpesa.id, d.categoriaId));
  let struttura: string | null = null;
  if (d.immobileId) {
    const [im] = await db.select({ nome: immobili.nome }).from(immobili).where(eq(immobili.id, d.immobileId));
    struttura = im?.nome ?? null;
  }
  await scriviSpesaSuFoglio({ data: r.data, categoriaNome: cat?.nome ?? '', descrizione: r.descrizione, importo: Number(r.importo), struttura });
  return r;
}

export async function creaScadenza(d: { immobileId?: string; titolo: string; ente?: string; dataScadenza: string; ricorrenza?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(scadenze).values({
    origine: 'Database', immobile_id: d.immobileId || null, titolo: d.titolo.trim(), ente: d.ente || null,
    data_scadenza: d.dataScadenza, ricorrenza: (d.ricorrenza as 'Una tantum') || 'Una tantum', note: d.note || null,
  }).returning();

  await scriviScadenzaSuFoglio({ titolo: r.titolo, dataScadenza: r.data_scadenza, ricorrenza: r.ricorrenza, ente: r.ente, note: r.note });
  return r;
}

/** Scadenze fiscali/amministrative tipiche di un B&B in Campania, se non già presenti. */
export async function seedScadenzeTipiche() {
  const db = getDb();
  const esistenti = await db.select({ titolo: scadenze.titolo }).from(scadenze);
  const gia = new Set(esistenti.map((s) => s.titolo.toLowerCase()));
  const anno = new Date().getFullYear();
  const preset: { titolo: string; ente: string; dataScadenza: string; ricorrenza: string; note: string }[] = [
    { titolo: 'Cedolare secca — 1° acconto', ente: 'Agenzia delle Entrate', dataScadenza: `${anno}-06-30`, ricorrenza: 'Annuale', note: 'Acconto imposta sostitutiva sugli affitti (regime cedolare).' },
    { titolo: 'Cedolare secca — 2° acconto', ente: 'Agenzia delle Entrate', dataScadenza: `${anno}-11-30`, ricorrenza: 'Annuale', note: 'Secondo acconto.' },
    { titolo: 'Dichiarazione redditi (730/Redditi PF)', ente: 'Agenzia delle Entrate', dataScadenza: `${anno}-09-30`, ricorrenza: 'Annuale', note: 'Dichiarazione dei redditi da locazione breve.' },
    { titolo: 'Comunicazione dati locazioni brevi (portali)', ente: 'Agenzia delle Entrate', dataScadenza: `${anno}-06-30`, ricorrenza: 'Annuale', note: 'Ritenuta operata dai portali (Airbnb/Booking) su affitti brevi.' },
    { titolo: 'Rinnovo / verifica CIN', ente: 'Ministero del Turismo', dataScadenza: `${anno}-12-31`, ricorrenza: 'Annuale', note: 'Codice Identificativo Nazionale: verifica che sia attivo ed esposto negli annunci.' },
    { titolo: 'Flusso mensile portale regionale (Sinfonia)', ente: 'Regione Campania', dataScadenza: `${anno}-${String(new Date().getMonth() + 2).padStart(2, '0')}-10`, ricorrenza: 'Mensile', note: 'Invio movimenti turistici del mese precedente al portale Sinfonia.' },
    { titolo: 'Imposta di soggiorno — versamento', ente: 'Comune', dataScadenza: `${anno}-${String(new Date().getMonth() + 2).padStart(2, '0')}-16`, ricorrenza: 'Mensile', note: 'Dove dovuta. A Marcianise non è ancora in vigore — tenere monitorato.' },
  ];
  const daInserire = preset.filter((p) => !gia.has(p.titolo.toLowerCase()));
  for (const p of daInserire) {
    await db.insert(scadenze).values({
      origine: 'Database', titolo: p.titolo, ente: p.ente, data_scadenza: p.dataScadenza,
      ricorrenza: p.ricorrenza as 'Annuale', note: p.note,
    });
    await scriviScadenzaSuFoglio({ titolo: p.titolo, dataScadenza: p.dataScadenza, ricorrenza: p.ricorrenza, ente: p.ente, note: p.note });
  }
  return { aggiunte: daInserire.length };
}
export async function completaScadenza(id: string) {
  const db = getDb();
  const [sc] = await db.select().from(scadenze).where(eq(scadenze.id, id));
  if (!sc) throw new Error('Scadenza non trovata');
  const oggi = oggiISO();
  let nuova = sc.data_scadenza;
  if (sc.ricorrenza !== 'Una tantum') {
    const mesi = sc.ricorrenza === 'Mensile' ? 1 : sc.ricorrenza === 'Semestrale' ? 6 : 12;
    const d = new Date(oggi); d.setMonth(d.getMonth() + mesi);
    nuova = d.toISOString().slice(0, 10);
  }
  const [r] = await db.update(scadenze).set({ ultimo_completamento: oggi, data_scadenza: nuova, aggiornato_il: new Date() }).where(eq(scadenze.id, id)).returning();

  if (r.origine === 'Database') {
    await aggiornaScadenzaSuFoglio({ titolo: r.titolo, dataScadenza: r.data_scadenza, ricorrenza: r.ricorrenza, ente: r.ente, note: r.note, ultimoCompletamento: r.ultimo_completamento });
  }
  return r;
}

export async function confermaPulizia(id: string, addettoId?: string) {
  const db = getDb();
  const [r] = await db.update(pulizie).set({ confermata_il: new Date(), addetto_id: addettoId || null, aggiornato_il: new Date() }).where(eq(pulizie.id, id)).returning();

  const [alloggio] = await db.select({ nome: alloggi.nome }).from(alloggi).where(eq(alloggi.id, r.alloggio_id));
  let operatore: string | null = null;
  if (addettoId) {
    const [u] = await db.select({ nome: utenti.nome }).from(utenti).where(eq(utenti.id, addettoId));
    operatore = u?.nome ?? null;
  }
  await confermaPuliziaSuFoglio({ data: r.data, alloggioNome: alloggio?.nome ?? '', operatore });
  return r;
}

// ── Contratto di gestione ───────────────────────────────────────────────────

async function rigaContrattoGestioneDa(r: typeof contrattiGestione.$inferSelect) {
  const proprietarioNome = await proprietarioNomePerFoglio(r.proprietario_id);
  return { proprietarioNome, dal: r.dal, al: r.al, percentualeFee: Number(r.percentuale_fee), direzioneIncasso: r.direzione_incasso, condizioni: r.condizioni };
}

export async function creaContrattoGestione(d: { proprietarioId: string; dal: string; al?: string; percentualeFee?: number; direzioneIncasso?: string; condizioni?: string }) {
  const db = getDb();
  const [r] = await db.insert(contrattiGestione).values({
    proprietario_id: d.proprietarioId, dal: d.dal, al: d.al || null,
    percentuale_fee: s(d.percentualeFee ?? 0),
    direzione_incasso: d.direzioneIncasso === 'Proprietario' ? 'Proprietario' : 'Gestore',
    condizioni: d.condizioni || null,
  }).returning();
  await scriviContrattoGestioneSuFoglio(await rigaContrattoGestioneDa(r));
  return r;
}
export async function aggiornaContrattoGestione(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const [prima] = await db.select().from(contrattiGestione).where(eq(contrattiGestione.id, id));
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({
    dal: d.dal, al: d.al, condizioni: d.condizioni, direzione_incasso: d.direzioneIncasso,
    percentuale_fee: d.percentualeFee != null ? s(Number(d.percentualeFee)) : undefined,
  })) if (v !== undefined) set[k] = v === '' ? null : v;
  const [r] = await db.update(contrattiGestione).set(set).where(eq(contrattiGestione.id, id)).returning();
  if (prima) {
    const proprietarioNomePrima = await proprietarioNomePerFoglio(prima.proprietario_id);
    await aggiornaContrattoGestioneSuFoglio({ proprietarioNome: proprietarioNomePrima, dal: prima.dal }, await rigaContrattoGestioneDa(r));
  }
  return r;
}

// ── Collaboratori (utenti) — invito + primo accesso ─────────────────────────────────────────
// Il Titolare crea solo nome/ruolo/permessi. Username e password li sceglie la persona stessa
// al primo accesso, usando il codice invito — mai decisi da Raffaele o da Claude per lei.

function generaCodiceInvito(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O/1/I, facile da leggere/dettare
  let c = '';
  for (let i = 0; i < 6; i++) c += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return c;
}

export async function invitaCollaboratore(d: { nome: string; ruolo: string; proprietarioId?: string }) {
  const db = getDb();
  const codice = generaCodiceInvito();
  const [r] = await db.insert(utenti).values({
    nome: d.nome, ruolo: d.ruolo as 'Collaboratore', proprietario_id: d.proprietarioId || null, codice_invito: codice,
  }).returning();
  return r;
}

export async function completaPrimoAccesso(d: { codiceInvito: string; username: string; password: string }) {
  const db = getDb();
  const codice = d.codiceInvito.trim().toUpperCase();
  const username = d.username.trim().toLowerCase();
  if (!username || d.password.length < 8) throw new Error('Username obbligatorio, password di almeno 8 caratteri');
  const [u] = await db.select().from(utenti).where(eq(utenti.codice_invito, codice));
  if (!u) throw new Error('Codice invito non valido o già usato');
  const [giaEsiste] = await db.select({ id: utenti.id }).from(utenti).where(eq(utenti.username, username));
  if (giaEsiste) throw new Error('Username già in uso, scegline un altro');
  const [r] = await db.update(utenti).set({
    username, password_hash: hashPassword(d.password), codice_invito: null, aggiornato_il: new Date(),
  }).where(eq(utenti.id, u.id)).returning();
  return r;
}

export async function leggiUtentiDb() {
  const db = getDb();
  return db.select({
    id: utenti.id, nome: utenti.nome, ruolo: utenti.ruolo, username: utenti.username,
    codiceInvito: utenti.codice_invito, attivo: utenti.attivo, proprietarioId: utenti.proprietario_id,
  }).from(utenti).orderBy(utenti.nome);
}

export async function impostaAttivoUtente(id: string, attivo: boolean) {
  const db = getDb();
  const [r] = await db.update(utenti).set({ attivo, aggiornato_il: new Date() }).where(eq(utenti.id, id)).returning();
  return r;
}

export async function impostaPermessoImmobile(d: { utenteId: string; immobileId: string; puoVedere: boolean; puoModificare: boolean; puoVedereFinanziario: boolean }) {
  const db = getDb();
  await db.insert(permessiImmobile).values({
    utente_id: d.utenteId, immobile_id: d.immobileId,
    puo_vedere: d.puoVedere, puo_modificare: d.puoModificare, puo_vedere_finanziario: d.puoVedereFinanziario,
  }).onConflictDoUpdate({
    target: [permessiImmobile.utente_id, permessiImmobile.immobile_id],
    set: { puo_vedere: d.puoVedere, puo_modificare: d.puoModificare, puo_vedere_finanziario: d.puoVedereFinanziario, aggiornato_il: new Date() },
  });
}

export async function leggiPermessiDb() {
  const db = getDb();
  return db.select().from(permessiImmobile);
}

// ── Check-in ospite (solo dashboard, non sincronizzato col foglio) ─────────────────────────

/** Segna/toglie "ospite arrivato" per una prenotazione — un click, nessun dato aggiuntivo. */
export async function confermaCheckinPrenotazione(id: string) {
  const db = getDb();
  const [attuale] = await db.select({ checkinConfermatoIl: prenotazioni.checkin_confermato_il }).from(prenotazioni).where(eq(prenotazioni.id, id));
  if (!attuale) throw new Error('Prenotazione non trovata');
  const [r] = await db.update(prenotazioni)
    .set({ checkin_confermato_il: attuale.checkinConfermatoIl ? null : new Date(), aggiornato_il: new Date() })
    .where(eq(prenotazioni.id, id)).returning();
  return r;
}

// ── Pulizie (ad-hoc, oltre a quelle importate dal foglio) ──────────────────────────────────

export async function creaPulizia(d: { alloggioId: string; data: string; note?: string; pagata?: boolean; importo?: number }) {
  const db = getDb();
  const [r] = await db.insert(pulizie).values({
    alloggio_id: d.alloggioId, data: d.data, note: d.note || null,
    pagata: !!d.pagata, importo: d.pagata && d.importo ? s(d.importo) : null,
  }).returning();
  return r;
}

export async function eliminaPulizia(id: string) {
  const db = getDb();
  await db.delete(pulizie).where(eq(pulizie.id, id));
}

// ── Blocchi calendario (uso personale/manutenzione, niente ospite/importi) ─────────────────

export async function creaBloccoCalendario(d: { alloggioId: string; checkin: string; checkout: string; nota?: string }) {
  const db = getDb();
  const [r] = await db.insert(blocchiCalendario).values({
    alloggio_id: d.alloggioId, checkin: d.checkin, checkout: d.checkout, nota: d.nota || null,
  }).returning();
  return r;
}

export async function leggiBlocchiCalendario(alloggioId: string) {
  const db = getDb();
  return db.select().from(blocchiCalendario)
    .where(and(eq(blocchiCalendario.alloggio_id, alloggioId), gte(blocchiCalendario.checkout, oggiISO())))
    .orderBy(blocchiCalendario.checkin);
}

export async function eliminaBloccoCalendario(id: string) {
  const db = getDb();
  await db.delete(blocchiCalendario).where(eq(blocchiCalendario.id, id));
}

// ─────────────────────────────────────────────────────────────────────────────
// Vita personale (Motore Rafilu)
// ─────────────────────────────────────────────────────────────────────────────

/** Salva/aggiorna il check-in del giorno (una nota per data, sovrascrive se già presente). */
// Le mutation "Vita personale" (salvaCheckin, creaAbitudine, eliminaAbitudine, segnaAbitudine,
// creaObiettivoTrimestrale, aggiornaStatoObiettivo) sono state spostate in plancia-raffaele
// il 18/09/2026 — la feature era finita per errore in questo progetto. Le tabelle restano in
// schema.ts (stesso database condiviso), ma le mutation vivono ora solo in
// plancia-raffaele/src/lib/db/mutations.ts.

export { nottiTra };
