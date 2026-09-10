import { NextRequest, NextResponse } from 'next/server';

// Controllo leggero e veloce della chiave della dashboard, usato dalla schermata di sblocco
// per dare un errore subito invece di far scoprire all'utente che era sbagliata solo dopo
// (quando falliva la prima vera richiesta a /api/assistente).

export async function POST(req: NextRequest) {
  const expectedKey = process.env.PLANCIA_ACCESS_KEY;
  const providedKey = req.headers.get('x-plancia-key');
  const valid = !expectedKey || providedKey === expectedKey;
  return NextResponse.json({ ok: valid });
}
