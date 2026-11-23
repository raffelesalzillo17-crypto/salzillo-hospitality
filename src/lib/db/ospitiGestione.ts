/**
 * Gestione della qualità degli ospiti (punto 4 delle richieste, 23/11/2026): ricerca dei duplicati,
 * unione guidata, inversione nome/cognome, segno "di prova".
 *
 * Regole:
 *  - niente si cancella o si unisce da solo: ogni azione parte da un click del Titolare;
 *  - l'unione sposta TUTTO ciò che è agganciato all'ospite (prenotazioni, ospiti di gruppo, schedine,
 *    documenti, preventivi) sul record principale e poi ricontrolla i conteggi;
 *  - il vecchio "nome cognome" resta come alias (tabella ospiti_alias): la sincronizzazione notturna dal
 *    foglio (importDaSheets) lo riconosce e non ricrea il doppione.
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { ospiti, ospitiAlias, prenotazioni, ospitiPrenotazione, schedine, documenti, preventivi, alloggi } from './schema';
import { mettiNelCestino } from './registro';
import { aggiornaOspiteSuFoglio } from './syncFoglio';
import { chiaveNomeFoglio, sembraDiProva, sembraInvertito, trovaGruppiDuplicati } from '../ospitiQualita';

type Conteggi = { prenotazioni: number; ospitiPrenotazione: number; schedine: number; documenti: number; preventivi: number };

async function conteggiPer(id: string): Promise<Conteggi> {
  const db = getDb();
  const n = async (t: typeof prenotazioni | typeof ospitiPrenotazione | typeof schedine | typeof documenti | typeof preventivi) => {
    const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(t as typeof prenotazioni).where(eq((t as typeof prenotazioni).ospite_id, id));
    return Number(r.n);
  };
  return { prenotazioni: await n(prenotazioni), ospitiPrenotazione: await n(ospitiPrenotazione as never), schedine: await n(schedine as never), documenti: await n(documenti as never), preventivi: await n(preventivi as never) };
}
const totale = (c: Conteggi) => c.prenotazioni + c.ospitiPrenotazione + c.schedine + c.documenti + c.preventivi;

export type MembroDuplicato = {
  id: string; nome: string; cognome: string; telefono: string | null; email: string | null; codiceFiscale: string | null;
  valutazione: string; prenotazioni: number; collegati: number; ultimoSoggiorno: string | null; forseInvertito: boolean;
};
export type GruppoDuplicatiVista = { motivi: string[]; principaleSuggerito: string; membri: MembroDuplicato[] };
export type RecordSospetto = { id: string; nome: string; cognome: string; telefono: string | null; motivo: string; collegati: number };

/** Duplicati, nomi forse invertiti e record sospetti. Sola lettura. */
export async function cercaProblemiOspiti(): Promise<{ gruppi: GruppoDuplicatiVista[]; invertiti: MembroDuplicato[]; sospetti: RecordSospetto[] }> {
  const db = getDb();
  const righe = await db.execute(sql`
    select o.id, o.nome, o.cognome, o.telefono, o.email, o.codice_fiscale, o.valutazione::text as valutazione,
      (select count(*) from prenotazioni p where p.ospite_id = o.id)::int as pren,
      (select count(*) from ospiti_prenotazione x where x.ospite_id = o.id)::int
        + (select count(*) from schedine x where x.ospite_id = o.id)::int
        + (select count(*) from documenti x where x.ospite_id = o.id)::int
        + (select count(*) from preventivi x where x.ospite_id = o.id)::int as altri,
      (select max(p.checkin)::text from prenotazioni p where p.ospite_id = o.id and p.stato = 'Attiva') as ultimo
    from ospiti o where o.di_prova = false`);
  type R = { id: string; nome: string; cognome: string; telefono: string | null; email: string | null; codice_fiscale: string | null; valutazione: string; pren: number; altri: number; ultimo: string | null };
  const tutti = righe.rows as unknown as R[];
  const vista = (r: R): MembroDuplicato => ({
    id: r.id, nome: r.nome, cognome: r.cognome, telefono: r.telefono, email: r.email, codiceFiscale: r.codice_fiscale, valutazione: r.valutazione,
    prenotazioni: Number(r.pren), collegati: Number(r.pren) + Number(r.altri), ultimoSoggiorno: r.ultimo, forseInvertito: sembraInvertito(r.nome, r.cognome),
  });
  const perId = new Map(tutti.map((r) => [r.id, r]));

  const gruppi = trovaGruppiDuplicati(tutti.map((r) => ({ id: r.id, nome: r.nome, cognome: r.cognome, telefono: r.telefono }))).map((g) => {
    const membri = g.ids.map((id) => vista(perId.get(id)!)).sort((a, b) => b.collegati - a.collegati || a.cognome.localeCompare(b.cognome));
    return { motivi: g.motivi, principaleSuggerito: membri[0].id, membri };
  });

  const invertiti = tutti.filter((r) => sembraInvertito(r.nome, r.cognome)).map(vista);
  const sospetti: RecordSospetto[] = [];
  for (const r of tutti) {
    const collegati = Number(r.pren) + Number(r.altri);
    if (sembraDiProva(r.nome, r.cognome)) sospetti.push({ id: r.id, nome: r.nome, cognome: r.cognome, telefono: r.telefono, motivo: 'il nome sembra di prova', collegati });
    else if (collegati === 0) sospetti.push({ id: r.id, nome: r.nome, cognome: r.cognome, telefono: r.telefono, motivo: 'non ha prenotazioni, documenti né preventivi', collegati });
  }
  return { gruppi, invertiti, sospetti };
}

export type EsitoUnione = { spostate: { prenotazioni: number; ospitiPrenotazione: number; schedine: number; documenti: number; preventivi: number }; unitiAlPrincipale: number };

/** Unisce uno o più ospiti nel record principale. Tutto ciò che è agganciato passa al principale; poi si ricontrolla il totale. */
export async function unisciOspiti(principaleId: string, daUnire: string[]): Promise<EsitoUnione> {
  const db = getDb();
  const ids = [...new Set(daUnire)].filter((x) => x !== principaleId);
  if (ids.length === 0) throw new Error('Scegli almeno un altro ospite da unire al principale.');
  const [principale] = await db.select().from(ospiti).where(eq(ospiti.id, principaleId));
  if (!principale) throw new Error('Ospite principale non trovato');
  const sorgenti = await db.select().from(ospiti).where(inArray(ospiti.id, ids));
  if (sorgenti.length !== ids.length) throw new Error('Uno degli ospiti da unire non esiste più: ricarica la pagina.');

  const prima = await conteggiPer(principaleId);
  let attesi = totale(prima);
  const spostate: Conteggi = { prenotazioni: 0, ospitiPrenotazione: 0, schedine: 0, documenti: 0, preventivi: 0 };

  for (const s of sorgenti) {
    const c = await conteggiPer(s.id);
    attesi += totale(c);
    for (const k of Object.keys(spostate) as (keyof Conteggi)[]) spostate[k] += c[k];

    // Rete di sicurezza: la riga dell'ospite unito va nel cestino (30 giorni) prima di sparire.
    await mettiNelCestino('ospite', s, `${s.cognome} ${s.nome} (unito a un altro ospite)`.trim());

    // ospiti_prenotazione ha un vincolo (prenotazione, ospite): se il principale è già nella stessa prenotazione, la riga doppia si toglie.
    const giaPresenti = await db.select({ p: ospitiPrenotazione.prenotazione_id }).from(ospitiPrenotazione).where(eq(ospitiPrenotazione.ospite_id, principaleId));
    const doppie = giaPresenti.map((x) => x.p);
    if (doppie.length) {
      const [d] = await db.select({ n: sql<number>`count(*)::int` }).from(ospitiPrenotazione).where(and(eq(ospitiPrenotazione.ospite_id, s.id), inArray(ospitiPrenotazione.prenotazione_id, doppie)));
      attesi -= Number(d.n); // righe di gruppo doppie: si tolgono, non si spostano
    }

    // Campi mancanti sul principale, presi dall'ospite unito. La valutazione peggiore resta (prudenza).
    const completa: Record<string, unknown> = { aggiornato_il: new Date() };
    if (!principale.telefono && s.telefono) { completa.telefono = s.telefono; principale.telefono = s.telefono; }
    if (!principale.email && s.email) { completa.email = s.email; principale.email = s.email; }
    if (!principale.codice_fiscale && s.codice_fiscale) { completa.codice_fiscale = s.codice_fiscale; principale.codice_fiscale = s.codice_fiscale; }
    if (s.note && !(principale.note ?? '').includes(s.note)) { completa.note = [principale.note, s.note].filter(Boolean).join('\n'); principale.note = completa.note as string; }
    if (s.valutazione === 'Problematico' && principale.valutazione !== 'Problematico') { completa.valutazione = 'Problematico'; principale.valutazione = 'Problematico'; }

    await db.batch([
      db.update(prenotazioni).set({ ospite_id: principaleId }).where(eq(prenotazioni.ospite_id, s.id)),
      ...(doppie.length ? [db.delete(ospitiPrenotazione).where(and(eq(ospitiPrenotazione.ospite_id, s.id), inArray(ospitiPrenotazione.prenotazione_id, doppie)))] : []),
      db.update(ospitiPrenotazione).set({ ospite_id: principaleId }).where(eq(ospitiPrenotazione.ospite_id, s.id)),
      db.update(schedine).set({ ospite_id: principaleId }).where(eq(schedine.ospite_id, s.id)),
      db.update(documenti).set({ ospite_id: principaleId }).where(eq(documenti.ospite_id, s.id)),
      db.update(preventivi).set({ ospite_id: principaleId }).where(eq(preventivi.ospite_id, s.id)),
      // alias: i vecchi alias dell'ospite unito e il suo "nome cognome" puntano al principale
      db.update(ospitiAlias).set({ ospite_id: principaleId }).where(eq(ospitiAlias.ospite_id, s.id)),
      db.insert(ospitiAlias).values({ chiave: chiaveNomeFoglio(s.nome, s.cognome), ospite_id: principaleId })
        .onConflictDoUpdate({ target: ospitiAlias.chiave, set: { ospite_id: principaleId } }),
      db.update(ospiti).set(completa).where(eq(ospiti.id, principaleId)),
      db.delete(ospiti).where(eq(ospiti.id, s.id)),
    ] as never);
  }

  // Controllo finale: il principale deve avere ESATTAMENTE tutto ciò che avevano insieme (meno le righe doppie di gruppo).
  const dopo = totale(await conteggiPer(principaleId));
  if (dopo !== attesi) {
    throw new Error(`Controllo finale fallito dopo l'unione (attesi ${attesi}, trovati ${dopo}): controlla l'ospite principale prima di continuare.`);
  }
  try { await aggiornaOspiteSuFoglio({ id: principale.id, nomeCompleto: `${principale.nome} ${principale.cognome}`.trim(), telefono: principale.telefono, codiceFiscale: principale.codice_fiscale, note: principale.note }); }
  catch (e) { console.error('[unisciOspiti] foglio non aggiornato (non bloccante):', e instanceof Error ? e.message : e); }
  return { spostate, unitiAlPrincipale: sorgenti.length };
}

/** Scambia nome e cognome. Il vecchio "nome cognome" resta come alias per la sincronizzazione dal foglio. */
export async function invertiNomeCognome(id: string) {
  const db = getDb();
  const [o] = await db.select().from(ospiti).where(eq(ospiti.id, id));
  if (!o) throw new Error('Ospite non trovato');
  if (!o.cognome.trim()) throw new Error('Questo ospite ha solo il nome: non c\'è niente da invertire.');
  await db.batch([
    db.update(ospiti).set({ nome: o.cognome, cognome: o.nome, aggiornato_il: new Date() }).where(eq(ospiti.id, id)),
    db.insert(ospitiAlias).values({ chiave: chiaveNomeFoglio(o.nome, o.cognome), ospite_id: id }).onConflictDoUpdate({ target: ospitiAlias.chiave, set: { ospite_id: id } }),
  ] as never);
  try { await aggiornaOspiteSuFoglio({ id, nomeCompleto: `${o.cognome} ${o.nome}`.trim(), telefono: o.telefono, codiceFiscale: o.codice_fiscale, note: o.note }); }
  catch (e) { console.error('[invertiNomeCognome] foglio non aggiornato (non bloccante):', e instanceof Error ? e.message : e); }
  return { id, nome: o.cognome, cognome: o.nome };
}

/** Segna (o toglie) il flag "record di prova": nasconde l'ospite da elenchi e ricerche. Non elimina niente. */
export async function segnaOspiteDiProva(id: string, valore: boolean) {
  const [r] = await getDb().update(ospiti).set({ di_prova: valore, aggiornato_il: new Date() }).where(eq(ospiti.id, id)).returning({ id: ospiti.id });
  if (!r) throw new Error('Ospite non trovato');
  return { id, diProva: valore };
}

/** Ospiti segnati di prova (per poterli rivedere e togliere il segno). */
export async function leggiOspitiDiProva() {
  return getDb().select({ id: ospiti.id, nome: ospiti.nome, cognome: ospiti.cognome, telefono: ospiti.telefono }).from(ospiti).where(eq(ospiti.di_prova, true));
}

// Storico dei soggiorni di ogni ospite, per la scheda e per i filtri dell'elenco.
export async function soggiorniPerOspite() {
  const righe = await getDb().select({
    ospiteId: prenotazioni.ospite_id, id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout,
    alloggio: alloggi.nome, canale: prenotazioni.canale, stato: prenotazioni.stato,
  }).from(prenotazioni).innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id)).orderBy(sql`${prenotazioni.checkin} desc`);
  const mappa = new Map<string, { id: string; checkin: string; checkout: string; alloggio: string; canale: string; stato: string }[]>();
  for (const r of righe) { const l = mappa.get(r.ospiteId) ?? []; l.push({ id: r.id, checkin: r.checkin, checkout: r.checkout, alloggio: r.alloggio, canale: r.canale, stato: r.stato }); mappa.set(r.ospiteId, l); }
  return mappa;
}
