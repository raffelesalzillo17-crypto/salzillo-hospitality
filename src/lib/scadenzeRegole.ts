/**
 * Regole delle scadenze (punto 13 delle richieste, 23/11/2026). Funzioni PURE.
 *  - chiave per riconoscere la stessa scadenza scritta in due modi (duplicati);
 *  - prossima data di una scadenza ricorrente: dalla data PREVISTA, non da quella in cui la si fa (così non scivola).
 */
import { prossimaData, type Frequenza } from './estrattoConto';

export const STATI_SCADENZA = ['Aperta', 'Fatta', 'Non più applicabile'] as const;
export type StatoScadenza = (typeof STATI_SCADENZA)[number];

/** "Cedolare secca — 1° acconto" e "cedolare secca  1 acconto" → stessa chiave. */
export function chiaveTitoloScadenza(titolo: string): string {
  return titolo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Prossima data di una scadenza ricorrente (stesso giorno del mese, o l'ultimo se il mese è più corto); null per "Una tantum". */
export function prossimaScadenza(dataPrevista: string, ricorrenza: string): string | null {
  if (ricorrenza === 'Una tantum') return null;
  const f = ricorrenza as Frequenza;
  if (!['Mensile', 'Trimestrale', 'Semestrale', 'Annuale'].includes(f)) return null;
  return prossimaData(dataPrevista, f, Number(dataPrevista.slice(8, 10)));
}

export type VoceScadenza = { id: string; titolo: string; ente: string | null; ricorrenza: string; origine: string; stato: string };
export type GruppoDuplicatiScadenze = { chiave: string; ids: string[] };

/**
 * Gruppi di scadenze che sono la stessa cosa: stessa chiave del titolo e stesso ente (o uno dei due senza ente: le righe importate dal
 * foglio hanno l'ente scritto solo nelle note). Considera solo le aperte: un'archiviata non è un doppione.
 */
export function trovaDuplicatiScadenze(voci: VoceScadenza[]): GruppoDuplicatiScadenze[] {
  const perChiave = new Map<string, VoceScadenza[]>();
  for (const v of voci.filter((x) => x.stato === 'Aperta')) { const k = chiaveTitoloScadenza(v.titolo); perChiave.set(k, [...(perChiave.get(k) ?? []), v]); }
  const out: GruppoDuplicatiScadenze[] = [];
  for (const [chiave, lista] of perChiave) {
    if (lista.length < 2) continue;
    const enti = new Set(lista.map((x) => x.ente).filter(Boolean));
    if (enti.size > 1) continue; // enti diversi: sono due cose diverse con lo stesso nome
    out.push({ chiave, ids: lista.map((x) => x.id) });
  }
  return out;
}
