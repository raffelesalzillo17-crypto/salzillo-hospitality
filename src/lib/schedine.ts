// Costanti condivise tra la route API (src/app/api/schedine/route.ts) e il componente
// (src/components/SchedineManager.tsx) per le "schedine" ospite — i dati richiesti dal
// Portale Alloggiati Web (Polizia di Stato) e da Sinfonia Turismo Smart (Regione Campania),
// raccolti qui SOLO in preparazione: nessun invio automatico ai portali reali (vedi
// SchedineManager per l'avviso mostrato in UI — decisione esplicita di Raffaele, notte del
// 07/09/2026, l'invio vero si attiva un altro giorno con un test supervisionato).
//
// Ricalca lo schema standard richiesto dal Portale Alloggiati Web. Non è stato trovato un
// template "Alloggiati web" nel foglio Google live (SalzilloFlow_2026, ID
// 11h0EzkcmK5yIKP5JLZWPXdPXrmTSoAhxVDqeR8SZNys) — la scheda omonima risulta esistita solo
// nell'export .xlsx originale di HostFlow_2026 (vedi wiki/sintesi/hostflow-tulipano.md),
// non migrata. Usato quindi lo schema standard indicato nella richiesta.
//
// Schema scheda "SCHEDINE" (riga 1 = intestazioni, colonne A-U), una riga per ospite/soggiorno:
//   A DataArrivo               — DD/MM/YYYY
//   B Notti
//   C Stanza
//   D Cognome
//   E Nome
//   F DataNascita              — DD/MM/YYYY
//   G LuogoNascita             — descrizione leggibile (per l'operatore), non il codice ufficiale
//   H Cittadinanza             — descrizione leggibile, non il codice ufficiale
//   I TipoDocumento            — es. "Carta d'identità" / "Passaporto"
//   J NumeroDocumento
//   K RapportoConCapofamiglia  — "Capofamiglia" per il primo ospite, altrimenti "Familiare/Ospite"
//   L Stato                    — "Da inviare" (default) oppure "Inviato manualmente"
//   M PrenotazioneRow          — il campo `row` della prenotazione collegata (per incrocio)
//   N Sesso                    — "M" / "F" (aggiunto 09/09/2026, allineamento al tracciato reale)
//   O TipoAlloggiatoCodice     — 16/17/18/19/20, vedi src/lib/alloggiatiTabelle.ts
//   P ComuneNascitaCodice      — valorizzato solo se nato in Italia
//   Q ProvinciaNascita         — sigla, valorizzata solo se nato in Italia
//   R StatoNascitaCodice       — sempre valorizzato (codice Tabella Stati, es. ITALIA=100000100)
//   S CittadinanzaCodice       — sempre valorizzato (codice Tabella Stati)
//   T TipoDocumentoCodice      — codice Tabella Documenti (es. IDENT/PASOR/PATEN)
//   U LuogoRilascioDocumento   — testo libero (comune o stato di rilascio)
//
// Le colonne N-U sono state aggiunte il 09/09/2026 per allineare il tracciato al vero schema
// di Alloggiati Web (src/lib/alloggiatiRecordFormat.ts) — prima il form/la scheda usavano una
// versione semplificata comoda per l'inserimento manuale (Raffaele sceglieva i valori giusti
// direttamente sul portale reale), ma insufficiente per un'eventuale generazione automatica
// (file Sinfonia, futuro invio Alloggiati). Aggiunte in coda, mai in mezzo, per non rompere le
// righe già scritte prima di questa data (restano valide, semplicemente con le colonne nuove
// vuote).

export const SCHEDINE_SHEET_NAME = 'SCHEDINE';

export const SCHEDINE_HEADERS = [
  'DataArrivo',
  'Notti',
  'Stanza',
  'Cognome',
  'Nome',
  'DataNascita',
  'LuogoNascita',
  'Cittadinanza',
  'TipoDocumento',
  'NumeroDocumento',
  'RapportoConCapofamiglia',
  'Stato',
  'PrenotazioneRow',
  'Sesso',
  'TipoAlloggiatoCodice',
  'ComuneNascitaCodice',
  'ProvinciaNascita',
  'StatoNascitaCodice',
  'CittadinanzaCodice',
  'TipoDocumentoCodice',
  'LuogoRilascioDocumento',
];

export const COL_DATA_ARRIVO = 0;
export const COL_NOTTI = 1;
export const COL_STANZA = 2;
export const COL_COGNOME = 3;
export const COL_NOME = 4;
export const COL_DATA_NASCITA = 5;
export const COL_LUOGO_NASCITA = 6;
export const COL_CITTADINANZA = 7;
export const COL_TIPO_DOCUMENTO = 8;
export const COL_NUMERO_DOCUMENTO = 9;
export const COL_RAPPORTO = 10;
export const COL_STATO = 11;
export const COL_PRENOTAZIONE_ROW = 12;
export const COL_SESSO = 13;
export const COL_TIPO_ALLOGGIATO_CODICE = 14;
export const COL_COMUNE_NASCITA_CODICE = 15;
export const COL_PROVINCIA_NASCITA = 16;
export const COL_STATO_NASCITA_CODICE = 17;
export const COL_CITTADINANZA_CODICE = 18;
export const COL_TIPO_DOCUMENTO_CODICE = 19;
export const COL_LUOGO_RILASCIO_DOCUMENTO = 20;
export const SCHEDINE_NUM_COLS = COL_LUOGO_RILASCIO_DOCUMENTO + 1; // 21 (A..U)

export const STATO_DA_INVIARE = 'Da inviare';
export const STATO_INVIATO_MANUALMENTE = 'Inviato manualmente';

export const RAPPORTO_CAPOFAMIGLIA = 'Capofamiglia';
export const RAPPORTO_OSPITE = 'Familiare/Ospite';

export const TIPI_DOCUMENTO = ["Carta d'identità", 'Passaporto', 'Patente'] as const;

export type Schedina = {
  row: number;
  dataArrivo: string; // DD/MM/YYYY
  notti: string;
  stanza: string;
  cognome: string;
  nome: string;
  dataNascita: string; // DD/MM/YYYY
  luogoNascita: string;
  cittadinanza: string;
  tipoDocumento: string;
  numeroDocumento: string;
  rapporto: string;
  stato: string;
  prenotazioneRow: string;
  // Campi aggiunti il 09/09/2026 per allinearsi al tracciato reale — vuoti per le righe scritte
  // prima di quella data, sempre presenti (anche se vuoti) per quelle scritte dal check-in pubblico.
  sesso: string; // "M" | "F" | ""
  tipoAlloggiatoCodice: string; // 16/17/18/19/20
  comuneNascitaCodice: string;
  provinciaNascita: string;
  statoNascitaCodice: string;
  cittadinanzaCodice: string;
  tipoDocumentoCodice: string;
  luogoRilascioDocumento: string;
};

// Testo pronto da copiare (pulsante "Copia dati") per l'inserimento manuale nel vero
// Portale Alloggiati Web — nessuna chiamata automatica, solo formattazione per l'operatore umano.
export function formattaSchedinaPerCopia(s: Schedina): string {
  const righe = [
    `Arrivo: ${s.dataArrivo}  ·  Notti: ${s.notti}  ·  Stanza: ${s.stanza}`,
    `Cognome: ${s.cognome}`,
    `Nome: ${s.nome}`,
    s.sesso && `Sesso: ${s.sesso}`,
    `Data di nascita: ${s.dataNascita}`,
    `Luogo di nascita: ${s.luogoNascita}`,
    `Cittadinanza: ${s.cittadinanza}`,
    `Tipo documento: ${s.tipoDocumento}`,
    `Numero documento: ${s.numeroDocumento}`,
    s.luogoRilascioDocumento && `Luogo di rilascio: ${s.luogoRilascioDocumento}`,
    `Rapporto con il capofamiglia: ${s.rapporto}`,
  ].filter(Boolean);
  return righe.join('\n');
}
