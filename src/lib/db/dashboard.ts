/**
 * Dashboard (punto 7 delle richieste, 23/11/2026): riepilogo di tutti gli immobili con indicatori etichettati e
 * "Cosa manca" diviso in blocchi.
 *
 * I numeri economici NON sono ricalcolati qui: vengono dalla stessa funzione dei Rendiconti
 * (rendicontoProprietarioDb), una chiamata per immobile, quindi per costruzione coincidono con i Rendiconti dello stesso
 * mese. Il totale è la somma degli immobili mostrati; con "tutti i proprietari" coincide con il rendiconto generale.
 * Occupazione e prezzo medio sono calcolati qui con definizioni scritte nelle etichette.
 */
import { and, eq, gte, lte, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, blocchiCalendario, immobili, ospiti, pagamenti, prenotazioni, proprietari, pulizie, scadenze } from './schema';
import { rendicontoProprietarioDb } from './queries';

const r2 = (n: number) => Math.round(n * 100) / 100;
const giorniDelMese = (anno: number, mese: number) => new Date(anno, mese, 0).getDate();
const aggiungi = (iso: string, g: number) => new Date(Date.parse(iso) + g * 864e5).toISOString().slice(0, 10);

export type RigaImmobile = {
  immobileId: string; immobile: string; proprietario: string; alloggiAttivi: number; prenotazioni: number;
  lordo: number; commissioni: number; cedolare: number; pulizia: number; nettoProprietario: number; spese: number; nettoDopoSpese: number;
  tassaRiscossa: number; nottiOccupate: number; occupazione: number; nottiPrenotazioni: number; prezzoMedioNotte: number;
};
export type Totali = Omit<RigaImmobile, 'immobileId' | 'immobile' | 'proprietario'>;

export type RiepilogoDashboard = { anno: number; mese: number; immobili: RigaImmobile[]; totali: Totali };

export async function riepilogoDashboard(anno: number, mese: number, proprietarioId: string | null, immobiliAmmessi: string[] | 'tutti'): Promise<RiepilogoDashboard> {
  const db = getDb();
  const da = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const finePiuUno = aggiungi(`${anno}-${String(mese).padStart(2, '0')}-${String(giorniDelMese(anno, mese)).padStart(2, '0')}`, 1);
  const giorni = giorniDelMese(anno, mese);

  const elenco = await db.select({ id: immobili.id, nome: immobili.nome, propId: immobili.proprietario_id, prop: proprietari.nome }).from(immobili)
    .innerJoin(proprietari, eq(proprietari.id, immobili.proprietario_id))
    .where(proprietarioId ? eq(immobili.proprietario_id, proprietarioId) : undefined).orderBy(immobili.nome);
  const visibili = elenco.filter((i) => immobiliAmmessi === 'tutti' || immobiliAmmessi.includes(i.id));

  // prenotazioni attive che toccano il mese (per notti occupate) — una sola lettura
  const tocca = await db.select({ immobile: alloggi.immobile_id, ci: prenotazioni.checkin, co: prenotazioni.checkout })
    .from(prenotazioni).innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(and(eq(prenotazioni.stato, 'Attiva'), lte(prenotazioni.checkin, aggiungi(finePiuUno, -1)), gte(prenotazioni.checkout, da)));
  const attivi = await db.select({ immobile: alloggi.immobile_id, n: sql<number>`count(*)::int` }).from(alloggi).where(eq(alloggi.attivo, true)).groupBy(alloggi.immobile_id);

  const righe: RigaImmobile[] = [];
  for (const i of visibili) {
    const rend = await rendicontoProprietarioDb(i.propId, anno, mese, { immobileId: i.id });
    if (!rend) continue;
    const t = rend.totali;
    let notti = 0;
    for (const p of tocca.filter((x) => x.immobile === i.id)) {
      const da1 = p.ci > da ? p.ci : da, a1 = p.co < finePiuUno ? p.co : finePiuUno;
      notti += Math.max(0, Math.round((Date.parse(a1) - Date.parse(da1)) / 864e5));
    }
    const nAll = attivi.find((a) => a.immobile === i.id)?.n ?? 0;
    const nottiPren = rend.righe.reduce((s, r) => s + Math.max(1, Math.round((Date.parse(r.checkout) - Date.parse(r.checkin)) / 864e5)), 0);
    righe.push({
      immobileId: i.id, immobile: i.nome, proprietario: i.prop, alloggiAttivi: nAll, prenotazioni: t.numPrenotazioni,
      lordo: r2(t.lordo), commissioni: r2(t.commissione), cedolare: r2(t.cedolare), pulizia: r2(t.costoPulizia), nettoProprietario: r2(t.nettoProprietario),
      spese: r2(t.totSpese), nettoDopoSpese: r2(t.nettoFinale), tassaRiscossa: r2(t.impostaSoggiorno),
      nottiOccupate: notti, occupazione: nAll ? Math.round((notti / (nAll * giorni)) * 1000) / 10 : 0,
      nottiPrenotazioni: nottiPren, prezzoMedioNotte: nottiPren ? r2(t.lordo / nottiPren) : 0,
    });
  }

  // totale = somma degli immobili mostrati; occupazione e prezzo medio ricalcolati sui totali, non mediati
  const somma = (k: keyof RigaImmobile) => r2(righe.reduce((s, r) => s + Number(r[k]), 0));
  const alloggiTot = righe.reduce((s, r) => s + r.alloggiAttivi, 0);
  const nottiPrenTot = righe.reduce((s, r) => s + r.nottiPrenotazioni, 0);
  const totali: Totali = {
    alloggiAttivi: alloggiTot, prenotazioni: righe.reduce((s, r) => s + r.prenotazioni, 0),
    lordo: somma('lordo'), commissioni: somma('commissioni'), cedolare: somma('cedolare'), pulizia: somma('pulizia'), nettoProprietario: somma('nettoProprietario'),
    spese: somma('spese'), nettoDopoSpese: somma('nettoDopoSpese'), tassaRiscossa: somma('tassaRiscossa'),
    nottiOccupate: righe.reduce((s, r) => s + r.nottiOccupate, 0),
    occupazione: alloggiTot ? Math.round((righe.reduce((s, r) => s + r.nottiOccupate, 0) / (alloggiTot * giorni)) * 1000) / 10 : 0,
    nottiPrenotazioni: nottiPrenTot, prezzoMedioNotte: nottiPrenTot ? r2(righe.reduce((s, r) => s + r.lordo, 0) / nottiPrenTot) : 0,
  };
  return { anno, mese, immobili: righe, totali };
}

// ── Cosa manca, a blocchi ─────────────────────────────────────────────────────────────────

export type CosaMancaBlocchi = {
  pagamenti: { id: string; ospite: string; alloggio: string; checkin: string; residuo: number }[];
  pulizie: { id: string; data: string; alloggio: string }[];
  scadenze: { id: string; titolo: string; data: string; immobile: string | null }[];
  sovrapposizioni: { alloggio: string; a: string; b: string }[];
};

export async function cosaMancaBlocchi(oggiISO: string, immobiliAmmessi: string[] | 'tutti', vedeFinanziario: boolean): Promise<CosaMancaBlocchi> {
  const db = getDb();
  const tra7 = aggiungi(oggiISO, 7), domani = aggiungi(oggiISO, 1), tra30 = aggiungi(oggiISO, 30);
  const filtroImm = (col: typeof alloggi.immobile_id) => (immobiliAmmessi === 'tutti' ? undefined : inArray(col, immobiliAmmessi.length ? immobiliAmmessi : ['00000000-0000-0000-0000-000000000000']));

  // Pagamenti: prenotazioni dirette con un saldo da incassare, con arrivo entro 7 giorni o già in corso
  let pagamentiRighe: CosaMancaBlocchi['pagamenti'] = [];
  if (vedeFinanziario) {
    const pren = await db.select({ id: prenotazioni.id, lordo: prenotazioni.lordo, checkin: prenotazioni.checkin, alloggio: alloggi.nome, nome: ospiti.nome, cognome: ospiti.cognome })
      .from(prenotazioni).innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id)).innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
      .where(and(eq(prenotazioni.stato, 'Attiva'), sql`${prenotazioni.canale} IN ('Diretto', 'No Tax')`, lte(prenotazioni.checkin, tra7), gte(prenotazioni.checkout, oggiISO), filtroImm(alloggi.immobile_id)))
      .orderBy(prenotazioni.checkin);
    if (pren.length) {
      const pag = await db.select({ p: pagamenti.prenotazione_id, tipo: pagamenti.tipo, importo: pagamenti.importo }).from(pagamenti).where(inArray(pagamenti.prenotazione_id, pren.map((x) => x.id)));
      pagamentiRighe = pren.map((p) => {
        const pagato = pag.filter((x) => x.p === p.id).reduce((s, x) => s + (x.tipo === 'Rimborso' ? -Number(x.importo) : Number(x.importo)), 0);
        return { id: p.id, ospite: `${p.nome} ${p.cognome}`.trim(), alloggio: p.alloggio, checkin: p.checkin, residuo: r2(Number(p.lordo) - pagato) };
      }).filter((x) => x.residuo > 0.5);
    }
  }

  const pulizieRighe = await db.select({ id: pulizie.id, data: pulizie.data, alloggio: alloggi.nome })
    .from(pulizie).innerJoin(alloggi, eq(alloggi.id, pulizie.alloggio_id))
    .where(and(sql`${pulizie.confermata_il} IS NULL`, gte(pulizie.data, oggiISO), lte(pulizie.data, domani), filtroImm(alloggi.immobile_id))).orderBy(pulizie.data);

  const scadRighe = await db.select({ id: scadenze.id, titolo: scadenze.titolo, data: scadenze.data_scadenza, immobile: immobili.nome })
    .from(scadenze).leftJoin(immobili, eq(immobili.id, scadenze.immobile_id))
    .where(and(gte(scadenze.data_scadenza, oggiISO), lte(scadenze.data_scadenza, tra30), immobiliAmmessi === 'tutti' ? undefined : sql`(${scadenze.immobile_id} IS NULL OR ${inArray(scadenze.immobile_id, immobiliAmmessi.length ? immobiliAmmessi : ['00000000-0000-0000-0000-000000000000'])})`))
    .orderBy(scadenze.data_scadenza);

  // Sovrapposizioni: prenotazioni attive e blocchi dello stesso alloggio che si accavallano (da oggi in poi)
  const occ = [
    ...(await db.select({ al: alloggi.nome, alId: prenotazioni.alloggio_id, ci: prenotazioni.checkin, co: prenotazioni.checkout }).from(prenotazioni).innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
      .where(and(eq(prenotazioni.stato, 'Attiva'), gte(prenotazioni.checkout, oggiISO), filtroImm(alloggi.immobile_id)))).map((x) => ({ ...x, tipo: 'prenotazione' })),
    ...(await db.select({ al: alloggi.nome, alId: blocchiCalendario.alloggio_id, ci: blocchiCalendario.checkin, co: blocchiCalendario.checkout }).from(blocchiCalendario).innerJoin(alloggi, eq(alloggi.id, blocchiCalendario.alloggio_id))
      .where(and(gte(blocchiCalendario.checkout, oggiISO), filtroImm(alloggi.immobile_id)))).map((x) => ({ ...x, tipo: 'blocco' })),
  ];
  const sov: CosaMancaBlocchi['sovrapposizioni'] = [];
  for (let i = 0; i < occ.length; i++) for (let j = i + 1; j < occ.length; j++) {
    const a = occ[i], b = occ[j];
    if (a.alId === b.alId && a.ci < b.co && b.ci < a.co) sov.push({ alloggio: a.al, a: `${a.tipo} ${a.ci}→${a.co}`, b: `${b.tipo} ${b.ci}→${b.co}` });
  }
  return { pagamenti: pagamentiRighe, pulizie: pulizieRighe, scadenze: scadRighe, sovrapposizioni: sov };
}
