import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { costruisciCsv, costruisciXlsx, datiCommercialista } from '@/lib/esportaCommercialista';
import { registra } from '@/lib/db/registro';

// Export per il commercialista (punto 12, 23/11/2026). Solo Titolare.
//   GET ?anno=2026&proprietario=<id|tutti>&formato=xlsx          → Excel con 4 fogli
//   GET ?anno=2026&proprietario=<id|tutti>&formato=csv&foglio=riepilogo|prenotazioni|spese|tassa → un foglio in CSV
export const dynamic = 'force-dynamic';

const FOGLI = ['riepilogo', 'prenotazioni', 'spese', 'tassa'] as const;

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });
  const q = req.nextUrl.searchParams;
  const anno = Number(q.get('anno'));
  if (!Number.isInteger(anno) || anno < 2020 || anno > 2100) return NextResponse.json({ ok: false, error: 'Anno non valido' }, { status: 400 });
  const prop = q.get('proprietario');
  const proprietarioId = prop && prop !== 'tutti' ? prop : null;
  if (proprietarioId && !/^[0-9a-f-]{36}$/i.test(proprietarioId)) return NextResponse.json({ ok: false, error: 'Proprietario non valido' }, { status: 400 });
  const formato = q.get('formato') === 'csv' ? 'csv' : 'xlsx';
  try {
    const d = await datiCommercialista(anno, proprietarioId);
    const etichetta = (proprietarioId ? d.proprietario : 'tutti').replace(/[^\w]+/g, '-').toLowerCase();
    if (formato === 'csv') {
      const k = FOGLI.indexOf((q.get('foglio') ?? 'riepilogo') as (typeof FOGLI)[number]);
      if (k < 0) return NextResponse.json({ ok: false, error: 'Foglio non valido' }, { status: 400 });
      await registra(check.sessione, 'export-commercialista', 'anno', String(anno), `CSV ${FOGLI[k]}, ${proprietarioId ? 'un proprietario' : 'tutti'}`);
      return new NextResponse(costruisciCsv(d.fogli[k]), {
        headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${FOGLI[k]}-${anno}-${etichetta}.csv"`, 'Cache-Control': 'no-store' },
      });
    }
    const buf = await costruisciXlsx(d);
    await registra(check.sessione, 'export-commercialista', 'anno', String(anno), `Excel, ${proprietarioId ? 'un proprietario' : 'tutti'}`);
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="commercialista-${anno}-${etichetta}.xlsx"`, 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
