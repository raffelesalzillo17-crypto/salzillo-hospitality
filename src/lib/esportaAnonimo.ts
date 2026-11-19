import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { leggiPrenotazioni, type Prenotazione } from '@/lib/prenotazioni';

// Foglio Google ANONIMO delle prenotazioni, pensato per gli assistenti esterni di Raffaele
// (Grok Bot, 19/11/2026): sola lettura, senza chiavi, senza dati personali.
//
// Colonne: Alloggio, Arrivo, Partenza, Notti, Canale, Stato, Aggiornato.
// MAI qui dentro: nome o cognome dell'ospite, telefono, email, codice di conferma del canale,
// importi (lordo, utile, penale), note, id degli eventi del calendario. Se si aggiunge una
// colonna, deve restare impossibile risalire a una persona.
// Finestra: da 90 giorni fa in avanti (arrivi e partenze recenti e futuri, non lo storico).

const NOME_FILE = 'Prenotazioni (anonimo)';
const GIORNI_INDIETRO = 90;
const INTESTAZIONI = ['Alloggio', 'Arrivo', 'Partenza', 'Notti', 'Canale', 'Stato', 'Aggiornato'];

/** "17/11/2026" → "2026-11-17" (data di calendario, senza fusi orari). */
function aIso(dmy: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

function giorniTra(daIso: string, aIsoStr: string): number {
  const ms = Date.UTC(+aIsoStr.slice(0, 4), +aIsoStr.slice(5, 7) - 1, +aIsoStr.slice(8, 10))
           - Date.UTC(+daIso.slice(0, 4), +daIso.slice(5, 7) - 1, +daIso.slice(8, 10));
  return Math.round(ms / 86_400_000);
}

function cella(v: string | number): string {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export type RigaAnonima = { alloggio: string; arrivo: string; partenza: string; notti: number; canale: string; stato: string };

/** Trasforma le prenotazioni in righe anonime: copia SOLO i campi ammessi. */
export function righeAnonime(prenotazioni: Prenotazione[], oggiIso: string): RigaAnonima[] {
  const [y, m, d] = oggiIso.split('-').map(Number);
  const limite = new Date(Date.UTC(y, m - 1, d - GIORNI_INDIETRO)).toISOString().slice(0, 10);
  const righe: RigaAnonima[] = [];
  for (const p of prenotazioni) {
    const arrivo = aIso(p.checkin);
    const partenza = aIso(p.checkout);
    if (!arrivo || !partenza || partenza < limite) continue;
    righe.push({
      alloggio: p.stanza,
      arrivo,
      partenza,
      notti: Math.max(0, giorniTra(arrivo, partenza)),
      canale: p.canale,
      stato: p.stato,
    });
  }
  return righe.sort((a, b) => a.arrivo.localeCompare(b.arrivo) || a.alloggio.localeCompare(b.alloggio));
}

export function righeInCsv(righe: RigaAnonima[], aggiornato: string): string {
  const linee = [INTESTAZIONI.join(',')];
  for (const r of righe) {
    linee.push([r.alloggio, r.arrivo, r.partenza, r.notti, r.canale, r.stato, aggiornato].map(cella).join(','));
  }
  return linee.join('\n') + '\n';
}

function getDrive(): drive_v3.Drive {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: client });
}

export type EsitoEsportazione = { fileId: string; link: string; righe: number; creato: boolean; account: string; condiviso: string };

/** Dà accesso in SOLA LETTURA al foglio all'indirizzo indicato (variabile ANONIMO_CONDIVIDI_CON),
 *  senza mandare email e senza duplicati. Se l'indirizzo è già il proprietario non fa nulla. */
async function condividiInSolaLettura(drive: drive_v3.Drive, fileId: string, email: string, proprietario: string): Promise<string> {
  if (!email) return 'nessuno';
  if (email.toLowerCase() === proprietario.toLowerCase()) return 'proprietario';
  const permessi = await drive.permissions.list({ fileId, fields: 'permissions(emailAddress, role)' });
  const gia = permessi.data.permissions?.find((p) => p.emailAddress?.toLowerCase() === email.toLowerCase());
  if (gia?.role === 'reader') return 'sola lettura (già presente)';
  if (gia?.role) return `ATTENZIONE: ruolo ${gia.role}`;
  await drive.permissions.create({
    fileId,
    sendNotificationEmail: false,
    requestBody: { type: 'user', role: 'reader', emailAddress: email },
  });
  return 'sola lettura';
}

/** Genera il CSV anonimo e lo scrive nel foglio «Prenotazioni (anonimo)» (lo crea se manca).
 *  Il foglio sta nella cartella radice dei documenti su Drive; si condivide a mano, in sola lettura. */
export async function esportaPrenotazioniAnonime(adesso: Date = new Date()): Promise<EsitoEsportazione> {
  const root = process.env.DRIVE_DOCUMENTI_FOLDER_ID;
  if (!root) throw new Error('DRIVE_DOCUMENTI_FOLDER_ID non configurata');

  const oggiIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(adesso); // YYYY-MM-DD
  const aggiornato = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short',
  }).format(adesso); // "2026-11-19 15:40"

  const righe = righeAnonime(await leggiPrenotazioni(), oggiIso);
  const csv = righeInCsv(righe, aggiornato);

  const drive = getDrive();
  const trovati = await drive.files.list({
    q: `'${root}' in parents and name = '${NOME_FILE}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: 'files(id, webViewLink)',
    pageSize: 1,
  });
  const esistente = trovati.data.files?.[0];
  const account = (await drive.about.get({ fields: 'user(emailAddress)' })).data.user?.emailAddress ?? '';
  const destinatario = (process.env.ANONIMO_CONDIVIDI_CON ?? '').trim();

  let fileId: string;
  let link: string;
  let creato: boolean;
  if (esistente?.id) {
    await drive.files.update({ fileId: esistente.id, media: { mimeType: 'text/csv', body: Readable.from(csv) } });
    fileId = esistente.id; link = esistente.webViewLink ?? ''; creato = false;
  } else {
    const nuovo = await drive.files.create({
      requestBody: { name: NOME_FILE, mimeType: 'application/vnd.google-apps.spreadsheet', parents: [root] },
      media: { mimeType: 'text/csv', body: Readable.from(csv) },
      fields: 'id, webViewLink',
    });
    if (!nuovo.data.id) throw new Error('Creazione del foglio anonimo fallita: Drive non ha restituito un id');
    fileId = nuovo.data.id; link = nuovo.data.webViewLink ?? ''; creato = true;
  }
  const condiviso = await condividiInSolaLettura(drive, fileId, destinatario, account);
  return { fileId, link, righe: righe.length, creato, account, condiviso };
}
