/**
 * Controllo prima dell'invio ad Alloggiati Web: le schedine di una prenotazione devono essere tante
 * quanti sono gli ospiti scritti nella prenotazione (richiesta di Raffaele, 23/11/2026).
 *
 * Perché: il 14→16/11/2026 una prenotazione con 2 ospiti è partita con 1 sola schedina, e un'altra con
 * 1 ospite è partita con 2 schedine, senza che nulla lo segnalasse. Al portale (e alla Polizia) arriva
 * ciò che c'è nelle schedine, non ciò che c'è nella prenotazione.
 *
 * Ritorna null se è tutto a posto, altrimenti il messaggio da mostrare. Non decide niente da sola:
 * l'invio resta bloccato finché il Titolare non corregge i dati o conferma esplicitamente l'invio.
 */
export function controlloOspitiSchedine(ospitiAttesi: number | null | undefined, schedinePresenti: number): string | null {
  const attesi = Number(ospitiAttesi) > 0 ? Number(ospitiAttesi) : 1;
  if (schedinePresenti === attesi) return null;
  const persone = (n: number) => `${n} ${n === 1 ? 'ospite' : 'ospiti'}`;
  const schedineTesto = (n: number) => `${n} ${n === 1 ? 'schedina' : 'schedine'}`;
  if (schedinePresenti < attesi) {
    return `La prenotazione ha ${persone(attesi)} ma ci sono solo ${schedineTesto(schedinePresenti)}: al portale risulterebbero ${persone(schedinePresenti)}. Aggiungi la schedina mancante.`;
  }
  return `La prenotazione ha ${persone(attesi)} ma ci sono ${schedineTesto(schedinePresenti)}: al portale risulterebbero ${persone(schedinePresenti)}. Controlla il numero di ospiti della prenotazione o togli la schedina di troppo.`;
}
