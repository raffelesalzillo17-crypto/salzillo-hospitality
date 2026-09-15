import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { inviaTelegram, eseguiSyncEmailPrenotazioni } from '@/lib/telegramDigest';

// Legge la casella salzillohospitality@gmail.com e trasforma le conferme di prenotazione
// Airbnb/Booking.com in nuove righe sul foglio, senza intervento manuale — vedi
// wiki/entita/salzillo-hospitality.md, "Sync email prenotazioni" (08/09/2026) per il contesto
// e per il perché Booking.com resta ad alert (la mail di Booking non contiene i dati, solo
// un numero di prenotazione e un link all'Extranet). Dal 15/09/2026 non è più schedulato da
// solo in vercel.json — confluisce in /api/cron/digest-sera (troppi messaggi Telegram sparsi
// durante il giorno). Resta qui, richiamabile a mano (anche con ?dryRun=1), per test/debug
// mirati; la logica vera è condivisa in src/lib/telegramDigest.ts.
//
// Airbnb: se TUTTI i campi necessari si leggono con sicurezza dall'email, la prenotazione
// viene creata in automatico (stessa API POST /api/prenotazione usata dal resto del sito) e
// Raffaele riceve solo una conferma. Se anche un solo campo manca, NON si inventa nulla:
// arriva un alert Telegram con quello che si è capito, da completare a mano su Motore Rafilu.
//
// Deduplica: un tab dedicato "EmailProcessate" sullo stesso foglio Google (creato al primo
// avvio se non esiste) tiene traccia degli ID email già gestiti, per non ricreare la stessa
// prenotazione o rimandare lo stesso alert ad ogni esecuzione.

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';
  const origin = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : req.nextUrl.origin;
  try {
    const testi = await eseguiSyncEmailPrenotazioni(origin, dryRun);
    if (!dryRun) for (const t of testi) await inviaTelegram(t);
    return NextResponse.json({ ok: true, dryRun, count: testi.length, testi });
  } catch (err) {
    console.error('Errore nel sync email prenotazioni:', err);
    if (!dryRun) await alertCronFailure('sync email prenotazioni', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
