import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, testoEventiLocali } from '@/lib/telegramDigest';

// Ricerca eventi locali (sagre, fiere, concerti, ponti) in autonomia — SOLO materiale per
// l'analisi prezzi di Raffaele, mai un cambio prezzo automatico. Dal 15/09/2026 non è più
// schedulato da solo in vercel.json — confluisce nel /api/cron/digest-sera del lunedì (troppi
// messaggi Telegram sparsi durante il giorno). Resta qui, richiamabile a mano (anche con
// ?dryRun=1), per test/debug mirati; la logica vera è condivisa in src/lib/telegramDigest.ts.

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  try {
    const text = await testoEventiLocali(dryRun);
    if (!text) return NextResponse.json({ ok: true, aggiunti: 0, dryRun });
    if (!dryRun) await inviaTelegram(text);
    return NextResponse.json({ ok: true, text, dryRun });
  } catch (err) {
    console.error('Errore nella ricerca eventi locali:', err);
    if (!dryRun) await alertCronFailure('ricerca eventi locali', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
