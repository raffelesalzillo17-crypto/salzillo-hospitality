/**
 * Strato database del motore di regole (promemoria e messaggi). La logica di calcolo sta in
 * src/lib/regole.ts (pura e testata); qui si leggono regole/prenotazioni, si applicano le
 * operazioni e si preparano i dati per il digest e per il gestionale.
 */

import { and, asc, desc, eq, gte, inArray, lte, notInArray } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, attivitaPianificate, ospiti, prenotazioni, regoleAutomazione } from './schema';
import { STATI_NON_BLOCCANTI } from './disponibilita';
import { strutturaPerAlloggio } from '../strutture';
import { toWaNumber } from '../pulizie';
import {
  AZIONI, EVENTI, STATI_APERTI, aggiungiGiorni, dataRoma, fineGiornoRoma, pianifica,
  type AttivitaEsistente, type AzioneRegola, type EventoRegola, type Regola, type Soggiorno, type StatoAttivita,
} from '../regole';

type RigaRegola = typeof regoleAutomazione.$inferSelect;
const comeRegola = (r: RigaRegola): Regola => ({
  id: r.id, nome: r.nome, attiva: r.attiva,
  evento: (EVENTI as readonly string[]).includes(r.evento) ? (r.evento as EventoRegola) : 'Check-in',
  offsetGiorni: r.offset_giorni, ora: r.ora,
  azione: (AZIONI as readonly string[]).includes(r.azione) ? (r.azione as AzioneRegola) : 'Promemoria per me',
  modello: r.modello, alloggioId: r.alloggio_id, canale: r.canale, minNotti: r.min_notti,
});

export async function leggiRegole(): Promise<Regola[]> {
  const righe = await getDb().select().from(regoleAutomazione).orderBy(asc(regoleAutomazione.creato_il), asc(regoleAutomazione.nome));
  return righe.map(comeRegola);
}

const ORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Modifica una regola (attiva/disattiva, testo, orario, giorni). Valida prima di scrivere. */
export async function aggiornaRegola(id: string, d: Record<string, unknown>) {
  const set: Record<string, unknown> = { aggiornato_il: new Date() };
  if (d.attiva !== undefined) set.attiva = !!d.attiva;
  if (d.nome !== undefined) { const n = String(d.nome).trim(); if (!n) throw new Error('Il nome non può essere vuoto'); set.nome = n; }
  if (d.modello !== undefined) { const m = String(d.modello).trim(); if (!m) throw new Error('Il testo non può essere vuoto'); set.modello = m; }
  if (d.ora !== undefined) { if (!ORA.test(String(d.ora))) throw new Error('Ora non valida (usa HH:MM, per esempio 10:00)'); set.ora = String(d.ora); }
  if (d.offsetGiorni !== undefined) {
    const n = Number(d.offsetGiorni);
    if (!Number.isInteger(n) || n < -30 || n > 30) throw new Error('I giorni devono essere un numero intero tra -30 e 30');
    set.offset_giorni = n;
  }
  if (d.evento !== undefined) { if (!(EVENTI as readonly string[]).includes(String(d.evento))) throw new Error('Evento non valido'); set.evento = String(d.evento); }
  if (d.azione !== undefined) { if (!(AZIONI as readonly string[]).includes(String(d.azione))) throw new Error('Azione non valida'); set.azione = String(d.azione); }
  if (d.alloggioId !== undefined) set.alloggio_id = d.alloggioId ? String(d.alloggioId) : null;
  if (d.canale !== undefined) set.canale = d.canale ? String(d.canale) : null;
  if (d.minNotti !== undefined) set.min_notti = d.minNotti ? Number(d.minNotti) : null;
  const [r] = await getDb().update(regoleAutomazione).set(set).where(eq(regoleAutomazione.id, id)).returning();
  if (!r) throw new Error('Regola non trovata');
  // le attività aperte seguono subito la regola cambiata
  await riconcilia();
  return comeRegola(r);
}

export async function creaRegola(d: {
  nome: string; evento: string; offsetGiorni?: number; ora?: string; azione: string; modello: string;
  alloggioId?: string; canale?: string; minNotti?: number;
}) {
  if (!d.nome?.trim() || !d.modello?.trim()) throw new Error('Servono almeno nome e testo');
  if (!(EVENTI as readonly string[]).includes(d.evento)) throw new Error('Evento non valido');
  if (!(AZIONI as readonly string[]).includes(d.azione)) throw new Error('Azione non valida');
  if (d.ora && !ORA.test(d.ora)) throw new Error('Ora non valida (usa HH:MM)');
  const [r] = await getDb().insert(regoleAutomazione).values({
    nome: d.nome.trim(), evento: d.evento, offset_giorni: d.offsetGiorni ?? 0, ora: d.ora ?? '10:00',
    azione: d.azione, modello: d.modello.trim(), alloggio_id: d.alloggioId || null, canale: d.canale || null,
    min_notti: d.minNotti || null, attiva: true,
  }).returning();
  await riconcilia();
  return comeRegola(r);
}

export async function eliminaRegola(id: string) {
  await getDb().delete(regoleAutomazione).where(eq(regoleAutomazione.id, id)); // le attività seguono (cascade)
  return { ok: true };
}

// ── Riconciliazione: regole + prenotazioni → attività ────────────────────────

/** Prenotazioni che occupano l'alloggio e non sono concluse da troppo tempo, come "soggiorni". */
async function leggiSoggiorni(daISO: string): Promise<Soggiorno[]> {
  const righe = await getDb().select({
    id: prenotazioni.id, alloggioId: prenotazioni.alloggio_id, alloggioNome: alloggi.nome,
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale,
    creatoIl: prenotazioni.creato_il, nome: ospiti.nome, cognome: ospiti.cognome, telefono: ospiti.telefono,
  }).from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(and(notInArray(prenotazioni.stato, [...STATI_NON_BLOCCANTI]), gte(prenotazioni.checkout, daISO)));
  return righe.map((r) => ({
    prenotazioneId: r.id, alloggioId: r.alloggioId, alloggioNome: r.alloggioNome,
    checkin: r.checkin, checkout: r.checkout, canale: r.canale,
    ospiteNome: r.nome, ospiteCognome: r.cognome, telefono: r.telefono, creatoIl: r.creatoIl,
  }));
}

function extraPerSoggiorno(s: Soggiorno) {
  const st = strutturaPerAlloggio(s.alloggioNome);
  return { messaggioGuida: st?.guideMessageText, emoji: st?.emoji, linkInfo: st?.infoGuideUrl, linkCheckin: st?.checkinGuideUrl };
}

/**
 * Porta le attività pianificate in linea con regole e prenotazioni attuali. Idempotente: si può
 * chiamare quando si vuole (dopo ogni modifica a prenotazioni/regole e ogni mattina).
 */
export async function riconcilia(adesso: Date = new Date()): Promise<{ scritte: number; annullate: number }> {
  const db = getDb();
  const oggi = dataRoma(adesso);
  const regole = (await leggiRegole());
  const soggiorni = await leggiSoggiorni(aggiungiGiorni(oggi, -3));
  const righeEsistenti = await db.select().from(attivitaPianificate).where(gte(attivitaPianificate.checkin, aggiungiGiorni(oggi, -60)));
  const esistenti: AttivitaEsistente[] = righeEsistenti.map((r) => ({
    id: r.id, regolaId: r.regola_id, alloggioId: r.alloggio_id, checkin: r.checkin,
    scadenza: r.scadenza, stato: r.stato as StatoAttivita, testo: r.testo,
  }));

  const ops = pianifica({ regole, soggiorni, esistenti, adesso, extra: extraPerSoggiorno });
  let scritte = 0, annullate = 0;
  for (const o of ops) {
    if (o.tipo === 'annulla') {
      await db.update(attivitaPianificate).set({ stato: 'Annullata', aggiornato_il: new Date() }).where(eq(attivitaPianificate.id, o.id));
      annullate++;
      continue;
    }
    const campi = {
      checkout: o.checkout, prenotazione_id: o.prenotazioneId, ospite_nome: o.ospiteNome, telefono: o.telefono,
      azione: o.azione, scadenza: o.scadenza, testo: o.testo, aggiornato_il: new Date(),
      ...(o.stato ? { stato: o.stato } : {}),
    };
    if (o.id) {
      await db.update(attivitaPianificate).set(campi).where(eq(attivitaPianificate.id, o.id));
    } else {
      await db.insert(attivitaPianificate).values({
        regola_id: o.regolaId, alloggio_id: o.alloggioId, checkin: o.checkin, stato: o.stato ?? 'Da fare', ...campi,
      }).onConflictDoUpdate({
        target: [attivitaPianificate.regola_id, attivitaPianificate.alloggio_id, attivitaPianificate.checkin],
        set: campi, // due riconciliazioni simultanee: la seconda aggiorna invece di fallire
      });
    }
    scritte++;
  }
  return { scritte, annullate };
}

// ── Letture per digest e gestionale ──────────────────────────────────────────

export type AttivitaVista = {
  id: string; regolaId: string; regola: string; azione: string; alloggio: string; checkin: string; checkout: string;
  ospite: string; scadenza: string; stato: string; testo: string; linkWhatsapp: string | null; fattaIl: string | null;
};

/** Link WhatsApp col testo già scritto (parentesi e simboli codificati: sicuro anche nei link Markdown di Telegram). */
export function linkWhatsapp(telefono: string | null, testo: string): string | null {
  const n = telefono ? toWaNumber(telefono) : null;
  if (!n) return null;
  const enc = encodeURIComponent(testo).replace(/[!'()*_]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  return `https://wa.me/${n}?text=${enc}`;
}

async function viste(where: ReturnType<typeof and>, ordine: 'asc' | 'desc', limite?: number): Promise<AttivitaVista[]> {
  const q = getDb().select({
    a: attivitaPianificate, regola: regoleAutomazione.nome, alloggio: alloggi.nome,
  }).from(attivitaPianificate)
    .innerJoin(regoleAutomazione, eq(regoleAutomazione.id, attivitaPianificate.regola_id))
    .innerJoin(alloggi, eq(alloggi.id, attivitaPianificate.alloggio_id))
    .where(where)
    .orderBy(ordine === 'asc' ? asc(attivitaPianificate.scadenza) : desc(attivitaPianificate.scadenza));
  const righe = limite ? await q.limit(limite) : await q;
  return righe.map(({ a, regola, alloggio }) => ({
    id: a.id, regolaId: a.regola_id, regola, azione: a.azione, alloggio, checkin: a.checkin, checkout: a.checkout,
    ospite: a.ospite_nome, scadenza: a.scadenza.toISOString(), stato: a.stato, testo: a.testo,
    linkWhatsapp: a.azione === 'Messaggio ospite' ? linkWhatsapp(a.telefono, a.testo) : null,
    fattaIl: a.fatta_il ? a.fatta_il.toISOString() : null,
  }));
}

/** Attività ancora aperte (da fare o già segnalate), le più vicine per prime. */
export const attivitaAperte = () =>
  viste(and(inArray(attivitaPianificate.stato, [...STATI_APERTI])), 'asc');

/** Ultime attività chiuse (fatte o saltate), per sapere cosa è già stato gestito. */
export const attivitaChiuse = (limite = 15) =>
  viste(and(inArray(attivitaPianificate.stato, ['Fatta', 'Saltata'])), 'desc', limite);

/** Da segnalare nel digest: scadenza entro la fine di oggi e non ancora segnalate. */
export async function attivitaDaSegnalare(adesso: Date = new Date()): Promise<AttivitaVista[]> {
  const fineOggi = fineGiornoRoma(dataRoma(adesso));
  return viste(and(eq(attivitaPianificate.stato, 'Da fare'), lte(attivitaPianificate.scadenza, fineOggi)), 'asc');
}

export async function segnaNotificate(ids: string[]) {
  if (!ids.length) return;
  await getDb().update(attivitaPianificate).set({ stato: 'Notificata', aggiornato_il: new Date() })
    .where(and(inArray(attivitaPianificate.id, ids), eq(attivitaPianificate.stato, 'Da fare')));
}

export async function segnaAttivita(id: string, stato: 'Fatta' | 'Saltata' | 'Da fare') {
  const [r] = await getDb().update(attivitaPianificate).set({
    stato, fatta_il: stato === 'Fatta' ? new Date() : null, aggiornato_il: new Date(),
  }).where(eq(attivitaPianificate.id, id)).returning({ id: attivitaPianificate.id });
  if (!r) throw new Error('Attività non trovata');
  return { ok: true };
}

// ── Testo per il digest ──────────────────────────────────────────────────────

const ggmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/** Testo del blocco "Promemoria da fare" del digest (puro: si prova con i test). */
export function formattaBloccoPromemoria(items: AttivitaVista[], max = 8): string | null {
  if (!items.length) return null;
  const righe = items.slice(0, max).map((a) => {
    if (a.azione === 'Messaggio ospite') {
      const cta = a.linkWhatsapp ? `[💬 Apri WhatsApp](${a.linkWhatsapp})` : '⚠️ manca il numero di telefono';
      return `• 📨 *${a.ospite}* — ${a.alloggio}, arrivo ${ggmm(a.checkin)} · ${a.regola}\n  ${cta}`;
    }
    return `• 🔔 ${a.testo}`;
  });
  if (items.length > max) righe.push(`…e altri ${items.length - max} nel gestionale.`);
  return `📋 *Promemoria da fare* (${items.length})\n${righe.join('\n')}`;
}

/**
 * Blocco del digest mattutino: riconcilia, poi elenca quello che scade oggi e non è ancora stato
 * segnalato (così non si ripete ogni mattina; resta visibile nel gestionale finché non lo si segna
 * come fatto). Con `dryRun` non segna nulla come segnalato.
 */
export async function testoPromemoriaAutomatici(dryRun = false): Promise<string | null> {
  await riconcilia();
  const items = await attivitaDaSegnalare();
  const testo = formattaBloccoPromemoria(items);
  if (testo && !dryRun) await segnaNotificate(items.map((a) => a.id));
  return testo;
}
