/**
 * Eventi Google Calendar per le prenotazioni create nel nuovo sistema.
 *
 * Un calendario per immobile (`immobili.calendar_id`); se non impostato, si usa quello
 * condiviso `GOOGLE_CALENDAR_ID` come oggi. Stesso account service già autorizzato sul
 * calendario del B&B (come /api/prenotazione).
 *
 * Tutto best-effort: se Calendar non risponde, la prenotazione si salva lo stesso.
 */

import { google } from 'googleapis';
import { getAuth } from '../sheets';

function calendarClient() {
  return google.calendar({ version: 'v3', auth: getAuth(['https://www.googleapis.com/auth/calendar']) });
}

const COLORE: Record<string, string> = { Airbnb: '11', Booking: '9', Diretto: '10', 'No Tax': '5' };

export async function creaEventoPrenotazione(opts: {
  calendarId: string | null; alloggio: string; ospite: string; canale: string;
  checkin: string; checkout: string; lordo: number; utile: number; telefono?: string | null;
}): Promise<string | null> {
  const calId = opts.calendarId || process.env.GOOGLE_CALENDAR_ID;
  if (!calId) return null;
  try {
    const res = await calendarClient().events.insert({
      calendarId: calId,
      requestBody: {
        summary: `${opts.alloggio} — ${opts.ospite} (${opts.canale})`,
        description: `Lordo: €${opts.lordo} · Utile: €${opts.utile}${opts.telefono ? ` · Tel: ${opts.telefono}` : ''}\n(creato dal nuovo sistema)`,
        start: { date: opts.checkin },
        end: { date: opts.checkout },
        colorId: COLORE[opts.canale] ?? '8',
      },
    });
    return res.data.id ?? null;
  } catch (e) {
    console.error('[calendario] insert fallito (non bloccante):', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function eliminaEventoPrenotazione(calendarId: string | null, eventId: string): Promise<void> {
  const calId = calendarId || process.env.GOOGLE_CALENDAR_ID;
  if (!calId || !eventId) return;
  try {
    await calendarClient().events.delete({ calendarId: calId, eventId });
  } catch (e) {
    console.error('[calendario] delete fallito (non bloccante):', e instanceof Error ? e.message : e);
  }
}
