import { google } from 'googleapis';

// Storage documentale reale per ospite — la parte mancante scoperta il 09/09/2026: contratti
// e ricevute venivano generati al volo e restituiti solo al browser, mai salvati da nessuna
// parte. Vedi wiki/decisioni/architettura-dati-pronta-per-server-domestico.md.
//
// Google Drive come backend, dietro un confine di libreria unico (stesso principio già usato
// per Sheets in src/lib/sheets.ts): se un giorno tutto si sposta su un server domestico, si
// riscrive questo file, non le route che lo chiamano.
//
// LIMITE REALE IMPORTANTE, verificato il 09/09/2026 con un test vero (non solo letto in giro):
// un service account non può salvare file veri, NEMMENO dentro una cartella condivisa come
// Editor da un utente reale — Google rifiuta esplicitamente ("Service Accounts do not have
// storage quota"). Un primo tentativo con service account + cartella condivisa (vedi storia
// in wiki/decisioni/due-livelli-credenziali.md) si è rivelato quindi insufficiente. La cosa
// che funziona davvero per un Google personale (non Workspace, quindi niente Drive condivisi
// né delega di dominio): OAuth utente vero, stesso pattern già in uso per Calendar
// (src/app/api/calendario/route.ts) — i file scritti "come Raffaele" consumano la sua quota
// reale. Ottenuto via /api/oauth/drive-start, salvato come DRIVE_REFRESH_TOKEN.

const ROOT_FOLDER_ID = process.env.DRIVE_DOCUMENTI_FOLDER_ID;

function getDrive() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: client });
}

function requireRootFolder(): string {
  if (!ROOT_FOLDER_ID) {
    throw new Error(
      'DRIVE_DOCUMENTI_FOLDER_ID non configurata — serve una cartella nel Drive personale di Raffaele (OAuth utente, DRIVE_REFRESH_TOKEN — un service account non può usarla, vedi commento in cima a questo file)'
    );
  }
  return ROOT_FOLDER_ID;
}

/** Nome cartella leggibile: "Mario Rossi (osp_ab12cd34)" — il nome per riconoscerla a vista,
 *  l'id per non rompersi mai se Raffaele rinomina la persona dopo un matrimonio, un refuso, ecc. */
function nomeCartella(nome: string, id: string): string {
  return `${nome} (${id})`;
}

/** Trova una cartella dentro la cartella radice, creandola se non esiste ancora — generica:
 *  usata sia per la cartella di un ospite sia (dal 23/09/2026) per quella di un proprietario,
 *  che prima non esisteva affatto (i rendiconti mensili non venivano mai salvati da nessuna
 *  parte, vedi registraDocumentoProprietario sotto). */
async function ensureCartella(id: string, nome: string): Promise<string> {
  const drive = getDrive();
  const root = requireRootFolder();
  const nomeCompleto = nomeCartella(nome, id);

  const trovata = await drive.files.list({
    q: `'${root}' in parents and name = '${nomeCompleto.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    pageSize: 1,
  });
  const esistente = trovata.data.files?.[0];
  if (esistente?.id) return esistente.id;

  const creata = await drive.files.create({
    requestBody: { name: nomeCompleto, mimeType: 'application/vnd.google-apps.folder', parents: [root] },
    fields: 'id',
  });
  if (!creata.data.id) throw new Error('Creazione cartella fallita — Drive non ha restituito un id');
  return creata.data.id;
}

/** Trova la cartella dell'ospite dentro la cartella radice, creandola se non esiste ancora. */
export async function ensureCartellaOspite(ospiteId: string, nomeOspite: string): Promise<string> {
  return ensureCartella(ospiteId, nomeOspite);
}

/** Come ensureCartellaOspite, ma per un proprietario — usata per i rendiconti mensili, che
 *  riguardano lui, non un ospite. Prefisso "Rendiconti — " nel nome per distinguerla a vista
 *  dalle cartelle ospite nella stessa cartella radice. */
export async function ensureCartellaProprietario(proprietarioId: string, nomeProprietario: string): Promise<string> {
  return ensureCartella(proprietarioId, `Rendiconti — ${nomeProprietario}`);
}

export type DocumentoSalvato = { id: string; nome: string; link: string };

async function salvaNellaCartella(cartellaId: string, nomeFile: string, contenuto: Buffer, mimeType: string): Promise<DocumentoSalvato> {
  const drive = getDrive();
  const { Readable } = await import('stream');
  const file = await drive.files.create({
    requestBody: { name: nomeFile, parents: [cartellaId] },
    media: { mimeType, body: Readable.from(contenuto) },
    fields: 'id, name, webViewLink',
  });
  if (!file.data.id) throw new Error('Caricamento documento fallito — Drive non ha restituito un id');
  return { id: file.data.id, nome: file.data.name ?? nomeFile, link: file.data.webViewLink ?? '' };
}

/**
 * Salva un documento (PDF di contratto/ricevuta/schedina) nella cartella dell'ospite.
 * Pensata per essere non-bloccante lato chiamante: un errore qui non deve mai impedire di
 * restituire il PDF già generato all'utente — stesso principio dell'audit trail su Sheets.
 */
export async function salvaDocumento(
  ospiteId: string,
  nomeOspite: string,
  nomeFile: string,
  contenuto: Buffer,
  mimeType: string = 'application/pdf'
): Promise<DocumentoSalvato> {
  const cartellaId = await ensureCartellaOspite(ospiteId, nomeOspite);
  return salvaNellaCartella(cartellaId, nomeFile, contenuto, mimeType);
}

type TipoDocumento = 'Documento identità' | 'Contratto ospite' | 'Ricevuta' | 'Preventivo' | 'Conferma prenotazione' | 'Contratto gestione' | 'Rendiconto' | 'Ricevuta Alloggiati' | 'Altro';

/**
 * Come salvaDocumento, ma registra anche una riga nella tabella `documenti` (Postgres) così il
 * file compare nella scheda "Documenti" del nuovo sistema — non solo su Drive. Scoperto il
 * 13/09/2026: contratto/ricevuta salvavano già su Drive da mesi, ma senza questa riga il file
 * restava invisibile nell'app (solo i preventivi vi comparivano). Da qui in poi tutto ciò che
 * passa da questa funzione (contratti, ricevute) è tracciato; i documenti più vecchi restano
 * solo su Drive, recuperabili con elencaDocumenti.
 */
export async function registraDocumento(opts: {
  ospiteId: string; nomeOspite: string; nomeFile: string; contenuto: Buffer;
  tipo: TipoDocumento;
  prenotazioneId?: string; mimeType?: string;
}): Promise<DocumentoSalvato> {
  const salvato = await salvaDocumento(opts.ospiteId, opts.nomeOspite, opts.nomeFile, opts.contenuto, opts.mimeType);
  const { getDb } = await import('./db/index');
  const { documenti } = await import('./db/schema');
  await getDb().insert(documenti).values({
    tipo: opts.tipo, nome: opts.nomeFile, ospite_id: opts.ospiteId, prenotazione_id: opts.prenotazioneId || null,
    drive_file_id: salvato.id, drive_url: salvato.link, mime: opts.mimeType || 'application/pdf',
  });
  return salvato;
}

/** Come registraDocumento, ma per un documento legato a un proprietario (oggi solo i
 *  rendiconti mensili) invece che a un ospite — vedi ensureCartellaProprietario. Aggiunta il
 *  23/09/2026: prima il rendiconto veniva solo generato al volo e mai salvato da nessuna
 *  parte, quindi se una prenotazione veniva corretta dopo l'invio non c'era modo di recuperare
 *  cosa fosse stato effettivamente mandato al proprietario. */
export async function registraDocumentoProprietario(opts: {
  proprietarioId: string; nomeProprietario: string; nomeFile: string; contenuto: Buffer;
  tipo: TipoDocumento; mimeType?: string;
}): Promise<DocumentoSalvato> {
  const cartellaId = await ensureCartellaProprietario(opts.proprietarioId, opts.nomeProprietario);
  const salvato = await salvaNellaCartella(cartellaId, opts.nomeFile, opts.contenuto, opts.mimeType || 'application/pdf');
  const { getDb } = await import('./db/index');
  const { documenti } = await import('./db/schema');
  await getDb().insert(documenti).values({
    tipo: opts.tipo, nome: opts.nomeFile, proprietario_id: opts.proprietarioId,
    drive_file_id: salvato.id, drive_url: salvato.link, mime: opts.mimeType || 'application/pdf',
  });
  return salvato;
}

export async function elencaDocumenti(ospiteId: string, nomeOspite: string): Promise<DocumentoSalvato[]> {
  const cartellaId = await ensureCartellaOspite(ospiteId, nomeOspite);
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${cartellaId}' in parents and trashed = false`,
    fields: 'files(id, name, webViewLink)',
    orderBy: 'createdTime desc',
    pageSize: 100,
  });
  return (res.data.files ?? []).map((f) => ({ id: f.id!, nome: f.name ?? '', link: f.webViewLink ?? '' }));
}
