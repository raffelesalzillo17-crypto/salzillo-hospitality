import { NextRequest, NextResponse } from 'next/server';
import { creaRichiestaPubblica } from '@/lib/db/mutations';
import { disponibileDb } from '@/lib/db/pubblico';
import { inviaTelegram } from '@/lib/telegramDigest';
import { contenutiStrutture } from '@/lib/contenutiStrutture';

// Endpoint pubblico (nessuna autenticazione): riceve una richiesta di disponibilità dal
// sito vetrina (/soggiorna). NON crea un preventivo — solo una "richiesta" leggera che
// Raffaele vede in dashboard e trasforma lui in preventivo vero quando decide il prezzo.
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corpo della richiesta non valido' }, { status: 400 });
  }
  const d = body as Record<string, unknown>;

  const alloggioId = typeof d.alloggioId === 'string' ? d.alloggioId : '';
  const checkin = typeof d.checkin === 'string' ? d.checkin : '';
  const checkout = typeof d.checkout === 'string' ? d.checkout : '';
  const nome = typeof d.nome === 'string' ? d.nome.trim() : '';
  const telefono = typeof d.telefono === 'string' ? d.telefono.trim() : '';
  const numeroOspiti = Number(d.numeroOspiti) || 1;
  const note = typeof d.note === 'string' ? d.note.trim() : '';
  const nomeStruttura = typeof d.nomeStruttura === 'string' ? d.nomeStruttura : '';

  if (!alloggioId || !checkin || !checkout || !nome || !telefono) {
    return NextResponse.json({ error: 'Mancano dei dati obbligatori' }, { status: 400 });
  }

  if (checkout <= checkin) {
    return NextResponse.json({ error: 'La data di uscita deve essere dopo quella di arrivo.' }, { status: 400 });
  }
  const oggiISO = new Date().toISOString().slice(0, 10);
  if (checkin < oggiISO) {
    return NextResponse.json({ error: 'La data di arrivo non può essere nel passato.' }, { status: 400 });
  }

  const maxOspiti = contenutiStrutture[nomeStruttura]?.maxOspiti;
  if (maxOspiti && numeroOspiti > maxOspiti) {
    return NextResponse.json({ error: `Questa camera ospita al massimo ${maxOspiti} persone.` }, { status: 400 });
  }

  try {
    if (!(await disponibileDb(alloggioId, checkin, checkout))) {
      return NextResponse.json(
        { error: 'Queste date risultano già occupate per questa camera. Prova altre date o scrivici su WhatsApp.' },
        { status: 409 },
      );
    }

    await creaRichiestaPubblica({ alloggioId, checkin, checkout, numeroOspiti, nome, telefono, note: note || undefined });

    await inviaTelegram(
      `🌐 *Nuova richiesta dal sito*\n${nomeStruttura || ''}\n${nome} — ${telefono}\n` +
      `${checkin} → ${checkout} (${numeroOspiti} ospiti)\n` +
      (note ? `Nota: ${note}\n` : '') +
      `Vai su Documenti → Richieste per creare il preventivo.`,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('Errore richiesta pubblica', e);
    return NextResponse.json({ error: 'Non siamo riusciti a registrare la richiesta, riprova o scrivi su WhatsApp.' }, { status: 500 });
  }
}
