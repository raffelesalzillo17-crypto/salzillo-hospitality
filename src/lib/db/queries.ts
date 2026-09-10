/**
 * Query di lettura sul database (Neon). Un posto solo per tutte le letture "di dominio",
 * come `src/lib/sheets.ts` lo è per Google Sheets. La logica applicativa (route, cron, bot,
 * UI) chiama queste funzioni e non sa se sotto c'è Postgres o il foglio.
 *
 * Fase 2 del piano — vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md.
 * In Fase 4 i lib esistenti (prenotazioni.ts, ospiti.ts, ...) sceglieranno la fonte in base
 * a una variabile d'ambiente.
 */

import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { getDb } from './index';
import {
  prenotazioni, ospiti, alloggi, immobili, proprietari, spese, categorieSpesa,
  scadenze, pulizie, schedine, pagamenti,
} from './schema';

// ── Prenotazioni ─────────────────────────────────────────────────────────────

export type PrenotazioneVista = {
  id: string;
  checkin: string;   // YYYY-MM-DD
  checkout: string;
  ospite: string;    // "Nome Cognome"
  ospiteId: string;
  telefono: string;
  alloggio: string;  // "Il Tulipano"
  immobile: string;  // "Via Clanio 60"
  proprietario: string;
  canale: string;
  lordo: number;
  commissione: number;
  cedolare: number;
  costoPulizia: number;
  feeGestione: number;
  utile: number;
  nettoProprietario: number;
  stato: string;
  penaleImporto: number | null;
  calendarEventId: string;
  note: string;
};

const n = (v: unknown): number => (v == null ? 0 : Number(v));

function mappaPrenotazione(r: Record<string, unknown>): PrenotazioneVista {
  return {
    id: String(r.id),
    checkin: String(r.checkin),
    checkout: String(r.checkout),
    ospite: `${r.ospite_nome ?? ''} ${r.ospite_cognome ?? ''}`.trim(),
    ospiteId: String(r.ospite_id),
    telefono: String(r.telefono ?? ''),
    alloggio: String(r.alloggio ?? ''),
    immobile: String(r.immobile ?? ''),
    proprietario: String(r.proprietario ?? ''),
    canale: String(r.canale ?? ''),
    lordo: n(r.lordo),
    commissione: n(r.commissione),
    cedolare: n(r.cedolare),
    costoPulizia: n(r.costo_pulizia),
    feeGestione: n(r.fee_gestione),
    utile: n(r.utile),
    nettoProprietario: n(r.netto_proprietario),
    stato: String(r.stato ?? ''),
    penaleImporto: r.penale_importo == null ? null : n(r.penale_importo),
    calendarEventId: String(r.calendar_event_id ?? ''),
    note: String(r.note ?? ''),
  };
}

/** Tutte le prenotazioni, con ospite/alloggio/immobile/proprietario risolti, ordinate per check-in. */
export async function leggiPrenotazioniDb(): Promise<PrenotazioneVista[]> {
  const db = getDb();
  const righe = await db
    .select({
      id: prenotazioni.id,
      checkin: prenotazioni.checkin,
      checkout: prenotazioni.checkout,
      canale: prenotazioni.canale,
      lordo: prenotazioni.lordo,
      commissione: prenotazioni.commissione,
      cedolare: prenotazioni.cedolare,
      costo_pulizia: prenotazioni.costo_pulizia,
      fee_gestione: prenotazioni.fee_gestione,
      utile: prenotazioni.utile,
      netto_proprietario: prenotazioni.netto_proprietario,
      stato: prenotazioni.stato,
      penale_importo: prenotazioni.penale_importo,
      calendar_event_id: prenotazioni.calendar_event_id,
      note: prenotazioni.note,
      ospite_id: prenotazioni.ospite_id,
      ospite_nome: ospiti.nome,
      ospite_cognome: ospiti.cognome,
      telefono: ospiti.telefono,
      alloggio: alloggi.nome,
      immobile: immobili.nome,
      proprietario: proprietari.nome,
    })
    .from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .innerJoin(proprietari, eq(proprietari.id, immobili.proprietario_id))
    .orderBy(prenotazioni.checkin);
  return righe.map((r) => mappaPrenotazione(r as Record<string, unknown>));
}

/** Prenotazioni con check-in o check-out tra due date (incluse) — per digest e promemoria. */
export async function prenotazioniNellaFinestraDb(daISO: string, aISO: string): Promise<PrenotazioneVista[]> {
  const tutte = await leggiPrenotazioniDb();
  return tutte.filter((p) => (p.checkin >= daISO && p.checkin <= aISO) || (p.checkout >= daISO && p.checkout <= aISO));
}

// ── Ospiti ───────────────────────────────────────────────────────────────────

export async function leggiOspitiDb() {
  const db = getDb();
  return db.select().from(ospiti).orderBy(ospiti.cognome, ospiti.nome);
}

export async function ospiteConSoggiorniDb(ospiteId: string) {
  const db = getDb();
  const [o] = await db.select().from(ospiti).where(eq(ospiti.id, ospiteId));
  if (!o) return null;
  const soggiorni = await db
    .select({
      id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout,
      alloggio: alloggi.nome, canale: prenotazioni.canale, stato: prenotazioni.stato, lordo: prenotazioni.lordo,
    })
    .from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(eq(prenotazioni.ospite_id, ospiteId))
    .orderBy(desc(prenotazioni.checkin));
  return { ospite: o, soggiorni };
}

// ── Anagrafica (proprietari / immobili / alloggi) ────────────────────────────

export async function leggiAnagraficaDb() {
  const db = getDb();
  const props = await db.select().from(proprietari).orderBy(proprietari.nome);
  const imms = await db.select().from(immobili);
  const allo = await db.select().from(alloggi);
  return props.map((p) => ({
    ...p,
    immobili: imms.filter((i) => i.proprietario_id === p.id).map((i) => ({
      ...i,
      alloggi: allo.filter((a) => a.immobile_id === i.id),
    })),
  }));
}

/** Elenco alloggi con nome immobile — sostituisce la lista hardcoded di src/lib/strutture.ts. */
export async function leggiAlloggiDb() {
  const db = getDb();
  return db
    .select({
      id: alloggi.id, nome: alloggi.nome, attivo: alloggi.attivo, regimeFiscale: alloggi.regime_fiscale,
      costoPulizia: alloggi.costo_pulizia, haSelfCheckin: alloggi.ha_self_checkin,
      emoji: alloggi.emoji, wifiSsid: alloggi.wifi_ssid, wifiPassword: alloggi.wifi_password,
      checkinGuideUrl: alloggi.checkin_guide_url, trasmetteAlloggiati: alloggi.trasmette_alloggiati,
      impostaSoggiornoComune: alloggi.imposta_soggiorno_comune,
      immobile: immobili.nome, indirizzo: immobili.indirizzo,
    })
    .from(alloggi)
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .orderBy(alloggi.nome);
}

// ── Gestione (spese, scadenze, pulizie) ─────────────────────────────────────

export async function leggiSpeseDb() {
  const db = getDb();
  return db
    .select({
      id: spese.id, data: spese.data, descrizione: spese.descrizione, importo: spese.importo,
      categoria: categorieSpesa.nome, immobile: immobili.nome, note: spese.note,
    })
    .from(spese)
    .innerJoin(categorieSpesa, eq(categorieSpesa.id, spese.categoria_id))
    .leftJoin(immobili, eq(immobili.id, spese.immobile_id))
    .orderBy(desc(spese.data));
}

export async function leggiScadenzeDb() {
  const db = getDb();
  return db
    .select({
      id: scadenze.id, titolo: scadenze.titolo, dataScadenza: scadenze.data_scadenza,
      ricorrenza: scadenze.ricorrenza, note: scadenze.note,
      ultimoCompletamento: scadenze.ultimo_completamento, immobile: immobili.nome,
    })
    .from(scadenze)
    .leftJoin(immobili, eq(immobili.id, scadenze.immobile_id))
    .orderBy(scadenze.data_scadenza);
}

export async function leggiPulizieDb() {
  const db = getDb();
  return db
    .select({
      id: pulizie.id, data: pulizie.data, alloggio: alloggi.nome,
      confermataIl: pulizie.confermata_il, note: pulizie.note,
    })
    .from(pulizie)
    .innerJoin(alloggi, eq(alloggi.id, pulizie.alloggio_id))
    .orderBy(desc(pulizie.data));
}

// ── Riepiloghi (dashboard / rendiconti) ────────────────────────────────────

/** Totali economici del mese (1-12) per immobile — base per la dashboard e i rendiconti. */
export async function riepilogoMeseDb(anno: number, mese: number) {
  const db = getDb();
  const daISO = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const aISO = `${anno}-${String(mese).padStart(2, '0')}-31`;
  return db
    .select({
      immobile: immobili.nome,
      proprietario: proprietari.nome,
      prenotazioni: sql<number>`count(*)::int`,
      lordo: sql<string>`coalesce(sum(${prenotazioni.lordo}),0)`,
      utile: sql<string>`coalesce(sum(${prenotazioni.utile}),0)`,
      nettoProprietario: sql<string>`coalesce(sum(${prenotazioni.netto_proprietario}),0)`,
    })
    .from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .innerJoin(proprietari, eq(proprietari.id, immobili.proprietario_id))
    .where(and(gte(prenotazioni.checkin, daISO), lte(prenotazioni.checkin, aISO), eq(prenotazioni.stato, 'Attiva')))
    .groupBy(immobili.nome, proprietari.nome);
}
