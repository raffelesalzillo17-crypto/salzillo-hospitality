import { NOMI_STRUTTURE } from '@/lib/strutture';

// Costanti condivise tra la route API (src/app/api/spese/route.ts) e il componente
// (src/components/ContabilitaDashboard.tsx) per il registro spese extra con dati persistiti
// su Google Sheets (scheda "SPESE" dello spreadsheet SalzilloFlow_2026 — stesso ID usato da
// /api/prenotazioni, /api/prenotazione, /api/pulizie-stato).
//
// Schema scheda "SPESE" (riga 1 = intestazioni, colonne A-E):
//   A Data          — DD/MM/YYYY
//   B Categoria     — testo libero (select in UI: Utenze/Manutenzione/Scorte-Forniture/Altro)
//   C Descrizione   — testo libero
//   D Importo       — numero, sempre positivo (è una spesa)
//   E Struttura     — opzionale: una delle STRUTTURE in src/lib/strutture.ts, o "Generale"

export const SPESE_SHEET_NAME = 'SPESE';

export const SPESE_HEADERS = ['Data', 'Categoria', 'Descrizione', 'Importo', 'Struttura'];

export const COL_DATA = 0;
export const COL_CATEGORIA = 1;
export const COL_DESCRIZIONE = 2;
export const COL_IMPORTO = 3;
export const COL_STRUTTURA = 4;
export const SPESE_NUM_COLS = COL_STRUTTURA + 1; // 5 (A..E)

export const CATEGORIE_SPESA = ['Utenze', 'Manutenzione', 'Scorte/Forniture', 'Altro'] as const;

export const STRUTTURE_SPESA = [...NOMI_STRUTTURE, 'Generale'];

export type Spesa = {
  row: number;
  data: string; // DD/MM/YYYY
  categoria: string;
  descrizione: string;
  importo: number;
  struttura: string;
};
