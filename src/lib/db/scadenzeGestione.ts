/**
 * Scadenze (punto 13 delle richieste, 23/11/2026): stati (aperta, fatta, non più applicabile), storico dei completamenti con ricevuta,
 * ricorrenza automatica dalla data prevista, ricerca e unione dei duplicati con anteprima.
 */
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from './index';
import { documenti, scadenze, scadenzeStorico } from './schema';
import { mettiNelCestino } from './registro';
import { aggiornaScadenzaSuFoglio } from './syncFoglio';
import { salvaFileScadenza } from '../documenti';
import { chiaveTitoloScadenza, prossimaScadenza, trovaDuplicatiScadenze } from '../scadenzeRegole';

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const oggiISO = () => new Date().toISOString().slice(0, 10);

/** Segna una scadenza come fatta. Una tantum → archiviata come "Fatta"; ricorrente → resta aperta con la data successiva
 *  (calcolata dalla data PREVISTA). Ogni volta resta una riga nello storico, a cui si può allegare la ricevuta. */
export async function completaScadenzaConStorico(id: string, fattaIl?: string) {
  const db = getDb();
  const [sc] = await db.select().from(scadenze).where(eq(scadenze.id, id));
  if (!sc) throw new Error('Scadenza non trovata');
  if (sc.stato !== 'Aperta') throw new Error(`Questa scadenza è già "${sc.stato.toLowerCase()}": riaprila prima.`);
  const data = fattaIl && DATA.test(fattaIl) ? fattaIl : oggiISO();
  if (data > oggiISO()) throw new Error('La data in cui l\'hai fatta non può essere nel futuro.');
  const prossima = prossimaScadenza(sc.data_scadenza, sc.ricorrenza);
  const [storico] = await db.insert(scadenzeStorico).values({ scadenza_id: id, scadenza_prevista: sc.data_scadenza, fatta_il: data }).returning();
  const [r] = await db.update(scadenze).set(prossima
    ? { ultimo_completamento: data, data_scadenza: prossima, aggiornato_il: new Date() }
    : { ultimo_completamento: data, stato: 'Fatta', chiusa_il: data, aggiornato_il: new Date() }).where(eq(scadenze.id, id)).returning();
  if (r.origine === 'Database') {
    await aggiornaScadenzaSuFoglio({ titolo: r.titolo, dataScadenza: r.data_scadenza, ricorrenza: r.ricorrenza, ente: r.ente, note: r.note, ultimoCompletamento: r.ultimo_completamento })
      .catch((e) => console.error('[scadenze] foglio non aggiornato (non bloccante):', e instanceof Error ? e.message : e));
  }
  return { scadenza: r, storicoId: storico.id, prossima };
}

export async function chiudiNonApplicabile(id: string, motivo: string) {
  const m = (motivo ?? '').trim();
  if (m.length < 3) throw new Error('Scrivi il motivo (almeno qualche parola): serve per ricordare perché non vale più.');
  const [r] = await getDb().update(scadenze).set({ stato: 'Non più applicabile', chiusa_il: oggiISO(), motivo_chiusura: m.slice(0, 300), aggiornato_il: new Date() })
    .where(and(eq(scadenze.id, id), eq(scadenze.stato, 'Aperta'))).returning({ id: scadenze.id });
  if (!r) throw new Error('Scadenza non trovata o già archiviata');
  return { ok: true };
}

export async function riapriScadenza(id: string) {
  const [r] = await getDb().update(scadenze).set({ stato: 'Aperta', chiusa_il: null, motivo_chiusura: null, aggiornato_il: new Date() })
    .where(eq(scadenze.id, id)).returning({ id: scadenze.id });
  if (!r) throw new Error('Scadenza non trovata');
  return { ok: true };
}

/** Allega la ricevuta all'ultimo completamento della scadenza (o la sostituisce). Il file va su Drive in "Ricevute scadenze <anno>". */
export async function salvaRicevutaScadenza(scadenzaId: string, file: { nome: string; mime: string; contenuto: Buffer }) {
  const db = getDb();
  const [ultimo] = await db.select().from(scadenzeStorico).where(eq(scadenzeStorico.scadenza_id, scadenzaId)).orderBy(desc(scadenzeStorico.fatta_il), desc(scadenzeStorico.creato_il)).limit(1);
  if (!ultimo) throw new Error('Questa scadenza non è ancora stata segnata come fatta: segnala prima che l\'hai fatta, poi allega la ricevuta.');
  const pulito = file.nome.replace(/[^\w.\- ]+/g, '_').slice(0, 80) || 'ricevuta';
  const nomeFile = `${ultimo.fatta_il} ${pulito}`;
  const salvato = await salvaFileScadenza(Number(ultimo.fatta_il.slice(0, 4)), nomeFile, file.contenuto, file.mime);
  const [doc] = await db.insert(documenti).values({ tipo: 'Altro', nome: `Ricevuta scadenza — ${nomeFile}`, drive_file_id: salvato.id, drive_url: salvato.link, mime: file.mime }).returning({ id: documenti.id });
  await db.update(scadenzeStorico).set({ ricevuta_documento_id: doc.id }).where(eq(scadenzeStorico.id, ultimo.id));
  return { documentoId: doc.id, link: salvato.link };
}

// ── Duplicati ─────────────────────────────────────────────────────────────────────────────

export type VoceDuplicato = { id: string; titolo: string; ente: string | null; dataScadenza: string; ricorrenza: string; origine: string; ultimoCompletamento: string | null; note: string | null };
export type GruppoDuplicati = { principaleSuggerito: string; voci: VoceDuplicato[] };

/** Sola lettura: gruppi di scadenze che sono la stessa cosa. Si propone come principale quella creata dal gestionale (con ente), le altre da togliere. */
export async function cercaDuplicatiScadenze(): Promise<GruppoDuplicati[]> {
  const tutte = await getDb().select().from(scadenze);
  const gruppi = trovaDuplicatiScadenze(tutte.map((s) => ({ id: s.id, titolo: s.titolo, ente: s.ente, ricorrenza: s.ricorrenza, origine: s.origine, stato: s.stato })));
  return gruppi.map((g) => {
    const voci = g.ids.map((id) => tutte.find((s) => s.id === id)!).map((s): VoceDuplicato => ({
      id: s.id, titolo: s.titolo, ente: s.ente, dataScadenza: s.data_scadenza, ricorrenza: s.ricorrenza, origine: s.origine, ultimoCompletamento: s.ultimo_completamento, note: s.note,
    }));
    const punteggio = (v: VoceDuplicato) => (v.origine === 'Database' ? 2 : 0) + (v.ente ? 1 : 0);
    voci.sort((a, b) => punteggio(b) - punteggio(a));
    return { principaleSuggerito: voci[0].id, voci };
  });
}

/** Unisce i doppioni nella scadenza principale: ente e ultimo completamento si completano, le altre vanno nel cestino (30 giorni). */
export async function unisciScadenze(principaleId: string, daRimuovere: string[]) {
  const db = getDb();
  const ids = [...new Set(daRimuovere)].filter((x) => x !== principaleId);
  if (ids.length === 0) throw new Error('Scegli almeno una scadenza da togliere.');
  const [p] = await db.select().from(scadenze).where(eq(scadenze.id, principaleId));
  if (!p) throw new Error('Scadenza principale non trovata');
  const altre = await db.select().from(scadenze).where(inArray(scadenze.id, ids));
  if (altre.length !== ids.length) throw new Error('Una delle scadenze non esiste più: ricarica la pagina.');
  for (const a of altre) if (chiaveTitoloScadenza(a.titolo) !== chiaveTitoloScadenza(p.titolo)) throw new Error('Si possono unire solo scadenze con lo stesso titolo.');
  const completa: Record<string, unknown> = { aggiornato_il: new Date() };
  for (const a of altre) {
    if (!p.ente && a.ente) { completa.ente = a.ente; p.ente = a.ente; }
    if (a.ultimo_completamento && (!p.ultimo_completamento || a.ultimo_completamento > p.ultimo_completamento)) { completa.ultimo_completamento = a.ultimo_completamento; p.ultimo_completamento = a.ultimo_completamento; }
    await mettiNelCestino('scadenza', a, `Scadenza "${a.titolo}" (doppione unito)`.slice(0, 120));
    await db.delete(scadenze).where(eq(scadenze.id, a.id));
  }
  if (Object.keys(completa).length > 1) await db.update(scadenze).set(completa).where(eq(scadenze.id, principaleId));
  return { rimosse: altre.length };
}
