import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Riusa lo stesso account Google personale già autorizzato per il bot Telegram
// (assistente-telegram/lib/calendar.js) — stesso pattern: OAuth utente, non service
// account, perché serve leggere anche il calendario personale, non solo quello del B&B.
// Dall'08/09/2026 il client OAuth è lo stesso condiviso con Gmail (GMAIL_OAUTH_CLIENT_ID/
// SECRET, progetto "Salzillo Gmail Automazione", pubblicato "In production" per un token
// che non scada dopo 7 giorni) — solo il refresh token resta separato, ottenuto via
// /api/oauth/calendar-start perché è un account Google diverso da quello Gmail.
function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GMAIL_OAUTH_CLIENT_ID,
    process.env.GMAIL_OAUTH_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN });
  return client;
}

export async function GET(req: NextRequest) {
  const days = Number(req.nextUrl.searchParams.get('days') || '14');

  try {
    const auth = getOAuthClient();
    const calendar = google.calendar({ version: 'v3', auth });

    const calListRes = await calendar.calendarList.list();
    const calendars = (calListRes.data.items || []).filter((c) => c.selected !== false);

    const now = new Date();
    const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const perCalendar = await Promise.all(
      calendars.map(async (cal) => {
        try {
          const res = await calendar.events.list({
            calendarId: cal.id!,
            timeMin: now.toISOString(),
            timeMax: end.toISOString(),
            singleEvents: true,
            orderBy: 'startTime',
            maxResults: 50,
          });
          return (res.data.items || []).map((e) => ({
            id: e.id,
            summary: e.summary || '(senza titolo)',
            start: e.start?.dateTime || e.start?.date,
            end: e.end?.dateTime || e.end?.date,
            allDay: !!e.start?.date,
            calendarName: cal.summary || cal.id,
          }));
        } catch {
          return [];
        }
      })
    );

    const events = perCalendar.flat().sort((a, b) => new Date(a.start!).getTime() - new Date(b.start!).getTime());
    return NextResponse.json({ ok: true, events });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
