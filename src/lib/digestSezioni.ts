// Sezioni del digest unico (mattina/sera) prodotte da Salzillo Hospitality.
//
// Dal 29/09/2026 il messaggio Telegram unico della mattina e della sera NON lo invia più questo
// progetto: lo compone e lo invia il bot personale di plancia-raffaele, che chiede qui la
// sezione B&B via /api/digest/sezione (vedi quella route) e ci aggiunge la sua parte
// personale. Decisione: wiki Hospitality, decisioni/digest-unico-mattina-sera. Qui restano solo
// i blocchi del business — nessun contenuto personale (notizie/mercati/PAC/agenda) vive più in
// questo progetto.

import {
  eseguiSyncEmailPrenotazioni,
  testoCheckinOggi,
  testoCheckoutOggi,
  testoControlloCalendari,
  testoEventiLocali,
  testoPreventiviScadenza,
  testoPulizieDomani,
  testoSchedineInScadenza,
} from './telegramDigest';

import { testoPostaInSospeso } from './posta';
import { testoPromemoriaAutomatici } from './db/regole';

export const SEPARATORE_BLOCCHI = '\n\n━━━━━━━━━━\n\n';

export async function sezioneMattina(dryRun = false): Promise<string[]> {
  const blocchi = await Promise.all([
    testoCheckinOggi(),
    testoCheckoutOggi(),
    testoControlloCalendari(),
    testoPreventiviScadenza(),
    testoPulizieDomani(),
    testoSchedineInScadenza(),
    testoPostaInSospeso(),
    // Promemoria e messaggi preparati dalle regole (src/lib/regole.ts). Se il motore ha un problema
    // non deve far saltare il resto del digest.
    testoPromemoriaAutomatici(dryRun).catch((e) => { console.error('[digest] promemoria automatici non disponibili:', e instanceof Error ? e.message : e); return null; }),
  ]);
  return blocchi.filter((b): b is string => !!b);
}

export async function sezioneSera(origin: string, dryRun: boolean): Promise<string[]> {
  const blocchi: string[] = [];
  blocchi.push(...(await eseguiSyncEmailPrenotazioni(origin, dryRun)));

  // I passi qui sotto sono accessori: se falliscono (es. Gemini 429 il lunedì, 19/10/2026) NON devono far
  // perdere gli avvisi del sync email, che a questo punto ha già creato prenotazioni e segnato le email come
  // gestite. Si segnala il guasto in un blocco e si va avanti.
  const accessorio = async (nome: string, passo: () => Promise<string | null>) => {
    try {
      const testo = await passo();
      if (testo) blocchi.push(testo);
    } catch (err) {
      console.error(`[digest sera] ${nome} non disponibile:`, err instanceof Error ? err.message : err);
      blocchi.push(`⚠️ ${nome} non disponibile stasera (${err instanceof Error ? err.message.slice(0, 120) : 'errore'}).`);
    }
  };

  // Eventi locali: una ricerca a settimana (lunedì), per non sprecare chiamate ogni sera.
  if (new Date().getDay() === 1) await accessorio('Ricerca eventi in zona', () => testoEventiLocali(dryRun));
  await accessorio('Controllo schedine in scadenza', () => testoSchedineInScadenza());
  return blocchi;
}
