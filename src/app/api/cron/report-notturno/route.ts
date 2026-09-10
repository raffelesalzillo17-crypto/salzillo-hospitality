import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { isAuthorizedCron } from '@/lib/cronAuth';
import { alertCronFailure } from '@/lib/cronAlert';
import { getDb } from '@/lib/db/index';
import { sql } from 'drizzle-orm';

// Invia a Raffaele su Telegram, una volta, il report del lavoro notturno sul nuovo sistema.
// Il testo sta in data/report-notturno.md (versionato). Schedulato alle 5:30 in vercel.json.
//  - Vercel Cron: header Authorization: Bearer $CRON_SECRET  (via isAuthorizedCron)
//  - test manuale: ?key=$REPORT_KEY   |   ?dry=1 restituisce il testo senza inviare

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const dry = req.nextUrl.searchParams.get('dry') === '1';
  const key = req.nextUrl.searchParams.get('key');
  const keyOk = process.env.REPORT_KEY && key === process.env.REPORT_KEY;
  if (!keyOk && !isAuthorizedCron(req)) {
    return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 401 });
  }

  try {
    let testo = 'Report notturno non disponibile.';
    try {
      testo = await readFile(path.join(process.cwd(), 'data', 'report-notturno.md'), 'utf8');
    } catch { /* usa il fallback */ }

    if (dry) return NextResponse.json({ ok: true, dry: true, testo });

    // invia una volta sola al giorno (il cron 5:30 e il backup 5:20 non fanno doppione)
    const oggi = new Date().toISOString().slice(0, 10);
    const ins = await getDb().execute(
      sql`INSERT INTO invii_report (giorno) VALUES (${oggi}) ON CONFLICT (giorno) DO NOTHING RETURNING giorno`,
    );
    const rows = Array.isArray(ins) ? ins : ((ins as { rows?: unknown[] }).rows ?? []);
    if (rows.length === 0) return NextResponse.json({ ok: true, giaInviato: true });

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.ALLOWED_CHAT_ID;
    if (!token || !chatId) return NextResponse.json({ ok: false, error: 'Telegram non configurato' }, { status: 500 });

    const send = (parse_mode?: string) => fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: testo, disable_web_page_preview: false, ...(parse_mode ? { parse_mode } : {}) }),
    });
    let res = await send('Markdown');
    if (!res.ok) res = await send(); // ritenta senza markdown se il parsing fallisce
    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (err) {
    await alertCronFailure('report notturno', err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
