import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { leggiPrenotazioni } from '@/lib/prenotazioni';
import { requireAccesso } from '@/lib/requireAccesso';

// Chiusa il 13/11/2026 su richiesta di Raffaele, dopo che lui e la collaboratrice (Lella) sono passati
// al nuovo gestionale con il link personale (/entra?k=...). Prima era aperta a chiunque conoscesse l'URL
// (nomi e telefoni degli ospiti) perché il vecchio sito `/` la leggeva senza login (decisione del
// 10/09/2026, ora superata). Ora serve una di queste credenziali:
//  - la chiave di Duet/Plancia (x-duet-key = DUET_LETTURA_KEY), usata dal server di plancia-raffaele;
//  - la chiave di Motore Rafilu (x-plancia-key) o un accesso valido del vecchio sistema (requireAccesso).
// Il vecchio sito `/` non ha più accesso: chi lo apre vede il messaggio qui sotto.
// Per riaprirla in caso di emergenza basta rimettere la versione precedente di questo file.

function chiaveDuetValida(req: NextRequest): boolean {
  const attesa = process.env.DUET_LETTURA_KEY || '';
  const data = req.headers.get('x-duet-key') || '';
  if (attesa.length < 32 || data.length !== attesa.length) return false;
  return timingSafeEqual(Buffer.from(data), Buffer.from(attesa));
}

export async function GET(req: NextRequest) {
  if (!chiaveDuetValida(req)) {
    const accesso = await requireAccesso(req);
    if ('risposta' in accesso) {
      return NextResponse.json({ ok: false, error: 'Questo vecchio sito non è più attivo: apri il tuo link personale del nuovo gestionale.' }, { status: 401 });
    }
  }
  try {
    const prenotazioni = await leggiPrenotazioni();
    return NextResponse.json({ ok: true, prenotazioni });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[prenotazioni] ERRORE:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
