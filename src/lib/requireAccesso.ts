import { NextRequest, NextResponse } from 'next/server';
import { verificaToken, getPermessi, type Permessi } from './accessi';

// Helper condiviso per proteggere le route del sito prenotazioni condiviso — legge il cookie
// di sessione, verifica la firma del token e ricontrolla i permessi correnti sul foglio (mai
// fidandosi solo di quanto c'era nel token, così una disattivazione ha effetto immediato).
// Vedi src/lib/accessi.ts per il contesto completo di questo sistema (09/09/2026).

export const COOKIE_NAME = 'accessi_token';

export type PermessoRichiesto = 'puoCreare' | 'puoCancellare' | 'puoVedereFinanziario' | null;

/**
 * Verifica la sessione per una richiesta protetta. Se `richiesto` è null, basta essere
 * autenticati (qualunque permesso); altrimenti serve quel permesso specifico attivo.
 * Ritorna i permessi se tutto ok, altrimenti una NextResponse già pronta da restituire
 * (401 non autenticato, 403 permesso mancante).
 */
// Motore Rafilu (/plancia) resta un sistema separato, protetto dalla sua chiave
// PLANCIA_ACCESS_KEY (non usa username/password ACCESSI) — vedi src/lib/accessi.ts. Ma
// alcune route (es. /api/prenotazioni) sono condivise tra il sito prenotazioni e la
// dashboard di Rafilu: chi presenta la chiave giusta di Rafilu è comunque Raffaele, quindi
// ottiene gli stessi permessi pieni di un accesso ACCESSI con ruolo Titolare — niente
// doppio login. Scoperto il 09/09/2026: dopo aver protetto /api/prenotazioni con questo
// gate, la card "Salzillo Hospitality" della dashboard andava in errore perché chiamava
// quella route senza alcuna autenticazione.
function permessiDaPlancia(req: NextRequest): Permessi | null {
  const expected = process.env.PLANCIA_ACCESS_KEY;
  const provided = req.headers.get('x-plancia-key');
  if (!expected || !provided || provided !== expected) return null;
  return { username: 'plancia', nome: 'Motore Rafilu', puoCreare: true, puoCancellare: true, puoVedereFinanziario: true };
}

export async function requireAccesso(
  req: NextRequest,
  richiesto: PermessoRichiesto = null
): Promise<{ permessi: Permessi } | { risposta: NextResponse }> {
  const daPlancia = permessiDaPlancia(req);
  if (daPlancia) {
    if (richiesto && !daPlancia[richiesto]) {
      return { risposta: NextResponse.json({ error: 'Non hai il permesso per questa azione' }, { status: 403 }) };
    }
    return { permessi: daPlancia };
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;
  const username = token ? verificaToken(token) : null;

  if (!username) {
    return { risposta: NextResponse.json({ error: 'Accesso richiesto — effettua il login' }, { status: 401 }) };
  }

  const permessi = await getPermessi(username);
  if (!permessi) {
    return { risposta: NextResponse.json({ error: 'Accesso non più valido — effettua di nuovo il login' }, { status: 401 }) };
  }

  if (richiesto && !permessi[richiesto]) {
    return { risposta: NextResponse.json({ error: 'Non hai il permesso per questa azione' }, { status: 403 }) };
  }

  return { permessi };
}
