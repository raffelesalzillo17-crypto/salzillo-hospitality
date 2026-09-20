import { NextRequest, NextResponse } from 'next/server';

// Legge i dati anagrafici da una foto di un documento d'identità (carta d'identità, passaporto,
// patente) — stessa idea di quando Raffaele manda una foto di un documento in chat e viene letta
// al volo, ma richiamabile da codice per il check-in pubblico degli ospiti (nessun essere umano
// presente a leggere la foto per loro).
//
// Passato da Claude a Gemini il 20/09/2026: stesso identico contratto (imageBase64/mediaType in
// ingresso, {ok, dati} in uscita) così checkin-gate.js non ha bisogno di cambiare — solo il
// fornitore AI dietro le quinte, per restare sul livello gratuito invece di consumare credito a
// pagamento su una funzione a basso volume (poche foto a settimana). Vedi
// wiki/decisioni/ per il perché del cambio.
//
// Importante: questo è un AIUTO per pre-compilare il form, mai una scrittura diretta — l'ospite
// vede sempre i campi già compilati e può correggerli prima di inviare (vedi
// public/checkin/checkin-gate.js). Nessun dato legalmente rilevante viene salvato senza che un
// umano l'abbia visto e confermato.

const MODELLO = 'gemini-3.6-flash';

const SCHEMA_ESTRAZIONE = {
  type: 'OBJECT',
  properties: {
    cognome: { type: 'STRING' },
    nome: { type: 'STRING' },
    sesso: { type: 'STRING', description: 'Esattamente "M" o "F" se leggibile/deducibile dal documento, altrimenti stringa vuota "". Nessun altro valore.' },
    dataNascita: { type: 'STRING', description: 'Formato GG/MM/AAAA' },
    luogoNascita: { type: 'STRING', description: 'Comune o città di nascita, nome leggibile (es. "Marcianise", "Parigi").' },
    statoNascita: { type: 'STRING', description: 'Nazione di nascita, nome leggibile in italiano (es. "Italia", "Francia"). Se il documento non lo indica esplicitamente ma il luogo di nascita è chiaramente italiano, usa "Italia".' },
    cittadinanza: { type: 'STRING', description: 'Nazionalità/cittadinanza, nome leggibile in italiano (es. "Italia"). Sui documenti italiani spesso non è scritta esplicitamente: in quel caso usa "Italia".' },
    tipoDocumento: { type: 'STRING', description: 'Esattamente uno tra "Carta d\'identità", "Passaporto", "Patente", oppure stringa vuota "" se non riconoscibile. Nessun altro valore.' },
    numeroDocumento: { type: 'STRING' },
    luogoRilascioDocumento: { type: 'STRING', description: 'Comune o autorità di rilascio, se leggibile.' },
  },
  required: ['cognome', 'nome', 'sesso', 'dataNascita', 'luogoNascita', 'statoNascita', 'cittadinanza', 'tipoDocumento', 'numeroDocumento', 'luogoRilascioDocumento'],
};

type DatiDocumento = {
  cognome: string; nome: string; sesso: string; dataNascita: string; luogoNascita: string;
  statoNascita: string; cittadinanza: string; tipoDocumento: string; numeroDocumento: string;
  luogoRilascioDocumento: string;
};

export async function POST(req: NextRequest) {
  let body: { imageBase64?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { imageBase64, mediaType } = body;
  if (!imageBase64 || !mediaType) {
    return NextResponse.json({ error: 'Mancano imageBase64/mediaType' }, { status: 400 });
  }
  // HEIC/HEIF non è tra i formati immagine di Gemini — il gate lato client (checkin-gate.js)
  // converte già tutto in JPEG prima di arrivare qui, ma un formato ancora diverso/inatteso va
  // segnalato chiaramente invece di far fallire la chiamata con un errore criptico.
  const TIPI_SUPPORTATI = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
  if (!TIPI_SUPPORTATI.has(mediaType)) {
    return NextResponse.json({ error: `Formato immagine non supportato (${mediaType}) — riprova con un'altra foto.` }, { status: 415 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: 'Lettura automatica non configurata su questo server' }, { status: 500 });
  }

  try {
    const chiamaGemini = () => fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODELLO}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: 'Leggi la foto di un documento d\'identità (carta d\'identità, passaporto o patente) e registra i dati nel formato richiesto. Non inventare mai un dato che non riesci a leggere: usa stringa vuota "".' }],
          },
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: mediaType, data: imageBase64 } },
              { text: 'Leggi questo documento ed estrai i dati.' },
            ],
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SCHEMA_ESTRAZIONE,
          },
        }),
      },
    );

    // Il livello gratuito di Gemini a volte risponde 503 "alta domanda" — transitorio, capitato
    // anche solo testando questa funzione. Un solo ritentativo dopo una breve attesa evita di
    // far fallire il check-in di un ospite vero per un sovraccarico passeggero lato Google.
    let res = await chiamaGemini();
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 1500));
      res = await chiamaGemini();
    }

    if (!res.ok) {
      const testo = await res.text().catch(() => '');
      console.error('[checkin-ocr] Gemini ERRORE:', res.status, testo);
      return NextResponse.json({ error: 'Lettura non riuscita — compila i dati a mano.' }, { status: 502 });
    }

    const data = await res.json();
    const testoJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!testoJson) {
      return NextResponse.json({ error: 'Lettura non riuscita — compila i dati a mano.' }, { status: 502 });
    }

    let dati: DatiDocumento;
    try {
      dati = JSON.parse(testoJson);
    } catch {
      return NextResponse.json({ error: 'Lettura non riuscita — compila i dati a mano.' }, { status: 502 });
    }

    // A differenza di Claude, lo schema strutturato di Gemini non accetta un enum con valore
    // vuoto incluso — questi due campi restano quindi STRING libere guidate solo dal testo
    // della description, senza garanzia rigida sul valore. Normalizza qui i casi più comuni
    // (minuscolo, "Maschio/Femmina") invece di scaricare quel rischio sul form dell'ospite.
    const sesso = dati.sesso?.trim().toUpperCase();
    dati.sesso = sesso === 'M' || sesso === 'MASCHIO' ? 'M' : sesso === 'F' || sesso === 'FEMMINA' ? 'F' : '';
    const TIPI_DOC = ["Carta d'identità", 'Passaporto', 'Patente'];
    if (dati.tipoDocumento && !TIPI_DOC.includes(dati.tipoDocumento)) {
      const t = dati.tipoDocumento.toLowerCase();
      dati.tipoDocumento = t.includes('ident') ? "Carta d'identità" : t.includes('passaport') ? 'Passaporto' : t.includes('patente') ? 'Patente' : '';
    }

    return NextResponse.json({ ok: true, dati });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
