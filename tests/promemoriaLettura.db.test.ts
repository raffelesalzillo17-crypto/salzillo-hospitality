// Lettura (senza scrivere nulla) del riepilogo per prenotazione sul database vero. Solo con RUN_DB_TESTS=1.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
function urlDb(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try { return fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g, '') ?? null; } catch { return null; }
}
const url = urlDb();
if (url) process.env.DATABASE_URL = url;
describe.skipIf(!(process.env.RUN_DB_TESTS === '1' && url))('promemoria per prenotazione (sola lettura)', () => {
  it('restituisce un elenco ben formato', async () => {
    const { riepilogoPerPrenotazione } = await import('../src/lib/db/regole');
    const el = await riepilogoPerPrenotazione();
    expect(Array.isArray(el)).toBe(true);
    for (const p of el) for (const r of p.righe) expect(['Pronto', 'Inviato', 'In programma', 'Bloccato', 'Non necessario', 'Saltato']).toContain(r.stato);
    console.log('prenotazioni con messaggi:', el.length, '| stati:', JSON.stringify(el.flatMap((p) => p.righe.map((r) => r.stato)).reduce((a: Record<string, number>, s) => (a[s] = (a[s] ?? 0) + 1, a), {})));
  }, 60_000);
});
