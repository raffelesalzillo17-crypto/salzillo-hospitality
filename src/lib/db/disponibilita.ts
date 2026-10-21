/**
 * Disponibilità degli alloggi: impedisce le doppie prenotazioni.
 *
 * Due livelli:
 *  1. controllo applicativo (`verificaPeriodoLibero`) che dà un messaggio chiaro, e controlla
 *     anche i blocchi manuali del calendario;
 *  2. vincolo nel database (`prenotazioni_no_sovrapposizione`, vedi drizzle/manuali/) che regge
 *     anche a due scritture simultanee: se due richieste passano insieme il controllo 1, la
 *     seconda viene comunque respinta dal database.
 *
 * Convenzione: un soggiorno occupa le notti [checkin, checkout) — il giorno di check-out è
 * libero per un nuovo check-in.
 */

import { and, eq, lt, gt, ne, notInArray } from 'drizzle-orm';
import { getDb } from './index';
import { prenotazioni, blocchiCalendario, ospiti } from './schema';

/** Stati che NON occupano l'alloggio (stessa lista del vincolo nel database). */
export const STATI_NON_BLOCCANTI = ['Cancellata', 'Cancellata con penale', 'No-show'] as const;

export const NOME_VINCOLO_SOVRAPPOSIZIONE = 'prenotazioni_no_sovrapposizione';

export const statoBlocca = (stato: string) => !(STATI_NON_BLOCCANTI as readonly string[]).includes(stato);

export class ErroreSovrapposizione extends Error {
  constructor(messaggio: string) { super(messaggio); this.name = 'ErroreSovrapposizione'; }
}
export class ErroreDate extends Error {
  constructor(messaggio: string) { super(messaggio); this.name = 'ErroreDate'; }
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const gm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** true se i due periodi [checkin, checkout) hanno almeno una notte in comune. */
export function periodiSiSovrappongono(
  a: { checkin: string; checkout: string }, b: { checkin: string; checkout: string },
): boolean {
  return a.checkin < b.checkout && b.checkin < a.checkout;
}

/** Date ISO valide e check-out dopo il check-in. */
export function validaPeriodo(checkin: string, checkout: string): void {
  if (!ISO.test(checkin) || !ISO.test(checkout) || Number.isNaN(Date.parse(checkin)) || Number.isNaN(Date.parse(checkout))) {
    throw new ErroreDate('Date non valide: usa il formato AAAA-MM-GG.');
  }
  if (checkout <= checkin) throw new ErroreDate('Il check-out deve essere dopo il check-in.');
}

/** true se l'errore arriva dal vincolo anti-sovrapposizione del database (codice Postgres 23P01). */
export function eErroreVincoloSovrapposizione(err: unknown): boolean {
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const o = e as { code?: string; constraint?: string; message?: string; cause?: unknown };
    if (o.code === '23P01' || o.constraint === NOME_VINCOLO_SOVRAPPOSIZIONE) return true;
    if (typeof o.message === 'string' && o.message.includes(NOME_VINCOLO_SOVRAPPOSIZIONE)) return true;
    e = o.cause;
  }
  return false;
}

export type Occupazione = { tipo: 'prenotazione' | 'blocco'; dal: string; al: string; chi: string };

/** Prenotazioni attive e blocchi manuali che si sovrappongono al periodo richiesto. */
export async function trovaOccupazioni(
  alloggioId: string, checkin: string, checkout: string, escludiPrenotazioneId?: string,
): Promise<Occupazione[]> {
  const db = getDb();
  const pren = await db
    .select({ dal: prenotazioni.checkin, al: prenotazioni.checkout, cognome: ospiti.cognome, nome: ospiti.nome })
    .from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(and(
      eq(prenotazioni.alloggio_id, alloggioId),
      notInArray(prenotazioni.stato, [...STATI_NON_BLOCCANTI]),
      lt(prenotazioni.checkin, checkout),
      gt(prenotazioni.checkout, checkin),
      escludiPrenotazioneId ? ne(prenotazioni.id, escludiPrenotazioneId) : undefined,
    ));
  const blocchi = await db
    .select({ dal: blocchiCalendario.checkin, al: blocchiCalendario.checkout, nota: blocchiCalendario.nota })
    .from(blocchiCalendario)
    .where(and(
      eq(blocchiCalendario.alloggio_id, alloggioId),
      lt(blocchiCalendario.checkin, checkout),
      gt(blocchiCalendario.checkout, checkin),
    ));
  return [
    ...pren.map((p) => ({ tipo: 'prenotazione' as const, dal: p.dal, al: p.al, chi: `${p.nome} ${p.cognome}`.trim() })),
    ...blocchi.map((b) => ({ tipo: 'blocco' as const, dal: b.dal, al: b.al, chi: b.nota ? `blocco: ${b.nota}` : 'blocco manuale' })),
  ];
}

export function messaggioOccupazioni(occ: Occupazione[]): string {
  const elenco = occ.map((o) => `${o.tipo === 'prenotazione' ? 'prenotazione di ' : ''}${o.chi} dal ${gm(o.dal)} al ${gm(o.al)}`).join('; ');
  return `Date non disponibili: l'alloggio è già occupato (${elenco}).`;
}

/** Lancia `ErroreSovrapposizione` se il periodo non è libero. */
export async function verificaPeriodoLibero(
  alloggioId: string, checkin: string, checkout: string, escludiPrenotazioneId?: string,
): Promise<void> {
  const occ = await trovaOccupazioni(alloggioId, checkin, checkout, escludiPrenotazioneId);
  if (occ.length > 0) throw new ErroreSovrapposizione(messaggioOccupazioni(occ));
}
