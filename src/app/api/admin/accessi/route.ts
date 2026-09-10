import { NextRequest, NextResponse } from 'next/server';
import { elencoAccessi, creaAccesso, resettaPassword, impostaAttivo } from '@/lib/accessi';

// Gestione accessi al sito prenotazioni — SOLO da Motore Rafilu (Raffaele), protetta dalla
// stessa chiave usata per tutta la dashboard. Non è collegata al sistema di login dei
// collaboratori: quello autentica loro sul sito prenotazioni, questa autentica Raffaele qui.

function checkPlanciaKey(req: NextRequest): boolean {
  const expected = process.env.PLANCIA_ACCESS_KEY;
  const provided = req.headers.get('x-plancia-key');
  return !expected || provided === expected;
}

export async function GET(req: NextRequest) {
  if (!checkPlanciaKey(req)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  const accessi = await elencoAccessi();
  // Non restituire mai passwordHash al client, anche se è solo un hash — non serve alla UI.
  const safe = accessi.map((a) => {
    const { passwordHash, ...rest } = a;
    void passwordHash;
    return rest;
  });
  return NextResponse.json({ ok: true, accessi: safe });
}

export async function POST(req: NextRequest) {
  if (!checkPlanciaKey(req)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  let body: {
    username?: string; nome?: string; ruolo?: string;
    puoCreare?: boolean; puoCancellare?: boolean; puoVedereFinanziario?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  if (!body.username?.trim() || !body.nome?.trim()) {
    return NextResponse.json({ error: 'Username e nome sono obbligatori' }, { status: 400 });
  }

  try {
    const { accesso, passwordInChiaro } = await creaAccesso({
      username: body.username,
      nome: body.nome,
      ruolo: body.ruolo ?? '',
      puoCreare: !!body.puoCreare,
      puoCancellare: !!body.puoCancellare,
      puoVedereFinanziario: !!body.puoVedereFinanziario,
    });
    // Unica occasione in cui la password in chiaro esce dal server — mostrata una volta sola
    // a Raffaele perché la giri al collaboratore, mai più recuperabile dopo questa risposta.
    return NextResponse.json({ ok: true, username: accesso.username, nome: accesso.nome, password: passwordInChiaro });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Errore sconosciuto' }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkPlanciaKey(req)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });

  let body: { username?: string; azione?: 'reset' | 'attiva' | 'disattiva' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  if (!body.username || !body.azione) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  try {
    if (body.azione === 'reset') {
      const password = await resettaPassword(body.username);
      return NextResponse.json({ ok: true, password });
    }
    await impostaAttivo(body.username, body.azione === 'attiva');
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Errore sconosciuto' }, { status: 400 });
  }
}
