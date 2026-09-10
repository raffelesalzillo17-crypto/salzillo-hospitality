// Costanti condivise tra la route API (src/app/api/pulizie-stato/route.ts) e il componente
// (src/components/PulizieChecklist.tsx) per la checklist pulizie con stato persistito su
// Google Sheets (scheda "PULIZIE" dello spreadsheet SalzilloFlow_2026).
//
// Schema scheda "PULIZIE" (riga 1 = intestazioni, colonne A-M):
//   A Data            — check-out, DD/MM/YYYY
//   B Stanza
//   C Ospite
//   D..J              — le 7 voci di CHECKLIST_STANDARD, valore "SI" oppure "" (vuoto)
//   K Operatore        — chi ha pulito, default "Lella"
//   L CompletatoIl     — ISO timestamp di quando è stata spuntata l'ultima voce (tutte e 7 a "SI")
//   M Note             — testo libero, opzionale

export const PULIZIE_SHEET_NAME = 'PULIZIE';

export const CHECKLIST_STANDARD = [
  'Cambio biancheria letto',
  'Cambio asciugamani',
  'Pulizia bagno',
  'Pulizia pavimenti',
  'Riordino generale',
  'Controllo scorte (carta igienica, sapone, cialde caffè)',
  'Controllo oggetti dimenticati dall’ospite',
] as const;

export const PULIZIE_HEADERS = [
  'Data',
  'Stanza',
  'Ospite',
  ...CHECKLIST_STANDARD,
  'Operatore',
  'CompletatoIl',
  'Note',
];

export const OPERATORE_DEFAULT = 'Lella';

// Indice di colonna (0-based, A=0) della prima voce di checklist e delle colonne fisse.
export const COL_DATA = 0;
export const COL_STANZA = 1;
export const COL_OSPITE = 2;
export const COL_VOCE_START = 3; // D..J, una colonna per voce di CHECKLIST_STANDARD
export const COL_OPERATORE = COL_VOCE_START + CHECKLIST_STANDARD.length; // K
export const COL_COMPLETATO_IL = COL_OPERATORE + 1; // L
export const COL_NOTE = COL_COMPLETATO_IL + 1; // M
export const PULIZIE_NUM_COLS = COL_NOTE + 1; // 13 (A..M)

export type PulizieStato = {
  row: number;
  data: string; // DD/MM/YYYY
  stanza: string;
  ospite: string;
  voci: boolean[]; // stessa lunghezza/ordine di CHECKLIST_STANDARD
  operatore: string;
  completatoIl: string;
  note: string;
};

// Normalizza un numero italiano scritto in formati diversi (spazi, trattini, +39, 0039, senza
// prefisso) nel formato numerico puro richiesto da wa.me. Stesso schema usato in
// src/app/api/cron/checkout-reminder/route.ts.
export function toWaNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  let n = digits.startsWith('+') ? digits.slice(1) : digits;
  if (n.startsWith('00')) n = n.slice(2);
  if (!n.startsWith('39') && n.length <= 10) n = '39' + n;
  return n;
}

export const LELLA_TELEFONO = '339 430 4429';
