/**
 * Conservazione dei documenti degli ospiti (punto 5 delle richieste, 23/11/2026).
 *
 * Base: nota di chiarimento del Garante privacy sui documenti d'identità negli alloggi (doc. web
 * 10244289) e DM Interno 7/1/2013, art. 4-bis: la copia del documento serve solo per inserire i dati
 * su Alloggiati Web e ottenere la ricevuta; dopo la ricevuta va cancellata. La ricevuta si conserva
 * 5 anni (qui: resta su Drive come documento "Ricevuta Alloggiati", mai toccata da questo modulo).
 * È una nota di chiarimento, non un provvedimento vincolante: per questo nulla parte da solo.
 * Il Titolare vede l'elenco delle proposte e conferma una prenotazione alla volta.
 *
 * Una prenotazione è PROPONIBILE solo se:
 *  - ha almeno una schedina e TUTTE sono "Inviata" (se una è da inviare/in errore la copia può servire ancora);
 *  - per OGNI giorno in cui è stata inviata una sua schedina esiste la ricevuta salvata su Drive
 *    (documento "Ricevuta Alloggiati" col giorno nel nome, stesso criterio di inviiFattiAlloggiati);
 *  - c'è davvero qualcosa da togliere (una copia del documento o un numero di documento).
 * La conferma ricontrolla tutto sul server: il browser non decide mai cosa cancellare.
 *
 * Cosa si toglie: i file "Documento identità" di quella prenotazione (da Drive, per sempre, e la riga
 * in `documenti`) + numero e luogo di rilascio del documento sulle sue schedine. Restano: ricevuta,
 * nome/cognome e dati anagrafici della schedina, lo storico dei soggiorni.
 */
import { and, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { google } from 'googleapis';
import { getDb } from './db';
import { alloggi, documenti, ospiti, prenotazioni, schedine } from './db/schema';

const giornoRoma = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export type PropostaConservazione = {
  prenotazioneId: string; alloggio: string; checkin: string; checkout: string; ospite: string;
  copieDocumento: number; schedineConNumero: number; ultimoInvio: string;
};

export type EsitoConservazione = { copieEliminate: number; schedineAnonimizzate: number; avvisi: string[] };

function drive() {
  const client = new google.auth.OAuth2(process.env.GMAIL_OAUTH_CLIENT_ID, process.env.GMAIL_OAUTH_CLIENT_SECRET);
  client.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
  return google.drive({ version: 'v3', auth: client });
}

/** Controlla le condizioni su UNA prenotazione. Ritorna null se non è proponibile (con il motivo in `motivo`). */
async function valuta(prenotazioneId: string): Promise<{ ok: true; proposta: PropostaConservazione; fileIds: { docId: string; driveId: string | null }[] } | { ok: false; motivo: string }> {
  const db = getDb();
  const [p] = await db.select({
    id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout,
    alloggio: alloggi.nome, ospCognome: ospiti.cognome, ospNome: ospiti.nome,
  }).from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(eq(prenotazioni.id, prenotazioneId));
  if (!p) return { ok: false, motivo: 'Prenotazione non trovata' };

  const sch = await db.select({ stato: schedine.stato, inviataIl: schedine.inviata_il, numero: schedine.numero_documento })
    .from(schedine).where(eq(schedine.prenotazione_id, prenotazioneId));
  if (sch.length === 0) return { ok: false, motivo: 'Nessuna schedina' };
  if (sch.some((s) => s.stato !== 'Inviata' || !s.inviataIl)) return { ok: false, motivo: 'Ci sono schedine non ancora inviate: la copia del documento può servire ancora' };

  const ricevute = await db.select({ nome: documenti.nome, driveId: documenti.drive_file_id }).from(documenti)
    .where(and(eq(documenti.prenotazione_id, prenotazioneId), eq(documenti.tipo, 'Ricevuta Alloggiati'), isNotNull(documenti.drive_file_id)));
  const giorni = [...new Set(sch.map((s) => giornoRoma(new Date(s.inviataIl!))))];
  const mancanti = giorni.filter((g) => !ricevute.some((r) => r.nome.includes(g)));
  if (mancanti.length > 0) return { ok: false, motivo: `Manca la ricevuta di Alloggiati salvata per il giorno ${mancanti.join(', ')}` };

  const copie = await db.select({ docId: documenti.id, driveId: documenti.drive_file_id }).from(documenti)
    .where(and(eq(documenti.prenotazione_id, prenotazioneId), eq(documenti.tipo, 'Documento identità')));
  const conNumero = sch.filter((s) => (s.numero ?? '').trim() !== '').length;
  if (copie.length === 0 && conNumero === 0) return { ok: false, motivo: 'Niente da togliere' };

  const ultimo = new Date(Math.max(...sch.map((s) => new Date(s.inviataIl!).getTime())));
  return {
    ok: true, fileIds: copie,
    proposta: {
      prenotazioneId, alloggio: p.alloggio, checkin: p.checkin, checkout: p.checkout, ospite: `${p.ospCognome} ${p.ospNome}`.trim(),
      copieDocumento: copie.length, schedineConNumero: conNumero, ultimoInvio: ultimo.toISOString(),
    },
  };
}

/** Elenco delle prenotazioni per cui si può proporre la cancellazione delle copie dei documenti. */
export async function proposteConservazione(): Promise<PropostaConservazione[]> {
  const db = getDb();
  // Candidate: prenotazioni con almeno una schedina inviata. La valutazione completa è in valuta().
  const cand = await db.selectDistinct({ id: schedine.prenotazione_id }).from(schedine).where(eq(schedine.stato, 'Inviata'));
  const out: PropostaConservazione[] = [];
  for (const c of cand) {
    const v = await valuta(c.id);
    if (v.ok) out.push(v.proposta);
  }
  return out.sort((a, b) => a.checkin.localeCompare(b.checkin));
}

/** Esegue la cancellazione per UNA prenotazione, dopo aver ricontrollato le condizioni. */
export async function applicaConservazione(prenotazioneId: string): Promise<EsitoConservazione> {
  const v = await valuta(prenotazioneId);
  if (!v.ok) throw new Error(`Non si può procedere: ${v.motivo}.`);
  const db = getDb();
  const avvisi: string[] = [];
  let copieEliminate = 0;
  let fallite = 0;

  for (const f of v.fileIds) {
    if (f.driveId) {
      try {
        await drive().files.delete({ fileId: f.driveId, supportsAllDrives: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Già sparito da Drive: va bene, si toglie solo la riga. Altro errore: si lascia tutto com'è per questo file.
        if (!/not found|404/i.test(msg)) { fallite++; avvisi.push(`Un file non è stato cancellato da Drive (${msg.slice(0, 120)})`); continue; }
      }
    }
    await db.delete(documenti).where(eq(documenti.id, f.docId));
    copieEliminate++;
  }
  if (fallite > 0) {
    // Non si anonimizzano le schedine finché una copia resta: l'operazione si può rilanciare.
    return { copieEliminate, schedineAnonimizzate: 0, avvisi };
  }

  const aggiornate = await db.update(schedine)
    .set({ numero_documento: null, luogo_rilascio_documento: null, aggiornato_il: new Date() })
    .where(and(eq(schedine.prenotazione_id, prenotazioneId), eq(schedine.stato, 'Inviata'), ne(sql`coalesce(${schedine.numero_documento}, '')`, '')))
    .returning({ id: schedine.id });
  return { copieEliminate, schedineAnonimizzate: aggiornate.length, avvisi };
}

// Usato solo dai test: stessi controlli, senza toccare nulla.
export const valutaPerTest = valuta;
