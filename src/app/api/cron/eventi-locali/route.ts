import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { leggiEventiLocaliDb } from '@/lib/db/queries';
import { getDb } from '@/lib/db';
import { eventiLocali } from '@/lib/db/schema';
import { creaEventoLocale } from '@/lib/db/mutations';
import { eq, and } from 'drizzle-orm';

// Cerca in autonomia eventi reali nella zona (sagre, fiere, concerti, ponti festivi) e li
// scrive in "Eventi in zona" — SOLO per dare a Raffaele materiale su cui fare la sua analisi
// prezzi, mai per cambiare un prezzo in automatico (lui stesso l'ha chiesto così: vuole
// decidere a mano se alzare o abbassare). Gira una volta a settimana (vedi vercel.json) —
// gli eventi non cambiano ogni giorno, a differenza dei promemoria di check-in/scadenza.

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type EventoTrovato = { titolo: string; dal: string; al: string; comune?: string; impatto?: string; note?: string };

function estraiJson(testo: string): EventoTrovato[] {
  const m = testo.match(/```(?:json)?\s*([\s\S]*?)```/) || testo.match(/(\[[\s\S]*\])/);
  if (!m) return [];
  try {
    const parsed = JSON.parse(m[1]);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const giaTracciati = await leggiEventiLocaliDb();
    const elencoTracciati = giaTracciati.length > 0
      ? giaTracciati.map((e) => `- ${e.titolo} (${e.dal} → ${e.al}, ${e.comune || '?'})`).join('\n')
      : '(nessuno)';

    const oggi = new Date();
    const fraDueMesi = new Date(oggi.getTime() + 60 * 24 * 60 * 60 * 1000);
    const oggiStr = oggi.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 2000,
      tools: [{
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: 6,
        user_location: { type: 'approximate', city: 'Marcianise', region: 'Campania', country: 'IT', timezone: 'Europe/Rome' },
      }],
      system: `Cerchi eventi reali (sagre, fiere, mercatini, concerti, manifestazioni, ponti festivi) entro circa 30 km da Marcianise (CE), nei prossimi 60 giorni da oggi (${oggiStr}), utili a un B&B locale per capire quando la domanda di alloggio sale. Includi Marcianise, Caserta, Aversa, San Nicola la Strada, Recale, Capua, Napoli e comuni limitrofi.

Non inventare eventi: se non trovi nulla di verificabile con la ricerca web, restituisci una lista vuota. Non includere eventi già tracciati (elenco sotto) — cerca solo novità.

Rispondi ESCLUSIVAMENTE con un blocco \`\`\`json contenente un array di oggetti con questi campi:
- titolo (stringa)
- dal (data ISO YYYY-MM-DD)
- al (data ISO YYYY-MM-DD, uguale a "dal" se un solo giorno)
- comune (stringa)
- impatto: "Alto" | "Medio" | "Basso" — stima di quanto potrebbe aumentare la domanda di alloggio nella zona
- note (breve descrizione, 1 riga, cita da dove viene l'informazione)

Se non trovi eventi validi, rispondi con \`\`\`json\n[]\n\`\`\`. Nessun testo fuori dal blocco json.`,
      messages: [{
        role: 'user',
        content: `Eventi già tracciati (non ripeterli):\n${elencoTracciati}\n\nCerca eventi nuovi tra oggi (${oggiStr}) e ${fraDueMesi.toLocaleDateString('it-IT')}.`,
      }],
    });

    const testo = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
    const trovati = estraiJson(testo);
    console.log(`[eventi-locali] risposta (${testo.length} caratteri): ${testo.slice(0, 500)}`);
    console.log(`[eventi-locali] blocchi risposta: ${response.content.map((b) => b.type).join(', ')} — trovati: ${trovati.length}`);

    const db = getDb();
    const aggiunti: EventoTrovato[] = [];
    for (const e of trovati) {
      if (!e.titolo || !e.dal) continue;
      const [esiste] = await db.select({ id: eventiLocali.id }).from(eventiLocali)
        .where(and(eq(eventiLocali.titolo, e.titolo.trim()), eq(eventiLocali.dal, e.dal)));
      if (esiste) continue;
      if (!dryRun) {
        await creaEventoLocale({ titolo: e.titolo, dal: e.dal, al: e.al || e.dal, comune: e.comune, impatto: e.impatto, note: e.note });
      }
      aggiunti.push(e);
    }

    if (aggiunti.length > 0 && chatId && token && !dryRun) {
      const dataIt = (d: string) => { const [y, m, gg] = d.split('-'); return `${gg}/${m}/${y}`; };
      const righe = aggiunti.map((e) => `• *${e.titolo}* — ${e.comune || '?'}, ${dataIt(e.dal)}${e.al && e.al !== e.dal ? `→${dataIt(e.al)}` : ''} (impatto ${e.impatto || 'Medio'})${e.note ? `\n  ${e.note}` : ''}`).join('\n');
      const text = `🎪 *Nuovi eventi in zona*\n\n${righe}\n\nAggiunti a "Eventi in zona" — dai un'occhiata ai prezzi di quei giorni.`;
      const send = (parseMode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, ...(parseMode ? { parse_mode: parseMode } : {}) }),
      });
      const res = await send('Markdown');
      if (!res.ok) await send();
    }

    return NextResponse.json({ ok: true, trovati: trovati.length, aggiunti: aggiunti.length, eventi: aggiunti, dryRun });
  } catch (err) {
    console.error('Errore nella ricerca eventi locali:', err);
    if (!dryRun) await alertCronFailure('ricerca eventi locali', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
