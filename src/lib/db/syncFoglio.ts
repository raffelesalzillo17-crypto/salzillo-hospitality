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

import { getSheetsClient, fileIdForTab, ensureSheetWithHeaders } from '../sheets';

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

/** Con valueInputOption USER_ENTERED, Sheets prova a interpretare "+39..." come l'inizio di
 *  una formula/numero e perde il "+". L'apostrofo iniziale forza il testo letterale — stesso
 *  trucco usato quando si digita un numero di telefono a mano in un foglio. */
const testo = (s: string): string => (s && /^[+=]/.test(s) ? `'${s}` : s);

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
    isoToIt(d.checkin), isoToIt(d.checkout), testo(d.ospiteNomeCompleto), stanza, d.canale, d.lordo,
    d.stato, d.penale ?? '', d.eventId ?? '', testo(d.telefono ?? ''),
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

// ── Spese ────────────────────────────────────────────────────────────────────
// Tab SPESE (file "gestione"): A=Data B=Categoria C=Descrizione D=Importo E=Struttura.
// A differenza di DATABASE la colonna A qui è dati veri (Data), quindi la prima riga
// libera si può leggere da lì senza il problema visto sopra.

export type RigaSpesa = {
  data: string; // ISO
  categoriaNome: string;
  descrizione: string;
  importo: number;
  struttura?: string | null; // nome immobile (es. "Via Clanio 60") — coerente col parsing in importDaSheets.ts
};

/** Aggiunge una nuova spesa in fondo al tab SPESE. Solo creazione: non esiste ancora una
 *  "modificaSpesa" nel nuovo sistema, quindi non serve una funzione di aggiornamento qui. */
export async function scriviSpesaSuFoglio(d: RigaSpesa): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('SPESE'), range: 'SPESE!A:A' });
    const row = (res.data.values?.length ?? 1) + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SPESE'),
      range: `SPESE!A${row}:E${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[isoToIt(d.data), d.categoriaNome, testo(d.descrizione), d.importo, d.struttura ?? '']] },
    });
  } catch (e) {
    console.error('[sync-foglio] scrittura spesa fallita (non bloccante):', e);
  }
}

// ── Scadenze ─────────────────────────────────────────────────────────────────
// Tab SCADENZE (file "gestione"): A=ID (non usato da importDaSheets.ts, lasciato vuoto)
// B=Titolo C=DataScadenza D=Ricorrenza E=Note F=UltimoCompletamento.
// Il vecchio schema non ha un campo "ente" — viene ripiegato dentro Note per non perderlo.

export type RigaScadenza = {
  titolo: string;
  dataScadenza: string; // ISO
  ricorrenza: string;
  ente?: string | null;
  note?: string | null;
  ultimoCompletamento?: string | null; // ISO
};

function noteConEnte(d: Pick<RigaScadenza, 'ente' | 'note'>): string {
  return [d.ente ? `Ente: ${d.ente}` : null, d.note ?? null].filter(Boolean).join(' — ');
}

/** Prima riga libera del tab SCADENZE, basata sulla colonna B (Titolo) — la colonna A (ID)
 *  non viene valorizzata da questo sync né da importDaSheets.ts. */
async function primaRigaLiberaScadenze(sheets: ReturnType<typeof getSheetsClient>): Promise<number> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('SCADENZE'), range: 'SCADENZE!B:B' });
  return (res.data.values?.length ?? 1) + 1;
}

export async function scriviScadenzaSuFoglio(d: RigaScadenza): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const row = await primaRigaLiberaScadenze(sheets);
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCADENZE'),
      range: `SCADENZE!B${row}:F${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[
        testo(d.titolo), isoToIt(d.dataScadenza), d.ricorrenza, testo(noteConEnte(d)),
        d.ultimoCompletamento ? isoToIt(d.ultimoCompletamento) : '',
      ]] },
    });
  } catch (e) {
    console.error('[sync-foglio] scrittura scadenza fallita (non bloccante):', e);
  }
}

/** Aggiorna data-scadenza e ultimo-completamento della riga trovata per titolo (colonna B).
 *  Se non la trova (es. scadenza creata prima che questo sync esistesse), la aggiunge. */
export async function aggiornaScadenzaSuFoglio(d: RigaScadenza): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('SCADENZE'), range: 'SCADENZE!B2:B100000' });
    const righe = res.data.values ?? [];
    const i = righe.findIndex((r) => String(r[0] ?? '') === d.titolo);
    if (i === -1) {
      await scriviScadenzaSuFoglio(d);
      return;
    }
    const row = i + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('SCADENZE'),
      range: `SCADENZE!C${row}:F${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[
        isoToIt(d.dataScadenza), d.ricorrenza, testo(noteConEnte(d)), d.ultimoCompletamento ? isoToIt(d.ultimoCompletamento) : '',
      ]] },
    });
  } catch (e) {
    console.error('[sync-foglio] aggiornamento scadenza fallito (non bloccante):', e);
  }
}

// ── Ospiti ───────────────────────────────────────────────────────────────────
// Tab OSPITI (file "prenotazioni"): A=OspiteId B=Nome(completo) C=Telefono D=CodiceFiscale
// E=Note F=CreatoIl. La colonna A è cosmetica (importDaSheets.ts non la usa per abbinare,
// cerca per nome) — ci scriviamo l'id del nuovo sistema, comodo per debug incrociato.

export type RigaOspite = {
  id: string;
  nomeCompleto: string;
  telefono?: string | null;
  codiceFiscale?: string | null;
  note?: string | null;
};

export async function scriviOspiteSuFoglio(d: RigaOspite): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('OSPITI'), range: 'OSPITI!A:A' });
    const row = (res.data.values?.length ?? 1) + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('OSPITI'),
      range: `OSPITI!A${row}:F${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[d.id, testo(d.nomeCompleto), testo(d.telefono ?? ''), d.codiceFiscale ?? '', testo(d.note ?? ''), new Date().toISOString()]] },
    });
  } catch (e) {
    console.error('[sync-foglio] scrittura ospite fallita (non bloccante):', e);
  }
}

/** Aggiorna la riga trovata per nome completo (colonna B). Se non la trova, la aggiunge. */
export async function aggiornaOspiteSuFoglio(d: RigaOspite): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('OSPITI'), range: 'OSPITI!B2:B100000' });
    const righe = res.data.values ?? [];
    const i = righe.findIndex((r) => String(r[0] ?? '') === d.nomeCompleto);
    if (i === -1) {
      await scriviOspiteSuFoglio(d);
      return;
    }
    const row = i + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('OSPITI'),
      range: `OSPITI!C${row}:E${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[testo(d.telefono ?? ''), d.codiceFiscale ?? '', testo(d.note ?? '')]] },
    });
  } catch (e) {
    console.error('[sync-foglio] aggiornamento ospite fallito (non bloccante):', e);
  }
}

// ── Pulizie ──────────────────────────────────────────────────────────────────
// Tab PULIZIE (file "gestione"): A=Data B=Stanza ... K=Operatore L=CompletatoIl M=Note.
// Nessuna creazione da qui: le righe pulizie arrivano tutte dall'import (una per check-out),
// solo la conferma (confermaPulizia) va rispecchiata sul foglio.

export type RigaPuliziaConferma = {
  data: string; // ISO
  alloggioNome: string;
  operatore?: string | null;
};

export async function confermaPuliziaSuFoglio(d: RigaPuliziaConferma): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('PULIZIE'), range: 'PULIZIE!A2:B100000' });
    const righe = res.data.values ?? [];
    const stanza = ALLOGGIO_FOGLIO[d.alloggioNome] ?? d.alloggioNome;
    const dataIt = isoToIt(d.data);
    const i = righe.findIndex((r) => String(r[0] ?? '') === dataIt && String(r[1] ?? '') === stanza);
    if (i === -1) return; // nessuna riga corrispondente sul foglio (es. pulizia creata solo nel nuovo sistema) — niente da aggiornare
    const row = i + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('PULIZIE'),
      range: `PULIZIE!K${row}:L${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[d.operatore ?? '', isoToIt(new Date().toISOString().slice(0, 10))]] },
    });
  } catch (e) {
    console.error('[sync-foglio] conferma pulizia fallita (non bloccante):', e);
  }
}

// ── Preventivi ───────────────────────────────────────────────────────────────
// Tab PREVENTIVI (file "prenotazioni") — non esisteva nel vecchio sistema (concetto nuovo
// di /nuovo): lo creiamo qui al primo utilizzo, con intestazioni proprie.
// A=Codice B=Check-in C=Check-out D=Ospite E=Alloggio F=Prezzo/notte G=Totale H=Sconto
// I=Stato J=Valido ore K=Note. Il codice (es. "PR-0007") è univoco e stabile: chiave di
// corrispondenza affidabile, a differenza delle prenotazioni.

const INTESTAZIONI_PREVENTIVI = ['Codice', 'Check-in', 'Check-out', 'Ospite', 'Alloggio', 'Prezzo/notte', 'Totale', 'Sconto', 'Stato', 'Valido ore', 'Note'] as const;

export type RigaPreventivo = {
  codice: string;
  checkin: string; // ISO
  checkout: string; // ISO
  ospiteNomeCompleto: string;
  alloggioNome: string;
  prezzoNotte?: number | null;
  totale: number;
  sconto: number;
  stato: string;
  validoOre: number;
  note?: string | null;
};

function rigaPreventivoToValues(d: RigaPreventivo): (string | number)[] {
  const stanza = ALLOGGIO_FOGLIO[d.alloggioNome] ?? d.alloggioNome;
  return [
    d.codice, isoToIt(d.checkin), isoToIt(d.checkout), testo(d.ospiteNomeCompleto), stanza,
    d.prezzoNotte ?? '', d.totale, d.sconto, d.stato, d.validoOre, testo(d.note ?? ''),
  ];
}

export async function scriviPreventivoSuFoglio(d: RigaPreventivo): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    await ensureSheetWithHeaders(sheets, 'PREVENTIVI', INTESTAZIONI_PREVENTIVI, 'sync-foglio');
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('PREVENTIVI'), range: 'PREVENTIVI!A:A' });
    const row = (res.data.values?.length ?? 1) + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('PREVENTIVI'),
      range: `PREVENTIVI!A${row}:K${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rigaPreventivoToValues(d)] },
    });
  } catch (e) {
    console.error('[sync-foglio] scrittura preventivo fallita (non bloccante):', e);
  }
}

/** Aggiorna la riga trovata per codice (colonna A, univoco). Se non la trova, la aggiunge. */
export async function aggiornaPreventivoSuFoglio(d: RigaPreventivo): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    await ensureSheetWithHeaders(sheets, 'PREVENTIVI', INTESTAZIONI_PREVENTIVI, 'sync-foglio');
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('PREVENTIVI'), range: 'PREVENTIVI!A2:A100000' });
    const righe = res.data.values ?? [];
    const i = righe.findIndex((r) => String(r[0] ?? '') === d.codice);
    if (i === -1) {
      await scriviPreventivoSuFoglio(d);
      return;
    }
    const row = i + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('PREVENTIVI'),
      range: `PREVENTIVI!A${row}:K${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rigaPreventivoToValues(d)] },
    });
  } catch (e) {
    console.error('[sync-foglio] aggiornamento preventivo fallito (non bloccante):', e);
  }
}

// ── Eventi locali ────────────────────────────────────────────────────────────
// Tab EVENTI_LOCALI (file "gestione") — anche questo nuovo, creato al primo utilizzo.
// A=Titolo B=Dal C=Al D=Comune E=Impatto F=Note. Nessun codice univoco qui: la
// corrispondenza cade su titolo+dal (ragionevole perché un evento è un caso d'uso a bassa
// frequenza, non una riga scritta ogni giorno come le prenotazioni).

const INTESTAZIONI_EVENTI_LOCALI = ['Titolo', 'Dal', 'Al', 'Comune', 'Impatto', 'Note'] as const;

export type RigaEventoLocale = {
  titolo: string;
  dal: string; // ISO
  al: string; // ISO
  comune?: string | null;
  impatto: string;
  note?: string | null;
};

function rigaEventoLocaleToValues(d: RigaEventoLocale): string[] {
  return [testo(d.titolo), isoToIt(d.dal), isoToIt(d.al), d.comune ?? '', d.impatto, testo(d.note ?? '')];
}

async function trovaRigaEventoLocale(sheets: ReturnType<typeof getSheetsClient>, titolo: string, dal: string): Promise<number | null> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('EVENTI_LOCALI'), range: 'EVENTI_LOCALI!A2:B100000' });
  const righe = res.data.values ?? [];
  const i = righe.findIndex((r) => String(r[0] ?? '') === titolo && String(r[1] ?? '') === isoToIt(dal));
  return i === -1 ? null : i + 2;
}

export async function scriviEventoLocaleSuFoglio(d: RigaEventoLocale): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    await ensureSheetWithHeaders(sheets, 'EVENTI_LOCALI', INTESTAZIONI_EVENTI_LOCALI, 'sync-foglio');
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: fileIdForTab('EVENTI_LOCALI'), range: 'EVENTI_LOCALI!A:A' });
    const row = (res.data.values?.length ?? 1) + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('EVENTI_LOCALI'),
      range: `EVENTI_LOCALI!A${row}:F${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rigaEventoLocaleToValues(d)] },
    });
  } catch (e) {
    console.error('[sync-foglio] scrittura evento locale fallita (non bloccante):', e);
  }
}

/** Aggiorna la riga trovata per titolo+dal (le uniche chiavi stabili prima della modifica —
 *  vanno passate come "prima" se titolo/dal cambiano insieme al resto). */
export async function aggiornaEventoLocaleSuFoglio(prima: { titolo: string; dal: string }, d: RigaEventoLocale): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    await ensureSheetWithHeaders(sheets, 'EVENTI_LOCALI', INTESTAZIONI_EVENTI_LOCALI, 'sync-foglio');
    const row = await trovaRigaEventoLocale(sheets, prima.titolo, prima.dal);
    if (row == null) {
      await scriviEventoLocaleSuFoglio(d);
      return;
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: fileIdForTab('EVENTI_LOCALI'),
      range: `EVENTI_LOCALI!A${row}:F${row}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [rigaEventoLocaleToValues(d)] },
    });
  } catch (e) {
    console.error('[sync-foglio] aggiornamento evento locale fallito (non bloccante):', e);
  }
}

export async function eliminaEventoLocaleSuFoglio(titolo: string, dal: string): Promise<void> {
  try {
    const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);
    const row = await trovaRigaEventoLocale(sheets, titolo, dal);
    if (row == null) return;
    const meta = await sheets.spreadsheets.get({ spreadsheetId: fileIdForTab('EVENTI_LOCALI'), fields: 'sheets.properties' });
    const sheetId = meta.data.sheets?.find((s) => s.properties?.title === 'EVENTI_LOCALI')?.properties?.sheetId;
    if (sheetId == null) return;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: fileIdForTab('EVENTI_LOCALI'),
      requestBody: { requests: [{ deleteDimension: { range: { sheetId, dimension: 'ROWS', startIndex: row - 1, endIndex: row } } }] },
    });
  } catch (e) {
    console.error('[sync-foglio] eliminazione evento locale fallita (non bloccante):', e);
  }
}
