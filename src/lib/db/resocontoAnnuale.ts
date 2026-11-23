/** Letture per il resoconto annuale (punto 14): una sola query per anno; il calcolo sta in src/lib/resocontoAnnuale.ts (puro, testato). */
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, prenotazioni } from './schema';
import { costruisciResoconto, type Resoconto, type RigaResoconto } from '../resocontoAnnuale';

export async function leggiResoconto(anno: number, immobiliAmmessi: string[] | 'tutti'): Promise<Resoconto> {
  const db = getDb();
  const ammessi = immobiliAmmessi === 'tutti' ? undefined : inArray(alloggi.immobile_id, immobiliAmmessi.length ? immobiliAmmessi : ['00000000-0000-0000-0000-000000000000']);
  const righe = await db.select({
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale, alloggio: alloggi.nome,
    ospiti: prenotazioni.numero_ospiti, lordo: prenotazioni.lordo, imposta: alloggi.imposta_soggiorno_importo, impostaMax: alloggi.imposta_soggiorno_max_notti,
  }).from(prenotazioni).innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(and(eq(prenotazioni.stato, 'Attiva'), lte(prenotazioni.checkin, `${anno}-12-31`), gte(prenotazioni.checkout, `${anno}-01-01`), ammessi));
  const attivi = await db.select({ id: alloggi.id }).from(alloggi).where(and(eq(alloggi.attivo, true), ammessi));
  const rr: RigaResoconto[] = righe.map((r) => ({
    checkin: r.checkin, checkout: r.checkout, canale: r.canale, alloggio: r.alloggio, ospiti: r.ospiti, lordo: Number(r.lordo),
    impostaImporto: Number(r.imposta ?? 0), impostaMaxNotti: r.impostaMax ?? null,
  }));
  return costruisciResoconto(anno, rr, attivi.length);
}
