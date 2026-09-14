import { google } from 'googleapis';

// Backend per "Idee per Claude" — un Google Doc in prosa libera dove Raffaele scrive idee,
// una per riga. Un agente automatico (cron orario, vedi wiki) legge le righe non ancora
// annotate, le esegue o propone, e riscrive la riga con un'annotazione visibile subito nel
// documento — niente struttura rigida a tabella, solo testo che si accumula in ordine.
//
// Stesso OAuth utente già in uso per Drive (src/lib/documenti.ts): un service account non
// può scrivere/leggere documenti come Raffaele, serve DRIVE_REFRESH_TOKEN.

const DOC_ID = process.env.IDEE_DOC_ID;

function requireDocId(): string {
  if (!DOC_ID) throw new Error('IDEE_DOC_ID non configurata — vedi src/lib/ideeDoc.ts');
  return DOC_ID;
}

function getAuth() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return client;
}

function getDocs() {
  return google.docs({ version: 'v1', auth: getAuth() });
}

const MARCATORE = '→ ['; // ogni riga già processata contiene questo marcatore

// Titolo e istruzioni fisse messe all'inizio del documento alla creazione — non sono idee,
// vanno escluse dalla lettura anche se non hanno ancora il marcatore di riga processata.
const RIGHE_INTESTAZIONE = new Set([
  'Idee per Claude',
  'Scrivi qui le tue idee, una per riga (o mandale al bot Telegram con "idea: ..."). Un controllo automatico gira ogni ora: le idee semplici le eseguo e segno il risultato subito accanto alla riga; quelle che richiedono una tua scelta le lascio segnate "da discutere" con la mia proposta. Non cancellare le righe già annotate se vuoi tenere lo storico — puoi comunque scriverne di nuove sotto in qualsiasi momento.',
]);

/** Testo semplice del documento, una stringa per paragrafo (riga), righe vuote escluse. */
async function leggiParagrafi(): Promise<string[]> {
  const docs = getDocs();
  const res = await docs.documents.get({ documentId: requireDocId() });
  const content = res.data.body?.content ?? [];
  const righe: string[] = [];
  for (const el of content) {
    const testo = (el.paragraph?.elements ?? [])
      .map((e) => e.textRun?.content ?? '')
      .join('')
      .replace(/\n$/, '');
    if (testo.trim()) righe.push(testo);
  }
  return righe;
}

export type IdeaPendente = { testo: string };

/** Idee scritte da Raffaele ma non ancora annotate con un esito. */
export async function leggiIdeeDoc(): Promise<IdeaPendente[]> {
  const righe = await leggiParagrafi();
  return righe
    .filter((r) => !r.includes(MARCATORE) && !RIGHE_INTESTAZIONE.has(r.trim()))
    .map((testo) => ({ testo }));
}

/** Aggiunge una nuova riga/idea in fondo al documento (usato dal bot Telegram). */
export async function aggiungiIdeaDoc(testo: string): Promise<void> {
  const docs = getDocs();
  const documentId = requireDocId();
  const doc = await docs.documents.get({ documentId });
  const endIndex = doc.data.body?.content?.slice(-1)[0]?.endIndex ?? 1;
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        { insertText: { location: { index: Math.max(1, endIndex - 1) }, text: `\n${testo.trim()}` } },
      ],
    },
  });
}

/**
 * Scrive l'esito accanto a un'idea già presente, cercandola per testo esatto (niente indici
 * di carattere da calcolare a mano — replaceAllText gestisce la ricerca da sola). Se il testo
 * non combacia più esattamente (Raffaele l'ha modificata nel frattempo), lancia un errore
 * chiaro invece di annotare la riga sbagliata in silenzio.
 */
export async function annotaIdeaDoc(ideaOriginale: string, stato: string, nota: string): Promise<void> {
  const docs = getDocs();
  const documentId = requireDocId();
  const pulito = ideaOriginale.trim();
  const annotazione = `${pulito} ${MARCATORE}${stato.toUpperCase()}${nota ? ` — ${nota}` : ''}]`;

  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        { replaceAllText: { containsText: { text: pulito, matchCase: true }, replaceText: annotazione } },
      ],
    },
  });
}
