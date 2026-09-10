import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudioViaGroq } from '@/lib/assistantCore';

// Trascrizione vocale per il microfono della barra della dashboard — stessa Groq/Whisper
// già usata dal bot Telegram (src/lib/assistantCore.ts). Protetta dalla stessa chiave della
// dashboard, non da Telegram, quindi il controllo qui è sull'header x-plancia-key.

export async function POST(req: NextRequest) {
  const expectedKey = process.env.PLANCIA_ACCESS_KEY;
  if (expectedKey && req.headers.get('x-plancia-key') !== expectedKey) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  try {
    const form = await req.formData();
    const audio = form.get('audio');
    if (!audio || !(audio instanceof Blob)) {
      return NextResponse.json({ ok: false, error: 'Nessun audio ricevuto' }, { status: 400 });
    }
    const buf = Buffer.from(await audio.arrayBuffer());
    const mimeType = audio.type || 'audio/webm';
    const ext = mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : mimeType.includes('wav') ? 'wav' : 'webm';
    const text = await transcribeAudioViaGroq(buf, `voice.${ext}`, mimeType);
    if (!text) return NextResponse.json({ ok: false, error: 'Non ho capito nulla dal vocale, riprova parlando più chiaro.' });
    return NextResponse.json({ ok: true, text });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
