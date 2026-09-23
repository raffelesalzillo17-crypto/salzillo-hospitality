import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { leggiPrenotazioni } from '@/lib/prenotazioni';

// Recap mattutino proattivo — livello 5 del "secondo cervello" (vedi wiki/decisioni/).
// Oltre a notizie/mercati (versione originale), ora controlla anche prenotazioni in arrivo/partenza,
// eventi calendario dei prossimi 7 giorni, e le decisioni salvate per segnalare eventuali contraddizioni.
// Invocato da Vercel Cron (vedi vercel.json) invece che da un processo sempre acceso come il vecchio bot.js.

// Dal 23/09/2026 Gemini al posto di Claude Sonnet — vedi src/lib/assistantCore.ts per il perché
// (credito Anthropic esaurito) e per il perché del modello 'gemini-3.6-flash'.
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = 'gemini-3.6-flash';

type Booking = { checkin: string; checkout: string; ospite: string; stanza: string; stato: string; telefono?: string };
type CalEvent = { summary: string; start: string; allDay: boolean };

function parseItDate(d: string): Date | null {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function fmtEuro(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function readDecisioni(): string {
  const dir = path.join(process.cwd(), 'data', 'wiki', 'decisioni');
  if (!fs.existsSync(dir)) return '';
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'decisioni.md')
    .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
    .join('\n\n---\n\n');
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const origin = req.nextUrl.origin;
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const [newsRes, marketsRes, bookings, calRes] = await Promise.all([
      fetch(`${origin}/api/notizie`),
      fetch(`${origin}/api/mercati`),
      leggiPrenotazioni(),
      fetch(`${origin}/api/calendario?days=7`),
    ]);
    const newsData = await newsRes.json();
    const marketsData = await marketsRes.json();
    const calData = await calRes.json();

    type N = { source: string; title: string; snippet: string; link: string };
    type M = { label: string; price?: number; currency?: string; changePercent?: number };
    const newsText = newsData.ok ? (newsData.news as N[]).map((n, i) => `${i + 1}. [${n.source}] ${n.title} — ${n.snippet} (${n.link})`).join('\n') : '';
    const marketsText = marketsData.ok ? (marketsData.markets as M[]).map((m) => `${m.label}: ${m.price != null ? fmtEuro(m.price) : '?'} ${m.currency} (${(m.changePercent ?? 0) >= 0 ? '+' : ''}${m.changePercent?.toFixed(2).replace('.', ',')}% oggi)`).join('\n') : '';

    // PAC di Raffaele: quote possedute e prezzo medio d'acquisto, da aggiornare il 16 di ogni mese
    // dopo il nuovo versamento — vedi wiki/concetti/pac-etf-core-msci-world.md (stessa costante di plancia/page.tsx).
    const PAC_QUOTE = 43.709478;
    const PAC_PREZZO_MEDIO = 108.24;
    let pacText = '';
    const pacMarket = marketsData.ok ? (marketsData.markets as M[]).find((m) => m.label.includes('PAC')) : null;
    if (pacMarket?.price) {
      const valoreAttuale = PAC_QUOTE * pacMarket.price;
      const capitaleVersato = PAC_QUOTE * PAC_PREZZO_MEDIO;
      const guadagno = valoreAttuale - capitaleVersato;
      const guadagnoPct = (guadagno / capitaleVersato) * 100;
      pacText = `Quota: ${fmtEuro(pacMarket.price)} €. Valore attuale: ${fmtEuro(valoreAttuale)} €. Versato: ${fmtEuro(capitaleVersato)} €. Profitto: ${guadagno >= 0 ? '+' : ''}${fmtEuro(guadagno)} € (${guadagnoPct >= 0 ? '+' : ''}${guadagnoPct.toFixed(1).replace('.', ',')}%).`;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAhead = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    const attive = (bookings as Booking[]).filter((b) => b.stato === 'Attiva');
    const bookingsText = attive.flatMap((b) => {
      const ci = parseItDate(b.checkin);
      const co = parseItDate(b.checkout);
      const rows: string[] = [];
      if (ci && ci >= today && ci <= weekAhead) rows.push(`Check-in ${b.checkin}: ${b.ospite}, stanza ${b.stanza}`);
      if (co && co >= today && co <= weekAhead) rows.push(`Check-out ${b.checkout}: ${b.ospite}, stanza ${b.stanza}`);
      return rows;
    }).join('\n');

    let calText = '';
    if (calData.ok) {
      calText = (calData.events as CalEvent[]).map((e) => `${e.allDay ? e.start : new Date(e.start).toLocaleString('it-IT')}: ${e.summary}`).join('\n');
    }

    const decisioniText = readDecisioni();
    const todayStr = today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    const response = await genai.models.generateContent({
      model: MODEL,
      contents: `Oggi è ${todayStr}.\n\nCheck-in/check-out prossimi 7 giorni:\n\n${bookingsText || '(nessun movimento nei prossimi 7 giorni)'}\n\nEventi calendario prossimi 7 giorni:\n\n${calText || '(nessun evento)'}\n\nNotizie di oggi:\n\n${newsText || '(nessuna notizia disponibile)'}\n\nMercati di oggi:\n\n${marketsText || '(dati di mercato non disponibili)'}\n\nPAC di Raffaele (iShares Core MSCI World), riporta questi numeri esatti in una riga dedicata:\n\n${pacText || '(dati PAC non disponibili)'}\n\nDecisioni salvate di Raffaele (per controllo contraddizioni, non da riportare per intero):\n\n${decisioniText || '(nessuna)'}\n\nScrivi il recap mattutino.`,
      config: {
        maxOutputTokens: 1000,
        thinkingConfig: { thinkingBudget: 0 },
        systemInstruction: `Sei l'assistente digitale personale di Raffaele Salzillo. Scrivi un recap mattutino proattivo come messaggio su Telegram, da leggere a colazione mezzo addormentato: breve, a punti elenco con qualche emoji pertinente.

Struttura fissa, in quest'ordine:
1. Prima riga ESATTAMENTE così, nient'altro prima: "☀️ *Buongiorno Raffaele!*" — non aggiungere un secondo saluto/data più sotto, quella riga basta.
2. *Oggi* — SOLO le cose datate oggi (${todayStr}): check-in/check-out di oggi, eventi di oggi. Niente di domani o dei giorni dopo qui dentro, nemmeno un accenno.
3. *Prossimi giorni* — tutto il resto della finestra di 7 giorni (domani incluso), in ordine cronologico.
4. Notizie, mercati, PAC — come sotto.

La data di oggi è ESATTAMENTE ${todayStr} — usala se la citi, non calcolarla né indovinarla mai da sola. Usa SOLO i dati forniti qui sotto, non inventare nulla — per il PAC in particolare riporta ESATTAMENTE i numeri già calcolati forniti, non rifare tu i calcoli, e i numeri sono già in formato italiano (virgola) — non convertirli. Le "decisioni salvate" sono il perché delle scelte ricorrenti di Raffaele: se qualcosa tra prenotazioni/eventi/notizie sembra andarci esplicitamente contro, segnalalo con una riga dedicata "⚠️ Attenzione:" — altrimenti non menzionarle affatto, non è una sezione fissa del digest. Per il grassetto usa un solo asterisco (*così*), mai il doppio. Se una sezione manca, omettila senza commentarlo.`,
      },
    });
    const text = response.text ?? '';

    if (chatId && token && !dryRun) {
      const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      });
      const res = await send('Markdown');
      if (!res.ok) await send();
    }

    return NextResponse.json({ ok: true, text, dryRun });
  } catch (err) {
    console.error('Errore nel digest giornaliero:', err);
    if (!dryRun) await alertCronFailure('digest mattutino', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
