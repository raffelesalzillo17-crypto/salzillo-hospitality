// Costanti condivise tra la route API (src/app/api/scadenze/route.ts) e il componente
// (src/components/ScadenzeFiscali.tsx) per il calendario scadenze fiscali/ricorrenti, con dati
// persistiti su Google Sheets (scheda "SCADENZE" dello spreadsheet SalzilloFlow_2026 — stesso ID
// usato da /api/prenotazioni, /api/pulizie-stato, /api/spese). Stesso pattern delle altre schede:
// vedi src/app/api/pulizie-stato/route.ts per l'auto-creazione/upsert.
//
// Schema scheda "SCADENZE" (riga 1 = intestazioni, colonne A-F):
//   A ID                  — stringa univoca, timestamp di creazione (es. "1725700000000")
//   B Titolo              — testo libero (es. "Controllo estintori Tulipano")
//   C DataScadenza        — DD/MM/YYYY
//   D Ricorrenza          — una di RICORRENZE: "Una tantum" | "Annuale" | "Semestrale" | "Mensile"
//   E Note                — testo libero, opzionale
//   F UltimoCompletamento — DD/MM/YYYY, opzionale: valorizzata quando Raffaele segna "fatto".
//                           Se Ricorrenza non è "Una tantum", a quel momento DataScadenza viene
//                           ricalcolata sommando l'intervallo alla data di completamento (oggi),
//                           non alla vecchia scadenza — così una scadenza fatta in ritardo non
//                           lascia lo scadenzario "indietro".

export const SCADENZE_SHEET_NAME = 'SCADENZE';

export const RICORRENZE = ['Una tantum', 'Annuale', 'Semestrale', 'Mensile'] as const;
export type Ricorrenza = (typeof RICORRENZE)[number];

export const SCADENZE_HEADERS = ['ID', 'Titolo', 'DataScadenza', 'Ricorrenza', 'Note', 'UltimoCompletamento'];

export const COL_ID = 0;
export const COL_TITOLO = 1;
export const COL_DATA_SCADENZA = 2;
export const COL_RICORRENZA = 3;
export const COL_NOTE = 4;
export const COL_ULTIMO_COMPLETAMENTO = 5;
export const SCADENZE_NUM_COLS = COL_ULTIMO_COMPLETAMENTO + 1; // 6 (A..F)

export type Scadenza = {
  row: number;
  id: string;
  titolo: string;
  dataScadenza: string; // DD/MM/YYYY
  ricorrenza: Ricorrenza;
  note: string;
  ultimoCompletamento: string; // DD/MM/YYYY oppure ''
};

export function isRicorrenza(v: unknown): v is Ricorrenza {
  return typeof v === 'string' && (RICORRENZE as readonly string[]).includes(v);
}

// DD/MM/YYYY -> Date a mezzanotte locale, oppure null se non parsabile.
export function parseItDate(s: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || '').trim());
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatItDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Somma l'intervallo di ricorrenza a una data di partenza (in genere la data di completamento).
// "Una tantum" non ha intervallo: chiamarla con "Una tantum" non ha senso, i chiamanti la evitano.
export function addIntervallo(base: Date, ricorrenza: Ricorrenza): Date {
  const d = new Date(base);
  if (ricorrenza === 'Annuale') d.setFullYear(d.getFullYear() + 1);
  else if (ricorrenza === 'Semestrale') d.setMonth(d.getMonth() + 6);
  else if (ricorrenza === 'Mensile') d.setMonth(d.getMonth() + 1);
  return d;
}

// Giorni mancanti alla scadenza (può essere negativo se scaduta), calcolati a mezzanotte per
// evitare scarti di poche ore dovuti all'ora corrente. Usata sia lato componente (badge/etichetta)
// sia potenzialmente lato server in futuro (es. promemoria).
export function giorniMancanti(dataScadenza: string, oggi: Date = new Date()): number | null {
  const d = parseItDate(dataScadenza);
  if (!d) return null;
  const today = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
