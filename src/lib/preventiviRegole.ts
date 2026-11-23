/**
 * Regole dei preventivi (punto 10 delle richieste, 23/11/2026). Funzioni PURE.
 *  - un preventivo accettato è BLOCCATO: non cambia stato e non si elimina; se i dati cambiano si crea una nuova versione;
 *  - confronto tra un preventivo e la prenotazione che ne è nata: ogni differenza si segnala.
 */

export const eurTesto = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;
const itData = (iso: string) => iso.split('-').reverse().join('/');

export type DatiPreventivo = { alloggioId: string; checkin: string; checkout: string; numeroOspiti: number; ospiteId: string | null; totale: number };
export type DatiPrenotazioneConfronto = { alloggioId: string; checkin: string; checkout: string; numeroOspiti: number; ospiteId: string; lordo: number; stato: string };

/** Elenco delle differenze (in italiano) tra il preventivo e la sua prenotazione; vuoto = coincidono. */
export function differenzePreventivoPrenotazione(p: DatiPreventivo, b: DatiPrenotazioneConfronto, nomi: { alloggioPreventivo?: string; alloggioPrenotazione?: string } = {}): string[] {
  const d: string[] = [];
  if (p.alloggioId !== b.alloggioId) d.push(`Alloggio: preventivo ${nomi.alloggioPreventivo ?? '?'}, prenotazione ${nomi.alloggioPrenotazione ?? '?'}`);
  if (p.checkin !== b.checkin) d.push(`Arrivo: preventivo ${itData(p.checkin)}, prenotazione ${itData(b.checkin)}`);
  if (p.checkout !== b.checkout) d.push(`Partenza: preventivo ${itData(p.checkout)}, prenotazione ${itData(b.checkout)}`);
  if (p.numeroOspiti !== b.numeroOspiti) d.push(`Ospiti: preventivo ${p.numeroOspiti}, prenotazione ${b.numeroOspiti}`);
  if (p.ospiteId && p.ospiteId !== b.ospiteId) d.push('Ospite: la prenotazione è intestata a un altro ospite');
  if (Math.abs(p.totale - b.lordo) > 0.009) d.push(`Importo: preventivo ${eurTesto(p.totale)}, prenotazione ${eurTesto(b.lordo)}`);
  if (b.stato.startsWith('Cancellata')) d.push(`La prenotazione è ${b.stato.toLowerCase()}`);
  return d;
}

/** Un preventivo accettato (o già legato a una prenotazione) non si modifica. */
export function preventivoBloccato(stato: string, prenotazioneId: string | null): boolean {
  return stato === 'Accettato' || !!prenotazioneId;
}
export const MSG_BLOCCATO = 'Un preventivo accettato è bloccato: non si può più modificare né eliminare. Se i dati cambiano, crea una nuova versione.';
