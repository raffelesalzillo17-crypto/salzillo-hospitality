import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Legge i dati anagrafici da una foto di un documento d'identità (carta d'identità, passaporto,
// patente) usando Claude — stessa idea di quando Raffaele manda una foto di un documento in
// chat e viene letta al volo, ma richiamabile da codice per il check-in pubblico degli ospiti
// (nessun essere umano presente a leggere la foto per loro). Riusa lo stesso client/modello già
// in uso per il bot Telegram (src/lib/assistantCore.ts, ANTHROPIC_API_KEY già configurata).
//
// Importante: questo è un AIUTO per pre-compilare il form, mai una scrittura diretta — l'ospite
// vede sempre i campi già compilati e può correggerli prima di inviare (vedi
// public/checkin/checkin-gate.js). Nessun dato legalmente rilevante viene salvato senza che un
// umano l'abbia visto e confermato.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOL_ESTRAI: Anthropic.Tool = {
  name: 'estrai_dati_documento',
  description: 'Registra i dati anagrafici letti dalla foto del documento. Usa stringa vuota "" per qualunque campo non leggibile o assente — mai inventare un valore.',
  input_schema: {
    type: 'object',
    properties: {
      cognome: { type: 'string' },
      nome: { type: 'string' },
      sesso: { type: 'string', enum: ['M', 'F', ''], description: 'M o F se leggibile/deducibile dal documento, altrimenti stringa vuota.' },
      dataNascita: { type: 'string', description: 'Formato GG/MM/AAAA' },
      luogoNascita: { type: 'string', description: 'Comune o città di nascita, nome leggibile (es. "Marcianise", "Parigi").' },
      statoNascita: { type: 'string', description: 'Nazione di nascita, nome leggibile in italiano (es. "Italia", "Francia"). Se il documento non lo indica esplicitamente ma il luogo di nascita è chiaramente italiano, usa "Italia".' },
      cittadinanza: { type: 'string', description: 'Nazionalità/cittadinanza, nome leggibile in italiano (es. "Italia"). Sui documenti italiani spesso non è scritta esplicitamente: in quel caso usa "Italia".' },
      tipoDocumento: { type: 'string', enum: ["Carta d'identità", 'Passaporto', 'Patente', ''] },
      numeroDocumento: { type: 'string' },
      luogoRilascioDocumento: { type: 'string', description: 'Comune o autorità di rilascio, se leggibile.' },
    },
    required: ['cognome', 'nome', 'sesso', 'dataNascita', 'luogoNascita', 'statoNascita', 'cittadinanza', 'tipoDocumento', 'numeroDocumento', 'luogoRilascioDocumento'],
  },
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
  // Claude non legge HEIC/HEIF (il formato di default delle foto su iPhone) — il gate lato
  // client (checkin-gate.js) le converte già in JPEG prima di arrivare qui, ma un formato
  // ancora diverso/inatteso va segnalato chiaramente invece di far fallire la chiamata ad
  // Anthropic con un errore criptico.
  const TIPI_SUPPORTATI = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
  if (!TIPI_SUPPORTATI.has(mediaType)) {
    return NextResponse.json({ error: `Formato immagine non supportato (${mediaType}) — riprova con un'altra foto.` }, { status: 415 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Lettura automatica non configurata su questo server' }, { status: 500 });
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1024,
      system: 'Leggi la foto di un documento d\'identità (carta d\'identità, passaporto o patente) e registra i dati con lo strumento fornito. Non inventare mai un dato che non riesci a leggere: usa stringa vuota. Non commentare, chiama solo lo strumento.',
      tools: [TOOL_ESTRAI],
      tool_choice: { type: 'tool', name: 'estrai_dati_documento' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: imageBase64 } },
            { type: 'text', text: 'Leggi questo documento ed estrai i dati.' },
          ],
        },
      ],
    });

    const toolUse = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      return NextResponse.json({ error: 'Lettura non riuscita — compila i dati a mano.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, dati: toolUse.input });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
