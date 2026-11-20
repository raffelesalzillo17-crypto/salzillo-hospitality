// Lettura dei dati anagrafici da un documento d'identità (foto o PDF) con Gemini.
// Estratta da /api/checkin-ocr il 20/11/2026 per due motivi: (1) più tentativi con attese
// crescenti — il livello gratuito risponde spesso 503 "alta domanda" e un solo ritentativo non
// bastava (fallito il 19/11 sera e già l'11/11); (2) poterla chiamare direttamente da altre route
// senza rifare un fetch HTTP con il file in base64 (che sfora il limite di ~4,5 MB del corpo).
//
// È un AIUTO per pre-compilare: mai una scrittura diretta di un dato legalmente rilevante.

const MODELLO = 'gemini-3.6-flash';
// Quota e capacità separate da 3.6-flash (il 2.5-flash dà 404 sulle chiavi nuove).
// Pensato per estrazione documenti e JSON; accetta foto e PDF.
const MODELLO_RISERVA = 'gemini-3.5-flash-lite';

export const TIPI_OCR_SUPPORTATI = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf',
]);

const SCHEMA_ESTRAZIONE = {
  type: 'OBJECT',
  properties: {
    cognome: { type: 'STRING' },
    nome: { type: 'STRING' },
    sesso: { type: 'STRING', description: 'Esattamente "M" o "F" se leggibile/deducibile dal documento, altrimenti stringa vuota "". Nessun altro valore.' },
    dataNascita: { type: 'STRING', description: 'Formato GG/MM/AAAA' },
    luogoNascita: { type: 'STRING', description: 'Comune o città di nascita copiato ESATTAMENTE come stampato, senza aggiungere, completare o correggere parole (se c\'è scritto "ROSSANO" scrivi "ROSSANO", mai "Rossano Calabro"). Senza la sigla della provincia tra parentesi, che va in provinciaNascita.' },
    provinciaNascita: { type: 'STRING', description: 'Sigla di 2 lettere della provincia di nascita se stampata (es. "CS"), altrimenti stringa vuota "".' },
    statoNascita: { type: 'STRING', description: 'Nazione di nascita, nome leggibile in italiano (es. "Italia", "Francia"). Se il documento non lo indica esplicitamente ma il luogo di nascita è chiaramente italiano, usa "Italia".' },
    cittadinanza: { type: 'STRING', description: 'Nazionalità/cittadinanza, nome leggibile in italiano (es. "Italia"). Sui documenti italiani spesso non è scritta esplicitamente: in quel caso usa "Italia".' },
    tipoDocumento: { type: 'STRING', description: 'Esattamente uno tra "Carta d\'identità", "Passaporto", "Patente", oppure stringa vuota "" se non riconoscibile. Nessun altro valore.' },
    numeroDocumento: { type: 'STRING' },
    luogoRilascioDocumento: { type: 'STRING', description: 'Comune o autorità di rilascio SOLO se è stampato esplicitamente come luogo di rilascio (es. "Questura di Napoli", "Comune di Roma"). Non copiare il luogo di nascita né la residenza. Sui passaporti italiani l\'autorità è il Ministero degli Affari Esteri: in quel caso, e se non leggibile, stringa vuota "".' },
  },
  required: ['cognome', 'nome', 'sesso', 'dataNascita', 'luogoNascita', 'provinciaNascita', 'statoNascita', 'cittadinanza', 'tipoDocumento', 'numeroDocumento', 'luogoRilascioDocumento'],
};

export type DatiDocumento = {
  cognome: string; nome: string; sesso: string; dataNascita: string; luogoNascita: string;
  provinciaNascita?: string; statoNascita: string; cittadinanza: string; tipoDocumento: string; numeroDocumento: string;
  luogoRilascioDocumento: string;
};

export type EsitoOcr = { ok: true; dati: DatiDocumento } | { ok: false; error: string; status: number };

// Errori transitori lato Google: vale la pena riprovare. 4xx diversi da 429 no.
const RIPROVABILI = new Set([429, 500, 502, 503, 504]);
const ATTESE_MS = [1500, 3000, 5000]; // fino a 4 tentativi, entro il budget di 48 s

export async function leggiDocumento(imageBase64: string, mediaType: string): Promise<EsitoOcr> {
  if (!TIPI_OCR_SUPPORTATI.has(mediaType)) {
    return { ok: false, error: `Formato non supportato (${mediaType}) — riprova con una foto o un PDF.`, status: 415 };
  }
  if (!process.env.GEMINI_API_KEY) {
    return { ok: false, error: 'Lettura automatica non configurata su questo server', status: 500 };
  }

  const chiama = (timeoutMs: number, modello: string) => fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'Leggi il documento d\'identità (carta d\'identità, passaporto o patente; può essere una foto o un PDF) e registra i dati nel formato richiesto. Non inventare mai un dato che non riesci a leggere: usa stringa vuota "".' }],
        },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: mediaType, data: imageBase64 } },
            { text: 'Leggi questo documento ed estrai i dati.' },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA_ESTRAZIONE },
      }),
    },
  );

  try {
    // Ogni tentativo ha un tetto di tempo: senza, una chiamata appesa a Gemini (vista nella prova
    // del 20/11: 503 poi silenzio) consumava tutti i 60 s della funzione e la route moriva in 504.
    // Il tetto dell'11/11 (11 s) era troppo stretto per la foto vera di un passaporto: nei log
    // del 20/11 i tentativi scadevano tutti a 11 s. Ora c'è un budget totale di 48 s (la funzione
    // ne ha 60, e la route dei documenti scarica prima il file da Drive): ogni tentativo usa il tempo che resta, fino a 26 s.
    const fine = Date.now() + 48000;
    // Primo tentativo sul modello principale; se risponde 503/429/5xx o non risponde,
    // i ritentativi usano 3.5-flash-lite (quota distinta, spesso più disponibile sul livello gratuito).
    const tentativo = async (modello: string): Promise<Response | null> => {
      const resto = fine - Date.now();
      if (resto < 4000) return null;
      try { return await chiama(Math.min(26000, resto), modello); } catch (e) {
        console.error('[ocr-documento] tentativo fallito/scaduto:', modello, e instanceof Error ? e.message : String(e));
        return null;
      }
    };
    let modello = MODELLO;
    let res = await tentativo(modello);
    for (const attesa of ATTESE_MS) {
      if (res && (res.ok || !RIPROVABILI.has(res.status))) break;
      if (fine - Date.now() < 8000) break;
      const fallito = modello;
      if (modello === MODELLO) modello = MODELLO_RISERVA;
      if (res) console.error('[ocr-documento] Gemini', fallito, res.status, '— riprovo con', modello, 'tra', attesa, 'ms');
      else console.error('[ocr-documento] nessuna risposta da', fallito, '— riprovo con', modello, 'tra', attesa, 'ms');
      await new Promise((r) => setTimeout(r, attesa));
      res = await tentativo(modello);
    }

    if (!res || !res.ok) {
      const testo = res ? await res.text().catch(() => '') : 'nessuna risposta (timeout)';
      console.error('[ocr-documento] Gemini ERRORE:', modello, res?.status, testo);
      return { ok: false, error: 'Lettura non riuscita — compila i dati a mano.', status: 502 };
    }

    const data = await res.json();
    const testoJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!testoJson) return { ok: false, error: 'Lettura non riuscita — compila i dati a mano.', status: 502 };

    let dati: DatiDocumento;
    try { dati = JSON.parse(testoJson); } catch {
      return { ok: false, error: 'Lettura non riuscita — compila i dati a mano.', status: 502 };
    }

    // Lo schema di Gemini non accetta enum con valore vuoto: normalizza qui sesso e tipo.
    const sesso = dati.sesso?.trim().toUpperCase();
    dati.sesso = sesso === 'M' || sesso === 'MASCHIO' ? 'M' : sesso === 'F' || sesso === 'FEMMINA' ? 'F' : '';
    const TIPI_DOC = ["Carta d'identità", 'Passaporto', 'Patente'];
    if (dati.tipoDocumento && !TIPI_DOC.includes(dati.tipoDocumento)) {
      const t = dati.tipoDocumento.toLowerCase();
      dati.tipoDocumento = t.includes('ident') ? "Carta d'identità" : t.includes('passaport') ? 'Passaporto' : t.includes('patente') ? 'Patente' : '';
    }
    return { ok: true, dati };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), status: 500 };
  }
}
