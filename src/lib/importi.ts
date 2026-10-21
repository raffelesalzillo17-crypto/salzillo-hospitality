/**
 * Calcolo puro degli importi di una prenotazione (nessun accesso al database): così si può
 * provare con test automatici. `calcolaImportiPrenotazione` in db/mutations.ts legge dal
 * database alloggio e contratto di gestione e poi chiama questa funzione.
 */

import { COMM_RATE, ALIQUOTA_CEDOLARE } from './tariffe';

export type ImportiPrenotazione = {
  commissione: number; cedolare: number; costoPulizia: number; feeGestione: number; utile: number; nettoProprietario: number;
};

const arrotonda = (n: number) => Math.round(n * 100) / 100;

export function calcolaImportiPuri(opts: {
  canale: string; lordo: number;
  regimeFiscale: string;        // 'Con cedolare' | 'No tax'
  costoPulizia: number;
  percentualeFee: number;       // % di gestione sul lordo (contratto del proprietario), 0 se assente
}): ImportiPrenotazione {
  const { lordo, canale } = opts;
  const commissione = arrotonda(lordo * (COMM_RATE[canale] ?? 0));
  const cedolare = opts.regimeFiscale === 'Con cedolare' && canale !== 'No Tax' ? arrotonda(lordo * ALIQUOTA_CEDOLARE) : 0;
  const costoPulizia = opts.costoPulizia;
  const feeGestione = arrotonda(lordo * (opts.percentualeFee / 100));
  const utile = arrotonda(lordo - commissione - cedolare - costoPulizia);
  const nettoProprietario = arrotonda(utile - feeGestione);
  return { commissione, cedolare, costoPulizia, feeGestione, utile, nettoProprietario };
}
