import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { generaAnalisiMercatoPdf } from '@/lib/db/analisiMercato';
import { inviaEmailConAllegati } from '@/lib/emailInvio';

// Analisi di mercato settimanale via email (PDF) — richiesta esplicita di Raffaele il
// 29/09/2026: ogni sabato alle 8:00 (vedi vercel.json, due voci per il fuso orario come gli
// altri cron), un PDF con l'occupazione/andamento reale delle 5 strutture più un quadro di
// mercato (ricerca IA con Google, non scraping diretto di Booking.com — troppo fragile da far
// girare in automatico ogni settimana). Vedi src/lib/db/analisiMercato.ts per il dettaglio.

export const maxDuration = 60;

const DESTINATARIO = process.env.EMAIL_REPORT_DESTINATARIO || 'salzillohospitality@gmail.com';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const { bytes, nome } = await generaAnalisiMercatoPdf();
    if (!dryRun) {
      await inviaEmailConAllegati({
        to: DESTINATARIO,
        subject: `Analisi di mercato settimanale — ${new Date().toLocaleDateString('it-IT')}`,
        testo: 'In allegato l\'analisi di mercato di questa settimana per le strutture di Marcianise.\n\nSalzillo Hospitality',
        allegati: [{ nome, contentType: 'application/pdf', bytes }],
      });
    }
    return NextResponse.json({ ok: true, inviato: !dryRun, nome, dryRun });
  } catch (err) {
    console.error('Errore nell\'analisi di mercato settimanale:', err);
    if (!dryRun) await alertCronFailure('analisi di mercato settimanale', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
