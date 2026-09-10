import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { leggiPrenotazioni } from '@/lib/prenotazioni';

// Promemoria giornaliero: chi ha fatto check-out oggi, con un link "tocca e invia" già
// compilato per la richiesta di recensione su WhatsApp. Separato dal digest mattutino
// (vedi /api/cron/digest) perché ha un momento diverso: dopo il check-out (le 10:00),
// non a colazione. Vedi wiki/sintesi/messaggi-checkin-ospiti.md per il contesto.

type Booking = { checkin: string; checkout: string; ospite: string; stanza: string; stato: string; telefono?: string };

function parseItDate(d: string): Date | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Normalizza un numero italiano scritto in formati diversi (spazi, trattini, +39, 0039, senza prefisso)
// nel formato numerico puro richiesto da wa.me. Ritorna null se non c'è nulla di utilizzabile.
function toWaNumber(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  let n = digits.startsWith('+') ? digits.slice(1) : digits;
  if (n.startsWith('00')) n = n.slice(2);
  if (!n.startsWith('39') && n.length <= 10) n = '39' + n;
  return n;
}

function reviewMessage(stanza: string): string {
  const link = 'https://g.page/r/CVxuMMgN8XDNEAE/review';
  if (stanza === 'Tulipano') {
    return `Grazie per aver soggiornato al B&B Il Tulipano! 🌷\n\nSperiamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore, per noi è un piccolo gesto che conta davvero.\n\nA presto! 🌷\nSalzillo Hospitality — B&B Il Tulipano`;
  }
  if (stanza === 'Rosa') {
    return `Grazie per aver soggiornato alla Stanza Rosa! 🌸\n\nSperiamo che tutto sia andato per il meglio e che vi siate trovati bene con noi.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore, per noi è un piccolo gesto che conta davvero.\n\nA presto! 🌸\nSalzillo Hospitality — Stanza Rosa`;
  }
  return `Grazie per aver soggiornato con noi! 🏡\n\nSperiamo che tutto sia andato per il meglio.\n\nSe vi va, una recensione su Google ci aiuterebbe moltissimo — bastano due minuti:\n⭐ ${link}\n\nGrazie di cuore!\n\nA presto!\nSalzillo Hospitality`;
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

    const checkoutOggi = (prenotazioni as Booking[]).filter((b) => {
      if (b.stato !== 'Attiva') return false;
      const co = parseItDate(b.checkout);
      return co ? sameDay(co, today) : false;
    });

    if (checkoutOggi.length === 0) {
      return NextResponse.json({ ok: true, sent: false, note: 'Nessun check-out oggi', dryRun });
    }

    const righe = checkoutOggi.map((b) => {
      const num = b.telefono ? toWaNumber(b.telefono) : null;
      const nome = b.ospite;
      if (!num) {
        return `👤 *${nome}* — ${b.stanza}\n⚠️ Nessun numero registrato, invia a mano la richiesta recensione.`;
      }
      const testo = encodeURIComponent(reviewMessage(b.stanza));
      const link = `https://wa.me/${num}?text=${testo}`;
      return `👤 *${nome}* — ${b.stanza}\n👉 [Tocca per inviare la richiesta recensione](${link})`;
    });

    const text = `🌙 *Check-out di oggi*\n\n${righe.join('\n\n')}\n\nSuggerimento: mandalo stasera o domani mattina, non subito — l'ospite è ancora in viaggio.`;

    if (chatId && token && !dryRun) {
      const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      });
      const res2 = await send('Markdown');
      if (!res2.ok) await send();
    }

    return NextResponse.json({ ok: true, sent: !dryRun, count: checkoutOggi.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel promemoria check-out:', err);
    if (!dryRun) await alertCronFailure('promemoria check-out', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
