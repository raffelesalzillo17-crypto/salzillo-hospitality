/**
 * Invio email con allegati via Gmail API (casella salzillohospitality@gmail.com) — aggiunto il
 * 29/09/2026 per l'analisi di mercato settimanale e il rendiconto mensile via email. Riusa lo
 * stesso client OAuth già usato in sola lettura da eseguiSyncEmailPrenotazioni
 * (src/lib/telegramDigest.ts): il refresh token deve avere anche lo scope gmail.send, non solo
 * gmail.readonly — va rifatta l'autorizzazione da /api/oauth/gmail-start dopo questo cambio.
 */
import { gmailClientBnb } from './gmailAuth';

const MITTENTE = 'salzillohospitality@gmail.com';

function getGmailClient() {
  return gmailClientBnb();
}

type Allegato = { nome: string; contentType: string; bytes: Uint8Array | Buffer };

// Le righe base64 andrebbero spezzate a 76 caratteri per rispettare RFC 2045 — Gmail è
// tollerante anche senza, ma è lo standard corretto per un messaggio MIME.
function wrap76(b64: string): string {
  return b64.replace(/.{1,76}/g, (riga) => riga + '\r\n');
}

function buildRawMessage(opts: { to: string; from: string; subject: string; testo: string; allegati: Allegato[] }): string {
  const boundary = `salzillo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const parti: string[] = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: =?UTF-8?B?${Buffer.from(opts.subject, 'utf8').toString('base64')}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(Buffer.from(opts.testo, 'utf8').toString('base64')),
  ];
  for (const a of opts.allegati) {
    parti.push(
      `--${boundary}`,
      `Content-Type: ${a.contentType}; name="${a.nome}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${a.nome}"`,
      '',
      wrap76(Buffer.from(a.bytes).toString('base64')),
    );
  }
  parti.push(`--${boundary}--`);
  return parti.join('\r\n');
}

export async function inviaEmailConAllegati(opts: { to: string; subject: string; testo: string; allegati: Allegato[] }): Promise<void> {
  const gmail = await getGmailClient();
  const raw = buildRawMessage({ ...opts, from: MITTENTE });
  const encoded = Buffer.from(raw, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } });
}
