import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { leggiPulizieDb } from '@/lib/db/queries';

// Promemoria giornaliero: le pulizie da fare domani, non ancora confermate — così non si
// scopre solo aprendo la scheda Pulizie del nuovo sistema. Stesso schema di checkin-reminder/
// checkout-reminder (vedi quei file), ma niente WhatsApp qui: la pulizia riguarda noi, non
// un ospite da contattare.

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const domani = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const tutte = await leggiPulizieDb();
    const daFareDomani = tutte.filter((p) => p.data === domani && !p.confermataIl);

    if (daFareDomani.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Nessuna pulizia da fare domani', dryRun });
    }

    const [gg, mm, aa] = [domani.slice(8, 10), domani.slice(5, 7), domani.slice(0, 4)];
    const righe = daFareDomani.map((p) => `🧹 *${p.alloggio}*${p.note ? ` — ${p.note}` : ''}${p.pagata ? ' (pagata dall’ospite)' : ''}`);
    const text = `🧹 *Pulizie da fare domani (${gg}/${mm}/${aa})*\n\n${righe.join('\n')}\n\nSegna fatta dalla scheda Pulizie appena finita.`;

    if (chatId && token && !dryRun) {
      const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      });
      const res = await send('Markdown');
      if (!res.ok) await send();
    }

    return NextResponse.json({ ok: true, sent: !dryRun, count: daFareDomani.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel promemoria pulizie:', err);
    if (!dryRun) await alertCronFailure('promemoria pulizie', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
