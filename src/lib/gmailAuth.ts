import { google } from 'googleapis';
import { eq } from 'drizzle-orm';
import { getDb } from './db/index';
import { oauthToken } from './db/schema';

// Client Gmail della casella del B&B (salzillohospitality@gmail.com). Dal 02/10/2026 il refresh
// token sta nel database (tabella oauth_token, servizio 'gmail_bnb'), scritto dal server dopo
// l'autorizzazione (/api/oauth/gmail-callback), con il permesso di segnare le email come lette
// (gmail.modify). La variabile GMAIL_REFRESH_TOKEN resta solo come ripiego se la riga non c'è.

export const SERVIZIO_GMAIL = 'gmail_bnb';

export async function gmailClientBnb() {
  let refresh: string | undefined;
  try {
    const [t] = await getDb().select().from(oauthToken).where(eq(oauthToken.servizio, SERVIZIO_GMAIL)).limit(1);
    refresh = t?.refresh_token;
  } catch (err) {
    console.error('[gmailAuth] lettura del token dal database fallita, uso la variabile:', err instanceof Error ? err.message : err);
  }
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: refresh ?? process.env.GMAIL_REFRESH_TOKEN?.trim() });
  return google.gmail({ version: 'v1', auth: client });
}
