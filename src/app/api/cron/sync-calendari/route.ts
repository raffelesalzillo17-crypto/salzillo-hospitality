import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { controllaTuttiICalendari } from '@/lib/db/ical';
import { avvisaUnaVolta } from '@/lib/push';

// Sincronizzazione dei calendari Airbnb e Booking (punto 2, 23/11/2026): legge i feed iCal di tutti gli alloggi, importa le prenotazioni
// che mancano come segnaposto da completare, segnala le sovrapposizioni e segna "da verificare" le prenotazioni sparite dal feed.
// Scrive il registro delle sincronizzazioni (data e ora, esito, eventi letti, errori). Risponde solo con conteggi, mai con dati degli ospiti.
//
// Frequenza: in vercel.json c'è una chiamata al giorno (il piano Vercel non permette di più); per ogni 15-30 minuti va chiamata dal
// pinger esterno (cron-job.org) con ?key=<EXTERNAL_PING_SECRET>, come già si fa per gli altri cron (vedi src/lib/cronAuth.ts).

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const esiti = await controllaTuttiICalendari({ origine: 'automatica' });
    // Avvisi push, una sola volta per cosa (senza nomi): prenotazione nuova dai calendari, sovrapposizione, prenotazione sparita dal sito.
    for (const e of esiti) {
      for (const i of e.importate) await avvisaUnaVolta(`importata:${e.alloggio}:${i.start}:${i.end}`, { titolo: 'Nuova prenotazione', testo: `${i.canale} · ${e.alloggio}, dal ${i.start.slice(8, 10)}/${i.start.slice(5, 7)}: da completare`, url: '/nuovo/prenotazioni', tag: 'importata' }).catch(() => {});
      for (const k of e.conflitti) await avvisaUnaVolta(`sovrapposizione:${e.alloggio}:${k.start}:${k.end}`, { titolo: '⚠️ Sovrapposizione di date', testo: `${e.alloggio}: ${e.calendario} si accavalla con una prenotazione (dal ${k.start.slice(8, 10)}/${k.start.slice(5, 7)})`, url: '/nuovo/calendario', tag: 'sovrapposizione' }).catch(() => {});
      for (const m of e.inPiu) await avvisaUnaVolta(`daverificare:${e.alloggio}:${m.start}:${m.end}:${m.canale}`, { titolo: 'Prenotazione da verificare', testo: `${e.alloggio}: una prenotazione non risulta più sul calendario del sito`, url: '/nuovo/prenotazioni', tag: 'daverificare' }).catch(() => {});
    }
    return NextResponse.json({
      ok: true, calendari: esiti.length,
      errori: esiti.filter((e) => e.errore).length,
      importate: esiti.reduce((n, e) => n + e.importate.length, 0),
      sovrapposizioni: esiti.reduce((n, e) => n + e.conflitti.length, 0),
      daVerificare: esiti.reduce((n, e) => n + e.inPiu.length, 0),
    });
  } catch (err) {
    console.error('[sync-calendari] ERRORE:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Sincronizzazione non riuscita' }, { status: 500 });
  }
}
