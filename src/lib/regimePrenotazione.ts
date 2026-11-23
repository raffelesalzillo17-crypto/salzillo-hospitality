/**
 * Regime fiscale della prenotazione (punto 3, 23/11/2026), separato dal canale.
 *  - Ordinario: cedolare e tassa di soggiorno come da regime dell'alloggio.
 *  - Esente da tassa di soggiorno: con un motivo.
 *  - No Tax: come prima — mai inviata ad Alloggiati Web, nessuna ricevuta, nessuna cedolare.
 * Finché una prenotazione ha ancora il canale "No Tax" (prima della migrazione confermata) vale lo stesso trattamento.
 */
export const REGIMI_PRENOTAZIONE = ['Ordinario', 'Esente da tassa di soggiorno', 'No Tax'] as const;
export type RegimePrenotazione = (typeof REGIMI_PRENOTAZIONE)[number];

export function regimeValido(r: unknown): RegimePrenotazione {
  return (REGIMI_PRENOTAZIONE as readonly string[]).includes(String(r)) ? (r as RegimePrenotazione) : 'Ordinario';
}

/** Esclusa da Alloggiati Web, ricevute e cedolare. */
export const esclusaDaAdempimenti = (canale: string, regime?: string | null) => canale === 'No Tax' || regime === 'No Tax';
