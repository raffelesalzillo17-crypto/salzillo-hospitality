// Costanti condivise tra la route API (src/app/api/conti/route.ts) e il componente
// (src/components/ContiBancari.tsx) per il registro conti bancari/investimento, con dati
// persistiti su Google Sheets (scheda "CONTI" dello spreadsheet SalzilloFlow_2026).
//
// Inserimento MANUALE per scelta esplicita (09/09/2026, vedi wiki/entita/salzillo-hospitality.md
// per il contesto): nessuna connessione diretta alle banche — Raffaele ha chiesto di aggiungere
// i suoi conti (Intesa Sanpaolo, Revolut, Trade Republic, Mediolanum) al Patrimonio, ma
// collegarli per davvero richiederebbe o le sue password (mai, per nessun motivo) o un vero
// servizio Open Banking/PSD2 con consenso (Enable Banking sembra la scelta migliore — copre
// Intesa Sanpaolo e Mediolanum con un piano gratuito per conti personali — ma richiede che sia
// Raffaele stesso a registrarsi, non è un'azione che si può fare per lui). Questo registro
// manuale è la base sicura costruibile subito: ogni aggiornamento è una nuova riga (mai
// sovrascritta), così si ottiene anche uno storico nel tempo senza sforzo aggiuntivo — utile
// in futuro per il "cruscotto crescita/capitale" del roadmap.
//
// Schema scheda "CONTI" (riga 1 = intestazioni, colonne A-D):
//   A Data          — DD/MM/YYYY, quando il saldo è stato aggiornato
//   B Banca         — una di BANCHE_CONTO, o testo libero
//   C Saldo         — numero (può essere negativo per un conto con scoperto, in teoria)
//   D Note          — testo libero, opzionale

export const CONTI_SHEET_NAME = 'CONTI';

export const CONTI_HEADERS = ['Data', 'Banca', 'Saldo', 'Note'];

export const COL_DATA = 0;
export const COL_BANCA = 1;
export const COL_SALDO = 2;
export const COL_NOTE = 3;
export const CONTI_NUM_COLS = COL_NOTE + 1; // 4 (A..D)

// Le 4 banche/broker citati da Raffaele, più "Altro" per qualunque altro conto futuro — elenco
// non vincolante, il campo Banca in scrittura accetta comunque testo libero.
export const BANCHE_CONTO = ['Intesa Sanpaolo', 'Revolut', 'Trade Republic', 'Mediolanum', 'Altro'] as const;

export type MovimentoConto = {
  row: number;
  data: string; // DD/MM/YYYY
  banca: string;
  saldo: number;
  note: string;
};

/** Dato un elenco di righe (storico completo), ritorna solo l'ultima per ciascuna banca —
 *  cioè il saldo "attuale" di ognuna. Confronto per data DD/MM/YYYY, a parità di data vince la
 *  riga con il numero di riga più alto (inserita per ultima). */
export function saldiAttuali(storico: MovimentoConto[]): MovimentoConto[] {
  const toISO = (d: string) => d.split('/').reverse().join('-');
  const latest = new Map<string, MovimentoConto>();
  for (const m of storico) {
    const prev = latest.get(m.banca);
    if (!prev || toISO(m.data) > toISO(prev.data) || (toISO(m.data) === toISO(prev.data) && m.row > prev.row)) {
      latest.set(m.banca, m);
    }
  }
  return Array.from(latest.values());
}
