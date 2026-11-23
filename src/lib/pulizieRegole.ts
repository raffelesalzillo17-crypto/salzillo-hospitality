/**
 * Regole delle pulizie (punto 9 delle richieste, 23/11/2026). Funzioni PURE.
 *  - una pulizia si può segnare "fatta" solo dal giorno del check-out (mai prima);
 *  - checklist per alloggio con voci predefinite;
 *  - urgenza: se il prossimo check-in nello stesso alloggio è lo stesso giorno della pulizia.
 */

export const CHECKLIST_PREDEFINITA = ['Biancheria cambiata', 'Articoli di cortesia', 'Rifornimenti (carta, sapone, caffè)'];

/** La checklist di un alloggio: una voce per riga; se è vuota valgono quelle predefinite. */
export function checklistDi(testo: string | null | undefined): string[] {
  const v = (testo ?? '').split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  return v.length ? [...new Set(v)].slice(0, 30) : CHECKLIST_PREDEFINITA;
}

/** Data di oggi (AAAA-MM-GG) a Roma. */
export function oggiRoma(adesso: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(adesso);
}

/** Si può segnare "fatta" solo dal giorno della pulizia in poi. */
export function puoSegnarsiFatta(dataPulizia: string, oggi: string): boolean {
  return dataPulizia <= oggi;
}

export type UrgenzaPulizia = 'stesso-giorno' | 'presto' | null;
/** "stesso-giorno": c'è un check-in nello stesso alloggio lo stesso giorno della pulizia → urgente. "presto": entro 2 giorni. */
export function urgenzaPulizia(dataPulizia: string, prossimoCheckin: string | null): UrgenzaPulizia {
  if (!prossimoCheckin) return null;
  if (prossimoCheckin === dataPulizia) return 'stesso-giorno';
  const giorni = Math.round((Date.parse(prossimoCheckin) - Date.parse(dataPulizia)) / 864e5);
  return giorni > 0 && giorni <= 2 ? 'presto' : null;
}

/** Orario HH:MM valido (o vuoto). */
export function oraValida(ora: string | null | undefined): string | null {
  const t = (ora ?? '').trim();
  if (!t) return null;
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('Orario non valido: scrivilo come 10:30.');
  return t;
}
