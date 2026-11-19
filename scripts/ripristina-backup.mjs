// Decifra un backup del gestionale (file .shbk scaricato da Drive, cartella «Backup gestionale (cifrato)»)
// e lo scrive come JSON leggibile. NON scrive nel database: il ripristino vero si fa a mano, tabella per
// tabella, guardando il JSON.
//
// Uso (PowerShell, dalla cartella del repo):
//   $env:BACKUP_KEY = (Get-Content .backup_key_local -Raw).Trim()
//   node scripts/ripristina-backup.mjs "C:\percorso\backup-2026-11-22_04-30.shbk" "C:\percorso\uscita.json"
// Il JSON contiene dati personali degli ospiti: tienilo fuori da Drive condivisi, dal wiki e da git.
import { readFileSync, writeFileSync } from 'node:fs';
import { createDecipheriv, scryptSync } from 'node:crypto';
import { gunzipSync } from 'node:zlib';

const [, , entrata, uscita] = process.argv;
const chiave = (process.env.BACKUP_KEY ?? '').trim();
if (!entrata || !uscita || chiave.length < 32) {
  console.error('Uso: BACKUP_KEY=... node scripts/ripristina-backup.mjs <file.shbk> <uscita.json>');
  process.exit(1);
}
const blob = readFileSync(entrata);
const magic = Buffer.from('SHBK1');
if (!blob.subarray(0, magic.length).equals(magic)) { console.error('File non riconosciuto'); process.exit(1); }
let o = magic.length;
const salt = blob.subarray(o, (o += 16));
const iv = blob.subarray(o, (o += 12));
const tag = blob.subarray(o, (o += 16));
const d = createDecipheriv('aes-256-gcm', scryptSync(chiave, salt, 32), iv);
d.setAuthTag(tag);
const json = gunzipSync(Buffer.concat([d.update(blob.subarray(o)), d.final()]));
writeFileSync(uscita, json);
const tabelle = JSON.parse(json.toString('utf8')).tabelle;
console.log('Decifrato. Tabelle e righe:', Object.fromEntries(Object.entries(tabelle).map(([n, r]) => [n, r.length])));
