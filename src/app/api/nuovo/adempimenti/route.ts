import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { arriviAdempimenti, statoSinfonia } from '@/lib/adempimenti';

// Adempimenti (punto 6, 23/11/2026): arrivi del periodo con lo stato per Alloggiati Web + stato mensile Sinfonia.
// Solo lettura, solo Titolare. Da qui non parte nessun invio.
//   GET ?da=YYYY-MM-DD&a=YYYY-MM-DD
export const dynamic = 'force-dynamic';

const DATA = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });
  const da = req.nextUrl.searchParams.get('da') ?? '';
  const a = req.nextUrl.searchParams.get('a') ?? '';
  if (!DATA.test(da) || !DATA.test(a) || da > a) return NextResponse.json({ ok: false, error: 'Periodo non valido' }, { status: 400 });
  if (Date.parse(a) - Date.parse(da) > 400 * 864e5) return NextResponse.json({ ok: false, error: 'Periodo troppo lungo (massimo 400 giorni)' }, { status: 400 });
  try {
    const oggi = new Date();
    const [arrivi, sinfonia] = await Promise.all([arriviAdempimenti(da, a), statoSinfonia(oggi.getFullYear(), oggi.getMonth() + 1)]);
    return NextResponse.json({ ok: true, arrivi, sinfonia, anno: oggi.getFullYear() });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
