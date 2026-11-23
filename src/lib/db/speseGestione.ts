/**
 * Spese e conti per il commercialista (punto 12 delle richieste, 23/11/2026): import da estratto conto,
 * ricevute allegate, spese ricorrenti, eliminazione con cestino.
 */
import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, categorieSpesa, documenti, immobili, spese, speseRicorrenti } from './schema';
import { mettiNelCestino } from './registro';
import { salvaFileSpesa } from '../documenti';
import { chiaveImport, dateDaGenerare, suggerisciCategoria, type Frequenza, type RigaEstratto, FREQUENZE } from '../estrattoConto';

const s2 = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const METODI = ['Bonifico', 'Contanti', 'Carta', 'Piattaforma'];

export type RigaAnteprima = RigaEstratto & { categoriaId: string | null; motivoCategoria: string; doppia: boolean };

/** Per ogni uscita dell'estratto: categoria suggerita e se è già stata importata/registrata. Sola lettura. */
export async function anteprimaEstratto(righe: RigaEstratto[]): Promise<{ righe: RigaAnteprima[]; categorie: { id: string; nome: string }[] }> {
  const db = getDb();
  const categorie = await db.select({ id: categorieSpesa.id, nome: categorieSpesa.nome }).from(categorieSpesa).where(eq(categorieSpesa.attiva, true)).orderBy(categorieSpesa.nome);
  const storico = (await db.select({ descrizione: spese.descrizione, categoriaId: spese.categoria_id }).from(spese)).slice(-500);
  const esistenti = await db.select({ chiave: spese.chiave_import, data: spese.data, importo: spese.importo }).from(spese);
  const chiavi = new Set(esistenti.map((e) => e.chiave).filter(Boolean));
  const dataImporto = new Set(esistenti.map((e) => `${e.data}|${Number(e.importo).toFixed(2)}`));
  return {
    categorie,
    righe: righe.slice(0, 1000).map((r) => {
      const sug = suggerisciCategoria(r.descrizione, storico, categorie);
      // "Doppia" = stessa impronta già importata, oppure già c'è una spesa con stessa data e importo (l'utente decide)
      const doppia = chiavi.has(chiaveImport(r.data, r.importo, r.descrizione)) || dataImporto.has(`${r.data}|${r.importo.toFixed(2)}`);
      return { ...r, categoriaId: sug.categoriaId, motivoCategoria: sug.motivo, doppia };
    }),
  };
}

export type RigaDaImportare = { data: string; descrizione: string; importo: number; categoriaId: string; immobileId?: string; alloggioId?: string; metodo?: string };

/** Inserisce le righe confermate. Una riga già importata (stessa impronta) viene saltata, mai duplicata. */
export async function importaSpese(righe: RigaDaImportare[]): Promise<{ inserite: number; saltate: number }> {
  const db = getDb();
  if (!Array.isArray(righe) || righe.length === 0) throw new Error('Nessuna riga da importare.');
  if (righe.length > 1000) throw new Error('Troppe righe in una volta (massimo 1000).');
  const cat = new Set((await db.select({ id: categorieSpesa.id }).from(categorieSpesa)).map((c) => c.id));
  const alloggiMap = new Map((await db.select({ id: alloggi.id, immobile: alloggi.immobile_id }).from(alloggi)).map((a) => [a.id, a.immobile]));
  let inserite = 0;
  for (const r of righe) {
    if (!DATA.test(r.data)) throw new Error(`Data non valida: "${r.data}"`);
    if (!(r.importo > 0)) throw new Error(`Importo non valido per "${r.descrizione}"`);
    if (!cat.has(r.categoriaId)) throw new Error(`Manca la categoria per "${r.descrizione}"`);
    if (r.alloggioId && !alloggiMap.has(r.alloggioId)) throw new Error('Alloggio non trovato');
    const immobileId = r.alloggioId ? alloggiMap.get(r.alloggioId)! : r.immobileId || null;
    const dentro = await db.insert(spese).values({
      origine: 'Database', immobile_id: immobileId, alloggio_id: r.alloggioId || null, categoria_id: r.categoriaId,
      data: r.data, descrizione: r.descrizione.trim().slice(0, 300), importo: s2(r.importo),
      metodo_pagamento: METODI.includes(r.metodo ?? '') ? (r.metodo as 'Bonifico') : 'Bonifico',
      chiave_import: chiaveImport(r.data, r.importo, r.descrizione), note: 'Importata da estratto conto',
    }).onConflictDoNothing().returning({ id: spese.id });
    inserite += dentro.length;
  }
  return { inserite, saltate: righe.length - inserite };
}

/** Allega (o sostituisce) la ricevuta di una spesa: il file va su Drive in "Ricevute spese <anno>" e resta collegato alla spesa. */
export async function salvaRicevutaSpesa(spesaId: string, file: { nome: string; mime: string; contenuto: Buffer }) {
  const db = getDb();
  const [sp] = await db.select({ id: spese.id, data: spese.data, descrizione: spese.descrizione }).from(spese).where(eq(spese.id, spesaId));
  if (!sp) throw new Error('Spesa non trovata');
  const anno = Number(sp.data.slice(0, 4));
  const pulito = file.nome.replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'ricevuta';
  const nomeFile = `${sp.data} ${pulito}`;
  const salvato = await salvaFileSpesa(anno, nomeFile, file.contenuto, file.mime);
  const [doc] = await db.insert(documenti).values({
    tipo: 'Altro', nome: `Ricevuta spesa — ${nomeFile}`, drive_file_id: salvato.id, drive_url: salvato.link, mime: file.mime,
  }).returning({ id: documenti.id });
  await db.update(spese).set({ scontrino_documento_id: doc.id, aggiornato_il: new Date() }).where(eq(spese.id, spesaId));
  return { documentoId: doc.id, link: salvato.link };
}

/** Elimina una spesa: la riga va nel cestino per 30 giorni (la ricevuta su Drive non si tocca). */
export async function eliminaSpesa(id: string, eliminatoDa?: string) {
  const db = getDb();
  const [r] = await db.select().from(spese).where(eq(spese.id, id));
  if (!r) throw new Error('Spesa non trovata');
  await mettiNelCestino('spesa', r, `Spesa ${r.data} ${r.descrizione} € ${r.importo}`.slice(0, 120), eliminatoDa);
  await db.delete(spese).where(eq(spese.id, id));
  return { ok: true };
}

// ── Ricorrenti ───────────────────────────────────────────────────────────────────────────

export async function leggiSpeseRicorrenti() {
  return getDb().select({
    id: speseRicorrenti.id, descrizione: speseRicorrenti.descrizione, importo: speseRicorrenti.importo, frequenza: speseRicorrenti.frequenza,
    giorno: speseRicorrenti.giorno, prossimaData: speseRicorrenti.prossima_data, fine: speseRicorrenti.fine, attiva: speseRicorrenti.attiva,
    categoria: categorieSpesa.nome, immobile: immobili.nome, alloggio: alloggi.nome,
  }).from(speseRicorrenti)
    .innerJoin(categorieSpesa, eq(categorieSpesa.id, speseRicorrenti.categoria_id))
    .leftJoin(immobili, eq(immobili.id, speseRicorrenti.immobile_id))
    .leftJoin(alloggi, eq(alloggi.id, speseRicorrenti.alloggio_id))
    .orderBy(speseRicorrenti.descrizione);
}

export async function creaSpesaRicorrente(d: { descrizione: string; categoriaId: string; immobileId?: string; alloggioId?: string; importo: number; metodoPagamento?: string; frequenza: string; primaData: string; fine?: string; note?: string }) {
  const db = getDb();
  if (!(d.frequenza in FREQUENZE)) throw new Error('Frequenza non valida');
  if (!(Number(d.importo) > 0)) throw new Error('Importo non valido');
  if (!DATA.test(d.primaData)) throw new Error('Data della prima spesa non valida');
  if (d.fine && !DATA.test(d.fine)) throw new Error('Data di fine non valida');
  if (!d.descrizione?.trim()) throw new Error('Manca la descrizione');
  let immobileId = d.immobileId || null;
  if (d.alloggioId) {
    const [a] = await db.select({ imm: alloggi.immobile_id }).from(alloggi).where(eq(alloggi.id, d.alloggioId));
    if (!a) throw new Error('Alloggio non trovato');
    immobileId = a.imm;
  }
  const [r] = await db.insert(speseRicorrenti).values({
    descrizione: d.descrizione.trim(), categoria_id: d.categoriaId, immobile_id: immobileId, alloggio_id: d.alloggioId || null,
    importo: s2(Number(d.importo)), metodo_pagamento: METODI.includes(d.metodoPagamento ?? '') ? (d.metodoPagamento as 'Bonifico') : null,
    frequenza: d.frequenza, giorno: Number(d.primaData.slice(8, 10)), prossima_data: d.primaData, fine: d.fine || null, note: d.note || null,
  }).returning();
  return r;
}

export async function impostaSpesaRicorrente(id: string, d: { attiva?: boolean; importo?: number }) {
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  if (d.attiva !== undefined) set.attiva = d.attiva;
  if (d.importo !== undefined) { if (!(d.importo > 0)) throw new Error('Importo non valido'); set.importo = s2(d.importo); }
  const [r] = await getDb().update(speseRicorrenti).set(set).where(eq(speseRicorrenti.id, id)).returning({ id: speseRicorrenti.id });
  if (!r) throw new Error('Spesa ricorrente non trovata');
  return { ok: true };
}

/** Toglie la ricorrenza; le spese già registrate restano (si scollegano soltanto). */
export async function eliminaSpesaRicorrente(id: string) {
  const db = getDb();
  await db.update(spese).set({ ricorrente_id: null }).where(eq(spese.ricorrente_id, id));
  await db.delete(speseRicorrenti).where(eq(speseRicorrenti.id, id));
  return { ok: true };
}

/**
 * Registra le spese ricorrenti arrivate a scadenza (anche quelle arretrate), una volta sola: la data è unica per ricorrenza
 * e il passaggio alla scadenza successiva è un aggiornamento condizionato, quindi due richieste insieme non duplicano.
 */
export async function generaSpeseRicorrenti(oggiISO: string): Promise<{ generate: number }> {
  const db = getDb();
  const dovute = await db.select().from(speseRicorrenti).where(and(eq(speseRicorrenti.attiva, true), sql`${speseRicorrenti.prossima_data} <= ${oggiISO}`));
  let generate = 0;
  for (const r of dovute) {
    const { date, prossimaDopo } = dateDaGenerare(r.prossima_data, r.frequenza as Frequenza, r.giorno, oggiISO, r.fine);
    if (date.length === 0) continue;
    const preso = await db.update(speseRicorrenti).set({ prossima_data: prossimaDopo, aggiornato_il: new Date() })
      .where(and(eq(speseRicorrenti.id, r.id), eq(speseRicorrenti.prossima_data, r.prossima_data))).returning({ id: speseRicorrenti.id });
    if (preso.length === 0) continue; // un'altra richiesta l'ha già fatto
    for (const data of date) {
      const dentro = await db.insert(spese).values({
        origine: 'Database', immobile_id: r.immobile_id, alloggio_id: r.alloggio_id, categoria_id: r.categoria_id, data,
        descrizione: r.descrizione, importo: r.importo, metodo_pagamento: r.metodo_pagamento, ricorrente_id: r.id, note: 'Spesa ricorrente',
      }).onConflictDoNothing().returning({ id: spese.id });
      generate += dentro.length;
    }
  }
  return { generate };
}
