import { NextResponse } from 'next/server';
import { google } from 'googleapis';

// Rotta EFFIMERA: crea i due Google Doc per gli appunti di lezione (2ª e 4ª SAS) nel Drive
// personale di Raffaele, usando lo stesso client OAuth già condiviso (Gmail/Calendar) con
// il refresh token di Drive. Da cancellare subito dopo l'uso — stesso pattern delle altre
// rotte diagnostiche effimere del progetto.

function client() {
  const c = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  c.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return c;
}

export async function GET() {
  try {
    const auth = client();
    const drive = google.drive({ version: 'v3', auth });

    // cartella "Appunti Lezioni" per tenere i due file insieme
    const cartellaEsistente = await drive.files.list({
      q: "name = 'Appunti Lezioni' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: 'files(id,name)',
    });
    let folderId = cartellaEsistente.data.files?.[0]?.id;
    if (!folderId) {
      const f = await drive.files.create({ requestBody: { name: 'Appunti Lezioni', mimeType: 'application/vnd.google-apps.folder' }, fields: 'id' });
      folderId = f.data.id!;
    }

    const testoIniziale = (classe: string) =>
      `Appunti — ${classe}\n\n` +
      `Scrivi qui gli appunti della lezione del giorno. Un titolo di sezione per ogni lezione ` +
      `(es. "11/09 — Le frazioni"), sotto gli appunti così come li prendi. Da qui l'AI legge, ` +
      `semplifica e prepara la pagina per gli studenti.\n\n` +
      `───────────────────\n\n`;

    // Creazione via Drive (senza l'API Google Docs, non ancora abilitata sul progetto):
    // caricando testo semplice con mimeType di destinazione "document", Drive lo converte
    // automaticamente in un vero Google Doc modificabile.
    const risultati: Record<string, unknown>[] = [];
    for (const nome of ['Appunti 2ª SAS', 'Appunti 4ª SAS']) {
      const esiste = await drive.files.list({
        q: `name = '${nome}' and '${folderId}' in parents and trashed = false`,
        fields: 'files(id,name,webViewLink)',
      });
      if (esiste.data.files && esiste.data.files.length > 0) {
        risultati.push({ nome, giaEsistente: true, id: esiste.data.files[0].id, link: esiste.data.files[0].webViewLink });
        continue;
      }
      const f = await drive.files.create({
        requestBody: { name: nome, mimeType: 'application/vnd.google-apps.document', parents: [folderId] },
        media: { mimeType: 'text/plain', body: testoIniziale(nome) },
        fields: 'id,webViewLink',
      });
      risultati.push({ nome, id: f.data.id, link: f.data.webViewLink });
    }

    return NextResponse.json({ ok: true, cartella: folderId, file: risultati });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
