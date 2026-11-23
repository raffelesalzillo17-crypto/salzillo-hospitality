import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { generaFileAlloggiati } from '@/lib/adempimenti';
import { registra } from '@/lib/db/registro';

// File nel tracciato ufficiale Alloggiati Web, da scaricare e caricare A MANO sul portale (punto 6, 23/11/2026).
// Contiene solo le prenotazioni "Pronte" tra quelle richieste; non contatta il portale e non cambia nessuno stato.
//   GET ?ids=<id>,<id>   → file .txt (CRLF, record da 168 caratteri)
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });
  const ids = (req.nextUrl.searchParams.get('ids') ?? '').split(',').map((x) => x.trim()).filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ ok: false, error: 'Nessuna prenotazione indicata' }, { status: 400 });
  try {
    const oggi = new Date().toISOString().slice(0, 10);
    const f = await generaFileAlloggiati(ids, oggi);
    if (!f.contenuto) return NextResponse.json({ ok: false, error: `Nessuna prenotazione pronta: ${f.saltate.map((s) => s.motivo).join(' | ')}` }, { status: 409 });
    await registra(check.sessione, 'scarica-file-alloggiati', 'prenotazione', null, `${f.prenotazioniInFile} prenotazioni, ${f.schedineInFile} schedine${f.saltate.length ? `, ${f.saltate.length} saltate` : ''}`);
    return new NextResponse(f.contenuto, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8', 'Content-Disposition': `attachment; filename="${f.nomeFile}"`,
        'Cache-Control': 'no-store', 'X-Prenotazioni-Saltate': String(f.saltate.length),
      },
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
