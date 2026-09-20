// Elenco unico delle strutture/stanze gestite da Salzillo Hospitality.
//
// Prima del 09/09/2026 questa lista era duplicata come stringa letterale in almeno 6 file
// diversi (STANZE in plancia/page.tsx, STANZE_VALIDE in assistantCore.ts, STRUTTURE_SPESA in
// spese.ts, STANZE_TULIPANO+DEFAULT_TULIPANO/DEFAULT_ALTRO in contratto/route.ts e
// ricevuta/route.ts, l'if/else di guideMessage() in cron/checkin-reminder/route.ts) — un
// immobile nuovo richiedeva modificare 6 posti diversi, con alto rischio di dimenticarne uno.
// Consolidato qui su richiesta di Raffaele (vedi wiki/entita/salzillo-hospitality.md,
// "Idee per il prossimo giro" punto 2 — "il tempo umano per immobile deve tendere a zero"
// vale anche per il tempo di chi scrive il codice, non solo per l'host).
//
// ECCEZIONE DELIBERATA: src/app/page.tsx (sito prenotazioni condiviso con i collaboratori)
// NON importa da qui. Quel file resta sotto la regola "non toccare la funzionalità"
// (wiki/decisioni/non-toccare-sito-prenotazioni.md) — la sua lista STANZE resta un letterale
// indipendente, da aggiornare a mano (con conferma esplicita di Raffaele, come già successo
// per il rename Stanza 3/4/5) se l'elenco strutture cambia di nuovo.

export type Scia = 'tulipano' | 'altro';

export type Struttura = {
  nome: string;
  /** Sotto quale SCIA/intestatario ricade — vedi DEFAULT_TULIPANO/DEFAULT_ALTRO in
   *  contratto/route.ts e ricevuta/route.ts per i dati fiscali associati. */
  scia: Scia;
  hasSelfCheckin: boolean;
  /** Solo check-in (parcheggio, ingresso, check-in/out) + il modulo dati Alloggiati Web —
   *  quella che si manda PRIMA dell'arrivo. Dal 20/09/2026 non contiene più WiFi/regole/
   *  dintorni: quelli si mandano a parte con infoGuideUrl, dopo che Raffaele ha controllato
   *  i dati del check-in (vedi checkinGateReview in DettaglioPrenotazione). */
  checkinGuideUrl?: string;
  /** WiFi, cucina, regole della casa, dintorni — si manda DOPO che il check-in digitale
   *  (checkinGuideUrl) risulta compilato correttamente, mai prima: pensata per il bottone
   *  "Manda scheda WiFi/regole" nella scheda della prenotazione. */
  infoGuideUrl?: string;
  /** Emoji usata nel promemoria WhatsApp di check-in (cron/checkin-reminder). */
  emoji?: string;
  /** Testo esatto già in uso per il promemoria di check-in — copia guest-facing, non
   *  generata automaticamente per non rischiare di alterare un testo già confermato. */
  guideMessageText?: string;
  /** Come guideMessageText ma per infoGuideUrl (scheda WiFi/regole mandata dopo il check-in). */
  infoMessageText?: string;
  /** Indirizzo reale della struttura — Tulipano/Rosa a Via Clanio 60, Via Campania per le altre
   *  tre (indirizzo diverso, confermato in wiki/entita/salzillo-hospitality.md). */
  indirizzo: string;
  /** Rete WiFi disponibile in loco — false per Via Campania (non ancora installato, confermato
   *  da Raffaele il 09/09/2026). Un generatore di QR WiFi non deve MAI produrne uno per una
   *  struttura senza WiFi vero: punterebbe l'ospite a una rete che non esiste sul posto. */
  wifi?: { ssid: string; password: string };
};

const BASE_URL = 'https://salzillo-hospitality.vercel.app';

export const STRUTTURE: Struttura[] = [
  {
    nome: 'Tulipano',
    scia: 'tulipano',
    hasSelfCheckin: true,
    checkinGuideUrl: `${BASE_URL}/checkin/tulipano.html`,
    infoGuideUrl: `${BASE_URL}/checkin/tulipano-info.html`,
    emoji: '🌷',
    guideMessageText: "Ecco le info per arrivare al Tulipano — indirizzo, parcheggio e come entrare. Appena fatto il check-in ti mando anche WiFi, regole e consigli sui dintorni:",
    infoMessageText: "Ecco WiFi, regole della casa e qualche consiglio sui dintorni per il tuo soggiorno al Tulipano:",
    indirizzo: 'Via Clanio 60, Marcianise (CE)',
    wifi: { ssid: 'Lella', password: 'Lella1978@' },
  },
  {
    nome: 'Rosa',
    scia: 'tulipano',
    hasSelfCheckin: false,
    checkinGuideUrl: `${BASE_URL}/checkin/rosa.html`,
    infoGuideUrl: `${BASE_URL}/checkin/rosa-info.html`,
    emoji: '🌸',
    guideMessageText: "Ecco le info per arrivare alla Stanza Rosa — indirizzo e come entrare. Appena fatto il check-in ti mando anche WiFi, regole e consigli sui dintorni:",
    infoMessageText: "Ecco WiFi, regole della casa e qualche consiglio sui dintorni per il tuo soggiorno alla Stanza Rosa:",
    indirizzo: 'Via Clanio 60, Marcianise (CE)',
    wifi: { ssid: 'Lella', password: 'Lella1978@' },
  },
  {
    nome: 'Piano Terra',
    scia: 'altro',
    hasSelfCheckin: false,
    checkinGuideUrl: `${BASE_URL}/checkin/piano-terra.html`,
    infoGuideUrl: `${BASE_URL}/checkin/piano-terra-info.html`,
    emoji: '🏠',
    guideMessageText: "Ecco le info per arrivare — indirizzo e come entrare. Appena fatto il check-in ti mando anche WiFi, regole e consigli sui dintorni:",
    infoMessageText: "Ecco WiFi, regole della casa e qualche consiglio sui dintorni per il tuo soggiorno:",
    indirizzo: 'Via Campania 36, Marcianise (CE)',
    // Nessun WiFi installato (confermato 09/09/2026) — resta undefined di proposito.
  },
  {
    nome: 'Primo Piano',
    scia: 'altro',
    hasSelfCheckin: false,
    checkinGuideUrl: `${BASE_URL}/checkin/primo-piano.html`,
    infoGuideUrl: `${BASE_URL}/checkin/primo-piano-info.html`,
    emoji: '🏠',
    guideMessageText: "Ecco le info per arrivare — indirizzo e come entrare. Appena fatto il check-in ti mando anche WiFi, regole e consigli sui dintorni:",
    infoMessageText: "Ecco WiFi, regole della casa e qualche consiglio sui dintorni per il tuo soggiorno:",
    indirizzo: 'Via Campania 36, Marcianise (CE)',
  },
  {
    nome: 'Secondo Piano',
    scia: 'altro',
    hasSelfCheckin: false,
    checkinGuideUrl: `${BASE_URL}/checkin/secondo-piano.html`,
    infoGuideUrl: `${BASE_URL}/checkin/secondo-piano-info.html`,
    emoji: '🏠',
    guideMessageText: "Ecco le info per arrivare — indirizzo e come entrare. Appena fatto il check-in ti mando anche WiFi, regole e consigli sui dintorni:",
    infoMessageText: "Ecco WiFi, regole della casa e qualche consiglio sui dintorni per il tuo soggiorno:",
    indirizzo: 'Via Campania 36, Marcianise (CE)',
  },
];

/** Nomi in ordine, per popolare i dropdown — stesso ordine/contenuto di sempre. */
export const NOMI_STRUTTURE = STRUTTURE.map((s) => s.nome);

export function getStruttura(nome: string): Struttura | undefined {
  return STRUTTURE.find((s) => s.nome === nome);
}

export function isStrutturaValida(nome: string): boolean {
  return STRUTTURE.some((s) => s.nome === nome);
}

/** "Il Tulipano" → struttura "Tulipano", "Stanza Rosa" → "Rosa", per il resto match esatto —
 *  serve perché `alloggi.nome` nel database usa il nome completo, questo elenco quello breve
 *  storico. Spostata qui il 20/09/2026 da /api/nuovo/dati/route.ts perché ora serve anche
 *  lato client (pulsante "Manda scheda WiFi/regole" in DettaglioPrenotazione). */
export function strutturaPerAlloggio(alloggioNome: string): Struttura | undefined {
  const esatto = getStruttura(alloggioNome);
  if (esatto) return esatto;
  return STRUTTURE.find((s) => alloggioNome.includes(s.nome));
}

/** 'tulipano' per Tulipano/Rosa (SCIA di Luigi Salzillo, Via Clanio 60), 'altro' per tutto il
 *  resto (Via Campania, intestatario non ancora confermato) — vedi DEFAULT_TULIPANO/DEFAULT_ALTRO
 *  nelle route che generano contratti/ricevute. Un nome non riconosciuto ricade su 'altro' (mai
 *  un default fiscale a un nome sconosciuto). */
export function getScia(nome: string): Scia {
  return getStruttura(nome)?.scia ?? 'altro';
}
