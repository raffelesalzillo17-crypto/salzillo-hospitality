// Percentuali di commissione OTA e aliquota cedolare secca — un posto solo, condiviso da
// src/lib/prenotazioni.ts (lettura legacy da Sheets), src/lib/db/importDaSheets.ts (sync
// notturno Sheets→DB) e src/lib/db/mutations.ts (creazione prenotazione nel nuovo sistema).
// Prima erano tre costanti identiche duplicate: se Airbnb/Booking cambiano commissione, o cambia
// l'aliquota della cedolare, bisognava ricordarsi di aggiornarle in tutti e tre i punti — rischio
// concreto di disallineamento silenzioso tra il calcolo del sync e quello delle nuove
// prenotazioni. Consolidate qui in un audit del 23/09/2026.
export const COMM_RATE: Record<string, number> = {
  Airbnb: 0.1891,
  Booking: 0.2015,
  Diretto: 0,
  'No Tax': 0,
};

export const ALIQUOTA_CEDOLARE = 0.21;
