import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Rotta EFFIMERA: elimina i due Google Doc "Appunti 2a/4a SAS" e la cartella "Appunti
// Lezioni" creati per errore (Raffaele ha cambiato idea, vuole dividere per materia).
// Da cancellare subito dopo l'uso.

function client() {
  const c = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return c;
}

export async function GET() {
  try {
    const drive = google.drive({ version: 'v3', auth: client() });
    const ids = [
      '1qHpdBRwb-5-Y_IzHulZhZB7PUbx59FIL7P36RXISEfc', // Appunti 2a SAS
      '1EwIGcuyR0-6UFjDJl9zc5HYzXtBWSYF7XToQ-JaOOAQ', // Appunti 4a SAS
      '1NX1eZn8Fs3y81kkyZ-XC0as13rr4S9Uy', // cartella Appunti Lezioni
    ];
    const esiti = [];
    for (const id of ids) {
      try {
        await drive.files.update({ fileId: id, requestBody: { trashed: true } });
        esiti.push({ id, ok: true });
      } catch (e) {
        esiti.push({ id, ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return NextResponse.json({ ok: true, esiti });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
