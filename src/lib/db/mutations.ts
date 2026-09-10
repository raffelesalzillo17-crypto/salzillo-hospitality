/**
 * Scritture sul database (Neon). Contraltare di queries.ts.
 * Ogni record creato qui ha origine='Database' → il sync da Google Sheets NON lo tocca.
 *
 * Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md.
 */

import { and, eq, isNull, lte, gte, or, sql } from 'drizzle-orm';
import { getDb } from './index';
import {
  proprietari, immobili, alloggi, ospiti, prenotazioni, pagamenti, spese, scadenze,
  pulizie, contrattiGestione, preventivi,
} from './schema';
import { creaEventoPrenotazione, eliminaEventoPrenotazione } from './calendario';

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

export async function creaProprietario(d: { nome: string; tipo?: string; codiceFiscalePiva?: string; email?: string; telefono?: string; iban?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(proprietari).values({
    nome: d.nome.trim(), tipo: (d.tipo as 'Persona fisica') || 'Persona fisica',
    codice_fiscale_piva: d.codiceFiscalePiva || null, email: d.email || null,
    telefono: d.telefono || null, iban: d.iban || null, note: d.note || null,
  }).returning();
  return r;
}
export async function aggiornaProprietario(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ nome: d.nome, tipo: d.tipo, codice_fiscale_piva: d.codiceFiscalePiva, email: d.email, telefono: d.telefono, iban: d.iban, note: d.note })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(proprietari).set(set).where(eq(proprietari.id, id)).returning();
  return r;
}

export async function creaImmobile(d: { proprietarioId: string; nome: string; indirizzo: string; comune: string; provincia: string; cin?: string; cir?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(immobili).values({
    proprietario_id: d.proprietarioId, nome: d.nome.trim(), indirizzo: d.indirizzo.trim(),
    comune: d.comune.trim(), provincia: d.provincia.trim().toUpperCase(),
    cin: d.cin || null, cir: d.cir || null, note: d.note || null,
  }).returning();
  return r;
}
export async function aggiornaImmobile(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ nome: d.nome, indirizzo: d.indirizzo, comune: d.comune, provincia: d.provincia, cin: d.cin, cir: d.cir, note: d.note, proprietario_id: d.proprietarioId })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(immobili).set(set).where(eq(immobili.id, id)).returning();
  return r;
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
  return r;
}

// ── Ospiti ───────────────────────────────────────────────────────────────────

export async function creaOspite(d: { nome: string; cognome: string; telefono?: string; email?: string; codiceFiscale?: string; valutazione?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(ospiti).values({
    nome: d.nome.trim(), cognome: d.cognome.trim(), telefono: d.telefono || null, email: d.email || null,
    codice_fiscale: d.codiceFiscale || null, valutazione: (d.valutazione as 'Neutro') || 'Neutro', note: d.note || null,
  }).returning();
  return r;
}
export async function aggiornaOspite(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({ nome: d.nome, cognome: d.cognome, telefono: d.telefono, email: d.email, codice_fiscale: d.codiceFiscale, valutazione: d.valutazione, note: d.note })) if (v !== undefined) set[k] = v || null;
  const [r] = await db.update(ospiti).set(set).where(eq(ospiti.id, id)).returning();
  return r;
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
  return r;
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
  return r;
}

export async function cancellaPrenotazione(id: string, conPenale: boolean, importoPenale?: number) {
  const db = getDb();
  const [attuale] = await db.select({ eventId: prenotazioni.calendar_event_id, alloggioId: prenotazioni.alloggio_id }).from(prenotazioni).where(eq(prenotazioni.id, id));
  if (attuale?.eventId) {
    const [im] = await db.select({ calendarId: immobili.calendar_id }).from(alloggi).innerJoin(immobili, eq(immobili.id, alloggi.immobile_id)).where(eq(alloggi.id, attuale.alloggioId));
    await eliminaEventoPrenotazione(im?.calendarId ?? null, attuale.eventId);
  }
  const [r] = await db.update(prenotazioni).set({
    stato: conPenale ? 'Cancellata con penale' : 'Cancellata',
    penale_importo: conPenale && importoPenale ? s(importoPenale) : null,
    calendar_event_id: null,
    aggiornato_il: new Date(),
  }).where(eq(prenotazioni.id, id)).returning();
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
  return r;
}

export async function aggiornaStatoPreventivo(id: string, stato: string) {
  const db = getDb();
  const set: Record<string, unknown> = { stato: stato as 'Bozza', aggiornato_il: new Date() };
  if (stato === 'Inviato') set.inviato_il = new Date();
  const [r] = await db.update(preventivi).set(set).where(eq(preventivi.id, id)).returning();
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
  return { preventivo: r, prenotazione: pren };
}

// ── Pagamenti ────────────────────────────────────────────────────────────────

export async function aggiungiPagamento(d: { prenotazioneId: string; tipo: string; importo: number; data?: string; metodo?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(pagamenti).values({
    prenotazione_id: d.prenotazioneId, tipo: d.tipo as 'Caparra', importo: s(d.importo),
    data: d.data || oggiISO(), metodo: (d.metodo as 'Bonifico') || null, note: d.note || null,
  }).returning();
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
  return r;
}

export async function creaScadenza(d: { immobileId?: string; titolo: string; dataScadenza: string; ricorrenza?: string; note?: string }) {
  const db = getDb();
  const [r] = await db.insert(scadenze).values({
    origine: 'Database', immobile_id: d.immobileId || null, titolo: d.titolo.trim(),
    data_scadenza: d.dataScadenza, ricorrenza: (d.ricorrenza as 'Una tantum') || 'Una tantum', note: d.note || null,
  }).returning();
  return r;
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
  return r;
}

export async function confermaPulizia(id: string, addettoId?: string) {
  const db = getDb();
  const [r] = await db.update(pulizie).set({ confermata_il: new Date(), addetto_id: addettoId || null, aggiornato_il: new Date() }).where(eq(pulizie.id, id)).returning();
  return r;
}

// ── Contratto di gestione ───────────────────────────────────────────────────

export async function creaContrattoGestione(d: { proprietarioId: string; dal: string; al?: string; percentualeFee?: number; direzioneIncasso?: string; condizioni?: string }) {
  const db = getDb();
  const [r] = await db.insert(contrattiGestione).values({
    proprietario_id: d.proprietarioId, dal: d.dal, al: d.al || null,
    percentuale_fee: s(d.percentualeFee ?? 0),
    direzione_incasso: d.direzioneIncasso === 'Proprietario' ? 'Proprietario' : 'Gestore',
    condizioni: d.condizioni || null,
  }).returning();
  return r;
}
export async function aggiornaContrattoGestione(id: string, d: Record<string, unknown>) {
  const db = getDb();
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const [k, v] of Object.entries({
    dal: d.dal, al: d.al, condizioni: d.condizioni, direzione_incasso: d.direzioneIncasso,
    percentuale_fee: d.percentualeFee != null ? s(Number(d.percentualeFee)) : undefined,
  })) if (v !== undefined) set[k] = v === '' ? null : v;
  const [r] = await db.update(contrattiGestione).set(set).where(eq(contrattiGestione.id, id)).returning();
  return r;
}

export { nottiTra };
