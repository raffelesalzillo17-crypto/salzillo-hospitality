// Prova le regole delle pulizie sul database VERO con un alloggio FINTO: mai "fatta" prima del check-out, conferma una volta sola, annullo
// (con limite di tempo per l'addetto pulizie), addetto/orario/note/checklist, urgenza se arriva un ospite lo stesso giorno. Toglie solo le
// righe sue. Si esegue solo con:  RUN_DB_TESTS=1 npx vitest run tests/pulizie.db.test.ts
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

describe.skipIf(!attivo)('pulizie (database reale, alloggio finto)', () => {
  it('regole di conferma, annullo, checklist e urgenza', async () => {
    const { getDb } = await import('../src/lib/db');
    const { alloggi, immobili, ospiti, prenotazioni, pulizie, utenti } = await import('../src/lib/db/schema');
    const M = await import('../src/lib/db/mutations');
    const { leggiPulizieDb } = await import('../src/lib/db/queries');
    const { cosaMancaBlocchi } = await import('../src/lib/db/dashboard');
    const db = getDb();
    let alId = ''; let ospId = ''; const idsPren: string[] = []; const idsPul: string[] = [];
    try {
      const [imm] = await db.select({ id: immobili.id }).from(immobili).limit(1);
      const [al] = await db.insert(alloggi).values({ immobile_id: imm.id, nome: 'FintoAlloggioPulizie' }).returning(); alId = al.id;
      const [o] = await db.insert(ospiti).values({ nome: 'Prova', cognome: 'FintoPulizie' }).returning(); ospId = o.id;
      const [utente] = await db.select({ id: utenti.id }).from(utenti).limit(1);
      const nuova = async (data: string) => { const [p] = await db.insert(pulizie).values({ alloggio_id: alId, data }).returning(); idsPul.push(p.id); return p; };

      // 1) mai prima del giorno del check-out
      const futura = await nuova('2099-05-01');
      await expect(M.confermaPulizia(futura.id)).rejects.toThrow('prima del giorno del check-out');
      expect((await db.select().from(pulizie).where(eq(pulizie.id, futura.id)))[0].confermata_il).toBeNull();

      // 2) dal giorno in poi sì, una volta sola; l'addetto assegnato resta se non se ne indica un altro
      const passata = await nuova('2020-01-01');
      await M.aggiornaPulizia(passata.id, { addettoId: utente.id, oraPrevista: '10:30', note: 'chiavi dal vicino', checklistFatta: ['Biancheria cambiata'] });
      const [agg] = await db.select().from(pulizie).where(eq(pulizie.id, passata.id));
      expect(agg.ora_prevista).toBe('10:30');
      expect(agg.note).toBe('chiavi dal vicino');
      expect(JSON.parse(agg.checklist_fatta!)).toEqual(['Biancheria cambiata']);
      await expect(M.aggiornaPulizia(passata.id, { oraPrevista: '25:99' })).rejects.toThrow('Orario non valido');
      const fatta = await M.confermaPulizia(passata.id, undefined, { checklistFatta: ['Biancheria cambiata', 'Articoli di cortesia'] });
      expect(fatta.confermata_il).not.toBeNull();
      expect(fatta.addetto_id).toBe(utente.id);
      await expect(M.confermaPulizia(passata.id)).rejects.toThrow('già segnata come fatta');

      // 3) annullo: sempre per chi gestisce; per l'addetto pulizie solo entro il limite
      await db.update(pulizie).set({ confermata_il: new Date(Date.now() - 10 * 60 * 1000) }).where(eq(pulizie.id, passata.id));
      await expect(M.annullaPulizia(passata.id, 180)).rejects.toThrow('tempo per annullare è scaduto');
      const annullata = await M.annullaPulizia(passata.id);
      expect(annullata.confermata_il).toBeNull();
      expect(annullata.checklist_fatta).toBeNull();
      await expect(M.annullaPulizia(passata.id)).rejects.toThrow('non è segnata come fatta');
      await M.confermaPulizia(passata.id);
      expect((await M.annullaPulizia(passata.id, 180)).confermata_il).toBeNull(); // dentro i 3 minuti
      await expect(M.confermaPulizia('00000000-0000-0000-0000-000000000000')).rejects.toThrow('non trovata');

      // 4) checklist dell'alloggio (predefinita o personalizzata) e urgenza con un arrivo lo stesso giorno
      let lista = (await leggiPulizieDb()).filter((x) => idsPul.includes(x.id));
      expect(lista.find((x) => x.id === futura.id)!.checklist).toEqual(['Biancheria cambiata', 'Articoli di cortesia', 'Rifornimenti (carta, sapone, caffè)']);
      await db.update(alloggi).set({ checklist_pulizie: 'Letti rifatti\nBagno igienizzato' }).where(eq(alloggi.id, alId));
      lista = (await leggiPulizieDb()).filter((x) => idsPul.includes(x.id));
      expect(lista.find((x) => x.id === futura.id)!.checklist).toEqual(['Letti rifatti', 'Bagno igienizzato']);
      expect(lista.find((x) => x.id === futura.id)!.prossimoCheckin).toBeNull();
      const [p] = await db.insert(prenotazioni).values({ alloggio_id: alId, ospite_id: ospId, checkin: '2099-05-01', checkout: '2099-05-03', canale: 'Diretto', lordo: '1' }).returning(); idsPren.push(p.id);
      lista = (await leggiPulizieDb()).filter((x) => idsPul.includes(x.id));
      expect(lista.find((x) => x.id === futura.id)!.prossimoCheckin).toBe('2099-05-01');   // stesso giorno della pulizia → urgente
      const blocchi = await cosaMancaBlocchi('2099-05-01', 'tutti', false);
      expect(blocchi.pulizie.find((x) => x.id === futura.id)?.urgente).toBe(true);
      expect(blocchi.pulizie.find((x) => x.id === futura.id)?.alloggio).toBe('FintoAlloggioPulizie');
    } finally {
      if (idsPul.length) await db.delete(pulizie).where(inArray(pulizie.id, idsPul));
      if (idsPren.length) await db.delete(prenotazioni).where(inArray(prenotazioni.id, idsPren));
      if (ospId) await db.delete(ospiti).where(eq(ospiti.id, ospId));
      if (alId) await db.delete(alloggi).where(eq(alloggi.id, alId));
    }
  }, 240_000);
});
