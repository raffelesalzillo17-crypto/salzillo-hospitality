// Client per l'API REST ufficiale di Sinfonia Turismo SMART (Regione Campania) — comunicazione
// obbligatoria per legge della movimentazione turistica (arrivi/presenze/partenze aggregati per
// nazionalità/provincia, ai fini ISTAT). API REST/JSON vera, specifica OpenAPI 3.0 completa
// scaricata dal portale ufficiale (turismo.regione.campania.it, sezione "documentazione tecnica
// per integrazione gestionali") il 09/09/2026 — vedi wiki/entita/salzillo-hospitality.md.
//
// A differenza di Alloggiati Web (dati anagrafici del singolo ospite), qui i dati inviati sono
// SOLO conteggi aggregati per giornata (camere occupate, arrivi/partenze/presenti per
// nazionalità o provincia) — nessun nome, documento o dato personale del singolo ospite.
//
// CONTESTO DI SICUREZZA:
// - Le operazioni di SCRITTURA reale (POST/PUT/DELETE su /v1/movimentazione e
//   /v1/movimentazione/stimato) NON sono implementate in questo file, di proposito — stesso
//   motivo di sendSchedine() in src/lib/alloggiatiWebService.ts: è una comunicazione a un ente
//   pubblico, va attivata solo con un test supervisionato insieme a Raffaele.
// - Le operazioni di SOLA LETTURA (login, anagrafica, ultima rilevazione, codici istat, periodi
//   di chiusura) sono invece implementate e sicure da chiamare anche subito: non modificano
//   nulla sul sistema regionale.
// - Credenziali lette SOLO da process.env (SINFONIA_CUSR, SINFONIA_API_KEY), mai loggate.
//   Non ancora impostate su Vercel al momento in cui questo file è stato scritto — richiede
//   che Raffaele le aggiunga (stesso pattern di ALLOGGIATI_WSKEY: io preparo i campi, lui
//   incolla i valori). Il CUSR è già noto e non sensibile (15061049EXT0003, vedi
//   wiki/entita/bb-il-tulipano.md); l'API KEY invece sì.

const BASE_URL_TEST = 'https://turismo-coll.regione.campania.it/turismoweb/api-gestionali';
const BASE_URL_PROD = 'https://turismo.regione.campania.it/turismoweb/api-gestionali';

// L'ambiente di test richiede utenze separate da richiedere via email a
// giuseppe.pezone@regione.campania.it (vedi PDF guida operativa) — non le abbiamo, quindi per
// ora si usa sempre l'ambiente di produzione, ma SOLO con le chiamate di sola lettura sopra.
const BASE_URL = BASE_URL_PROD;

export type LoginResult = {
  accessToken: string;
  expiresIn: number;
};

export type AnagraficaStruttura = {
  denominazione?: string;
  codiceFiscale?: string;
  partitaIva?: string;
  cin?: string;
  cusr?: string;
  indirizzo?: string;
  civico?: string;
  cap?: string;
  comune?: string;
  provincia?: string;
  macroCategoria?: string;
  categoria?: string;
  sottoCategoria?: string;
  numeroCamere?: number;
  numeroUnitaAbitative?: number;
  numeroPiazzole?: number;
  numeroPostiLetto?: number;
  numeroBagni?: number;
  email?: string;
  sitoWeb?: string;
};

export type CodiceIstat = { descrizione?: string; codiceIstat?: string };
export type CodiciIstatResult = { province: CodiceIstat[]; nazioni: CodiceIstat[] };

export type UltimaRilevazioneResult = { dataUltimaRilevazione: string | null };

function requireEnv(name: 'SINFONIA_CUSR' | 'SINFONIA_API_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Sinfonia Turismo SMART: variabile d'ambiente ${name} mancante (va aggiunta su Vercel)`);
  }
  return value;
}

async function apiCall<T>(path: string, opts: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // risposta non-JSON (es. 401/5XX senza corpo) — restituiamo il testo grezzo nell'errore
  }

  if (!res.ok) {
    const errore = (json as { errore?: string } | null)?.errore;
    const headers = [...res.headers.entries()].map(([k, v]) => `${k}: ${v}`).join(' | ');
    throw new Error(`Sinfonia Turismo SMART: HTTP ${res.status} su ${path}${errore ? ` — ${errore}` : text ? ` — corpo: ${text.slice(0, 500)}` : ' — corpo vuoto'} — headers: ${headers}`);
  }
  return json as T;
}

/** POST /v1/auth/login — ritorna un JWT valido per ~50 minuti (expiresIn in secondi). */
export async function login(): Promise<LoginResult> {
  const cusr = requireEnv('SINFONIA_CUSR');
  const apiKey = requireEnv('SINFONIA_API_KEY');
  return apiCall<LoginResult>('/v1/auth/login', { method: 'POST', body: { cusr, apiKey } });
}

/** GET /v1/anagrafica — dati registrati della struttura (sola lettura, sicuro). */
export async function getAnagrafica(token: string): Promise<AnagraficaStruttura> {
  return apiCall<AnagraficaStruttura>('/v1/anagrafica', { token });
}

/** GET /v1/codici-istat — tabella codici provincia/nazione ammessi (sola lettura, sicuro). */
export async function getCodiciIstat(token: string): Promise<CodiciIstatResult> {
  return apiCall<CodiciIstatResult>('/v1/codici-istat', { token });
}

/** GET /v1/movimentazione/ultima-rilevazione — data dell'ultimo invio registrato (sola lettura). */
export async function getUltimaRilevazione(token: string, stimato = false): Promise<UltimaRilevazioneResult> {
  return apiCall<UltimaRilevazioneResult>(`/v1/movimentazione/ultima-rilevazione?stimato=${stimato}`, { token });
}

/** GET /v1/movimentazione/periodi-chiusura — periodi di chiusura registrati (sola lettura). */
export async function getPeriodiChiusura(token: string): Promise<unknown> {
  return apiCall('/v1/movimentazione/periodi-chiusura', { token });
}

/**
 * POST/PUT/DELETE /v1/movimentazione — invio/modifica/eliminazione VERA della movimentazione
 * turistica. NON IMPLEMENTATO, DI PROPOSITO: stessa cautela di sendSchedine() in
 * alloggiatiWebService.ts. Va costruito e attivato solo con un test supervisionato insieme a
 * Raffaele, non in autonomia — anche se qui i dati sono aggregati (non nomi di ospiti), resta
 * una comunicazione a un ente pubblico con possibili conseguenze se sbagliata.
 */
export function inviaMovimentazione(): never {
  throw new Error(
    "inviaMovimentazione() non è implementato per decisione esplicita di sicurezza. L'invio vero " +
      'della movimentazione a Sinfonia Turismo SMART non va chiamato senza un test supervisionato ' +
      "con l'utente."
  );
}
