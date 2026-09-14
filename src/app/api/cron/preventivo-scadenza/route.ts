import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { leggiPreventiviDb } from '@/lib/db/queries';

// Promemoria Telegram per i preventivi "Inviato" in scadenza. Il piano Vercel Hobby
// permette ai cron di girare al massimo una volta al giorno, quindi non possiamo
// controllare ogni ora: giriamo una volta al mattino (vedi vercel.json) e segnaliamo
// ogni preventivo la cui scadenza (inviato_il, o creato_il se non risulta mai inviato,
// più valido_ore) cade nelle prossime 24 ore — così ognuno viene segnalato esattamente
// una volta, nell'unico giro giornaliero che copre la sua finestra di scadenza.
// Segnaliamo separatamente anche quelli già scaduti ma ancora "Inviato" (nessuno li ha
// aggiornati a mano), che altrimenti restano invisibili.

function fmtEuro(n: string | number | null): string {
  const v = typeof n === 'string' ? Number(n) : n ?? 0;
  return v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function dataIt(d: string): string {
  const [y, m, gg] = d.split('-');
  return `${gg}/${m}/${y}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const preventivi = await leggiPreventiviDb();
    const ora = new Date();
    const fraUnGiorno = new Date(ora.getTime() + 24 * 60 * 60 * 1000);

    const inScadenza: { riga: string }[] = [];
    const giaScaduti: { riga: string }[] = [];

    for (const p of preventivi) {
      if (p.stato !== 'Inviato') continue;
      const partenza = p.inviatoIl ?? p.creatoIl;
      if (!partenza) continue;
      const scadenza = new Date(new Date(partenza).getTime() + p.validoOre * 60 * 60 * 1000);
      const nome = [p.ospiteNome, p.ospiteCognome].filter(Boolean).join(' ') || '(ospite non indicato)';
      const riga = `• *${p.codice}* — ${nome}, ${p.alloggio}, ${dataIt(p.checkin)}→${dataIt(p.checkout)}, ${fmtEuro(p.totale)} €`;

      if (scadenza < ora) {
        giaScaduti.push({ riga });
      } else if (scadenza <= fraUnGiorno) {
        inScadenza.push({ riga });
      }
    }

    if (inScadenza.length === 0 && giaScaduti.length === 0) {
      return NextResponse.json({ ok: true, inviato: false, motivo: 'nessun preventivo in scadenza', dryRun });
    }

    const blocchi: string[] = ['⏳ *Preventivi in scadenza*'];
    if (inScadenza.length > 0) {
      blocchi.push('Scadono entro domani:\n' + inScadenza.map((x) => x.riga).join('\n'));
    }
    if (giaScaduti.length > 0) {
      blocchi.push('Già scaduti (ancora segnati "Inviato" — valuta se aggiornarli):\n' + giaScaduti.map((x) => x.riga).join('\n'));
    }
    const text = blocchi.join('\n\n');

    if (chatId && token && !dryRun) {
      const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      });
      const res = await send('Markdown');
      if (!res.ok) await send();
    }

    return NextResponse.json({ ok: true, inviato: true, inScadenza: inScadenza.length, giaScaduti: giaScaduti.length, text, dryRun });
  } catch (err) {
    console.error('Errore nel promemoria scadenza preventivi:', err);
    if (!dryRun) await alertCronFailure('promemoria scadenza preventivi', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
