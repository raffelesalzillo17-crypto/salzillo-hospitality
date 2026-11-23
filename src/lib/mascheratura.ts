// Mascheratura dei dati sensibili (punto 5 delle richieste, 23/11/2026).
// Il dato intero esce dal server solo da /api/nuovo/rivela (solo Titolare, registrato).

/** "AX1234567" → "•••••4567": restano solo le ultime 4 cifre (3 se il numero è molto corto). */
export function mascheraDocumento(numero: string | null | undefined): string {
  const n = (numero ?? '').trim();
  if (!n) return '';
  const visibili = n.length >= 8 ? 4 : n.length >= 5 ? 3 : 0;
  return '•'.repeat(Math.max(n.length - visibili, 3)) + (visibili ? n.slice(-visibili) : '');
}
