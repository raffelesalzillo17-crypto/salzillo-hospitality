import { NextRequest, NextResponse } from 'next/server';
import { leggiDocumento } from '@/lib/ocrDocumento';

// Legge i dati anagrafici da una foto (o PDF) di un documento d'identità — richiamabile da codice
// per il check-in pubblico degli ospiti (nessun essere umano presente a leggere la foto per loro).
//
// La logica (Gemini, ritentativi sui 503, normalizzazione) sta in src/lib/ocrDocumento.ts dal
// 20/11/2026. Contratto invariato: {imageBase64, mediaType} in ingresso, {ok, dati} in uscita,
// così checkin-gate.js non cambia.
//
// Importante: è un AIUTO per pre-compilare il form, mai una scrittura diretta — l'ospite vede
// sempre i campi già compilati e può correggerli prima di inviare.

export const maxDuration = 60; // fino a 4 tentativi con attese crescenti

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

  const esito = await leggiDocumento(imageBase64, mediaType);
  if (!esito.ok) return NextResponse.json({ error: esito.error }, { status: esito.status });
  return NextResponse.json({ ok: true, dati: esito.dati });
}
