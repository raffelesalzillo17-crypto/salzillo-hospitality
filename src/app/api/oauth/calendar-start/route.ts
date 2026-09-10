import { NextResponse } from 'next/server';

// Punto di partenza per (ri)autorizzare l'accesso a Google Calendar dell'account personale
// di Raffaele (raffaele.salzillo02@gmail.com — dove sono consolidati sia il calendario
// personale sia quello del B&B). Visitare questo indirizzo da loggati sull'account
// PERSONALE (non salzillohospitality@gmail.com, quello è per /api/oauth/gmail-start),
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
