import { getSheetsClient, fileIdForTab } from './sheets';
import { COMM_RATE, ALIQUOTA_CEDOLARE } from './tariffe';

// Lettura delle prenotazioni dal foglio DATABASE, condivisa tra la rotta HTTP
// (/api/prenotazioni, con gate di autenticazione) e i consumatori interni che girano
// già lato server e non devono passare dall'HTTP: i cron degli avvisi (digest mattutino,
// promemoria check-in/check-out) e il bot Telegram (assistantCore.ts).
//
// Scoperto il 10/09/2026: dopo aver protetto /api/prenotazioni con requireAccesso
// (09/09/2026), quei consumatori interni chiamavano la rotta senza credenziali e
// ricevevano 401 — gli avvisi hanno smesso di partire. Estratta qui la logica così il
// problema non si ripresenta: chi è già server-side importa questa funzione direttamente.

export function calcUtile(lordo: number, canale: string): number {
  if (canale === 'No Tax') return Math.round((lordo - 20) * 100) / 100;
  const comm = lordo * (COMM_RATE[canale] ?? 0);
  const ced  = lordo * ALIQUOTA_CEDOLARE;
  return Math.round((lordo - comm - ced - 20) * 100) / 100;
}

export type Prenotazione = {
  row: number;
  checkin: string;
  checkout: string;
  ospite: string;
  stanza: string;
  canale: string;
  lordo: number;
  utile: number;
  stato: string;
  penale: string;
  eventId: string;
  telefono: string;
};

/** Legge tutte le prenotazioni valide dal foglio DATABASE, ordinate per check-in ASC.
 *  Include sempre lordo/utile — la redazione dei dati finanziari per chi non ha il
 *  permesso avviene nella rotta HTTP, non qui (i consumatori interni sono tutti fidati). */
export async function leggiPrenotazioni(): Promise<Prenotazione[]> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab('DATABASE'),
    range: 'DATABASE!B2:K1000',
  });

  const rows = res.data.values ?? [];

  return rows
    .map((row, idx): Prenotazione | null => {
      const [checkin, checkout, ospite, stanza, canale, lordo, stato, penale, eventId, telefono] = row;
      // Filtra righe senza dati essenziali o righe header
      if (!checkin || !ospite || !stanza || !canale) return null;
      // Verifica che checkin sia in formato DD/MM/YYYY
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(String(checkin))) return null;
      const lordoNum = parseFloat(String(lordo ?? 0)) || 0;
      return {
        row:      idx + 2, // sheet row (1-indexed, +1 per header)
        checkin:  String(checkin),
        checkout: String(checkout ?? ''),
        ospite:   String(ospite),
        stanza:   String(stanza),
        canale:   String(canale),
        lordo:    lordoNum,
        utile:    calcUtile(lordoNum, String(canale)),
        stato:    String(stato ?? 'Attiva'),
        penale:   String(penale ?? ''),
        eventId:  String(eventId ?? ''),
        telefono: String(telefono ?? ''),
      };
    })
    .filter((p): p is Prenotazione => p !== null)
    .sort((a, b) => {
      const toISO = (s: string) => s.split('/').reverse().join('-');
      return toISO(a.checkin).localeCompare(toISO(b.checkin));
    });
}
