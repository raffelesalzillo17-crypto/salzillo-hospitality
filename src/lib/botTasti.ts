// Tasti cliccabili del bot Telegram del B&B (richiesta di Raffaele, 29/09/2026: "creiamo dei
// tasti cliccabili così evitiamo incomprensioni"). Due tipi:
// - tastiera fissa sotto la chat (reply keyboard): ogni tasto invia il proprio testo, e le
//   letture (arrivi, partenze, ospiti in casa, prossime prenotazioni, pulizie) sono risposte
//   DETERMINISTICHE dai dati veri — non passano dal modello, quindi non c'è nulla da fraintendere;
// - tasti sotto un messaggio (inline keyboard): conferma/annulla delle azioni proposte e
//   scelta della prenotazione da cancellare.

import { leggiPrenotazioni, type Prenotazione } from './prenotazioni';
import { testoCheckinOggi, testoCheckoutOggi, testoPulizieDomani } from './telegramDigest';

export const TASTI = {
  PROSSIME: '📅 Prossime prenotazioni',
  IN_CASA: '🏠 Ospiti in casa',
  ARRIVI: '🛬 Arrivi oggi',
  PARTENZE: '🛫 Partenze oggi',
  PULIZIE: '🧹 Pulizie domani',
  NUOVA: '➕ Nuova prenotazione',
  CANCELLA: '🗑️ Cancella prenotazione',
  MENU: '📋 Menu',
} as const;

export const TASTIERA_FISSA = {
  keyboard: [
    [{ text: TASTI.PROSSIME }, { text: TASTI.IN_CASA }],
    [{ text: TASTI.ARRIVI }, { text: TASTI.PARTENZE }],
    [{ text: TASTI.PULIZIE }, { text: TASTI.NUOVA }],
    [{ text: TASTI.CANCELLA }, { text: TASTI.MENU }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

export const TASTI_CONFERMA = {
  inline_keyboard: [[
    { text: '✅ Conferma', callback_data: 'conf:si' },
    { text: '❌ Annulla', callback_data: 'conf:no' },
  ]],
};

export const TESTO_MENU = 'Ciao Raffaele! Sono l\'assistente del B&B. Usa i tasti qui sotto per le cose di tutti i giorni, oppure scrivimi (o mandami un vocale) per tutto il resto.';
export const TESTO_NUOVA = 'Ok, nuova prenotazione. Scrivimi (o detta in un vocale) ospite, stanza, date di check-in e check-out, canale e importo — poi ti mostro un riepilogo da confermare con un tasto.';

const parseIt = (s: string): Date | null => {
  const [d, m, y] = s.split('/').map(Number);
  return d && m && y ? new Date(y, m - 1, d) : null;
};
const oggi = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const breve = (s: string) => s.slice(0, 5); // "DD/MM"
const riga = (b: Prenotazione) => `• *${b.ospite}* — ${b.stanza}, ${breve(b.checkin)} → ${breve(b.checkout)} (${b.canale})`;

async function attive(): Promise<(Prenotazione & { ci: Date; co: Date })[]> {
  const tutte = await leggiPrenotazioni();
  return tutte
    .filter((b) => (b.stato || '').toLowerCase() === 'attiva')
    .map((b) => ({ ...b, ci: parseIt(b.checkin), co: parseIt(b.checkout) }))
    .filter((b): b is Prenotazione & { ci: Date; co: Date } => !!b.ci && !!b.co);
}

export async function testoOspitiInCasa(): Promise<string> {
  const t = oggi();
  const l = (await attive()).filter((b) => b.ci <= t && b.co > t);
  return l.length ? `🏠 *Ospiti in casa oggi*\n\n${l.map(riga).join('\n')}` : '🏠 Nessun ospite in casa oggi.';
}

export async function testoProssimePrenotazioni(giorni = 14): Promise<string> {
  const t = oggi();
  const limite = new Date(t.getTime() + giorni * 86400000);
  const l = (await attive()).filter((b) => b.ci > t && b.ci <= limite).sort((a, b) => a.ci.getTime() - b.ci.getTime());
  return l.length ? `📅 *Prossimi arrivi (${giorni} giorni)*\n\n${l.map(riga).join('\n')}` : `📅 Nessun arrivo nei prossimi ${giorni} giorni.`;
}

/** Risposta deterministica a un tasto di sola lettura; null se il testo non è uno di quelli. */
export async function rispondiATasto(testo: string): Promise<string | null> {
  switch (testo.trim()) {
    case TASTI.PROSSIME: return await testoProssimePrenotazioni();
    case TASTI.IN_CASA: return await testoOspitiInCasa();
    case TASTI.ARRIVI: return (await testoCheckinOggi()) ?? '🛬 Nessun arrivo oggi.';
    case TASTI.PARTENZE: return (await testoCheckoutOggi()) ?? '🛫 Nessuna partenza oggi.';
    case TASTI.PULIZIE: return (await testoPulizieDomani()) ?? '🧹 Nessuna pulizia da fare domani.';
    default: return null;
  }
}

/** Prenotazioni future/in corso cancellabili, come tasti (uno per riga, max 10). */
export async function tastiCancellazione(): Promise<{ testo: string; markup?: object }> {
  const t = oggi();
  const l = (await attive()).filter((b) => b.co >= t).sort((a, b) => a.ci.getTime() - b.ci.getTime()).slice(0, 10);
  if (!l.length) return { testo: 'Non ci sono prenotazioni attive da cancellare.' };
  return {
    testo: 'Quale prenotazione vuoi cancellare?',
    markup: {
      inline_keyboard: [
        ...l.map((b) => [{ text: `${b.ospite} · ${b.stanza} · ${breve(b.checkin)}→${breve(b.checkout)}`, callback_data: `canc:${b.row}` }]),
        [{ text: '↩️ Niente, lascia stare', callback_data: 'conf:no' }],
      ],
    },
  };
}

export async function trovaPrenotazione(row: number): Promise<Prenotazione | undefined> {
  return (await leggiPrenotazioni()).find((b) => b.row === row);
}
