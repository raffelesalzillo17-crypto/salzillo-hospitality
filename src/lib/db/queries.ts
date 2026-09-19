/**
 * Query di lettura sul database (Neon). Un posto solo per tutte le letture "di dominio",
 * come `src/lib/sheets.ts` lo è per Google Sheets. La logica applicativa (route, cron, bot,
 * UI) chiama queste funzioni e non sa se sotto c'è Postgres o il foglio.
 *
 * Fase 2 del piano — vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md.
 * In Fase 4 i lib esistenti (prenotazioni.ts, ospiti.ts, ...) sceglieranno la fonte in base
 * a una variabile d'ambiente.
 */

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from './index';
import {
  prenotazioni, ospiti, alloggi, immobili, proprietari, spese, categorieSpesa,
  scadenze, pulizie, schedine, pagamenti, preventivi, eventiLocali, prezziPeriodo, utenti, documenti,
  richiestePubbliche,
} from './schema';

/** Primo e ultimo giorno (inclusi) di un mese, in formato YYYY-MM-DD. */
function estremiMese(anno: number, mese: number): [string, string] {
  const primo = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const ultGiorno = new Date(anno, mese, 0).getDate(); // giorno 0 del mese dopo = ultimo del mese
  const ultimo = `${anno}-${String(mese).padStart(2, '0')}-${String(ultGiorno).padStart(2, '0')}`;
  return [primo, ultimo];
}

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
  numeroOspiti: number;
  origine: string;
  penaleImporto: number | null;
  calendarEventId: string;
  checkinConfermatoIl: string | null;
  note: string;
  pagamenti: { id: string; tipo: string; importo: number; data: string; metodo: string | null }[];
};

const n = (v: unknown): number => (v == null ? 0 : Number(v));

function mappaPrenotazione(r: Record<string, unknown>, pagamentiRiga: PrenotazioneVista['pagamenti'] = []): PrenotazioneVista {
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
    numeroOspiti: n(r.numero_ospiti) || 1,
    origine: String(r.origine ?? 'Database'),
    penaleImporto: r.penale_importo == null ? null : n(r.penale_importo),
    calendarEventId: String(r.calendar_event_id ?? ''),
    checkinConfermatoIl: r.checkin_confermato_il ? new Date(r.checkin_confermato_il as string | Date).toISOString() : null,
    note: String(r.note ?? ''),
    pagamenti: pagamentiRiga,
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
      numero_ospiti: prenotazioni.numero_ospiti,
      origine: prenotazioni.origine,
      penale_importo: prenotazioni.penale_importo,
      calendar_event_id: prenotazioni.calendar_event_id,
      checkin_confermato_il: prenotazioni.checkin_confermato_il,
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

  const righePag = await db.select({
    id: pagamenti.id, prenotazione_id: pagamenti.prenotazione_id, tipo: pagamenti.tipo,
    importo: pagamenti.importo, data: pagamenti.data, metodo: pagamenti.metodo,
  }).from(pagamenti);
  const pagamentiPerPren = new Map<string, PrenotazioneVista['pagamenti']>();
  for (const p of righePag) {
    const lista = pagamentiPerPren.get(p.prenotazione_id) ?? [];
    lista.push({ id: p.id, tipo: p.tipo, importo: n(p.importo), data: p.data, metodo: p.metodo });
    pagamentiPerPren.set(p.prenotazione_id, lista);
  }

  return righe.map((r) => mappaPrenotazione(r as Record<string, unknown>, pagamentiPerPren.get(String(r.id)) ?? []));
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

/** Elenco preventivi (per la sezione Documenti). Più recenti prima. */
export async function leggiPreventiviDb() {
  const db = getDb();
  return db
    .select({
      id: preventivi.id, codice: preventivi.codice, stato: preventivi.stato,
      checkin: preventivi.checkin, checkout: preventivi.checkout, numeroOspiti: preventivi.numero_ospiti,
      prezzoNotte: preventivi.prezzo_notte, totalePieno: preventivi.totale_pieno,
      sconto: preventivi.sconto, scontoTipo: preventivi.sconto_tipo, totale: preventivi.totale,
      validoOre: preventivi.valido_ore, note: preventivi.note,
      creatoIl: preventivi.creato_il, inviatoIl: preventivi.inviato_il, accettatoIl: preventivi.accettato_il,
      prenotazioneId: preventivi.prenotazione_id,
      alloggioId: preventivi.alloggio_id, alloggio: alloggi.nome, immobile: immobili.nome,
      ospiteId: preventivi.ospite_id, ospiteNome: ospiti.nome, ospiteCognome: ospiti.cognome, ospiteTelefono: ospiti.telefono,
    })
    .from(preventivi)
    .innerJoin(alloggi, eq(alloggi.id, preventivi.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .leftJoin(ospiti, eq(ospiti.id, preventivi.ospite_id))
    .orderBy(desc(preventivi.creato_il));
}

/** Richieste dal sito vetrina non ancora trasformate in preventivo (stato 'Nuova'). */
export async function richiesteNuoveDb() {
  const db = getDb();
  return db
    .select({
      id: richiestePubbliche.id, checkin: richiestePubbliche.checkin, checkout: richiestePubbliche.checkout,
      numeroOspiti: richiestePubbliche.numero_ospiti, nome: richiestePubbliche.nome, telefono: richiestePubbliche.telefono,
      note: richiestePubbliche.note, creatoIl: richiestePubbliche.creato_il,
      alloggioId: richiestePubbliche.alloggio_id, alloggio: alloggi.nome,
    })
    .from(richiestePubbliche)
    .innerJoin(alloggi, eq(alloggi.id, richiestePubbliche.alloggio_id))
    .where(eq(richiestePubbliche.stato, 'Nuova'))
    .orderBy(desc(richiestePubbliche.creato_il));
}

// Le query "Vita personale" (checkinRecentiDb, abitudiniConLogDb, obiettiviTrimestraliDb)
// sono state spostate in plancia-raffaele il 18/09/2026 — la feature era finita per errore
// in questo progetto. Le tabelle restano in schema.ts (stesso database condiviso), ma le
// query vivono ora solo in plancia-raffaele/src/lib/db/queries.ts.

/** Documenti veri salvati su Drive (contratti, ricevute...) — per la scheda Documenti,
 *  accanto ai preventivi. Solo quelli generati dopo il 13/09/2026: vedi registraDocumento
 *  in src/lib/documenti.ts. */
export async function leggiDocumentiDb() {
  const db = getDb();
  return db
    .select({
      id: documenti.id, tipo: documenti.tipo, nome: documenti.nome,
      ospiteId: documenti.ospite_id, prenotazioneId: documenti.prenotazione_id,
      driveUrl: documenti.drive_url, caricatoIl: documenti.caricato_il,
    })
    .from(documenti)
    .orderBy(desc(documenti.caricato_il));
}

/** Un preventivo con i dati che servono al PDF. */
export async function preventivoPerPdf(id: string) {
  const db = getDb();
  const [p] = await db
    .select({
      alloggioId: preventivi.alloggio_id, checkin: preventivi.checkin, checkout: preventivi.checkout,
      numeroOspiti: preventivi.numero_ospiti, prezzoNotte: preventivi.prezzo_notte,
      sconto: preventivi.sconto, scontoTipo: preventivi.sconto_tipo, validoOre: preventivi.valido_ore,
      note: preventivi.note, codice: preventivi.codice,
      ospiteNome: ospiti.nome, ospiteCognome: ospiti.cognome, ospiteTelefono: ospiti.telefono,
    })
    .from(preventivi)
    .leftJoin(ospiti, eq(ospiti.id, preventivi.ospite_id))
    .where(eq(preventivi.id, id));
  return p ?? null;
}

/** Eventi locali futuri o in corso (sagre, fiere...) per decidere i prezzi. */
export async function leggiEventiLocaliDb() {
  const oggi = new Date().toISOString().slice(0, 10);
  return getDb().select().from(eventiLocali).where(gte(eventiLocali.al, oggi)).orderBy(eventiLocali.dal);
}

/** Prezzi consigliati per periodo (con nome alloggio; null = tutti). */
export async function leggiPrezziPeriodoDb() {
  const oggi = new Date().toISOString().slice(0, 10);
  return getDb()
    .select({
      id: prezziPeriodo.id, dal: prezziPeriodo.dal, al: prezziPeriodo.al,
      prezzoNotte: prezziPeriodo.prezzo_notte, note: prezziPeriodo.note,
      alloggioId: prezziPeriodo.alloggio_id, alloggio: alloggi.nome,
    })
    .from(prezziPeriodo)
    .leftJoin(alloggi, eq(alloggi.id, prezziPeriodo.alloggio_id))
    .where(gte(prezziPeriodo.al, oggi))
    .orderBy(prezziPeriodo.dal);
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

export async function leggiCategorieSpesaDb() {
  const db = getDb();
  return db.select({ id: categorieSpesa.id, nome: categorieSpesa.nome }).from(categorieSpesa).where(eq(categorieSpesa.attiva, true)).orderBy(categorieSpesa.nome);
}

export async function leggiScadenzeDb() {
  const db = getDb();
  return db
    .select({
      id: scadenze.id, titolo: scadenze.titolo, ente: scadenze.ente, dataScadenza: scadenze.data_scadenza,
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
      id: pulizie.id, data: pulizie.data, alloggioId: pulizie.alloggio_id, alloggio: alloggi.nome,
      confermataIl: pulizie.confermata_il, note: pulizie.note, origine: pulizie.origine,
      addettoNome: utenti.nome, prenotazioneId: pulizie.prenotazione_id,
      pagata: pulizie.pagata, importo: pulizie.importo,
    })
    .from(pulizie)
    .innerJoin(alloggi, eq(alloggi.id, pulizie.alloggio_id))
    .leftJoin(utenti, eq(utenti.id, pulizie.addetto_id))
    .orderBy(desc(pulizie.data));
}

// ── Riepiloghi (dashboard / rendiconti) ────────────────────────────────────

/** Sintesi sintetica di un mese (n° prenotazioni, lordo, netto proprietario) — per i confronti. */
async function sintesiRendiconto(
  db: ReturnType<typeof getDb>, proprietarioId: string, anno: number, mese: number,
  ambito: { immobileId?: string; alloggioId?: string } | undefined, stati: string[],
) {
  const [daISO, aISO] = estremiMese(anno, mese);
  const conds = [
    eq(immobili.proprietario_id, proprietarioId),
    gte(prenotazioni.checkin, daISO), lte(prenotazioni.checkin, aISO),
    inArray(prenotazioni.stato, stati as never[]),
  ];
  if (ambito?.immobileId) conds.push(eq(immobili.id, ambito.immobileId));
  if (ambito?.alloggioId) conds.push(eq(alloggi.id, ambito.alloggioId));
  const [row] = await db
    .select({
      n: sql<number>`count(*)::int`.as('n'),
      lordo: sql<number>`coalesce(sum(${prenotazioni.lordo}), 0)`.as('lordo'),
      nettoProprietario: sql<number>`coalesce(sum(${prenotazioni.netto_proprietario}), 0)`.as('netto_proprietario'),
    })
    .from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .where(and(...conds));
  return {
    prenotazioni: Number(row?.n ?? 0),
    lordo: Math.round(Number(row?.lordo ?? 0) * 100) / 100,
    nettoProprietario: Math.round(Number(row?.nettoProprietario ?? 0) * 100) / 100,
  };
}

/** Rendiconto di un proprietario per un mese: le prenotazioni con check-in in quel mese,
 *  la cascata economica per ciascuna, i totali, i confronti (mese scorso, stesso mese anno
 *  scorso) e la previsione per il mese successivo. Base per il PDF e la pagina proprietario.
 *  `ambito` opzionale: limita a un singolo immobile o a un singolo alloggio del proprietario. */
export async function rendicontoProprietarioDb(
  proprietarioId: string, anno: number, mese: number,
  ambito?: { immobileId?: string; alloggioId?: string },
) {
  const db = getDb();
  const [daISO, aISO] = estremiMese(anno, mese);
  const [prop] = await db.select().from(proprietari).where(eq(proprietari.id, proprietarioId));
  if (!prop) return null;

  // etichetta dell'ambito + immobile di riferimento per filtrare le spese
  let ambitoEtichetta = 'Tutti gli immobili';
  let speseImmobileId: string | undefined;
  if (ambito?.alloggioId) {
    const [al] = await db.select({ nome: alloggi.nome, immNome: immobili.nome, immId: immobili.id })
      .from(alloggi).innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
      .where(eq(alloggi.id, ambito.alloggioId));
    if (al) { ambitoEtichetta = `${al.nome} — ${al.immNome}`; speseImmobileId = al.immId; }
  } else if (ambito?.immobileId) {
    const [im] = await db.select({ nome: immobili.nome }).from(immobili).where(eq(immobili.id, ambito.immobileId));
    if (im) { ambitoEtichetta = im.nome; speseImmobileId = ambito.immobileId; }
  }

  const righeConds = [
    eq(immobili.proprietario_id, proprietarioId),
    gte(prenotazioni.checkin, daISO), lte(prenotazioni.checkin, aISO),
    eq(prenotazioni.stato, 'Attiva'),
  ];
  if (ambito?.immobileId) righeConds.push(eq(immobili.id, ambito.immobileId));
  if (ambito?.alloggioId) righeConds.push(eq(alloggi.id, ambito.alloggioId));

  const righe = await db
    .select({
      id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout,
      alloggio: alloggi.nome, immobile: immobili.nome, canale: prenotazioni.canale,
      numeroOspiti: prenotazioni.numero_ospiti,
      lordo: prenotazioni.lordo, commissione: prenotazioni.commissione, cedolare: prenotazioni.cedolare,
      costoPulizia: prenotazioni.costo_pulizia, feeGestione: prenotazioni.fee_gestione,
      utile: prenotazioni.utile, nettoProprietario: prenotazioni.netto_proprietario,
      ospiteNome: ospiti.nome, ospiteCognome: ospiti.cognome,
      impostaSoggiornoImporto: alloggi.imposta_soggiorno_importo, impostaSoggiornoMaxNotti: alloggi.imposta_soggiorno_max_notti,
    })
    .from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(and(...righeConds))
    .orderBy(prenotazioni.checkin);

  const speseConds = [eq(immobili.proprietario_id, proprietarioId), gte(spese.data, daISO), lte(spese.data, aISO)];
  if (speseImmobileId) speseConds.push(eq(immobili.id, speseImmobileId));
  const speseRighe = await db
    .select({ id: spese.id, data: spese.data, descrizione: spese.descrizione, importo: spese.importo, categoria: categorieSpesa.nome, immobile: immobili.nome })
    .from(spese)
    .innerJoin(categorieSpesa, eq(categorieSpesa.id, spese.categoria_id))
    .innerJoin(immobili, eq(immobili.id, spese.immobile_id))
    .where(and(...speseConds));

  // imposta di soggiorno per prenotazione: notti (cap max) × persone × importo/persona/notte
  const nottiDi = (ci: string, co: string) => Math.max(1, Math.round((Date.parse(co) - Date.parse(ci)) / 864e5));
  const impostaDi = (r: typeof righe[number]) => {
    const imp = Number(r.impostaSoggiornoImporto);
    if (!imp) return 0;
    let notti = nottiDi(r.checkin, r.checkout);
    if (r.impostaSoggiornoMaxNotti) notti = Math.min(notti, r.impostaSoggiornoMaxNotti);
    return Math.round(notti * r.numeroOspiti * imp * 100) / 100;
  };

  const t = righe.reduce((s, r) => ({
    lordo: s.lordo + Number(r.lordo), commissione: s.commissione + Number(r.commissione),
    cedolare: s.cedolare + Number(r.cedolare), costoPulizia: s.costoPulizia + Number(r.costoPulizia),
    feeGestione: s.feeGestione + Number(r.feeGestione), utile: s.utile + Number(r.utile),
    nettoProprietario: s.nettoProprietario + Number(r.nettoProprietario),
    impostaSoggiorno: s.impostaSoggiorno + impostaDi(r),
  }), { lordo: 0, commissione: 0, cedolare: 0, costoPulizia: 0, feeGestione: 0, utile: 0, nettoProprietario: 0, impostaSoggiorno: 0 });
  const totSpese = speseRighe.reduce((s, r) => s + Number(r.importo), 0);

  // ── Confronti e previsione ──────────────────────────────────────────────
  const [mesePrec, annoMesePrec] = mese === 1 ? [12, anno - 1] : [mese - 1, anno];
  const [mesePros, annoMesePros] = mese === 12 ? [1, anno + 1] : [mese + 1, anno];
  const ATTIVE = ['Attiva'];
  const ACQUISITE = ['Attiva', 'In attesa di conferma'];

  const [meseScorso, annoScorso, previstoAcquisito, previstoStorico] = await Promise.all([
    sintesiRendiconto(db, proprietarioId, annoMesePrec, mesePrec, ambito, ATTIVE),
    sintesiRendiconto(db, proprietarioId, anno - 1, mese, ambito, ATTIVE),
    sintesiRendiconto(db, proprietarioId, annoMesePros, mesePros, ambito, ACQUISITE),
    sintesiRendiconto(db, proprietarioId, annoMesePros - 1, mesePros, ambito, ATTIVE),
  ]);

  const nettoFinale = Math.round((t.nettoProprietario - totSpese) * 100) / 100;

  return {
    proprietario: prop.nome, anno, mese,
    ambito: {
      etichetta: ambitoEtichetta,
      tipo: ambito?.alloggioId ? 'alloggio' : ambito?.immobileId ? 'immobile' : 'tutto',
      immobileId: ambito?.immobileId ?? null, alloggioId: ambito?.alloggioId ?? null,
    },
    righe: righe.map((r) => ({ ...r, ospite: `${r.ospiteNome} ${r.ospiteCognome}`.trim(), impostaSoggiorno: impostaDi(r) })),
    spese: speseRighe,
    totali: { ...t, totSpese, nettoFinale, numPrenotazioni: righe.length },
    confronti: {
      meseScorso: { anno: annoMesePrec, mese: mesePrec, ...meseScorso },
      annoScorso: { anno: anno - 1, mese, ...annoScorso },
      previsione: {
        anno: annoMesePros, mese: mesePros,
        acquisito: previstoAcquisito,
        annoScorso: previstoStorico,
      },
    },
  };
}

/** Cose da fare / che mancano — alimenta la sezione "cosa manca" della dashboard. */
export async function cosaMancaDb(oggiISO: string) {
  const db = getDb();
  const fra14 = new Date(Date.parse(oggiISO) + 14 * 864e5).toISOString().slice(0, 10);

  const schedineDaInviare = await db
    .select({ id: schedine.id, cognome: schedine.cognome, nome: schedine.nome, scadeIl: schedine.scade_il, alloggio: alloggi.nome })
    .from(schedine)
    .innerJoin(prenotazioni, eq(prenotazioni.id, schedine.prenotazione_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(eq(schedine.stato, 'Da inviare'));

  const scadenzeVicine = await db
    .select({ id: scadenze.id, titolo: scadenze.titolo, dataScadenza: scadenze.data_scadenza, immobile: immobili.nome })
    .from(scadenze)
    .leftJoin(immobili, eq(immobili.id, scadenze.immobile_id))
    .where(and(gte(scadenze.data_scadenza, oggiISO), lte(scadenze.data_scadenza, fra14)))
    .orderBy(scadenze.data_scadenza);

  const pulizieDaFare = await db
    .select({ id: pulizie.id, data: pulizie.data, alloggio: alloggi.nome })
    .from(pulizie)
    .innerJoin(alloggi, eq(alloggi.id, pulizie.alloggio_id))
    .where(and(sql`${pulizie.confermata_il} IS NULL`, lte(pulizie.data, fra14)));

  // pagamenti: prenotazioni Diretto/No Tax attive senza saldo completo (semplificato: nessun pagamento registrato)
  const senzaPagamento = await db
    .select({ id: prenotazioni.id, ospite: sql<string>`${ospiti.nome} || ' ' || ${ospiti.cognome}`.as('ospite'), checkin: prenotazioni.checkin, lordo: prenotazioni.lordo, alloggio: alloggi.nome })
    .from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .leftJoin(pagamenti, eq(pagamenti.prenotazione_id, prenotazioni.id))
    .where(and(
      eq(prenotazioni.stato, 'Attiva'),
      sql`${prenotazioni.canale} IN ('Diretto', 'No Tax')`,
      gte(prenotazioni.checkin, oggiISO),
      sql`${pagamenti.id} IS NULL`,
    ));

  return { schedineDaInviare, scadenzeVicine, pulizieDaFare, pagamentiInSospeso: senzaPagamento };
}

/** Totali economici del mese (1-12) per immobile — base per la dashboard e i rendiconti. */
export async function riepilogoMeseDb(anno: number, mese: number) {
  const db = getDb();
  const [daISO, aISO] = estremiMese(anno, mese);
  return db
    .select({
      immobile: immobili.nome,
      proprietario: proprietari.nome,
      prenotazioni: sql<number>`count(*)::int`.as('prenotazioni'),
      lordo: sql<string>`coalesce(sum(${prenotazioni.lordo}),0)`.as('lordo'),
      utile: sql<string>`coalesce(sum(${prenotazioni.utile}),0)`.as('utile'),
      nettoProprietario: sql<string>`coalesce(sum(${prenotazioni.netto_proprietario}),0)`.as('netto_proprietario'),
    })
    .from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .innerJoin(proprietari, eq(proprietari.id, immobili.proprietario_id))
    .where(and(gte(prenotazioni.checkin, daISO), lte(prenotazioni.checkin, aISO), eq(prenotazioni.stato, 'Attiva')))
    .groupBy(immobili.nome, proprietari.nome);
}
