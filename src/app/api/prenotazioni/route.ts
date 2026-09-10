import { NextResponse } from 'next/server';
import { leggiPrenotazioni } from '@/lib/prenotazioni';

// Autenticazione RIMOSSA il 10/09/2026 su richiesta di Raffaele (vedi src/app/page.tsx per
// il contesto). Tornerà nel nuovo sistema a database. Fino ad allora questa rotta è aperta,
// come lo era prima del 09/09.

export async function GET() {
  try {
    const prenotazioni = await leggiPrenotazioni();
    return NextResponse.json({ ok: true, prenotazioni });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[prenotazioni] ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
