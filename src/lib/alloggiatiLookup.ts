import tabelle from '../../public/checkin/tabelle.json';
import { CODICE_ITALIA, STATI, TIPI_DOCUMENTO_CODICI, TIPO_ALLOGGIATO } from './alloggiatiTabelle';

// Ricerca di comuni, stati e tipi nelle tabelle ufficiali di Alloggiati Web, per costruire una
// schedina a partire da dati letti da un documento (12/10/2026). I nomi letti dall'OCR sono
// testo libero: si accetta solo una corrispondenza ESATTA (ignorando maiuscole, accenti e
// punteggiatura), mai "quasi uguale" — un dato legalmente rilevante non si indovina.

type Comune = { codice: string; nome: string; provincia: string };
const COMUNI = tabelle.comuni as Comune[];

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

export function cercaComuni(nome: string): Comune[] {
  const n = norm(nome);
  return n ? COMUNI.filter((c) => norm(c.nome) === n) : [];
}

export function cercaStato(nome: string): { codice: string; nome: string } | null {
  const n = norm(nome);
  return n ? STATI.find((s) => norm(s.nome) === n) ?? null : null;
}

export function cercaTipoDocumento(nome: string): { codice: string; nome: string } | null {
  const n = norm(nome);
  return TIPI_DOCUMENTO_CODICI.find((t) => norm(t.nome) === n) ?? null;
}

export const TIPI_ALLOGGIATO_UI = [
  { nome: 'Ospite singolo', codice: TIPO_ALLOGGIATO.OSPITE_SINGOLO as string },
  { nome: 'Capofamiglia', codice: TIPO_ALLOGGIATO.CAPO_FAMIGLIA as string },
  { nome: 'Capogruppo', codice: TIPO_ALLOGGIATO.CAPO_GRUPPO as string },
  { nome: 'Familiare', codice: TIPO_ALLOGGIATO.FAMILIARE as string },
  { nome: 'Membro gruppo', codice: TIPO_ALLOGGIATO.MEMBRO_GRUPPO as string },
];

export { CODICE_ITALIA };
