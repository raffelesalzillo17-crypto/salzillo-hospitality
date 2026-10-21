/**
 * Motore di regole per promemoria e messaggi (nucleo puro, senza database: si prova con i test).
 *
 * Modello preso da Guesty/Hospitable: una regola dice "quando succede EVENTO, dopo/prima di N
 * giorni, a una certa ORA, se la prenotazione rispetta i FILTRI, prepara questa AZIONE con questo
 * MODELLO di testo". Per ogni soggiorno e ogni regola esiste al massimo una attività pianificata
 * (identificata da regola + alloggio + data di check-in, che è unica tra le prenotazioni attive
 * grazie al vincolo anti-sovrapposizione).
 *
 * Comportamento voluto (come nei PMS professionali):
 *  - se una prenotazione cambia date, le attività non ancora fatte si RIPROGRAMMANO da sole;
 *  - se si cancella, quelle non ancora fatte si ANNULLANO; se si riattiva, tornano;
 *  - un'attività già fatta o saltata non viene mai riaperta;
 *  - se una regola nasce (o una prenotazione arriva) quando l'ora è già passata: se il momento
 *    "prima dell'evento" è ancora utile (es. messaggio di benvenuto e l'arrivo è oggi o dopo) diventa
 *    da fare subito, altrimenti viene SALTATA (niente messaggi fuori tempo massimo).
 *
 * Nessun messaggio parte da solo verso gli ospiti: l'azione produce un promemoria con il testo
 * già pronto (e il link WhatsApp precompilato); lo invia Raffaele con un tocco.
 */

export const EVENTI = ['Conferma prenotazione', 'Check-in', 'Check-out'] as const;
export type EventoRegola = (typeof EVENTI)[number];

export const AZIONI = ['Messaggio ospite', 'Promemoria per me'] as const;
export type AzioneRegola = (typeof AZIONI)[number];

export type StatoAttivita = 'Da fare' | 'Notificata' | 'Fatta' | 'Saltata' | 'Annullata';
export const STATI_APERTI: readonly StatoAttivita[] = ['Da fare', 'Notificata'];

export type Regola = {
  id: string;
  nome: string;
  attiva: boolean;
  evento: EventoRegola;
  /** Giorni rispetto all'evento: negativo = prima, 0 = lo stesso giorno, positivo = dopo. */
  offsetGiorni: number;
  /** Ora locale (Europe/Rome) in formato HH:MM. */
  ora: string;
  azione: AzioneRegola;
  /** Testo con segnaposto tra graffe: vedi `SEGNAPOSTO`. */
  modello: string;
  alloggioId: string | null;
  canale: string | null;
  minNotti: number | null;
};

export type Soggiorno = {
  prenotazioneId: string;
  alloggioId: string;
  alloggioNome: string;
  checkin: string;   // AAAA-MM-GG
  checkout: string;
  canale: string;
  ospiteNome: string;
  ospiteCognome: string;
  telefono: string | null;
  creatoIl: Date;
};

export type AttivitaEsistente = {
  id: string;
  regolaId: string;
  alloggioId: string;
  checkin: string;
  scadenza: Date;
  stato: StatoAttivita;
  testo: string;
};

export type Operazione =
  | {
    tipo: 'scrivi';
    /** Se presente aggiorna la riga esistente (anche per riaprirla), altrimenti la crea. */
    id?: string;
    regolaId: string; alloggioId: string; checkin: string; checkout: string;
    prenotazioneId: string; ospiteNome: string; telefono: string | null;
    scadenza: Date;
    /** Assente = lascia lo stato com'è (es. cambia solo il testo di un'attività già notificata). */
    stato?: 'Da fare' | 'Saltata'; testo: string; azione: AzioneRegola;
  }
  | { tipo: 'annulla'; id: string };

/** Segnaposto disponibili nei modelli di testo. */
export const SEGNAPOSTO = [
  'nome', 'cognome', 'alloggio', 'checkin', 'checkout', 'notti',
  'messaggio_guida', 'emoji', 'link_info', 'link_checkin',
] as const;

// ── Date e fuso orario (Europe/Rome) ─────────────────────────────────────────


export function aggiungiGiorni(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nottiTra(checkin: string, checkout: string): number {
  return Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 864e5);
}

const FORMATTA_ROMA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Rome', hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
});

function offsetRomaMinuti(istante: Date): number {
  const p = FORMATTA_ROMA.formatToParts(istante);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const comeUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second'));
  return Math.round((comeUtc - Math.floor(istante.getTime() / 1000) * 1000) / 60000);
}

/** L'istante (UTC) in cui in Italia sono le `hhmm` del giorno `iso`. */
export function istanteRoma(iso: string, hhmm: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  const [h, mi] = hhmm.split(':').map(Number);
  const ipotesi = Date.UTC(y, m - 1, d, h, mi);
  let off = offsetRomaMinuti(new Date(ipotesi));
  off = offsetRomaMinuti(new Date(ipotesi - off * 60000)); // seconda passata: cambio ora legale
  return new Date(ipotesi - off * 60000);
}

/** Data (AAAA-MM-GG) che in Italia corrisponde a quell'istante. */
export function dataRoma(istante: Date): string {
  const p = FORMATTA_ROMA.formatToParts(istante);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

/** Ultimo istante del giorno `iso` in Italia. */
export function fineGiornoRoma(iso: string): Date {
  return new Date(istanteRoma(aggiungiGiorni(iso, 1), '00:00').getTime() - 1);
}

// ── Regola → scadenza, filtri, testo ─────────────────────────────────────────

export function dataEvento(regola: Pick<Regola, 'evento'>, s: Pick<Soggiorno, 'checkin' | 'checkout' | 'creatoIl'>): string {
  if (regola.evento === 'Check-in') return s.checkin;
  if (regola.evento === 'Check-out') return s.checkout;
  return dataRoma(s.creatoIl);
}

export function scadenzaRegola(regola: Pick<Regola, 'evento' | 'offsetGiorni' | 'ora'>, s: Pick<Soggiorno, 'checkin' | 'checkout' | 'creatoIl'>): Date {
  return istanteRoma(aggiungiGiorni(dataEvento(regola, s), regola.offsetGiorni), regola.ora);
}

export function rispettaFiltri(regola: Regola, s: Soggiorno): boolean {
  if (!regola.attiva) return false;
  if (regola.alloggioId && regola.alloggioId !== s.alloggioId) return false;
  if (regola.canale && regola.canale !== s.canale) return false;
  if (regola.minNotti && nottiTra(s.checkin, s.checkout) < regola.minNotti) return false;
  return true;
}

export type ExtraSoggiorno = { messaggioGuida?: string; emoji?: string; linkInfo?: string; linkCheckin?: string };

const ggmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export function variabiliSoggiorno(s: Soggiorno, extra: ExtraSoggiorno = {}): Record<string, string> {
  return {
    nome: s.ospiteNome.trim(),
    cognome: s.ospiteCognome.trim(),
    alloggio: s.alloggioNome,
    checkin: ggmm(s.checkin),
    checkout: ggmm(s.checkout),
    notti: String(nottiTra(s.checkin, s.checkout)),
    messaggio_guida: extra.messaggioGuida ?? '',
    emoji: extra.emoji ?? '',
    link_info: extra.linkInfo ?? '',
    link_checkin: extra.linkCheckin ?? '',
  };
}

/** Sostituisce i segnaposto. `mancanti` elenca quelli sconosciuti o rimasti vuoti, ESCLUSO
 *  `emoji` (decorativo): un testo con segnaposto mancanti non va mai proposto così com'è. */
export function riempiModello(modello: string, vars: Record<string, string>): { testo: string; mancanti: string[] } {
  const mancanti: string[] = [];
  const testo = modello.replace(/\{([a-z_]+)\}/g, (_m, nome: string) => {
    const v = vars[nome];
    if (v === undefined || (v === '' && nome !== 'emoji')) { mancanti.push(nome); return ''; }
    return v;
  });
  return { testo: testo.replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n').trim(), mancanti };
}

// ── Pianificazione (cuore del motore) ────────────────────────────────────────

const chiave = (regolaId: string, alloggioId: string, checkin: string) => `${regolaId}|${alloggioId}|${checkin}`;
const aperta = (stato: StatoAttivita) => (STATI_APERTI as readonly string[]).includes(stato);

/**
 * Confronta ciò che le regole prescrivono oggi con le attività già pianificate e restituisce le
 * sole operazioni necessarie (idempotente: richiamata subito dopo, restituisce una lista vuota).
 *
 * `soggiorni` = prenotazioni che occupano l'alloggio (non cancellate). `regole` = tutte le regole,
 * attive e no: quelle disattivate fanno annullare le attività aperte che avevano generato.
 */
export function pianifica(opts: {
  regole: Regola[];
  soggiorni: Soggiorno[];
  esistenti: AttivitaEsistente[];
  adesso: Date;
  extra: (s: Soggiorno) => ExtraSoggiorno;
}): Operazione[] {
  const { regole, soggiorni, esistenti, adesso } = opts;
  const oggi = dataRoma(adesso);
  const perChiave = new Map(esistenti.map((e) => [chiave(e.regolaId, e.alloggioId, e.checkin), e]));
  const visitate = new Set<string>();
  const ops: Operazione[] = [];

  for (const regola of regole) {
    for (const s of soggiorni) {
      if (!rispettaFiltri(regola, s)) continue;
      const k = chiave(regola.id, s.alloggioId, s.checkin);
      const { testo, mancanti } = riempiModello(regola.modello, variabiliSoggiorno(s, opts.extra(s)));
      if (mancanti.length) continue; // es. alloggio senza link ospite: niente messaggio a metà
      visitate.add(k);

      const scadenza = scadenzaRegola(regola, s);
      const esistente = perChiave.get(k);
      const base = {
        regolaId: regola.id, alloggioId: s.alloggioId, checkin: s.checkin, checkout: s.checkout,
        prenotazioneId: s.prenotazioneId, ospiteNome: `${s.ospiteNome} ${s.ospiteCognome}`.trim(),
        telefono: s.telefono, testo, azione: regola.azione,
      };

      // Ancora utile se è un'azione "prima/durante" e l'evento non è passato (giorno incluso).
      const aTempoDopoRitardo = regola.offsetGiorni <= 0 && dataEvento(regola, s) >= oggi;

      if (!esistente || esistente.stato === 'Annullata') {
        if (scadenza.getTime() >= adesso.getTime()) {
          ops.push({ tipo: 'scrivi', id: esistente?.id, ...base, scadenza, stato: 'Da fare' });
        } else if (aTempoDopoRitardo) {
          ops.push({ tipo: 'scrivi', id: esistente?.id, ...base, scadenza: adesso, stato: 'Da fare' });
        } else {
          ops.push({ tipo: 'scrivi', id: esistente?.id, ...base, scadenza, stato: 'Saltata' });
        }
        continue;
      }
      if (!aperta(esistente.stato)) continue; // Fatta o Saltata: mai riaperte

      // Attività aperta: si riprogramma solo se la nuova scadenza è nel futuro e diversa; se è
      // già passata si lascia com'è (altrimenti ogni passaggio la riporterebbe indietro).
      const riprogramma = scadenza.getTime() >= adesso.getTime() && scadenza.getTime() !== esistente.scadenza.getTime();
      if (riprogramma || esistente.testo !== testo) {
        ops.push({
          tipo: 'scrivi', id: esistente.id, ...base,
          scadenza: riprogramma ? scadenza : esistente.scadenza,
          // spostata in avanti = si riavvisa: torna "Da fare" anche se era già stata notificata
          ...(riprogramma ? { stato: 'Da fare' as const } : {}),
        });
      }
    }
  }

  // Attività aperte che nessuna regola attiva/prenotazione attuale prescrive più.
  for (const e of esistenti) {
    if (aperta(e.stato) && !visitate.has(chiave(e.regolaId, e.alloggioId, e.checkin))) {
      ops.push({ tipo: 'annulla', id: e.id });
    }
  }
  return ops;
}
