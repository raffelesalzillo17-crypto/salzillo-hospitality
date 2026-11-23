/**
 * Migrazione guidata del canale "No Tax" (punto 3, 23/11/2026). Non sposta nulla da sola:
 *  1) `anteprimaNoTax` elenca le prenotazioni con canale "No Tax" e il canale proposto;
 *  2) `applicaNoTax` cambia il canale SOLO per le prenotazioni scelte dal titolare, e solo se sono ancora "No Tax".
 * Il regime "No Tax" (colonna regime_prenotazione) resta: Alloggiati, ricevute e cedolare si comportano come prima.
 * Annullamento: drizzle/manuali/0012_regime_prenotazione_rollback.sql rimette il canale "No Tax" dove il regime è "No Tax".
 */
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, ospiti, prenotazioni } from './schema';

export const CANALI_DI_DESTINAZIONE = ['Diretto', 'Airbnb', 'Booking'] as const;
type CanaleDestinazione = (typeof CANALI_DI_DESTINAZIONE)[number];

export type RigaAnteprimaNoTax = { id: string; ospite: string; alloggio: string; checkin: string; checkout: string; lordo: number; stato: string; canaleProposto: CanaleDestinazione };

export async function anteprimaNoTax(): Promise<RigaAnteprimaNoTax[]> {
  const righe = await getDb().select({
    id: prenotazioni.id, nome: ospiti.nome, cognome: ospiti.cognome, alloggio: alloggi.nome,
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, lordo: prenotazioni.lordo, stato: prenotazioni.stato,
  }).from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(sql`${prenotazioni.canale}::text = 'No Tax'`)
    .orderBy(prenotazioni.checkin);
  return righe.map((r) => ({
    id: r.id, ospite: `${r.nome} ${r.cognome}`.trim(), alloggio: r.alloggio, checkin: r.checkin, checkout: r.checkout,
    lordo: Number(r.lordo), stato: r.stato, canaleProposto: 'Diretto',
  }));
}

export async function applicaNoTax(scelte: { id: string; canale: string }[]): Promise<{ spostate: number; invariate: number }> {
  if (!Array.isArray(scelte) || scelte.length === 0) throw new Error('Nessuna prenotazione scelta');
  for (const s of scelte) {
    if (!/^[0-9a-f-]{36}$/i.test(String(s.id))) throw new Error('Prenotazione non valida');
    if (!(CANALI_DI_DESTINAZIONE as readonly string[]).includes(s.canale)) throw new Error(`Canale non valido: ${s.canale}`);
  }
  const db = getDb();
  const ancoraNoTax = await db.select({ id: prenotazioni.id }).from(prenotazioni)
    .where(and(inArray(prenotazioni.id, scelte.map((s) => s.id)), sql`${prenotazioni.canale}::text = 'No Tax'`));
  const valide = new Set(ancoraNoTax.map((x) => x.id));
  const da = scelte.filter((s) => valide.has(s.id));
  if (da.length) {
    // una sola transazione: o si spostano tutte o nessuna
    const [primo, ...resto] = da.map((s) => db.update(prenotazioni)
      .set({ canale: s.canale as CanaleDestinazione, regime_prenotazione: 'No Tax', aggiornato_il: new Date() })
      .where(eq(prenotazioni.id, s.id)));
    await db.batch([primo, ...resto]);
  }
  return { spostate: da.length, invariate: scelte.length - da.length };
}
