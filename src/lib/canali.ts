/**
 * Canali di prenotazione (punto 3, 23/11/2026). I canali "diretti" non passano da una piattaforma: il pagamento lo gestisce Raffaele
 * (caparra, saldo, contratto, ricevuta). "No Tax" resta un canale a sé, invariato (scelta esplicita del titolare).
 */
export const CANALI = ['Airbnb', 'Booking', 'Diretto', 'No Tax'] as const;
export const CANALI_DIRETTI: readonly string[] = ['Diretto'];
/** Canali in cui il pagamento lo gestisce Raffaele (anche No Tax, come prima). */
export const canaleConIncasso = (c: string) => CANALI_DIRETTI.includes(c) || c === 'No Tax';

/** Canali scelgibili nei moduli: "No Tax" non è un canale ma un regime fiscale (punto 3); compare solo sulle prenotazioni che lo hanno ancora. */
export const CANALI_SCELTA = ['Airbnb', 'Booking', 'Diretto'] as const;
