import { NextResponse, type NextRequest } from 'next/server';

// Interruttore "bot Telegram spento" (19/11/2026). Con TELEGRAM_OFF=1:
// - il webhook di Telegram risponde 200 senza fare nulla (il bot non agisce né risponde);
// - la scansione della posta si ferma, perché senza Telegram segnerebbe le email come lette
//   senza che Raffaele venga avvisato.
// Per riaccendere: togliere la variabile (o metterla a 0) su Vercel e ripubblicare.
export function proxy(req: NextRequest) {
  if (process.env.TELEGRAM_OFF === '1') {
    return NextResponse.json({ ok: true, spento: 'bot Telegram spento il 19/11/2026' });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/telegram-webhook', '/api/cron/posta'],
};
