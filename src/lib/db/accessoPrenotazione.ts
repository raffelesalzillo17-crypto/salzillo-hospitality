import { eq } from 'drizzle-orm';
import { getDb } from './index';
import { alloggiVisibili, type Sessione } from './auth';
import { alloggi, ospiti, prenotazioni } from './schema';

/** La prenotazione con l'ospite principale, solo se la sessione può vederla (null altrimenti).
 *  Condivisa dalle route dei documenti e delle schedine caricate a mano (12/10/2026). */
export async function prenotazioneVisibile(id: string, sess: Sessione) {
  const [p] = await getDb().select({
    id: prenotazioni.id, ospiteId: prenotazioni.ospite_id, alloggioId: prenotazioni.alloggio_id,
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, stato: prenotazioni.stato,
    nome: ospiti.nome, cognome: ospiti.cognome,
  }).from(prenotazioni)
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .where(eq(prenotazioni.id, id));
  if (!p) return null;
  const vis = await alloggiVisibili(sess);
  if (vis !== 'tutti' && !vis.has(p.alloggioId)) return null;
  return p;
}

export const puoScrivereDocumenti = (s: Sessione) => s.ruolo === 'Titolare' || s.ruolo === 'Collaboratore';
