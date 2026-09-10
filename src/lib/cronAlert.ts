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
