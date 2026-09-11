/**
 * Scrive verso i Google Sheet ("il vecchio sistema") ogni prenotazione creata/modificata/
 * cancellata nel nuovo sistema (origine='Database'), così il foglio resta un mirror
 * completo e utilizzabile come riserva — non solo i dati importati da lì.
 *
 * Direzione opposta a importDaSheets.ts (quello legge Sheets→DB, questo scrive DB→Sheets).
 * Va usato dalle mutations solo con .catch() — una scrittura sul foglio che fallisce non
 * deve mai far fallire l'operazione nel nuovo sistema, che resta la fonte di verità.
 *
 * Il tab DATABASE non ha una colonna ID: la colonna EVENT_ID (J) fa da chiave di
 * corrispondenza tra le due parti quando l'alloggio ha un calendario Google collegato
 * (creaEventoPrenotazione lo valorizza sia nel DB che qui). Senza EVENT_ID, la corrispondenza
 * cade su check-in + stanza + ospite — meno robusto ma sufficiente per gli alloggi senza
 * calendario configurato.
 */

import { getSheetsClient, fileIdForTab } from '../sheets';

const ALLOGGIO_FOGLIO: Record<string, string> = {
  'Il Tulipano': 'Tulipano',
  'Stanza Rosa': 'Rosa',
  'Piano Terra': 'Piano Terra',
  'Primo Piano': 'Primo Piano',
  'Secondo Piano': 'Secondo Piano',
};

const isoToIt = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export type RigaPrenotazione = {
  alloggioNome: string;
  checkin: string; // ISO
  checkout: string; // ISO
  ospiteNomeCompleto: string;
  canale: string;
  lordo: number;
  stato: string;
  penale?: number | null;
  eventId?: string | null;
  telefono?: string | null;
};

function rigaToValues(d: RigaPrenotazione): (string | number)[] {
  const stanza = ALLOGGIO_FOGLIO[d.alloggioNome] ?? d.alloggioNome;
  return [
    isoToIt(d.checkin), isoToIt(d.checkout), d.ospiteNomeCompleto, stanza, d.canale, d.lordo,
    d.stato, d.penale ?? '', d.eventId ?? '', d.telefono ?? '',
  ];
}

/** Prima riga libera del tab DATABASE, basata sulla colonna B (Check-in) — la colonna A
 *  ("Informazioni cronologiche") è quasi sempre vuota, quindi non va usata come riferimento
 *  (il generico findFirstFreeRow di sheets.ts la userebbe e sovrascriverebbe righe esistenti). */
async function primaRigaLiberaDatabase(sheets: ReturnType<typeof getSheetsClient>): Promise<number> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab('DATABASE'),
    range: 'DATABASE!B:B',
  });
  return (res.data.values?.length ?? 1) + 1;
}

/** Numero di riga (1-based) della prenotazione sul foglio, o null se non trovata.
 *  Cerca prima per EVENT_ID (colonna J), poi per check-in+stanza+ospite (colonne B,E,D). */
async function trovaRigaPrenotazione(
  sheets: ReturnType<typeof getSheetsClient>,
  d: Pick<RigaPrenotazione, 'eventId' | 'checkin' | 'alloggioNome' | 'ospiteNomeCompleto'>,
): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: fileIdForTab('DATABASE'),
    range: 'DATABASE!B2:J100000',
  });
  const righe = res.data.values ?? [];
  if (d.eventId) {
    const i = righe.findIndex((r) => String(r[8] ?? '') === d.eventId);
    if (i !== -1) return i + 2;
  }
  const stanza = ALLOGGIO_FOGLIO[d.alloggioNome] ?? d.alloggioNome;
  const checkinIt = isoToIt(d.checkin);
  const i = righe.findIndex((r) => String(r[0] ?? '') === checkinIt && String(r[3] ?? '') === stanza && String(r[2] ?? '') === d.ospiteNomeCompleto);
  return i === -1 ? null : i + 2;
}

/** Aggiunge una nuova prenotazione in fondo al tab DATABASE. Best-effort: logga e non lancia. */
export async function scriviNuovaPrenotazioneSuFoglio(d: RigaPrenotazione): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const row = await primaRigaLiberaDatabase(sheets);
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('DATABASE'),
      range: `DATABASE!B${row}:K${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rigaToValues(d)] },
    });
  } catch (e) {
    console.error('[sync-foglio] scrittura nuova prenotazione fallita (non bloccante):', e);
  }
}

/** Aggiorna la riga esistente (trovata per EVENT_ID o check-in+stanza+ospite). Se non la
 *  trova, la aggiunge come riga nuova (es. prenotazioni create prima che questo sync esistesse). */
export async function aggiornaPrenotazioneSuFoglio(d: RigaPrenotazione): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const row = await trovaRigaPrenotazione(sheets, d);
    if (row == null) {
      await scriviNuovaPrenotazioneSuFoglio(d);
      return;
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('DATABASE'),
      range: `DATABASE!B${row}:K${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rigaToValues(d)] },
    });
  } catch (e) {
    console.error('[sync-foglio] aggiornamento prenotazione fallito (non bloccante):', e);
  }
}
