/**
 * Letture pubbliche per il sito vetrina (/soggiorna) — nessuna autenticazione,
 * solo dati che un ospite può già vedere altrove (nome struttura, indirizzo, disponibilità).
 * Mai esporre qui campi sensibili (wifi_password, importi, dati proprietario/ospiti).
 */
import { eq, and, lt, gt, notInArray } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, immobili, prenotazioni, blocchiCalendario } from './schema';

export type StrutturaVetrina = {
  id: string;
  nome: string;
  immobile: string;
  indirizzo: string;
  comune: string;
};

export async function struttureVetrinaDb(): Promise<StrutturaVetrina[]> {
  const db = getDb();
  return db
    .select({
      id: alloggi.id, nome: alloggi.nome,
      immobile: immobili.nome, indirizzo: immobili.indirizzo, comune: immobili.comune,
    })
    .from(alloggi)
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .where(eq(alloggi.attivo, true))
    .orderBy(alloggi.nome);
}

const STATI_NON_BLOCCANTI = ['Cancellata', 'Cancellata con penale', 'No-show'] as const;

/** true se il periodo [checkin, checkout) è libero per quell'alloggio. */
export async function disponibileDb(alloggioId: string, checkinISO: string, checkoutISO: string): Promise<boolean> {
  const db = getDb();
  const sovrapposte = await db
    .select({ id: prenotazioni.id })
    .from(prenotazioni)
    .where(and(
      eq(prenotazioni.alloggio_id, alloggioId),
      notInArray(prenotazioni.stato, [...STATI_NON_BLOCCANTI]),
      lt(prenotazioni.checkin, checkoutISO),
      gt(prenotazioni.checkout, checkinISO),
    ));
  if (sovrapposte.length > 0) return false;

  const bloccate = await db
    .select({ id: blocchiCalendario.id })
    .from(blocchiCalendario)
    .where(and(
      eq(blocchiCalendario.alloggio_id, alloggioId),
      lt(blocchiCalendario.checkin, checkoutISO),
      gt(blocchiCalendario.checkout, checkinISO),
    ));
  return bloccate.length === 0;
}
