import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { getStruttura } from '@/lib/strutture';
import { leggiPrenotazioni } from '@/lib/prenotazioni';

// Promemoria giornaliero, simmetrico a /api/cron/checkout-reminder: chi ha check-in
// oggi, con un link "tocca e invia" già compilato per mandare la guida della stanza
// giusta su WhatsApp. Vedi wiki/sintesi/messaggi-checkin-ospiti.md per il contesto.

type Booking = { checkin: string; checkout: string; ospite: string; stanza: string; stato: string; telefono?: string };

function parseItDate(d: string): Date | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toWaNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  let n = digits.startsWith('+') ? digits.slice(1) : digits;
  if (n.startsWith('00')) n = n.slice(2);
  if (!n.startsWith('39') && n.length <= 10) n = '39' + n;
  return n;
}

// Testo/URL per struttura ora centralizzati in src/lib/strutture.ts (09/09/2026) — stesso
// identico testo di prima per ognuna delle 5, solo non più duplicato riga per riga qui.
function guideMessage(stanza: string): string | null {
  const s = getStruttura(stanza);
  if (!s?.checkinGuideUrl || !s.guideMessageText) return null;
  return `${s.guideMessageText}\n${s.emoji ?? ''} ${s.checkinGuideUrl}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const prenotazioni = await leggiPrenotazioni();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkinOggi = (prenotazioni as Booking[]).filter((b) => {
      if (b.stato !== 'Attiva') return false;
      const ci = parseItDate(b.checkin);
      return ci ? sameDay(ci, today) : false;
    });

    if (checkinOggi.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Nessun check-in oggi', dryRun });
    }

    const righe = checkinOggi.map((b) => {
      const guida = guideMessage(b.stanza);
      const num = b.telefono ? toWaNumber(b.telefono) : null;
      if (!guida) {
        return `👤 *${b.ospite}* — ${b.stanza}\n⚠️ Nessuna guida web per questa stanza ancora — invia le info a mano.`;
      }
      if (!num) {
        return `👤 *${b.ospite}* — ${b.stanza}\n⚠️ Nessun numero registrato, invia a mano la guida di check-in.`;
      }
      const link = `https://wa.me/${num}?text=${encodeURIComponent(guida)}`;
      return `👤 *${b.ospite}* — ${b.stanza}\n👉 [Tocca per inviare la guida di check-in](${link})`;
    });

    const text = `☀️ *Check-in di oggi*\n\n${righe.join('\n\n')}\n\nMandala con comodo prima delle 15:00, così l'ospite arriva già informato.`;

    if (chatId && token && !dryRun) {
      const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      });
      const res2 = await send('Markdown');
      if (!res2.ok) await send();
    }

    return NextResponse.json({ ok: true, sent: !dryRun, count: checkinOggi.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel promemoria check-in:', err);
    if (!dryRun) await alertCronFailure('promemoria check-in', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
