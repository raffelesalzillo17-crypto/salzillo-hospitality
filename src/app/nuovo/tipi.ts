
export type Prenotazione = {
  id: string; checkin: string; checkout: string; ospite: string; ospiteId: string; telefono: string;
  alloggio: string; immobile: string; proprietario: string; canale: string;
  lordo: number; commissione: number; cedolare: number; costoPulizia: number; feeGestione: number;
  utile: number; nettoProprietario: number; stato: string; numeroOspiti: number; origine: string; penaleImporto: number | null; note: string;
  checkinConfermatoIl: string | null; waCheckinNumero: string | null; waCheckinMessaggio: string | null;
  documentiIdentita: number;
  pagamenti: { id: string; tipo: string; importo: number; data: string; metodo: string | null }[];
  schedine: { id: string; cognome: string; nome: string; tipoDocumento: string; numeroDocumento: string; rapporto: string; stato: string; creatoIl: string }[];
};

export type Pulizia = {
  id: string; data: string; alloggioId: string; alloggio: string; confermataIl: string | null; note: string | null;
  origine: string; addettoNome: string | null; prenotazioneId: string | null; pagata: boolean; importo: string | null;
};

export type Operatore = { id: string; nome: string };

export type DocumentoCaricato = { id: string; tipo: string; nome: string; ospiteId: string | null; prenotazioneId: string | null; proprietarioId: string | null; driveUrl: string | null; caricatoIl: string };

export type UtenteAdmin = { id: string; nome: string; ruolo: string; username: string | null; codiceInvito: string | null; attivo: boolean; proprietarioId: string | null };

export type Permesso = { utente_id: string; immobile_id: string; puo_vedere: boolean; puo_modificare: boolean; puo_vedere_finanziario: boolean };

export type Alloggio = {
  id: string; nome: string; attivo: boolean; regimeFiscale: string; costoPulizia: string;
  emoji: string | null; wifiSsid: string | null; immobile: string; indirizzo: string;
  trasmetteAlloggiati: boolean; impostaSoggiornoComune: string | null;
};

export type Ospite = { id: string; nome: string; cognome: string; telefono: string | null; email: string | null; codice_fiscale: string | null; valutazione: string; note: string | null };

export type RigaMese = { immobile: string; proprietario: string; prenotazioni: number; lordo: number; utile: number; nettoProprietario: number };

export type AlloggioDb = {
  id: string; nome: string; regime_fiscale: string; costo_pulizia: string; attivo: boolean;
  emoji: string | null; wifi_ssid: string | null; wifi_password: string | null;
  trasmette_alloggiati: boolean; trasmette_regione: boolean;
  imposta_soggiorno_comune: string | null; imposta_soggiorno_importo: string;
};

export type Anagrafica = {
  id: string; nome: string; email: string | null; telefono: string | null; iban: string | null;
  immobili: { id: string; nome: string; indirizzo: string; comune: string; provincia: string; cin: string | null; alloggi: AlloggioDb[] }[];
}[];

export type Scadenza = { id: string; titolo: string; ente: string | null; dataScadenza: string; ricorrenza: string; note: string | null; ultimoCompletamento: string | null; immobile: string | null };

export type Spesa = { id: string; data: string; descrizione: string; importo: string; categoria: string; immobile: string | null; note: string | null };

export type CosaManca = {
  schedineDaInviare: { id: string; cognome: string; nome: string; scadeIl: string | null; alloggio: string }[];
  scadenzeVicine: { id: string; titolo: string; dataScadenza: string; immobile: string | null }[];
  pulizieDaFare: { id: string; data: string; alloggio: string }[];
  pagamentiInSospeso: { id: string; ospite: string; checkin: string; lordo: string; alloggio: string }[];
};

export type SchedinaAlloggiati = {
  id: string; cognome: string; nome: string; ospiteNomeCompleto: string;
  alloggioNome: string; prenotazioneId: string; checkin: string; checkout: string; canale: string;
};

export type SchedinaDaVerificare = {
  id: string; cognome: string; nome: string; stato: 'In invio' | 'Errore';
  esitoInvio: string | null; prenotazioneId: string; checkin: string; alloggioNome: string;
};

export type Preventivo = {
  id: string; codice: string; stato: 'Bozza' | 'Inviato' | 'Accettato' | 'Scaduto' | 'Rifiutato';
  checkin: string; checkout: string; numeroOspiti: number;
  prezzoNotte: string | null; totalePieno: string; sconto: string; scontoTipo: string; totale: string;
  validoOre: number; note: string | null;
  creatoIl: string; inviatoIl: string | null; accettatoIl: string | null; prenotazioneId: string | null;
  alloggioId: string; alloggio: string; immobile: string;
  ospiteId: string | null; ospiteNome: string | null; ospiteCognome: string | null; ospiteTelefono: string | null;
};

export type Richiesta = {
  id: string; checkin: string; checkout: string; numeroOspiti: number; nome: string; telefono: string;
  note: string | null; creatoIl: string; alloggioId: string; alloggio: string;
};

export type Dati = {
  ok: boolean; oggi: string; prenotazioni: Prenotazione[]; ospiti: Ospite[];
  anagrafica: Anagrafica; alloggi: Alloggio[]; spese: Spesa[]; scadenze: Scadenza[];
  riepilogoMese: RigaMese[]; cosaManca: CosaManca; preventivi?: Preventivo[]; pulizie?: Pulizia[];
  richieste?: Richiesta[];
  operatoriPulizie?: Operatore[]; utenti?: UtenteAdmin[]; permessi?: Permesso[]; documenti?: DocumentoCaricato[];
  schedineAlloggiati?: SchedinaAlloggiati[];
  schedineDaVerificare?: SchedinaDaVerificare[];
  categorieSpesa?: { id: string; nome: string }[];
  eventi?: { id: string; titolo: string; dal: string; al: string; comune: string | null; impatto: string; note: string | null }[];
  prezzi?: { id: string; dal: string; al: string; prezzoNotte: string; note: string | null; alloggioId: string | null; alloggio: string | null }[];
  blocchi?: { id: string; alloggioId: string; alloggio: string; checkin: string; checkout: string; nota: string | null }[];
  linkUtili?: LinkUtile[];
  promemoria?: Promemoria;
};

export type LinkUtile = { id: string; titolo: string; url: string; descrizione: string | null; ordine: number };

export type SintesiMese = { anno: number; mese: number; prenotazioni: number; lordo: number; nettoProprietario: number };

export type Rendiconto = {
  proprietario: string; anno: number; mese: number;
  ambito: { etichetta: string; tipo: 'tutto' | 'immobile' | 'alloggio'; immobileId: string | null; alloggioId: string | null };
  righe: { id: string; checkin: string; checkout: string; alloggio: string; immobile: string; canale: string;
    ospite: string; lordo: string; commissione: string; cedolare: string; costoPulizia: string;
    feeGestione: string; utile: string; nettoProprietario: string }[];
  spese: { id: string; data: string; descrizione: string; importo: string; categoria: string; immobile: string }[];
  totali: { lordo: number; commissione: number; cedolare: number; costoPulizia: number; feeGestione: number;
    utile: number; nettoProprietario: number; totSpese: number; nettoFinale: number; impostaSoggiorno: number; numPrenotazioni: number };
  confronti: {
    meseScorso: SintesiMese; annoScorso: SintesiMese;
    previsione: { anno: number; mese: number; acquisito: Omit<SintesiMese, 'anno' | 'mese'>; annoScorso: Omit<SintesiMese, 'anno' | 'mese'> };
  };
};

export type Campo = { k: string; label: string; tipo?: 'text' | 'number' | 'date' | 'select' | 'checkbox' | 'textarea'; opzioni?: { v: string; t: string }[]; req?: boolean };

// ── Tema chiaro/scuro ──────────────────────────────────────────────────────
export type Tema = 'auto' | 'light' | 'dark';

// ── Sezione Calendario: griglia + Prezzi + Eventi ──────────────────────────
export type EventoLoc = { id: string; titolo: string; dal: string; al: string; comune: string | null; impatto: string; note: string | null };

export type PrezzoPer = { id: string; dal: string; al: string; prezzoNotte: string; note: string | null; alloggioId: string | null; alloggio: string | null };

export type Blocco = { id: string; alloggioId: string; alloggio: string; checkin: string; checkout: string; nota: string | null };

export type DatiSch = {
  cognome: string; nome: string; sesso: string; dataNascita: string; luogoNascita: string; statoNascita: string;
  cittadinanza: string; tipoDocumento: string; numeroDocumento: string; luogoRilascioDocumento: string;
  tipoAlloggiatoCodice: string; comuneNascitaCodice: string;
};

export type TabelleAll = { stati: { codice: string; nome: string }[]; comuni: { codice: string; nome: string; provincia: string }[] };

export type AttivitaPromemoria = {
  id: string; regolaId: string; regola: string; azione: string; alloggio: string; checkin: string; checkout: string;
  ospite: string; scadenza: string; stato: string; testo: string; linkWhatsapp: string | null; fattaIl: string | null;
};
export type RegolaPromemoria = {
  id: string; nome: string; attiva: boolean; evento: string; offsetGiorni: number; ora: string;
  azione: string; modello: string; alloggioId: string | null; canale: string | null; minNotti: number | null;
};
export type Promemoria = { aperte: AttivitaPromemoria[]; chiuse: AttivitaPromemoria[]; regole: RegolaPromemoria[] };
