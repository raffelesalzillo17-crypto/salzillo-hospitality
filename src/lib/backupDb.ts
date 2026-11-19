import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { is } from 'drizzle-orm';
import { PgTable, getTableConfig } from 'drizzle-orm/pg-core';
import { getDb, schema } from '@/lib/db';
import { impacchetta } from '@/lib/backupCifratura';

// Backup del database Neon (19/11/2026, richiesta di Raffaele: nessuna copia automatica esisteva).
//
// Tutte le tabelle dello schema → JSON → gzip → CIFRATO (AES-256-GCM) → file su Drive, nella
// cartella «Backup gestionale (cifrato)». Il file è illeggibile senza BACKUP_KEY, che sta solo su
// Vercel e in un file locale di Raffaele: i dati degli ospiti non finiscono in chiaro su Drive, e
// nemmeno un assistente collegato a quel Drive (Grok Bot) può leggerli. Si tengono le ultime
// COPIE_DA_TENERE copie. Ripristino: scripts/ripristina-backup.mjs.

const NOME_CARTELLA = 'Backup gestionale (cifrato)';
const COPIE_DA_TENERE = 8;

/** Legge TUTTE le tabelle dello schema (anche quelle aggiunte in futuro). */
export async function leggiTutteLeTabelle(): Promise<Record<string, unknown[]>> {
  const db = getDb();
  const out: Record<string, unknown[]> = {};
  for (const valore of Object.values(schema)) {
    if (!is(valore, PgTable)) continue;
    const nome = getTableConfig(valore).name;
    out[nome] = await db.select().from(valore);
  }
  return out;
}

function getDrive(): drive_v3.Drive {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: client });
}

export type EsitoBackup = { file: string; byte: number; tabelle: Record<string, number>; copieTenute: number; copieEliminate: number };

export async function eseguiBackup(adesso: Date = new Date()): Promise<EsitoBackup> {
  const root = process.env.DRIVE_DOCUMENTI_FOLDER_ID;
  if (!root) throw new Error('DRIVE_DOCUMENTI_FOLDER_ID non configurata');
  const chiave = process.env.BACKUP_KEY ?? '';

  const tabelle = await leggiTutteLeTabelle();
  const conteggi = Object.fromEntries(Object.entries(tabelle).map(([n, r]) => [n, r.length]));
  const blob = impacchetta(tabelle, chiave);

  const drive = getDrive();
  const trovata = await drive.files.list({
    q: `'${root}' in parents and name = '${NOME_CARTELLA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id)', pageSize: 1,
  });
  let cartella = trovata.data.files?.[0]?.id;
  if (!cartella) {
    const n = await drive.files.create({
      requestBody: { name: NOME_CARTELLA, mimeType: 'application/vnd.google-apps.folder', parents: [root] },
      fields: 'id',
    });
    cartella = n.data.id ?? undefined;
  }
  if (!cartella) throw new Error('Cartella dei backup non creata');

  const quando = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', dateStyle: 'short', timeStyle: 'short' })
    .format(adesso).replace(' ', '_').replace(':', '-');
  const nomeFile = `backup-${quando}.shbk`;
  await drive.files.create({
    requestBody: { name: nomeFile, parents: [cartella] },
    media: { mimeType: 'application/octet-stream', body: Readable.from(blob) },
    fields: 'id',
  });

  const elenco = await drive.files.list({
    q: `'${cartella}' in parents and name contains 'backup-' and trashed = false`,
    fields: 'files(id, name)', orderBy: 'name desc', pageSize: 100,
  });
  const vecchi = (elenco.data.files ?? []).slice(COPIE_DA_TENERE);
  for (const f of vecchi) if (f.id) await drive.files.delete({ fileId: f.id });

  return { file: nomeFile, byte: blob.length, tabelle: conteggi, copieTenute: Math.min((elenco.data.files ?? []).length, COPIE_DA_TENERE), copieEliminate: vecchi.length };
}
