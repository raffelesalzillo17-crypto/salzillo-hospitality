// Prova il cestino (fotografia + ripristino) sul database VERO con un ospite FINTO, e poi toglie
// solo le righe create dal test. Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/cestino.db.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';

function urlDb(): string | null {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const t = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
    return t.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='))?.slice(13).replace(/^"|"$/g, '') ?? null;
  } catch { return null; }
}
const url = urlDb();
const attivo = process.env.RUN_DB_TESTS === '1' && !!url;
if (url) process.env.DATABASE_URL = url;

describe.skipIf(!attivo)('cestino (database reale, dati finti)', () => {
  it('fotografa, elimina, ripristina e ritrova la stessa riga', async () => {
    const { getDb } = await import('../src/lib/db');
    const { ospiti, cestino } = await import('../src/lib/db/schema');
    const { mettiNelCestino, ripristinaDalCestino, leggiCestino } = await import('../src/lib/db/registro');
    const db = getDb();
    const [finto] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoTest', note: 'riga creata dal test del cestino' }).returning();
    try {
      await mettiNelCestino('ospite', finto, 'FintoTest Prova', null);
      await db.delete(ospiti).where(eq(ospiti.id, finto.id));
      expect((await db.select().from(ospiti).where(eq(ospiti.id, finto.id))).length).toBe(0);
      expect((await leggiCestino()).some((c) => c.etichetta === 'FintoTest Prova')).toBe(true);

      const [voce] = await db.select().from(cestino).where(eq(cestino.entita_id, finto.id));
      await ripristinaDalCestino(voce.id);
      const [tornato] = await db.select().from(ospiti).where(eq(ospiti.id, finto.id));
      expect(tornato.cognome).toBe('FintoTest');
      expect(new Date(tornato.creato_il).getTime()).toBe(new Date(finto.creato_il).getTime());
      expect((await leggiCestino()).some((c) => c.etichetta === 'FintoTest Prova')).toBe(false);
      await expect(ripristinaDalCestino(voce.id)).rejects.toThrow('Già ripristinato');
    } finally {
      await db.delete(ospiti).where(eq(ospiti.id, finto.id));
      await db.delete(cestino).where(eq(cestino.entita_id, finto.id));
    }
  });
});
