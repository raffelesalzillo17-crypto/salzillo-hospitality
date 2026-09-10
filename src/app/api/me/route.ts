import { NextRequest, NextResponse } from 'next/server';
import { requireAccesso } from '@/lib/requireAccesso';

// Usata dal sito prenotazioni all'avvio per sapere se c'è già una sessione valida (cookie)
// e con quali permessi, senza dover rifare il login a ogni apertura della pagina.

export async function GET(req: NextRequest) {
  const check = await requireAccesso(req);
  if ('risposta' in check) return check.risposta;
  return NextResponse.json({ ok: true, ...check.permessi });
}
