import { NextResponse } from 'next/server';

// Punto di partenza per autorizzare l'accesso in sola lettura alla casella Gmail
// (salzillohospitality@gmail.com) usata per riconoscere le prenotazioni Airbnb/Booking.
// Visitare questo indirizzo da loggati sull'account giusto, poi confermare su Google
// (compare l'avviso "app non verificata": normale per un progetto a uso personale, si
// prosegue da "Avanzate" → "Vai a ... (non sicuro)").
//
// Stesso client OAuth (stesso progetto Google Cloud "Salzillo Gmail Automazione") riusato
// anche da /api/oauth/calendar-start per Google Calendar — un solo progetto da mantenere,
// due autorizzazioni separate perché sono due account Google diversi (la casella B&B qui,
// l'account personale di Raffaele per il calendario).
//
// IMPORTANTE per un'autorizzazione che duri (non scada dopo 7 giorni): la schermata di
// consenso OAuth del progetto deve avere stato di pubblicazione "In production", non
// "Testing" — vedi wiki/decisioni/infrastruttura-free-first.md e wiki/entita/salzillo-hospitality.md
// per il dettaglio del problema che questo risolve.

export async function GET() {
  const clientId = process.env.GMAIL_OAUTH_CLIENT_ID;
  const redirectUri = 'https://salzillo-hospitality.vercel.app/api/oauth/gmail-callback';
  const params = new URLSearchParams({
    client_id: clientId ?? '',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    access_type: 'offline',
    prompt: 'consent',
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
