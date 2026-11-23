import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { leggiResoconto } from '@/lib/db/resocontoAnnuale';
import { confrontoAnni, fogliResoconto } from '@/lib/resocontoAnnuale';
import { costruisciCsv, costruisciXlsxFogli } from '@/lib/esportaCommercialista';
import { registra } from '@/lib/db/registro';

// Resoconto annuale (punto 14, 23/11/2026): occupazione, incassi per canale, tassa di soggiorno per mese e alloggio, confronto con l'anno prima.
//   GET ?anno=2026                                   → JSON
//   GET ?anno=2026&formato=xlsx                      → Excel con 4 fogli
//   GET ?anno=2026&formato=csv&foglio=mesi|canali|tassa|confronto
// Solo chi vede i dati finanziari; ciascuno vede solo i suoi immobili.
export const dynamic = 'force-dynamic';

const FOGLI = ['mesi', 'canali', 'tassa', 'confronto'];

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  if (sess.ruolo === 'Pulizie' || !sess.vedeFinanziario) return NextResponse.json({ ok: false, error: 'Non disponibile per il tuo ruolo' }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const anno = Number(q.get('anno'));
  if (!Number.isInteger(anno) || anno < 2020 || anno > 2100) return NextResponse.json({ ok: false, error: 'Anno non valido' }, { status: 400 });
  const formato = q.get('formato');
  try {
    const [corrente, precedente] = await Promise.all([leggiResoconto(anno, sess.immobiliVisibili), leggiResoconto(anno - 1, sess.immobiliVisibili)]);
    if (formato !== 'xlsx' && formato !== 'csv') {
      return NextResponse.json({ ok: true, corrente, precedente, confronto: confrontoAnni(corrente, precedente) });
    }
    const fogli = fogliResoconto(corrente, precedente);
    await registra(sess, 'export-resoconto', 'anno', String(anno), formato === 'csv' ? `CSV ${q.get('foglio') ?? 'mesi'}` : 'Excel');
    if (formato === 'csv') {
      const k = FOGLI.indexOf(q.get('foglio') ?? 'mesi');
      if (k < 0) return NextResponse.json({ ok: false, error: 'Foglio non valido' }, { status: 400 });
      return new NextResponse(costruisciCsv(fogli[k]), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="resoconto-${anno}-${FOGLI[k]}.csv"`, 'Cache-Control': 'no-store' },
      });
    }
    const buf = await costruisciXlsxFogli(fogli);
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="resoconto-${anno}.xlsx"`, 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
