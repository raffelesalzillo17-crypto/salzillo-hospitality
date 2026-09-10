import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getAuth, fileIdForTab } from '@/lib/sheets';
import { calcUtile } from '@/lib/prenotazioni';

// Autenticazione RIMOSSA il 10/09/2026 su richiesta di Raffaele (vedi src/app/page.tsx).

// calcUtile + tariffe (commissioni OTA, cedolare 21%, pulizia €20) vivono in un solo posto,
// src/lib/prenotazioni.ts — sono numeri fiscali/di business, non devono poter divergere tra
// una route e l'altra (prima erano copiati identici qui e in /api/prenotazioni).

const CALENDAR_ID    = process.env.GOOGLE_CALENDAR_ID!;

function calColorId(stanza: string): string {
  if (stanza === 'Tulipano') return '2';
  if (stanza === 'Rosa')     return '4';
  return '5';
}

function toItalian(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export async function POST(req: NextRequest) {
  console.log('\n━━━━ [prenotazione] POST ricevuto ━━━━');

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 });
  }

  const { checkin, checkout, ospite, stanza, canale, lordo, telefono } = body as Record<string, unknown>;

  if (!checkin || !checkout || !(ospite as string)?.trim() || !stanza || !canale || lordo == null) {
    return NextResponse.json({ error: 'Campi mancanti' }, { status: 400 });
  }

  const lordoNum = Number(lordo);
  const utile    = calcUtile(lordoNum, canale as string);

  try {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/calendar',
    ];
    const auth     = getAuth(scopes);
    const sheets   = google.sheets({ version: 'v4', auth });
    const calendar = google.calendar({ version: 'v3', auth });

    // Trova la prima riga libera
    const colB = await sheets.spreadsheets.values.get({
      spreadsheetId: fileIdForTab('DATABASE'),
      range: 'DATABASE!B:B',
    });
    const nextRow = (colB.data.values?.length ?? 1) + 1;
    console.log('[prenotazione] prossima riga DATABASE:', nextRow);

    // Inserisci evento Calendar (non bloccante)
    let eventId = '';
    try {
      const calRes = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        requestBody: {
          summary:     `${stanza} — ${(ospite as string).trim()} (${canale})`,
          description: `Lordo: €${lordoNum} | Utile reale: €${utile} | Canale: ${canale}`,
          start: { date: checkin as string },
          end:   { date: checkout as string },
          colorId: calColorId(stanza as string),
        },
      });
      eventId = calRes.data.id ?? '';
      console.log('[prenotazione] ✅ Calendar OK — eventId:', eventId);
    } catch (e) {
      console.error('[prenotazione] ⚠️ Calendar ERRORE (non bloccante):', e instanceof Error ? e.message : e);
    }

    // Scrivi su Sheets: B=checkin, C=checkout, D=ospite, E=stanza, F=canale, G=lordo, H=STATO, I=PENALE, J=eventId, K=telefono
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('DATABASE'),
      range: `DATABASE!B${nextRow}:K${nextRow}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          toItalian(checkin as string),
          toItalian(checkout as string),
          (ospite as string).trim(),
          stanza,
          canale,
          lordoNum,
          'Attiva',
          '',
          eventId,
          (telefono as string)?.trim() ?? '',
        ]],
      },
    });
    console.log('[prenotazione] ✅ Sheets OK — riga:', nextRow);

    // Aggancia (o crea) l'anagrafica ospite — non bloccante, la prenotazione è già salvata.
    // Vedi src/lib/ospiti.ts per la logica di deduplica (per telefono, poi per nome).
    try {
      const { trovaOCreaOspite } = await import('@/lib/ospiti');
      await trovaOCreaOspite((ospite as string).trim(), (telefono as string)?.trim() ?? '');
    } catch (e) {
      console.error('[prenotazione] ⚠️ Anagrafica ospite ERRORE (non bloccante):', e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ ok: true, utile, calWarning: eventId ? undefined : 'Calendar non aggiornato' });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[prenotazione] ERRORE GENERICO:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
