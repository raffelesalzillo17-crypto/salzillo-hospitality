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

/**
 * Il tracciato vuole il luogo di rilascio del documento come CODICE (di un comune italiano o di
 * uno stato estero, 9 cifre), non come nome. Nelle schedine lo teniamo scritto per esteso, come
 * si legge sul documento, e lo traduciamo qui al momento dell'invio (11/11/2026: il nome
 * mandato così com'era veniva rifiutato come "troppo lungo"). Ritorna null se il nome non
 * corrisponde a un solo comune né a uno stato: in quel caso non si indovina.
 */
export function codiceLuogoRilascio(testo: string | null | undefined): string | null {
  const t = (testo ?? '').trim();
  if (!t) return null;
  if (/^[0-9]{9}$/.test(t)) return t;
  const comuni = cercaComuni(t);
  if (comuni.length === 1) return comuni[0].codice;
  if (comuni.length > 1) return null;
  return cercaStato(t)?.codice ?? null;
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
