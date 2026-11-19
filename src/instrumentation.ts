// Interruttore "bot Telegram spento" (19/11/2026, richiesta di Raffaele: Grok Bot lo sostituisce).
// Con TELEGRAM_OFF=1 ogni chiamata verso api.telegram.org viene assorbita senza uscire dal server.
// Per riaccendere: togliere la variabile (o metterla a 0) su Vercel e ripubblicare.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.TELEGRAM_OFF !== '1') return;
  const originale = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.startsWith('https://api.telegram.org/')) {
      return new Response(JSON.stringify({ ok: true, result: { message_id: 0 } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return originale(input, init);
  }) as typeof fetch;
}
