import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/index';
import { oauthToken } from '@/lib/db/schema';
import { SERVIZIO_GMAIL } from '@/lib/gmailAuth';

// Riceve il "code" da Google dopo l'autorizzazione della casella Gmail del B&B, lo scambia per un
// refresh token e lo SALVA nel database (tabella oauth_token, servizio 'gmail_bnb'): dal 02/10/2026
// niente copia a mano su Vercel e il token non viene mai mostrato. Permessi: gmail.modify (leggere
// e segnare come lette) + gmail.send. Vedi /api/oauth/gmail-start per l'avvio.

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error) return NextResponse.json({ ok: false, error });
  if (!code) return NextResponse.json({ ok: false, error: 'Nessun "code" ricevuto da Google' });

  const body = new URLSearchParams({
    code,
    client_id: process.env.GMAIL_OAUTH_CLIENT_ID ?? '',
    client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET ?? '',
    redirect_uri: 'https://salzillo-hospitality.vercel.app/api/oauth/gmail-callback',
    grant_type: 'authorization_code',
  });
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  if (!res.ok) return NextResponse.json({ ok: false, error: data.error, descrizione: data.error_description });
  if (!data.refresh_token) return NextResponse.json({ ok: false, error: 'Google non ha restituito un refresh token (riprova: serve prompt=consent)' });

  await getDb().insert(oauthToken)
    .values({ servizio: SERVIZIO_GMAIL, refresh_token: data.refresh_token })
    .onConflictDoUpdate({ target: oauthToken.servizio, set: { refresh_token: data.refresh_token, aggiornato_il: new Date() } });
  return NextResponse.json({ ok: true, salvato: true, scope: data.scope, scade_tra_7_giorni: data.refresh_token_expires_in !== undefined });
}
