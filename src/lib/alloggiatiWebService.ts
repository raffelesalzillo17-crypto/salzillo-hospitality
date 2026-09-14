// Client SOAP minimale per il web service ufficiale della Polizia di Stato — Alloggiati Web
// (WS_ALLOGGIATI, comunicazione obbligatoria per legge degli ospiti). Nessuna libreria SOAP
// pesante: fetch + costruzione manuale della busta XML, stesso spirito delle altre chiamate
// fetch del progetto.
//
// CONTESTO DI SICUREZZA — leggi prima di modificare questo file:
// - Endpoint reale della Polizia di Stato. Un errore di formato qui non è un bug normale:
//   è una comunicazione sbagliata a un ente pubblico, con rischio di sanzione reale per il
//   proprietario del B&B.
// - Send() — l'invio VERO e DEFINITIVO delle schedine — è implementato (14/09/2026) ma va
//   chiamato SOLO tramite src/lib/alloggiatiInvio.ts, mai direttamente: quel file applica il
//   filtro di sicurezza (solo Tulipano, canali Airbnb/Booking/Diretto) e obbliga un
//   testSchedine() con esito positivo prima di ogni Send(). Vedi il commento su sendSchedine()
//   in fondo al file.
// - Le credenziali si leggono SOLO da process.env (ALLOGGIATI_USER, ALLOGGIATI_PASSWORD,
//   ALLOGGIATI_WSKEY) e non vanno mai loggate, nemmeno negli errori.
//
// Fonti usate per costruire questo file:
// - Prompt operativo di questa sessione (flusso GenerateToken → Authentication_Test già
//   verificato "stanotte", tracciato record a 168 caratteri ricostruito dal manuale ufficiale).
// - Lo schema WSDL pubblico del servizio, scaricato senza credenziali da
//   https://alloggiatiweb.poliziadistato.it/service/service.asmx?WSDL (metadata pubblica,
//   nessun dato sensibile). Da lì vengono i nomi esatti degli elementi di richiesta/risposta
//   qui sotto, e i valori validi dell'enum TipoTabella per Tabella() — che il prompt segnalava
//   come incerti per un bug di estrazione del PDF: dal WSDL risultano essere esattamente
//   "Luoghi" | "Tipi_Documento" | "Tipi_Alloggiato" | "TipoErrore" | "ListaAppartamenti".
//
// CONFERMATO (08/09/2026): con credenziali vere, la risposta reale di GenerateToken ha
// <esito>true</esito> annidato DENTRO <GenerateTokenResult> insieme a <token>/<issued>/
// <expires> (non nel <result> fratello previsto dal WSDL) — il parsing sotto già gestiva
// questo caso come primo tentativo, confermato corretto. authenticationTest() e testSchedine()
// verificati allo stesso modo: GenerateToken→Authentication_Test→Test hanno dato esito:true
// end-to-end, con una schedina di prova formattata da alloggiatiRecordFormat.ts validata dal
// sistema stesso (schedineValide:1). Vedi wiki/entita/salzillo-hospitality.md per i dettagli.

const ENDPOINT = 'https://alloggiatiweb.poliziadistato.it/service/service.asmx';
const SOAP_NS = 'http://www.w3.org/2003/05/soap-envelope';
const SERVICE_NS = 'AlloggiatiService';

// ---------------------------------------------------------------------------
// Tipi
// ---------------------------------------------------------------------------

export type EsitoOperazione = {
  esito: boolean;
  erroreCod?: string;
  erroreDes?: string;
  erroreDettaglio?: string;
};

export type GenerateTokenResult = {
  esito: EsitoOperazione;
  token: string | null;
  issued: string | null;
  expires: string | null;
};

export type TestResult = {
  /** Esito complessivo restituito da <TestResult> (EsitoOperazioneServizio). */
  esito: EsitoOperazione;
  /** <result><SchedineValide> — quante schedine dell'elenco sono risultate valide. */
  schedineValide: number | null;
  /** <result><Dettaglio> — un EsitoOperazioneServizio per ogni riga inviata, stesso ordine. */
  dettaglio: EsitoOperazione[];
  /** Risposta XML grezza, utile per debug quando qualcosa non torna. */
  raw: string;
};

export type TabellaResult = {
  esito: EsitoOperazione;
  csv: string | null;
};

// Valori confermati dallo schema WSDL pubblico (elemento <s:simpleType name="TipoTabella">).
export type TipoTabella = 'Luoghi' | 'Tipi_Documento' | 'Tipi_Alloggiato' | 'TipoErrore' | 'ListaAppartamenti';

// ---------------------------------------------------------------------------
// Helper XML — parsing volutamente semplice (regex tolleranti al prefisso di namespace),
// niente libreria XML pesante. Sufficiente per risposte piatte come queste; se in futuro le
// risposte diventassero più annidate/irregolari, valutare un vero parser.
// ---------------------------------------------------------------------------

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Contenuto del primo tag `tag` trovato (qualunque prefisso di namespace), o null se assente. */
function getTag(xml: string, tag: string): string | null {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'i');
  const m = xml.match(re);
  if (m) return m[1];
  const selfClosing = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?/>`, 'i');
  return selfClosing.test(xml) ? '' : null;
}

/** Contenuto di TUTTE le occorrenze di `tag` allo stesso livello (per elenchi ripetuti). */
function getAllBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

function extractFault(xml: string): string | null {
  const faultBlock = getTag(xml, 'Fault');
  if (faultBlock == null) return null;
  const reason = getTag(faultBlock, 'Text') ?? getTag(faultBlock, 'faultstring') ?? '';
  const code = getTag(faultBlock, 'Value') ?? getTag(faultBlock, 'faultcode') ?? '';
  return [code, reason].filter(Boolean).join(': ') || 'SOAP Fault senza dettagli nel corpo della risposta';
}

function parseEsito(block: string | null): EsitoOperazione {
  if (block == null) return { esito: false };
  const esitoStr = getTag(block, 'esito');
  return {
    esito: esitoStr?.trim().toLowerCase() === 'true',
    erroreCod: getTag(block, 'ErroreCod') ?? undefined,
    erroreDes: getTag(block, 'ErroreDes') ?? undefined,
    erroreDettaglio: getTag(block, 'ErroreDettaglio') ?? undefined,
  };
}

function requireEnv(name: 'ALLOGGIATI_USER' | 'ALLOGGIATI_PASSWORD' | 'ALLOGGIATI_WSKEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Alloggiati Web: variabile d'ambiente ${name} mancante (impostala su Vercel e ripulla con vercel env pull)`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Trasporto SOAP
// ---------------------------------------------------------------------------

function buildEnvelope(bodyXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n<soap:Envelope xmlns:soap="${SOAP_NS}" xmlns:all="${SERVICE_NS}"><soap:Body>${bodyXml}</soap:Body></soap:Envelope>`;
}

async function soapCall(action: string, bodyXml: string): Promise<string> {
  const envelope = buildEnvelope(bodyXml);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      body: envelope,
    });
  } catch (err) {
    throw new Error(`Alloggiati Web: errore di rete chiamando ${action}: ${(err as Error).message}`);
  }

  const text = await res.text();
  const fault = extractFault(text);

  if (!res.ok) {
    throw new Error(
      `Alloggiati Web: HTTP ${res.status} chiamando ${action}` +
        (fault ? ` — ${fault}` : ` — corpo risposta: ${text.slice(0, 500)}`)
    );
  }
  if (fault) {
    throw new Error(`Alloggiati Web: SOAP Fault chiamando ${action} — ${fault}`);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Metodi del servizio
// ---------------------------------------------------------------------------

/**
 * GenerateToken(Utente, Password, WsKey) → token valido 1 ora.
 * Credenziali lette da process.env, mai loggate.
 */
export async function generateToken(): Promise<GenerateTokenResult> {
  const utente = requireEnv('ALLOGGIATI_USER');
  const password = requireEnv('ALLOGGIATI_PASSWORD');
  const wsKey = requireEnv('ALLOGGIATI_WSKEY');

  const body =
    `<all:GenerateToken>` +
    `<all:Utente>${escapeXml(utente)}</all:Utente>` +
    `<all:Password>${escapeXml(password)}</all:Password>` +
    `<all:WsKey>${escapeXml(wsKey)}</all:WsKey>` +
    `</all:GenerateToken>`;

  const xml = await soapCall('GenerateToken', body);

  const responseBlock = getTag(xml, 'GenerateTokenResponse') ?? xml;
  const resultBlock = getTag(responseBlock, 'GenerateTokenResult');

  // Vedi nota in testa al file: proviamo prima <esito> DENTRO GenerateTokenResult (osservazione
  // empirica della sessione di stanotte), poi ripieghiamo sul fratello <result> (schema WSDL).
  let esitoSource: string | null = null;
  if (resultBlock != null && getTag(resultBlock, 'esito') != null) {
    esitoSource = resultBlock;
  } else {
    const remainder = resultBlock != null ? responseBlock.replace(resultBlock, '') : responseBlock;
    esitoSource = getTag(remainder, 'result');
  }

  return {
    esito: parseEsito(esitoSource),
    token: resultBlock != null ? getTag(resultBlock, 'token') : null,
    issued: resultBlock != null ? getTag(resultBlock, 'issued') : null,
    expires: resultBlock != null ? getTag(resultBlock, 'expires') : null,
  };
}

/** Authentication_Test(Utente, token) → conferma che il token è valido. */
export async function authenticationTest(token: string): Promise<EsitoOperazione> {
  const utente = requireEnv('ALLOGGIATI_USER');

  const body =
    `<all:Authentication_Test>` +
    `<all:Utente>${escapeXml(utente)}</all:Utente>` +
    `<all:token>${escapeXml(token)}</all:token>` +
    `</all:Authentication_Test>`;

  const xml = await soapCall('Authentication_Test', body);
  const resultBlock = getTag(xml, 'Authentication_TestResult');
  return parseEsito(resultBlock);
}

/**
 * Test(Utente, token, ElencoSchedine) → valida SENZA inviare. Usare SEMPRE e SOLO questo
 * metodo per verificare il formato delle schedine — mai Send().
 */
export async function testSchedine(token: string, righe: string[]): Promise<TestResult> {
  const utente = requireEnv('ALLOGGIATI_USER');

  const elencoXml = righe.map((r) => `<all:string>${escapeXml(r)}</all:string>`).join('');
  const body =
    `<all:Test>` +
    `<all:Utente>${escapeXml(utente)}</all:Utente>` +
    `<all:token>${escapeXml(token)}</all:token>` +
    `<all:ElencoSchedine>${elencoXml}</all:ElencoSchedine>` +
    `</all:Test>`;

  const xml = await soapCall('Test', body);

  const responseBlock = getTag(xml, 'TestResponse') ?? xml;
  const testResultBlock = getTag(responseBlock, 'TestResult');
  const resultBlock = getTag(responseBlock, 'result'); // ElencoSchedineEsito

  const schedineValideStr = resultBlock != null ? getTag(resultBlock, 'SchedineValide') : null;
  const dettaglioBlock = resultBlock != null ? getTag(resultBlock, 'Dettaglio') : null;
  const dettaglio = dettaglioBlock != null ? getAllBlocks(dettaglioBlock, 'EsitoOperazioneServizio').map(parseEsito) : [];

  return {
    esito: parseEsito(testResultBlock),
    schedineValide: schedineValideStr != null && schedineValideStr !== '' ? parseInt(schedineValideStr, 10) : null,
    dettaglio,
    raw: xml,
  };
}

/**
 * Tabella(Utente, token, tipo) → CSV (separatore ;) con i codici REALI da usare nelle
 * schedine. Valori validi di `tipo` confermati dallo schema WSDL pubblico.
 */
export async function downloadTabella(token: string, tipo: TipoTabella): Promise<TabellaResult> {
  const utente = requireEnv('ALLOGGIATI_USER');

  const body =
    `<all:Tabella>` +
    `<all:Utente>${escapeXml(utente)}</all:Utente>` +
    `<all:token>${escapeXml(token)}</all:token>` +
    `<all:tipo>${escapeXml(tipo)}</all:tipo>` +
    `</all:Tabella>`;

  const xml = await soapCall('Tabella', body);
  const responseBlock = getTag(xml, 'TabellaResponse') ?? xml;
  const resultBlock = getTag(responseBlock, 'TabellaResult');

  return {
    esito: parseEsito(resultBlock),
    csv: getTag(responseBlock, 'CSV'),
  };
}

/**
 * Send(Utente, token, ElencoSchedine) → invio VERO e DEFINITIVO delle schedine alla Polizia
 * di Stato. Implementato il 14/09/2026 su richiesta esplicita di Raffaele, dopo il test
 * supervisionato in modalità Test (08/09/2026, Francesco La Manna + Silvia Vita).
 *
 * SICUREZZA: questa funzione NON va mai chiamata direttamente da una route senza prima aver
 * chiamato testSchedine() sulle stesse righe e aver verificato che l'esito sia positivo — vedi
 * src/lib/alloggiatiInvio.ts, che è l'UNICO punto del progetto autorizzato a orchestrare
 * Test→Send, con il filtro "solo Tulipano, canali Airbnb/Booking/Diretto" applicato PRIMA di
 * arrivare qui (wiki/decisioni/solo-tulipano-va-inviato-ad-alloggiati-e-sinfonia.md) e con
 * l'invio sempre innescato da un click esplicito di Raffaele (mai automatico/in batch).
 * Stesso pattern di testSchedine(), stesso parsing — cambia solo l'elemento SOAP.
 */
export async function sendSchedine(token: string, righe: string[]): Promise<TestResult> {
  const utente = requireEnv('ALLOGGIATI_USER');

  const elencoXml = righe.map((r) => `<all:string>${escapeXml(r)}</all:string>`).join('');
  const body =
    `<all:Send>` +
    `<all:Utente>${escapeXml(utente)}</all:Utente>` +
    `<all:token>${escapeXml(token)}</all:token>` +
    `<all:ElencoSchedine>${elencoXml}</all:ElencoSchedine>` +
    `</all:Send>`;

  const xml = await soapCall('Send', body);

  const responseBlock = getTag(xml, 'SendResponse') ?? xml;
  const sendResultBlock = getTag(responseBlock, 'SendResult');
  const resultBlock = getTag(responseBlock, 'result'); // ElencoSchedineEsito

  const schedineValideStr = resultBlock != null ? getTag(resultBlock, 'SchedineValide') : null;
  const dettaglioBlock = resultBlock != null ? getTag(resultBlock, 'Dettaglio') : null;
  const dettaglio = dettaglioBlock != null ? getAllBlocks(dettaglioBlock, 'EsitoOperazioneServizio').map(parseEsito) : [];

  return {
    esito: parseEsito(sendResultBlock),
    schedineValide: schedineValideStr != null && schedineValideStr !== '' ? parseInt(schedineValideStr, 10) : null,
    dettaglio,
    raw: xml,
  };
}
