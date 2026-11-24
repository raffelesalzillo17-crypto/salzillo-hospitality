import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { getDb } from '@/lib/db';
import { attivitaPianificate, prenotazioni, pulizie, scadenze } from '@/lib/db/schema';
import { aggiungiGiorni, dataRoma, fineGiornoRoma } from '@/lib/regole';
import { avvisaUnaVolta } from '@/lib/push';

// Riepilogo del mattino come notifica push (24/11/2026): arrivi, partenze, pulizie, promemoria e scadenze di oggi.
// Solo conteggi, mai nomi né dati degli ospiti. Se non c'è niente da segnalare non manda nulla. Una sola notifica al giorno
// (anche se il cron girasse due volte: due orari estate/inverno in vercel.json).
export const dynamic = 'force-dynamic';

const plurale = (n: number, uno: string, piu: string) => `${n} ${n === 1 ? uno : piu}`;

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  try {
    const db = getDb();
    const adesso = new Date();
    const oggi = dataRoma(adesso);
    // Vercel ha due voci (estate e inverno): si manda solo quando in Italia sono le 7 o le 8, così una sola cade nell'ora giusta.
    const oraRoma = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(adesso));
    if (req.nextUrl.searchParams.get('forza') !== '1' && (oraRoma < 7 || oraRoma > 8)) return NextResponse.json({ ok: true, saltato: 'fuori orario' });

    const conta = async (q: Promise<{ n: number }[]>) => (await q)[0]?.n ?? 0;
    const [arrivi, partenze, puliz, promemoria, scad] = await Promise.all([
      conta(db.select({ n: sql<number>`count(*)::int` }).from(prenotazioni).where(and(eq(prenotazioni.stato, 'Attiva'), eq(prenotazioni.checkin, oggi)))),
      conta(db.select({ n: sql<number>`count(*)::int` }).from(prenotazioni).where(and(eq(prenotazioni.stato, 'Attiva'), eq(prenotazioni.checkout, oggi)))),
      conta(db.select({ n: sql<number>`count(*)::int` }).from(pulizie).where(and(eq(pulizie.data, oggi), isNull(pulizie.confermata_il)))),
      conta(db.select({ n: sql<number>`count(*)::int` }).from(attivitaPianificate).where(and(inArray(attivitaPianificate.stato, ['Da fare', 'Notificata']), lte(attivitaPianificate.scadenza, fineGiornoRoma(oggi))))),
      conta(db.select({ n: sql<number>`count(*)::int` }).from(scadenze).where(and(eq(scadenze.stato, 'Aperta'), lte(scadenze.data_scadenza, aggiungiGiorni(oggi, 7))))),
    ]);
    const pezzi = [
      arrivi && plurale(arrivi, 'arrivo', 'arrivi'), partenze && plurale(partenze, 'partenza', 'partenze'),
      puliz && plurale(puliz, 'pulizia', 'pulizie'), promemoria && plurale(promemoria, 'messaggio da mandare', 'messaggi da mandare'),
      scad && plurale(scad, 'scadenza vicina', 'scadenze vicine'),
    ].filter(Boolean) as string[];
    if (!pezzi.length) return NextResponse.json({ ok: true, inviata: false, motivo: 'niente da segnalare' });
    const inviata = await avvisaUnaVolta(`mattina:${oggi}`, { titolo: 'Oggi', testo: pezzi.join(' · '), url: '/nuovo', tag: 'mattina' });
    return NextResponse.json({ ok: true, inviata, arrivi, partenze, pulizie: puliz, promemoria, scadenze: scad });
  } catch (err) {
    console.error('[push-mattina] ERRORE:', err instanceof Error ? err.message : err);
    return NextResponse.json({ ok: false, error: 'Riepilogo non riuscito' }, { status: 500 });
  }
}
