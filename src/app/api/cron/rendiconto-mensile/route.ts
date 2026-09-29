import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { elencoProprietari, generaRendicontoPdf } from '@/lib/db/rendicontoPdf';
import { inviaEmailConAllegati } from '@/lib/emailInvio';

// Rendiconto mensile via email — richiesta esplicita di Raffaele il 29/09/2026: il primo di
// ogni mese alle 8:00 (vedi vercel.json), un'unica email con un PDF "tutti gli immobili" più un
// PDF per ciascun proprietario esistente nel database (cresce da solo quando ne aggiunge uno
// nuovo in Immobili — oggi Luigi Salzillo e Raffaela Iodice). Il rendiconto è sempre del mese
// appena concluso, non di quello in corso.

export const maxDuration = 60;

const DESTINATARIO = process.env.EMAIL_REPORT_DESTINATARIO || 'salzillohospitality@gmail.com';

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1';

  try {
    const oggi = new Date();
    // mese appena concluso: se oggi è ottobre, il rendiconto è di settembre
    const meseScorso = new Date(oggi.getFullYear(), oggi.getMonth() - 1, 1);
    const anno = meseScorso.getFullYear();
    const mese = meseScorso.getMonth() + 1;
    const nomeMese = meseScorso.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    const allegati: { nome: string; contentType: string; bytes: Uint8Array }[] = [];

    const tutti = await generaRendicontoPdf(null, anno, mese);
    if (tutti) allegati.push({ nome: tutti.nome, contentType: 'application/pdf', bytes: tutti.bytes });

    const proprietari = await elencoProprietari();
    for (const p of proprietari) {
      const r = await generaRendicontoPdf(p.id, anno, mese);
      if (r) allegati.push({ nome: r.nome, contentType: 'application/pdf', bytes: r.bytes });
    }

    if (allegati.length === 0) {
      return NextResponse.json({ ok: true, inviato: false, note: 'Nessun rendiconto generabile (nessun proprietario/dato)', dryRun });
    }

    if (!dryRun) {
      await inviaEmailConAllegati({
        to: DESTINATARIO,
        subject: `Rendiconto mensile — ${nomeMese}`,
        testo: `In allegato il rendiconto di ${nomeMese}: un PDF con tutti gli immobili insieme, più un PDF per ciascun proprietario (${proprietari.map((p) => p.nome).join(', ') || 'nessuno'}).\n\nSalzillo Hospitality`,
        allegati,
      });
    }
    return NextResponse.json({ ok: true, inviato: !dryRun, allegati: allegati.map((a) => a.nome), dryRun });
  } catch (err) {
    console.error('Errore nel rendiconto mensile:', err);
    if (!dryRun) await alertCronFailure('rendiconto mensile', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
