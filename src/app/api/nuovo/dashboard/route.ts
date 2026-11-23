import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { cosaMancaBlocchi, riepilogoDashboard } from '@/lib/db/dashboard';
import { avvisiAdempimenti } from '@/lib/adempimenti';

// Dashboard (punto 7, 23/11/2026).
//   GET ?parte=riepilogo&mese=YYYY-MM&proprietario=<id|tutti>   → indicatori e tabella per immobile (stessi numeri dei Rendiconti)
//   GET ?parte=cosamanca                                        → blocchi separati: pagamenti, pulizie, scadenze, schedine, sovrapposizioni
// Rispetta i permessi: ciascuno vede solo i suoi immobili; senza accesso ai dati finanziari gli importi non escono.
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  const sess = check.sessione;
  if (sess.ruolo === 'Pulizie') return NextResponse.json({ ok: false, error: 'Non disponibile per il tuo ruolo' }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const oggi = new Date().toISOString().slice(0, 10);
  try {
    if (q.get('parte') === 'cosamanca') {
      const blocchi = await cosaMancaBlocchi(oggi, sess.immobiliVisibili, sess.vedeFinanziario);
      const schedine = sess.ruolo === 'Titolare' ? await avvisiAdempimenti(oggi).catch(() => []) : [];
      return NextResponse.json({ ok: true, ...blocchi, schedine, vedeFinanziario: sess.vedeFinanziario });
    }
    const m = (q.get('mese') ?? oggi.slice(0, 7)).match(/^(\d{4})-(\d{2})$/);
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[1]) < 2020 || Number(m[1]) > 2100) return NextResponse.json({ ok: false, error: 'Mese non valido' }, { status: 400 });
    const prop = q.get('proprietario');
    const proprietarioId = sess.ruolo === 'Titolare' && prop && prop !== 'tutti' && /^[0-9a-f-]{36}$/i.test(prop) ? prop : null;
    const r = await riepilogoDashboard(Number(m[1]), Number(m[2]), proprietarioId, sess.immobiliVisibili);
    if (!sess.vedeFinanziario) {
      // senza accesso ai dati finanziari restano solo occupazione e numero di prenotazioni
      const azzera = <T extends Record<string, unknown>>(x: T): T => ({ ...x, lordo: 0, commissioni: 0, cedolare: 0, pulizia: 0, nettoProprietario: 0, spese: 0, nettoDopoSpese: 0, tassaRiscossa: 0, prezzoMedioNotte: 0 });
      r.immobili = r.immobili.map(azzera); r.totali = azzera(r.totali);
    }
    return NextResponse.json({ ok: true, riepilogo: r, vedeFinanziario: sess.vedeFinanziario });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
