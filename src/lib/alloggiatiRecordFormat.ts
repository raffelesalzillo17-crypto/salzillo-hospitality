// Formattazione del tracciato record a 168 caratteri per le "schedine" del Portale Alloggiati
// Web (Polizia di Stato). Tracciato ricostruito dal manuale ufficiale
// (manualewebsercices_alloggiatiweb.pdf, Centro Elettronico Nazionale, Rev.01 13/01/2022).
//
// PADDING VERIFICATO DAL SISTEMA REALE (08/09/2026): testato col metodo Test() del servizio
// (mai Send) usando codici reali scaricati dalle tabelle ufficiali (Marcianise, Italia, Carta
// d'identità) — risposta: schedineValide:1, esito:true, nessun errore. Il tracciato/padding
// qui sotto (testo → spazi a destra, numerico → zeri a sinistra) è quindi confermato corretto
// dal sistema stesso, non solo un'ipotesi. Vedi wiki/entita/salzillo-hospitality.md per i
// dettagli del test. Prima di usarlo per un invio REALE (Send, non ancora implementato — vedi
// src/lib/alloggiatiWebService.ts) resta comunque prudente ri-validare con dati veri via
// Test() ogni volta che cambia qualcosa nel tracciato.

export const SCHEDINA_RECORD_LENGTH = 168;

export type TipoAlloggiatoCodice = '16' | '17' | '18' | '19' | '20';

export type DatiSchedina = {
  /** Codice da Tabella Tipi_Alloggiato (16/17/18/19/20). */
  tipoAlloggiato: TipoAlloggiatoCodice;
  /** gg/mm/aaaa */
  dataArrivo: string;
  /** 1-30 (max 30gg per il tracciato) */
  numeroGiorniPermanenza: number;
  cognome: string;
  nome: string;
  /** 1 = M, 2 = F */
  sesso: '1' | '2';
  /** gg/mm/aaaa */
  dataNascita: string;
  /** Codice da Tabella Comuni — obbligatorio se nato in Italia. Responsabilità del chiamante
   *  stabilire se il nato-in-Italia si applica: qui non si prova a dedurlo dal codice Stato
   *  (non abbiamo confermato quale codice rappresenti "Italia" nella Tabella Stati reale). */
  comuneNascita?: string;
  /** Sigla provincia — obbligatorio se nato in Italia. */
  provinciaNascita?: string;
  /** Codice da Tabella Stati — sempre obbligatorio. */
  statoNascita: string;
  /** Codice da Tabella Stati — sempre obbligatorio. */
  cittadinanza: string;
  /** Codice da Tabella Documenti — obbligatorio per capofamiglia/singolo (tipo 16-18).
   *  Viene forzato a blank automaticamente per tipo 19-20, come richiesto dal tracciato. */
  tipoDocumento?: string;
  numeroDocumento?: string;
  /** Codice Stato o Comune. */
  luogoRilascioDocumento?: string;
};

type Allineamento = 'testo' | 'numerico';

type CampoSpec = {
  chiave: keyof DatiSchedina;
  nome: string;
  da: number;
  ampiezza: number;
  allineamento: Allineamento;
  obbligatorio: boolean;
};

// Offset "DA" 0-indexed, ampiezza in caratteri. Somma delle ampiezze = 168.
const CAMPI: CampoSpec[] = [
  { chiave: 'tipoAlloggiato', nome: 'Tipo Alloggiato', da: 0, ampiezza: 2, allineamento: 'numerico', obbligatorio: true },
  { chiave: 'dataArrivo', nome: 'Data Arrivo', da: 2, ampiezza: 10, allineamento: 'testo', obbligatorio: true },
  { chiave: 'numeroGiorniPermanenza', nome: 'Numero Giorni Permanenza', da: 12, ampiezza: 2, allineamento: 'numerico', obbligatorio: true },
  { chiave: 'cognome', nome: 'Cognome', da: 14, ampiezza: 50, allineamento: 'testo', obbligatorio: true },
  { chiave: 'nome', nome: 'Nome', da: 64, ampiezza: 30, allineamento: 'testo', obbligatorio: true },
  { chiave: 'sesso', nome: 'Sesso', da: 94, ampiezza: 1, allineamento: 'testo', obbligatorio: true },
  { chiave: 'dataNascita', nome: 'Data Nascita', da: 95, ampiezza: 10, allineamento: 'testo', obbligatorio: true },
  { chiave: 'comuneNascita', nome: 'Comune Nascita', da: 105, ampiezza: 9, allineamento: 'testo', obbligatorio: false },
  { chiave: 'provinciaNascita', nome: 'Provincia Nascita', da: 114, ampiezza: 2, allineamento: 'testo', obbligatorio: false },
  { chiave: 'statoNascita', nome: 'Stato Nascita', da: 116, ampiezza: 9, allineamento: 'testo', obbligatorio: true },
  { chiave: 'cittadinanza', nome: 'Cittadinanza', da: 125, ampiezza: 9, allineamento: 'testo', obbligatorio: true },
  { chiave: 'tipoDocumento', nome: 'Tipo Documento', da: 134, ampiezza: 5, allineamento: 'testo', obbligatorio: false },
  { chiave: 'numeroDocumento', nome: 'Numero Documento', da: 139, ampiezza: 20, allineamento: 'testo', obbligatorio: false },
  { chiave: 'luogoRilascioDocumento', nome: 'Luogo Rilascio Documento', da: 159, ampiezza: 9, allineamento: 'testo', obbligatorio: false },
];

// Sanity check statico sulla somma delle ampiezze — se qualcuno modifica CAMPI per errore,
// meglio un crash immediato e chiaro qui che una schedina silenziosamente sbagliata.
const SOMMA_AMPIEZZE = CAMPI.reduce((tot, c) => tot + c.ampiezza, 0);
if (SOMMA_AMPIEZZE !== SCHEDINA_RECORD_LENGTH) {
  throw new Error(
    `alloggiatiRecordFormat: somma ampiezze campi (${SOMMA_AMPIEZZE}) diversa da SCHEDINA_RECORD_LENGTH (${SCHEDINA_RECORD_LENGTH})`
  );
}

const DATA_REGEX = /^\d{2}\/\d{2}\/\d{4}$/;

/** Valida i dati SENZA formattare. Ritorna un array di errori (vuoto = valido). */
export function validateSchedina(dati: DatiSchedina): string[] {
  const errori: string[] = [];

  if (!['16', '17', '18', '19', '20'].includes(dati.tipoAlloggiato)) {
    errori.push(`Tipo Alloggiato non valido: "${dati.tipoAlloggiato}" (atteso 16/17/18/19/20)`);
  }
  if (!DATA_REGEX.test(dati.dataArrivo)) {
    errori.push(`Data Arrivo non in formato gg/mm/aaaa: "${dati.dataArrivo}"`);
  }
  if (!DATA_REGEX.test(dati.dataNascita)) {
    errori.push(`Data Nascita non in formato gg/mm/aaaa: "${dati.dataNascita}"`);
  }
  if (
    !Number.isInteger(dati.numeroGiorniPermanenza) ||
    dati.numeroGiorniPermanenza < 1 ||
    dati.numeroGiorniPermanenza > 30
  ) {
    errori.push(`Numero Giorni Permanenza fuori range 1-30: ${dati.numeroGiorniPermanenza}`);
  }
  if (dati.sesso !== '1' && dati.sesso !== '2') {
    errori.push(`Sesso non valido: "${dati.sesso}" (atteso 1=M o 2=F)`);
  }
  if (!dati.cognome.trim()) errori.push('Cognome mancante');
  if (!dati.nome.trim()) errori.push('Nome mancante');
  if (!dati.statoNascita.trim()) errori.push('Stato Nascita mancante (sempre obbligatorio)');
  if (!dati.cittadinanza.trim()) errori.push('Cittadinanza mancante (sempre obbligatorio)');

  const tipoDocRichiesto = dati.tipoAlloggiato === '16' || dati.tipoAlloggiato === '17' || dati.tipoAlloggiato === '18';
  if (tipoDocRichiesto && !dati.tipoDocumento?.trim()) {
    errori.push(`Tipo Documento mancante (obbligatorio per capofamiglia/singolo, tipo ${dati.tipoAlloggiato})`);
  }

  // Larghezza massima per campo — non tronchiamo mai in silenzio un dato legale.
  for (const campo of CAMPI) {
    const valore = (dati[campo.chiave] ?? '').toString();
    if (valore.length > campo.ampiezza) {
      errori.push(`${campo.nome} troppo lungo: ${valore.length} caratteri, massimo ${campo.ampiezza}`);
    }
  }

  return errori;
}

function padCampo(valore: string, ampiezza: number, allineamento: Allineamento): string {
  if (valore.length > ampiezza) {
    // Non dovrebbe mai arrivare qui se si è passati da validateSchedina() — vedi commento lì.
    throw new Error(`Valore "${valore}" più lungo dell'ampiezza consentita (${ampiezza})`);
  }
  const padLength = ampiezza - valore.length;
  const pad = allineamento === 'numerico' ? '0'.repeat(padLength) : ' '.repeat(padLength);
  return allineamento === 'numerico' ? pad + valore : valore + pad;
}

/**
 * Formatta una schedina come stringa di 168 caratteri secondo il tracciato Alloggiati Web.
 * Lancia un errore descrittivo (mai un dato troncato/sbagliato in silenzio) se i dati non
 * sono validi — chiamare prima validateSchedina() per un controllo esplicito senza eccezioni.
 */
export function formatSchedinaRecord(dati: DatiSchedina): string {
  const errori = validateSchedina(dati);
  if (errori.length > 0) {
    throw new Error(`formatSchedinaRecord: dati non validi — ${errori.join('; ')}`);
  }

  const tipo19o20 = dati.tipoAlloggiato === '19' || dati.tipoAlloggiato === '20';

  const valori: Record<string, string> = {
    tipoAlloggiato: dati.tipoAlloggiato,
    dataArrivo: dati.dataArrivo,
    numeroGiorniPermanenza: String(dati.numeroGiorniPermanenza),
    cognome: dati.cognome,
    nome: dati.nome,
    sesso: dati.sesso,
    dataNascita: dati.dataNascita,
    comuneNascita: dati.comuneNascita ?? '',
    provinciaNascita: dati.provinciaNascita ?? '',
    statoNascita: dati.statoNascita,
    cittadinanza: dati.cittadinanza,
    // Tracciato: "blank per 19-20" — forziamo il blank qui anche se il chiamante ha passato
    // qualcosa, per non rischiare un campo documento popolato dove il tracciato lo vuole vuoto.
    tipoDocumento: tipo19o20 ? '' : dati.tipoDocumento ?? '',
    numeroDocumento: tipo19o20 ? '' : dati.numeroDocumento ?? '',
    luogoRilascioDocumento: tipo19o20 ? '' : dati.luogoRilascioDocumento ?? '',
  };

  const record = CAMPI.map((campo) => padCampo(valori[campo.chiave] ?? '', campo.ampiezza, campo.allineamento)).join('');

  if (record.length !== SCHEDINA_RECORD_LENGTH) {
    // Non dovrebbe mai succedere dato il sanity check statico sopra — ma se succede, meglio
    // saperlo subito invece di spedire una riga della lunghezza sbagliata.
    throw new Error(`formatSchedinaRecord: lunghezza record ${record.length}, attesi ${SCHEDINA_RECORD_LENGTH}`);
  }

  return record;
}
