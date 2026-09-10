import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { controllaTuttiICalendari } from '@/lib/db/ical';

// Controllo giornaliero: confronta i calendari Airbnb/Booking (iCal) con le nostre
// prenotazioni e avvisa su Telegram se qualcosa non torna.

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const esiti = await controllaTuttiICalendari();
    const problemi = esiti.filter((e) => e.errore || e.mancano.length || e.inPiu.length);

    const chatId = process.env.ALLOWED_CHAT_ID, token = process.env.TELEGRAM_BOT_TOKEN;
    if (problemi.length && chatId && token) {
      const testo = ['\u26a0\ufe0f *Controllo calendari \u2014 qualcosa non torna:*', '',
        ...problemi.map((p) => {
          const righe = [`*${p.alloggio} \u00b7 ${p.calendario}*`];
          if (p.errore) righe.push(`  errore: ${p.errore}`);
          p.mancano.forEach((m) => righe.push(`  \ud83d\udce5 ${m.start}\u2192${m.end}: c'\u00e8 su ${p.calendario} ma non da noi`));
          p.inPiu.forEach((m) => righe.push(`  \ud83d\udce4 ${m.start}\u2192${m.end} (${m.ospite}): da noi ma non su ${p.calendario}`));
          return righe.join('\n');
        })].join('\n');
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: testo, parse_mode: 'Markdown' }),
      });
    }
    return NextResponse.json({ ok: true, controllati: esiti.length, problemi: problemi.length, esiti });
  } catch (err) {
    await alertCronFailure('controllo calendari', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
