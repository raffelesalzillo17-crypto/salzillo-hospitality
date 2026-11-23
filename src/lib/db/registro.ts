/**
 * Registro delle azioni e cestino (punto 5 delle richieste, 23/11/2026).
 *
 *  - registra(): una riga per ogni creazione/modifica/eliminazione/visualizzazione di un dato
 *    sensibile. NON deve mai far fallire l'operazione che registra (errori solo nel log).
 *    Mai dati degli ospiti nel dettaglio.
 *  - cestino: gli ospiti e i preventivi eliminati si conservano come fotografia della riga per
 *    30 giorni e si possono rimettere com'erano. Passato il termine restano non recuperabili
 *    e vengono tolti alla prima apertura del registro (svuotaCestinoScaduto).
 */
import { and, desc, eq, gt, isNull, lt, getTableColumns } from 'drizzle-orm';
import { getDb } from './index';
import { registroAzioni, cestino, ospiti, preventivi } from './schema';

export const GIORNI_CESTINO = 30;

type Chi = { id: string; nome: string; ruolo: string } | null;

export async function registra(chi: Chi, azione: string, entita?: string | null, entitaId?: string | null, dettaglio?: string | null): Promise<void> {
  try {
    await getDb().insert(registroAzioni).values({
      utente_id: chi?.id ?? null, utente_nome: chi?.nome ?? null, ruolo: chi?.ruolo ?? null,
      azione, entita: entita ?? null, entita_id: entitaId ?? null, dettaglio: dettaglio ?? null,
    });
  } catch (e) {
    console.error('[registro] scrittura non riuscita (non bloccante):', e instanceof Error ? e.message : e);
  }
}

export async function leggiRegistro(limite = 200) {
  return getDb().select().from(registroAzioni).orderBy(desc(registroAzioni.quando)).limit(limite);
}

const TABELLE = { ospite: ospiti, preventivo: preventivi } as const;
export type TipoCestino = keyof typeof TABELLE;

/** Fotografa una riga prima di eliminarla. Se la fotografia non riesce l'eliminazione NON deve proseguire. */
export async function mettiNelCestino(tipo: TipoCestino, riga: { id: string }, etichetta: string, eliminatoDa?: string | null) {
  const scade = new Date(Date.now() + GIORNI_CESTINO * 864e5);
  await getDb().insert(cestino).values({
    tipo, entita_id: riga.id, etichetta, dati: JSON.parse(JSON.stringify(riga)), eliminato_da: eliminatoDa ?? null, scade_il: scade,
  });
}

export async function leggiCestino() {
  return getDb().select({
    id: cestino.id, tipo: cestino.tipo, etichetta: cestino.etichetta, eliminatoIl: cestino.eliminato_il, scadeIl: cestino.scade_il,
  }).from(cestino).where(and(isNull(cestino.ripristinato_il), gt(cestino.scade_il, new Date()))).orderBy(desc(cestino.eliminato_il));
}

export async function svuotaCestinoScaduto() {
  try { await getDb().delete(cestino).where(lt(cestino.scade_il, new Date())); }
  catch (e) { console.error('[cestino] pulizia scaduti non riuscita (non bloccante):', e instanceof Error ? e.message : e); }
}

/** Rimette la riga com'era (stesso id). Fallisce con un messaggio chiaro se esiste già o è scaduta. */
export async function ripristinaDalCestino(id: string) {
  const db = getDb();
  const [v] = await db.select().from(cestino).where(eq(cestino.id, id));
  if (!v) throw new Error('Elemento non trovato nel cestino');
  if (v.ripristinato_il) throw new Error('Già ripristinato');
  if (v.scade_il.getTime() < Date.now()) throw new Error('Il cestino conserva gli elementi 30 giorni: questo è scaduto');
  const tabella = TABELLE[v.tipo as TipoCestino];
  if (!tabella) throw new Error(`Tipo non ripristinabile: ${v.tipo}`);
  // JSON ha reso stringhe le date: dove la colonna è un timestamp si rifà un Date.
  const colonne = getTableColumns(tabella) as Record<string, { dataType: string }>;
  const riga: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v.dati as Record<string, unknown>)) {
    riga[k] = typeof val === 'string' && colonne[k]?.dataType === 'date' ? new Date(val) : val;
  }
  await db.insert(tabella).values(riga as never);
  await db.update(cestino).set({ ripristinato_il: new Date() }).where(eq(cestino.id, id));
  return { tipo: v.tipo, etichetta: v.etichetta };
}
