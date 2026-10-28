// Registra nel DATABASE una prenotazione Airbnb letta da un'email di conferma (26/10/2026).
//
// Prima il sync email chiamava POST /api/prenotazione, che scrive solo su foglio e Calendar: la
// prenotazione compariva in /nuovo il mattino dopo (import notturno) e, se la lettura falliva,
// nessuno se ne accorgeva (caso Giuseppe del 24/10). Ora passa da creaPrenotazione, la stessa
// funzione del gestionale: scrittura atomica nel database con controllo sovrapposizioni e pulizia
// di check-out, poi Calendar e foglio come mirror.

import { and, eq, sql } from 'drizzle-orm';
import { getDb } from './index';
import { alloggi, ospiti, prenotazioni } from './schema';
import { ALLOGGI_SEED } from './importDaSheets';
import { creaPrenotazione } from './mutations';

/** "Giuseppe Zampella" → nome + cognome. Un nome solo ottiene un cognome segnaposto da completare a mano. */
export function dividiNomeOspite(completo: string): { nome: string; cognome: string } {
  const parti = completo.trim().split(/\s+/);
  if (parti.length === 1) return { nome: parti[0], cognome: '(da completare)' };
  return { nome: parti[0], cognome: parti.slice(1).join(' ') };
}

export type DatiPrenotazioneEmail = {
  ospite: string; stanza: string; checkinISO: string; checkoutISO: string; lordo: number; codice?: string;
};

/** 'gia-presente' se il codice di conferma Airbnb è già in database (nessuna doppia registrazione). */
export async function registraPrenotazioneAirbnb(p: DatiPrenotazioneEmail): Promise<{ esito: 'creata' | 'gia-presente' }> {
  const db = getDb();
  if (p.codice) {
    const [gia] = await db.select({ id: prenotazioni.id }).from(prenotazioni)
      .where(eq(prenotazioni.codice_conferma_canale, p.codice)).limit(1);
    if (gia) return { esito: 'gia-presente' };
  }
  const seed = ALLOGGI_SEED.find((a) => a.foglio === p.stanza);
  if (!seed) throw new Error(`Stanza sconosciuta: ${p.stanza}`);
  const [al] = await db.select({ id: alloggi.id }).from(alloggi).where(eq(alloggi.nome, seed.nome));
  if (!al) throw new Error(`Alloggio "${seed.nome}" non trovato nel database`);

  const { nome, cognome } = dividiNomeOspite(p.ospite);
  const sceltoNome = sql`lower(${ospiti.nome}) = ${nome.toLowerCase()}`;
  const sceltoCognome = sql`lower(${ospiti.cognome}) = ${cognome.toLowerCase()}`;

  // Stessa prenotazione già inserita a mano (stesso alloggio, stesse date, stesso ospite, senza codice):
  // non è una doppia prenotazione. Le si aggancia il codice di conferma e si chiude lì.
  const [stessa] = await db.select({ id: prenotazioni.id, codice: prenotazioni.codice_conferma_canale }).from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(and(eq(prenotazioni.alloggio_id, al.id), eq(prenotazioni.checkin, p.checkinISO), eq(prenotazioni.checkout, p.checkoutISO),
      eq(prenotazioni.stato, 'Attiva'), sceltoNome, sceltoCognome)).limit(1);
  if (stessa) {
    if (!stessa.codice && p.codice) await db.update(prenotazioni).set({ codice_conferma_canale: p.codice }).where(eq(prenotazioni.id, stessa.id));
    return { esito: 'gia-presente' };
  }

  // Un ospite che è già tornato riusa la sua anagrafica (documenti e storico restano agganciati).
  const [esistente] = await db.select({ id: ospiti.id }).from(ospiti)
    .where(and(sceltoNome, sceltoCognome)).limit(1);

  await creaPrenotazione({
    alloggioId: al.id, ospiteId: esistente?.id, ospiteNome: nome, ospiteCognome: cognome,
    checkin: p.checkinISO, checkout: p.checkoutISO, canale: 'Airbnb', lordo: p.lordo,
    codiceConfermaCanale: p.codice, note: "Registrata in automatico dall'email di conferma Airbnb",
  });
  return { esito: 'creata' };
}
