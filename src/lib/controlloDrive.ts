import { google } from 'googleapis';

/**
 * Controllo in SOLA LETTURA della condivisione delle cartelle Drive con i documenti degli ospiti
 * (punto 5 delle richieste, 23/11/2026). Restituisce SOLO conteggi e tipi di condivisione: mai i
 * nomi di cartelle o file (sono nomi di ospiti). Non cambia nessuna impostazione di Drive.
 */
export type EsitoControlloDrive = {
  elementiControllati: number; cartelle: number;
  condivisionePubblica: number; tipiPubblici: Record<string, number>;
  condivisiConPersone: number; radiceCondivisaPubblicamente: boolean;
  ultimoBackup: string | null;
};

type FileDrive = { id?: string | null; name?: string | null; mimeType?: string | null; shared?: boolean | null; permissions?: { type?: string | null; role?: string | null }[] };

export async function controllaCondivisioneDrive(): Promise<EsitoControlloDrive> {
  const radice = process.env.DRIVE_DOCUMENTI_FOLDER_ID;
  if (!radice) throw new Error('Cartella documenti non configurata (DRIVE_DOCUMENTI_FOLDER_ID)');
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  const drive = google.drive({ version: 'v3', auth: client });

  const figli = async (id: string): Promise<FileDrive[]> => {
    const out: FileDrive[] = []; let pageToken: string | undefined;
    do {
      const r = await drive.files.list({
        q: `'${id}' in parents and trashed = false`, pageSize: 200, pageToken,
        fields: 'nextPageToken, files(id,name,mimeType,shared,permissions(type,role))',
        supportsAllDrives: true, includeItemsFromAllDrives: true,
      });
      out.push(...((r.data.files ?? []) as FileDrive[])); pageToken = r.data.nextPageToken ?? undefined;
    } while (pageToken);
    return out;
  };
  const pubblici = (f: FileDrive) => (f.permissions ?? []).filter((p) => p.type === 'anyone' || p.type === 'domain');

  const r = await drive.files.get({ fileId: radice, fields: 'id,shared,permissions(type,role)', supportsAllDrives: true });
  const livello1 = await figli(radice);
  const cartelle = livello1.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
  const tutti: FileDrive[] = [...livello1];
  for (const c of cartelle) if (c.id) tutti.push(...await figli(c.id));

  const tipi: Record<string, number> = {};
  let nPubblici = 0;
  for (const f of tutti) {
    const p = pubblici(f);
    if (p.length) nPubblici++;
    for (const x of p) tipi[`${x.type}/${x.role}`] = (tipi[`${x.type}/${x.role}`] ?? 0) + 1;
  }
  const backup = livello1.find((f) => f.name === 'Backup gestionale (cifrato)');
  let ultimoBackup: string | null = null;
  if (backup?.id) {
    const b = await drive.files.list({ q: `'${backup.id}' in parents and trashed = false`, orderBy: 'createdTime desc', pageSize: 1, fields: 'files(createdTime)', supportsAllDrives: true });
    ultimoBackup = b.data.files?.[0]?.createdTime ?? null;
  }
  return {
    elementiControllati: tutti.length, cartelle: cartelle.length,
    condivisionePubblica: nPubblici, tipiPubblici: tipi,
    condivisiConPersone: tutti.filter((f) => f.shared).length,
    radiceCondivisaPubblicamente: pubblici(r.data as FileDrive).length > 0,
    ultimoBackup,
  };
}
