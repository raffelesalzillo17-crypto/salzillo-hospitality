import { NextResponse } from 'next/server';

// Autorizza l'accesso a Google Drive dell'account personale di Raffaele
// (raffaele.salzillo02@gmail.com — lo stesso già usato per Calendar). Necessario perché,
// verificato il 09/09/2026, un service account NON PUÒ salvare file veri nemmeno dentro una
// cartella condivisa da un utente reale — può solo creare cartelle (metadati, gratis). Serve
// un OAuth utente vero, che scrive "come Raffaele" e consuma la sua quota reale. Stesso
// identico pattern già in uso per Calendar — vedi /api/oauth/calendar-start.
//
// Visitare da loggati su raffaele.salzillo02@gmail.com, poi confermare su Google (avviso
// "app non verificata": normale, si prosegue da "Avanzate" → "Vai a ... (non sicuro)").

export async function GET() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const redirectUri = 'https://salzillo-hospitality.vercel.app/api/oauth/drive-callback';
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive',
    access_type: 'offline',
    prompt: 'consent',
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
