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
    const docs = google.docs({ version: 'v1', auth });

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
      const doc = await docs.documents.create({ requestBody: { title: nome } });
      const id = doc.data.documentId!;
      await drive.files.update({ fileId: id, addParents: folderId, fields: 'id' });
      const meta = await drive.files.get({ fileId: id, fields: 'webViewLink' });
      risultati.push({ nome, id, link: meta.data.webViewLink });
    }

    return NextResponse.json({ ok: true, cartella: folderId, file: risultati });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
