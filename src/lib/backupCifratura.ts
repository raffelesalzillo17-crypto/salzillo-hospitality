import { gzipSync, gunzipSync } from 'zlib';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Cifratura dei backup (AES-256-GCM) separata da database e Drive, così si prova con i test.
// Formato: SHBK1 | salt(16) | iv(12) | tag(16) | testo cifrato. Ripristino: scripts/ripristina-backup.mjs.

const MAGIC = Buffer.from('SHBK1');

/** Cifra un buffer: SHBK1 | salt(16) | iv(12) | tag(16) | testo cifrato. */
export function cifra(dati: Buffer, chiave: string): Buffer {
  if (chiave.trim().length < 32) throw new Error('BACKUP_KEY mancante o troppo corta (minimo 32 caratteri)');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const k = scryptSync(chiave.trim(), salt, 32);
  const c = createCipheriv('aes-256-gcm', k, iv);
  const cifrato = Buffer.concat([c.update(dati), c.final()]);
  return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), cifrato]);
}

export function decifra(blob: Buffer, chiave: string): Buffer {
  if (!blob.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('File non riconosciuto (manca l\'intestazione SHBK1)');
  let o = MAGIC.length;
  const salt = blob.subarray(o, (o += 16));
  const iv = blob.subarray(o, (o += 12));
  const tag = blob.subarray(o, (o += 16));
  const k = scryptSync(chiave.trim(), salt, 32);
  const d = createDecipheriv('aes-256-gcm', k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(blob.subarray(o)), d.final()]);
}

export function impacchetta(tabelle: Record<string, unknown[]>, chiave: string): Buffer {
  return cifra(gzipSync(Buffer.from(JSON.stringify({ versione: 1, tabelle }), 'utf8')), chiave);
}

export function spacchetta(blob: Buffer, chiave: string): { versione: number; tabelle: Record<string, unknown[]> } {
  return JSON.parse(gunzipSync(decifra(blob, chiave)).toString('utf8'));
}
