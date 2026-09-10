import { NextRequest, NextResponse } from 'next/server';
import { richiediSessione } from '@/lib/db/auth';
import { generaFileSinfonia } from '@/lib/db/sinfonia';
import { getDb } from '@/lib/db/index';
import { inviiRegione } from '@/lib/db/schema';

// Genera (e salva un riferimento del) file mensile per il portale regionale Sinfonia.
//  GET  ?immobile=<id>&anno=2026&mese=9         → JSON con anteprima + avvisi
//  GET  ?immobile=<id>&anno=2026&mese=9&scarica=1 → il file .txt

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (check.sessione.ruolo !== 'Titolare') return NextResponse.json({ ok: false, error: 'Solo il titolare' }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const immobileId = q.get('immobile');
  const anno = Number(q.get('anno'));
  const mese = Number(q.get('mese'));
  if (!immobileId || !anno || !mese) return NextResponse.json({ ok: false, error: 'Parametri mancanti' }, { status: 400 });

  try {
    const r = await generaFileSinfonia(immobileId, anno, mese);

    // salva il riferimento (upsert)
    const db = getDb();
    await db.insert(inviiRegione).values({
      immobile_id: immobileId, anno, mese, generato_il: new Date(), contenuto_txt: r.contenuto,
    }).onConflictDoUpdate({
      target: [inviiRegione.immobile_id, inviiRegione.anno, inviiRegione.mese],
      set: { generato_il: new Date(), contenuto_txt: r.contenuto },
    });

    if (q.get('scarica') === '1') {
      return new NextResponse(r.contenuto || '(nessun movimento)\n', {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="sinfonia-${anno}-${String(mese).padStart(2, '0')}.txt"`,
        },
      });
    }
    return NextResponse.json({ ok: true, ...r });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
