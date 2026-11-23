import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { costruisciCsv, costruisciXlsxFogli } from '@/lib/esportaCommercialista';

// Trasforma in Excel o CSV una tabella che l'utente STA GIÀ VEDENDO nel gestionale (es. l'elenco prenotazioni con i filtri attivi).
// Non legge nulla dal database: formatta soltanto le righe ricevute, quindi non può mostrare più di quanto l'utente già vede.
//   POST { nome, formato: 'xlsx' | 'csv', intestazioni: string[], righe: (string|number|null)[][] }
export const dynamic = 'force-dynamic';
const MAX_RIGHE = 5000;

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo === 'Pulizie') return NextResponse.json({ ok: false, error: 'Non disponibile per il tuo ruolo' }, { status: 403 });
  let b: { nome?: unknown; formato?: unknown; intestazioni?: unknown; righe?: unknown };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Richiesta non valida' }, { status: 400 }); }
  const nome = String(b.nome ?? 'tabella').replace(/[^\w-]+/g, '-').slice(0, 40) || 'tabella';
  const intest = Array.isArray(b.intestazioni) ? b.intestazioni.map((x) => String(x).slice(0, 80)) : null;
  const righe = Array.isArray(b.righe) ? (b.righe as unknown[]) : null;
  if (!intest || !righe || intest.length > 40 || righe.length > MAX_RIGHE) return NextResponse.json({ ok: false, error: `Tabella non valida (massimo ${MAX_RIGHE} righe)` }, { status: 400 });
  const pulite = righe.map((r) => (Array.isArray(r) ? r.slice(0, intest.length).map((c) => (typeof c === 'number' || c === null ? c : String(c).slice(0, 500))) : []));
  const foglio = { nome: nome.slice(0, 31), intestazioni: intest, righe: pulite };
  const oggi = new Date().toISOString().slice(0, 10);
  if (b.formato === 'csv') {
    return new NextResponse(costruisciCsv(foglio), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}-${oggi}.csv"`, 'Cache-Control': 'no-store' } });
  }
  const buf = await costruisciXlsxFogli([foglio]);
  return new NextResponse(new Uint8Array(buf), { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${nome}-${oggi}.xlsx"`, 'Cache-Control': 'no-store' } });
}
