import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, fileIdForTab } from '@/lib/sheets';

// Autenticazione RIMOSSA il 10/09/2026 su richiesta di Raffaele (vedi src/app/page.tsx).

const CALENDAR_ID    = process.env.GOOGLE_CALENDAR_ID!;

export async function POST(req: NextRequest) {
  let body: {
    row:           number;
    penaleType:    'nessuna' | 'penale';
    importoPenale?: number;
    stanza:        string;
    ospite:        string;
    eventId?:      string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { row, penaleType, importoPenale, stanza, ospite, eventId } = body;

  if (!row || !penaleType || !stanza || !ospite) {
    return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
  }

  const stato = penaleType === 'penale' ? 'Cancellata con penale' : 'Cancellata';

  try {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ];
    const auth     = getAuth(scopes);
    const sheets   = google.sheets({ version: 'v4', auth });
    const calendar = google.calendar({ version: 'v3', auth });

    // Aggiorna STATO (col H) e PENALE (col I)
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('DATABASE'),
      range: `DATABASE!H${row}:I${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[stato, penaleType === 'penale' ? (importoPenale ?? '') : '']],
      },
    });
    console.log('[cancella] ✅ Sheets aggiornato — riga:', row, 'stato:', stato);

    // Elimina evento Calendar
    let calResult = 'non eliminato';
    if (eventId) {
      try {
        await calendar.events.delete({ calendarId: CALENDAR_ID, eventId });
        calResult = 'eliminato';
        console.log('[cancella] ✅ Calendar eliminato — eventId:', eventId);
      } catch (e) {
        calResult = `errore: ${e instanceof Error ? e.message : 'sconosciuto'}`;
        console.error('[cancella] ⚠️ Calendar delete errore:', calResult);
      }
    } else {
      // Cerca per titolo (stanza — ospite)
      try {
        const searchRes = await calendar.events.list({
          calendarId: CALENDAR_ID,
          q: `${stanza} — ${ospite}`,
          maxResults: 5,
          singleEvents: true,
          orderBy: 'startTime',
        });
        const event = searchRes.data.items?.[0];
        if (event?.id) {
          await calendar.events.delete({ calendarId: CALENDAR_ID, eventId: event.id });
          calResult = 'eliminato (ricerca per titolo)';
          console.log('[cancella] ✅ Calendar eliminato (by search) — eventId:', event.id);
        } else {
          calResult = 'evento non trovato';
        }
      } catch (e) {
        calResult = `ricerca fallita: ${e instanceof Error ? e.message : 'sconosciuto'}`;
        console.error('[cancella] ⚠️ Calendar search errore:', calResult);
      }
    }

    return NextResponse.json({ ok: true, stato, calResult });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cancella] ERRORE GENERICO:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
