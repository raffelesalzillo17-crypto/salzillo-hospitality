import { NextRequest, NextResponse } from 'next/server';

// Riceve il "code" da Google dopo l'autorizzazione e lo scambia per un refresh token,
// mostrato una sola volta a schermo perché Raffaele lo copi e lo passi via chat per
// salvarlo come GMAIL_REFRESH_TOKEN. Vedi /api/oauth/gmail-start per l'avvio del flusso.

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const error = req.nextUrl.searchParams.get('error');
  if (error) return NextResponse.json({ ok: false, error });
  if (!code) return NextResponse.json({ ok: false, error: 'Nessun "code" ricevuto da Google' });

  const redirectUri = 'https://salzillo-hospitality.vercel.app/api/oauth/gmail-callback';
  const body = new URLSearchParams({
    code,
    client_id: process.env.GMAIL_OAUTH_CLIENT_ID ?? '',
    client_secret: process.env.GMAIL_OAUTH_CLIENT_SECRET ?? '',
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const data = await res.json();
  return NextResponse.json({ ok: res.ok, ...data });
}
