// Prova duplicati, unione, inversione e "di prova" sul database VERO con ospiti FINTI (prenotazioni nel 2099),
// e poi toglie solo le righe create dal test. Si esegue solo con:
//   RUN_DB_TESTS=1 npx vitest run tests/ospiti-gestione.db.test.ts
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { eq, inArray } from 'drizzle-orm';

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

describe.skipIf(!attivo)('qualità ospiti (database reale, dati finti)', () => {
  it('trova i duplicati, unisce senza perdere nulla, inverte e nasconde i record di prova', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, ospiti, ospitiAlias, ospitiPrenotazione, prenotazioni, schedine, documenti, cestino } = await import('../src/lib/db/schema');
    const { cercaProblemiOspiti, unisciOspiti, invertiNomeCognome, segnaOspiteDiProva } = await import('../src/lib/db/ospitiGestione');
    const { leggiOspitiDb } = await import('../src/lib/db/queries');
    const db = getDb();
    const creati: string[] = [];
    const idsPren: string[] = [];
    try {
      const [al] = await db.select({ id: alloggi.id }).from(alloggi).where(eq(alloggi.nome, 'Il Tulipano'));
      const [P] = await db.insert(ospiti).values({ nome: 'Provaunico', cognome: 'Finto', telefono: '+393330000011' }).returning();
      const [S] = await db.insert(ospiti).values({ nome: 'Provaunico', cognome: 'Fintoo', telefono: '+39 333 0000011', email: 'finto@esempio.it', valutazione: 'Problematico' }).returning();
      const [X] = await db.insert(ospiti).values({ nome: 'Fintocognome', cognome: 'Maria' }).returning();
      creati.push(P.id, S.id, X.id);
      const pren = async (ospiteId: string, ci: string, co: string) => { const [p] = await db.insert(prenotazioni).values({ alloggio_id: al.id, ospite_id: ospiteId, checkin: ci, checkout: co, canale: 'Diretto', lordo: '1' }).returning(); idsPren.push(p.id); return p; };
      const p1 = await pren(P.id, '2099-04-10', '2099-04-12');
      const p2 = await pren(S.id, '2099-05-10', '2099-05-12');
      await db.insert(ospitiPrenotazione).values([{ prenotazione_id: p1.id, ospite_id: P.id }, { prenotazione_id: p1.id, ospite_id: S.id }]);
      await db.insert(schedine).values({ prenotazione_id: p2.id, ospite_id: S.id, cognome: 'Fintoo', nome: 'Provaunico' });
      await db.insert(documenti).values({ tipo: 'Altro', nome: 'finto.txt', ospite_id: S.id, prenotazione_id: p2.id });

      // 1) lo strumento li trova (stesso telefono scritto in due modi: NON basta confrontare il testo)
      const problemi = await cercaProblemiOspiti();
      const g = problemi.gruppi.find((x) => x.membri.some((m) => m.id === P.id));
      expect(g).toBeTruthy();
      expect(g!.membri.map((m) => m.id).sort()).toEqual([P.id, S.id].sort());
      expect(g!.motivi).toContain('stesso telefono');
      expect(problemi.invertiti.some((m) => m.id === X.id)).toBe(true);

      // 2) unione: tutto passa al principale, niente si perde
      const esito = await unisciOspiti(P.id, [S.id]);
      expect(esito.unitiAlPrincipale).toBe(1);
      expect((await db.select().from(ospiti).where(eq(ospiti.id, S.id))).length).toBe(0);
      const penP = await db.select().from(prenotazioni).where(eq(prenotazioni.ospite_id, P.id));
      expect(penP.map((x) => x.id).sort()).toEqual([p1.id, p2.id].sort());
      expect((await db.select().from(schedine).where(eq(schedine.ospite_id, P.id))).length).toBe(1);
      expect((await db.select().from(documenti).where(eq(documenti.ospite_id, P.id))).length).toBe(1);
      expect((await db.select().from(ospitiPrenotazione).where(eq(ospitiPrenotazione.ospite_id, P.id))).length).toBe(1); // la riga doppia di gruppo è sparita
      const [Pdopo] = await db.select().from(ospiti).where(eq(ospiti.id, P.id));
      expect(Pdopo.email).toBe('finto@esempio.it');          // campo mancante preso dall'ospite unito
      expect(Pdopo.valutazione).toBe('Problematico');        // la valutazione peggiore resta
      const alias = await db.select().from(ospitiAlias).where(eq(ospitiAlias.ospite_id, P.id));
      expect(alias.map((a) => a.chiave)).toContain('provaunico fintoo'); // il vecchio nome non verrà ricreato dalla sync
      expect((await db.select().from(cestino).where(eq(cestino.entita_id, S.id))).length).toBe(1);

      // 3) inverti: nome e cognome scambiati, il vecchio nome resta come alias
      const inv = await invertiNomeCognome(X.id);
      expect(inv).toMatchObject({ nome: 'Maria', cognome: 'Fintocognome' });
      expect((await db.select().from(ospitiAlias).where(eq(ospitiAlias.ospite_id, X.id))).map((a) => a.chiave)).toContain('fintocognome maria');

      // 4) di prova: sparisce dall'elenco, torna se si toglie il segno; non si cancella nulla
      await segnaOspiteDiProva(P.id, true);
      expect((await leggiOspitiDb()).some((o) => o.id === P.id)).toBe(false);
      expect((await db.select().from(ospiti).where(eq(ospiti.id, P.id))).length).toBe(1);
      await segnaOspiteDiProva(P.id, false);
      const elenco = await leggiOspitiDb();
      const vistoP = elenco.find((o) => o.id === P.id);
      expect(vistoP?.soggiorni.length).toBe(2); // storico dei soggiorni
    } finally {
      await db.delete(documenti).where(inArray(documenti.ospite_id, creati));
      await db.delete(schedine).where(inArray(schedine.ospite_id, creati));
      await db.delete(ospitiPrenotazione).where(inArray(ospitiPrenotazione.ospite_id, creati));
      if (idsPren.length) await db.delete(prenotazioni).where(inArray(prenotazioni.id, idsPren));
      await db.delete(cestino).where(inArray(cestino.entita_id, creati));
      await db.delete(ospiti).where(inArray(ospiti.id, creati)); // gli alias spariscono a cascata
    }
  }, 120_000);
});
