import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { richiediSessione } from '@/lib/db/auth';
import { getDb } from '@/lib/db';
import { pushSottoscrizioni } from '@/lib/db/schema';
import { chiavePubblicaPush, inviaPush } from '@/lib/push';

// Notifiche push (24/11/2026).
//   GET                      → { chiave, attivo }: la chiave pubblica per iscrivere il dispositivo e se QUESTO utente ha già un dispositivo iscritto
//   POST {sottoscrizione}    → iscrive il dispositivo (endpoint e chiavi che il browser ha creato)
//   POST {prova: true}       → manda una notifica di prova a se stessi
//   DELETE {endpoint}        → toglie il dispositivo
// Solo Titolare e Operatore: l'addetto pulizie e il proprietario non ricevono notifiche.
export const dynamic = 'force-dynamic';

const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });
const consentito = (ruolo: string) => ruolo === 'Titolare' || ruolo === 'Collaboratore';

export async function GET(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!consentito(check.sessione.ruolo)) return err('Non disponibile per il tuo ruolo', 403);
  const chiave = await chiavePubblicaPush();
  if (!chiave) return NextResponse.json({ ok: true, chiave: null, attivo: false });
  const mie = await getDb().select({ id: pushSottoscrizioni.id }).from(pushSottoscrizioni).where(eq(pushSottoscrizioni.utente_id, check.sessione.id));
  return NextResponse.json({ ok: true, chiave, attivo: mie.length > 0 });
}

export async function POST(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  if (!consentito(check.sessione.ruolo)) return err('Non disponibile per il tuo ruolo', 403);
  let b: { sottoscrizione?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; prova?: boolean; dispositivo?: string };
  try { b = await req.json(); } catch { return err('Richiesta non valida'); }
  if (b.prova) {
    const r = await inviaPush({ titolo: 'Notifiche attive ✅', testo: 'Così ti avviserò di arrivi, pulizie e novità dai calendari.', tag: 'prova' }, [check.sessione.ruolo]);
    return NextResponse.json({ ok: true, ...r });
  }
  const s = b.sottoscrizione;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys.auth || !/^https:\/\//.test(s.endpoint)) return err('Sottoscrizione non valida');
  await getDb().insert(pushSottoscrizioni).values({
    utente_id: check.sessione.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, dispositivo: (b.dispositivo ?? '').slice(0, 80) || null,
  }).onConflictDoUpdate({ target: pushSottoscrizioni.endpoint, set: { utente_id: check.sessione.id, p256dh: s.keys.p256dh, auth: s.keys.auth } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const check = await richiediSessione(req);
  if ('risposta' in check) return check.risposta;
  let b: { endpoint?: string } = {};
  try { b = await req.json(); } catch { /* senza corpo: toglie tutti i miei dispositivi */ }
  const db = getDb();
  if (b.endpoint) await db.delete(pushSottoscrizioni).where(eq(pushSottoscrizioni.endpoint, b.endpoint));
  else await db.delete(pushSottoscrizioni).where(eq(pushSottoscrizioni.utente_id, check.sessione.id));
  return NextResponse.json({ ok: true });
}
