// Heartbeat sui cron: se un job schedulato (digest/checkin-reminder/checkout-reminder)
// fallisce a metà, oggi finiva solo nei log di Vercel — nessuno se ne accorgeva finché
// non mancava un messaggio. Vedi wiki/entita/salzillo-hospitality.md, "Promemoria
// automatici che non arrivavano" (08/09/2026) per il contesto di questa lacuna.
// Best-effort: se anche l'invio dell'alert fallisce, non c'è altro da fare qui — non
// deve mai far esplodere il route handler che lo chiama.
export async function alertCronFailure(cronName: string, err: unknown): Promise<void> {
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  const message = err instanceof Error ? err.message : String(err);
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `⚠️ *Cron fallito: ${cronName}*\n\n${message}\n\nControlla i log su Vercel se serve capire di più.`,
        parse_mode: 'Markdown',
      }),
    });
  } catch {
    // Nessun fallback ulteriore: se Telegram stesso è irraggiungibile non c'è molto altro da fare.
  }
}

/**
 * Un ospite si è bloccato compilando la scheda di check-in online (checkin-gate.js) perché il
 * sistema non trova/riconosce in modo univoco la sua prenotazione. Avvisa subito
 * Raffaele via Telegram con i dati che l'ospite ha già inserito, così può intervenire lo stesso
 * giorno invece di scoprirlo solo quando l'ospite si lamenta di persona. Vedi
 * wiki/log.md 10/09/2026 (Serafina Posillipo) per il precedente che ha motivato questo alert.
 * Best-effort, come alertCronFailure: non deve mai far fallire la route che lo chiama.
 */
export async function alertOspiteBloccato(dettagli: {
  stanza: string; dataArrivo: string; ospite: string; motivo: string;
}): Promise<void> {
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  const text = `🧍‍♂️ *Ospite bloccato al check-in online*\n\n` +
    `${dettagli.ospite} — ${dettagli.stanza}, arrivo ${dettagli.dataArrivo}\n` +
    `Motivo: ${dettagli.motivo}\n\n` +
    `Controlla la prenotazione (data o stanza diversa/ambigua) e contattalo tu direttamente per non lasciarlo bloccato.`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch {
    // Nessun fallback ulteriore.
  }
}

/**
 * L'invio ad Alloggiati Web è stato accettato dal portale, ma il salvataggio dell'esito nel
 * nostro database è fallito (es. timeout) — la schedina resta in stato "In invio" invece di
 * essere segnata "Errore" per sbaglio (vedi src/lib/db/schema.ts, statoSchedina). Senza questo
 * alert Raffaele non avrebbe modo di saperlo finché non guarda la scheda Alloggiati Web di
 * persona, col rischio concreto di rimandare a mano una schedina già trasmessa davvero.
 * Scoperto in un audit del 23/09/2026, mai capitato finora. Best-effort come gli altri alert.
 */
export async function alertInvioAmbiguo(dettagli: { ospite: string; alloggio: string; erroreScrittura: string }): Promise<void> {
  const chatId = process.env.ALLOWED_CHAT_ID;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!chatId || !token) return;

  const text = `🚨 *Invio Alloggiati Web da verificare*\n\n` +
    `${dettagli.ospite} — ${dettagli.alloggio}\n` +
    `L'invio al portale è andato a buon fine, ma non sono riuscito a registrarlo nel sistema (${dettagli.erroreScrittura}).\n\n` +
    `NON reinviarla: apri la scheda "Alloggiati Web" → "Da verificare" e conferma a mano cosa è successo.`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch {
    // Nessun fallback ulteriore.
  }
}
