import { NextResponse } from 'next/server';

// Punto di partenza per autorizzare l'accesso a Google Calendar dell'account del B&B
// (salzillohospitality@gmail.com): serve a rispondere agli inviti ricevuti nella casella del
// B&B (src/lib/posta.ts). Dal 29/09/2026 il calendario PERSONALE di Raffaele non è più qui: sta in
// plancia-raffaele. Visitare questo indirizzo da loggati su salzillohospitality@gmail.com,
// poi confermare su Google (compare l'avviso "app non verificata": normale, si prosegue
// da "Avanzate" → "Vai a ... (non sicuro)").
//
// Riusa lo stesso client OAuth di Gmail (stesso progetto Google Cloud "Salzillo Gmail
// Automazione") — un solo progetto/una sola schermata di consenso da mantenere "In
// production" per entrambe le autorizzazioni, anche se producono due refresh token
// distinti (due account Google diversi). Vedi /api/oauth/gmail-start per il dettaglio
// del perché "In production" (non "Testing") è essenziale per un'autorizzazione duratura.

export async function GET() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const redirectUri = 'https://salzillo-hospitality.vercel.app/api/oauth/calendar-callback';
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar',
    access_type: 'offline',
    prompt: 'consent',
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
