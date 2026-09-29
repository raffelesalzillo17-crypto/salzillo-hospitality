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

export const SEPARATORE_BLOCCHI = '\n\n━━━━━━━━━━\n\n';

export async function sezioneMattina(): Promise<string[]> {
  const blocchi = await Promise.all([
    testoCheckinOggi(),
    testoCheckoutOggi(),
    testoControlloCalendari(),
    testoPreventiviScadenza(),
    testoPulizieDomani(),
    testoSchedineInScadenza(),
  ]);
  return blocchi.filter((b): b is string => !!b);
}

export async function sezioneSera(origin: string, dryRun: boolean): Promise<string[]> {
  const blocchi: string[] = [];
  blocchi.push(...(await eseguiSyncEmailPrenotazioni(origin, dryRun)));

  // Eventi locali: una ricerca a settimana (lunedì), per non sprecare chiamate ogni sera.
  if (new Date().getDay() === 1) {
    const testoEventi = await testoEventiLocali(dryRun);
    if (testoEventi) blocchi.push(testoEventi);
  }

  const testoSchedine = await testoSchedineInScadenza();
  if (testoSchedine) blocchi.push(testoSchedine);
  return blocchi;
}
