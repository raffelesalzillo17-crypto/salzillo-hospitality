/**
 * Schema del database Salzillo Hospitality (Postgres, via Drizzle).
 *
 * Sostituisce Google Sheets come base dati — vedi
 * data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md e
 * data/wiki/sintesi/discovery-nuovo-sistema-salzillo-hospitality.md.
 *
 * REGOLE DI STILE (volute da Raffaele — "tutto leggibile da un umano"):
 *  - Nomi di tabella e colonna in italiano, minuscolo, con underscore.
 *  - Gli enum contengono le etichette come si leggono ("Airbnb", "Da inviare"), non codici.
 *  - Ogni riga ha un `id` interno (uuid) che NON si mostra mai nell'interfaccia: si vedono i nomi.
 *  - I codici ufficiali (Alloggiati Web) stanno solo nelle colonne che servono per trasmettere,
 *    mai in primo piano.
 *  - Gli importi delle prenotazioni si SALVANO al momento (commissione, cedolare, pulizia, fee):
 *    se il regime fiscale di un alloggio cambia, le prenotazioni vecchie non si toccano.
 */

import {
  pgTable, pgEnum, uuid, text, boolean, integer, numeric, date, timestamp, jsonb, unique,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────
// Enum (etichette leggibili, non codici)
// ─────────────────────────────────────────────────────────────────────────────

export const tipoProprietario = pgEnum('tipo_proprietario', ['Persona fisica', 'Società']);
export const regimeFiscale = pgEnum('regime_fiscale', ['Con cedolare', 'No tax']);
export const canale = pgEnum('canale', ['Airbnb', 'Booking', 'Diretto', 'No Tax']);
export const statoPrenotazione = pgEnum('stato_prenotazione', [
  'Attiva', 'In attesa di conferma', 'Cancellata', 'Cancellata con penale', 'No-show',
]);
export const tipoPagamento = pgEnum('tipo_pagamento', ['Caparra', 'Saldo', 'Rimborso']);
export const metodoPagamento = pgEnum('metodo_pagamento', ['Bonifico', 'Contanti', 'Carta', 'Piattaforma']);
export const statoSchedina = pgEnum('stato_schedina', ['Da inviare', 'Inviata', 'Errore']);
export const statoPreventivo = pgEnum('stato_preventivo', ['Bozza', 'Inviato', 'Accettato', 'Scaduto', 'Rifiutato']);
export const tipoDocumento = pgEnum('tipo_documento', [
  'Documento identità', 'Contratto ospite', 'Ricevuta', 'Preventivo', 'Conferma prenotazione',
  'Contratto gestione', 'Rendiconto', 'Ricevuta Alloggiati', 'Altro',
]);
export const ruoloUtente = pgEnum('ruolo_utente', ['Titolare', 'Collaboratore', 'Proprietario', 'Pulizie']);
export const ricorrenza = pgEnum('ricorrenza', ['Una tantum', 'Mensile', 'Semestrale', 'Annuale']);
export const valutazioneOspite = pgEnum('valutazione_ospite', ['Buono', 'Neutro', 'Problematico']);
export const tipoNotifica = pgEnum('tipo_notifica', [
  'Schedina da inviare', 'Pulizia da fare', 'Documento mancante', 'Scadenza vicina', 'Pagamento in sospeso',
]);
export const sesso = pgEnum('sesso', ['M', 'F']);

// Da dove nasce un record: 'Foglio' = importato/sincronizzato da Google Sheets (verrà
// riscritto ad ogni sync finché il foglio è la fonte viva); 'Database' = creato direttamente
// nel nuovo sistema, il sync NON lo tocca. Dopo il "flip" (fase 6) tutto diventa 'Database'.
export const origineRecord = pgEnum('origine_record', ['Foglio', 'Database']);

// Colonne comuni a (quasi) tutte le tabelle.
const base = {
  id: uuid('id').defaultRandom().primaryKey(),
  creato_il: timestamp('creato_il', { withTimezone: true }).defaultNow().notNull(),
  aggiornato_il: timestamp('aggiornato_il', { withTimezone: true }).defaultNow().notNull(),
};

// ─────────────────────────────────────────────────────────────────────────────
// Anagrafiche
// ─────────────────────────────────────────────────────────────────────────────

export const proprietari = pgTable('proprietari', {
  ...base,
  nome: text('nome').notNull(),
  tipo: tipoProprietario('tipo').notNull().default('Persona fisica'),
  codice_fiscale_piva: text('codice_fiscale_piva'),
  email: text('email'),
  telefono: text('telefono'),
  iban: text('iban'), // per i bonifici di rendicontazione
  note: text('note'),
});

export const contrattiGestione = pgTable('contratti_gestione', {
  ...base,
  proprietario_id: uuid('proprietario_id').notNull().references(() => proprietari.id),
  dal: date('dal').notNull(),
  al: date('al'), // null = ancora attivo
  percentuale_fee: numeric('percentuale_fee', { precision: 5, scale: 2 }).notNull().default('0'), // % sul lordo
  // Chi incassa dall'OTA per le prenotazioni di questo immobile (idea dai PMS professionali):
  direzione_incasso: text('direzione_incasso').notNull().default('Gestore'), // 'Gestore' | 'Proprietario'
  condizioni: text('condizioni'),
  documento_id: uuid('documento_id'), // FK a documenti, aggiunta dopo per evitare ciclo
});

export const immobili = pgTable('immobili', {
  ...base,
  proprietario_id: uuid('proprietario_id').notNull().references(() => proprietari.id),
  nome: text('nome').notNull(), // es. "Via Clanio 60"
  indirizzo: text('indirizzo').notNull(),
  comune: text('comune').notNull(),
  provincia: text('provincia').notNull(),
  cin: text('cin'),
  cir: text('cir'),
  calendar_id: text('calendar_id'), // un calendario Google per immobile (idea di Raffaele)
  note: text('note'),
});

export const alloggi = pgTable('alloggi', {
  ...base,
  immobile_id: uuid('immobile_id').notNull().references(() => immobili.id),
  nome: text('nome').notNull(), // es. "Il Tulipano"
  attivo: boolean('attivo').notNull().default(true),
  regime_fiscale: regimeFiscale('regime_fiscale').notNull().default('No tax'),
  costo_pulizia: numeric('costo_pulizia', { precision: 8, scale: 2 }).notNull().default('20'),
  ha_self_checkin: boolean('ha_self_checkin').notNull().default(false),
  checkin_guide_url: text('checkin_guide_url'),
  emoji: text('emoji'),
  wifi_ssid: text('wifi_ssid'),
  wifi_password: text('wifi_password'),
  messaggio_guida: text('messaggio_guida'),
  promemoria_pulizia: text('promemoria_pulizia'), // "cose da ricordare", non una checklist
  trasmette_alloggiati: boolean('trasmette_alloggiati').notNull().default(false),
  trasmette_regione: boolean('trasmette_regione').notNull().default(false), // Sinfonia (Campania) / ROSS1000
  // Imposta di soggiorno: comune che la richiede (null = non dovuta — es. Marcianise oggi),
  // importo per persona per notte, e tetto di notti tassabili (0/null = nessun tetto).
  imposta_soggiorno_comune: text('imposta_soggiorno_comune'),
  imposta_soggiorno_importo: numeric('imposta_soggiorno_importo', { precision: 6, scale: 2 }).notNull().default('0'),
  imposta_soggiorno_max_notti: integer('imposta_soggiorno_max_notti'),
});

export const ospiti = pgTable('ospiti', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  nome: text('nome').notNull(),
  cognome: text('cognome').notNull(),
  telefono: text('telefono'),
  email: text('email'),
  codice_fiscale: text('codice_fiscale'),
  valutazione: valutazioneOspite('valutazione').notNull().default('Neutro'),
  note: text('note'),
  note_import: text('note_import'), // per la migrazione: il "Nome" originale unico da Google Sheets
});

// ─────────────────────────────────────────────────────────────────────────────
// Prenotazioni e derivati
// ─────────────────────────────────────────────────────────────────────────────

export const prenotazioni = pgTable('prenotazioni', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  alloggio_id: uuid('alloggio_id').notNull().references(() => alloggi.id),
  ospite_id: uuid('ospite_id').notNull().references(() => ospiti.id), // il capofamiglia
  checkin: date('checkin').notNull(),
  checkout: date('checkout').notNull(),
  numero_ospiti: integer('numero_ospiti').notNull().default(1),
  canale: canale('canale').notNull(),
  codice_conferma_canale: text('codice_conferma_canale'), // codice prenotazione Airbnb/Booking
  // Importi FOTOGRAFATI al momento della prenotazione (non ricalcolati):
  lordo: numeric('lordo', { precision: 10, scale: 2 }).notNull(),
  commissione: numeric('commissione', { precision: 10, scale: 2 }).notNull().default('0'),
  cedolare: numeric('cedolare', { precision: 10, scale: 2 }).notNull().default('0'),
  costo_pulizia: numeric('costo_pulizia', { precision: 10, scale: 2 }).notNull().default('0'),
  fee_gestione: numeric('fee_gestione', { precision: 10, scale: 2 }).notNull().default('0'),
  utile: numeric('utile', { precision: 10, scale: 2 }).notNull().default('0'),
  netto_proprietario: numeric('netto_proprietario', { precision: 10, scale: 2 }).notNull().default('0'),
  stato: statoPrenotazione('stato').notNull().default('Attiva'),
  penale_importo: numeric('penale_importo', { precision: 10, scale: 2 }),
  calendar_event_id: text('calendar_event_id'),
  note: text('note'),
  creata_da: uuid('creata_da').references(() => utenti.id),
});

export const pagamenti = pgTable('pagamenti', {
  ...base,
  prenotazione_id: uuid('prenotazione_id').notNull().references(() => prenotazioni.id),
  tipo: tipoPagamento('tipo').notNull(),
  importo: numeric('importo', { precision: 10, scale: 2 }).notNull(),
  data: date('data').notNull(),
  metodo: metodoPagamento('metodo'),
  note: text('note'),
});

// Ospiti oltre al capofamiglia (raccolti col check-in online, servono per le schedine).
export const ospitiPrenotazione = pgTable('ospiti_prenotazione', {
  ...base,
  prenotazione_id: uuid('prenotazione_id').notNull().references(() => prenotazioni.id),
  ospite_id: uuid('ospite_id').notNull().references(() => ospiti.id),
}, (t) => ({
  unico: unique().on(t.prenotazione_id, t.ospite_id),
}));

export const schedine = pgTable('schedine', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  prenotazione_id: uuid('prenotazione_id').notNull().references(() => prenotazioni.id),
  ospite_id: uuid('ospite_id').notNull().references(() => ospiti.id),
  // Dati anagrafici come vanno trasmessi (l'interfaccia mostra i nomi, qui ci sono anche i codici)
  cognome: text('cognome').notNull(),
  nome: text('nome').notNull(),
  sesso: sesso('sesso'),
  data_nascita: date('data_nascita'),
  luogo_nascita: text('luogo_nascita'),
  comune_nascita_codice: text('comune_nascita_codice'),
  provincia_nascita: text('provincia_nascita'),
  stato_nascita: text('stato_nascita'),
  stato_nascita_codice: text('stato_nascita_codice'),
  cittadinanza: text('cittadinanza'),
  cittadinanza_codice: text('cittadinanza_codice'),
  tipo_documento: text('tipo_documento'),
  tipo_documento_codice: text('tipo_documento_codice'),
  numero_documento: text('numero_documento'),
  luogo_rilascio_documento: text('luogo_rilascio_documento'),
  tipo_alloggiato: text('tipo_alloggiato'), // es. "Ospite singolo", "Capofamiglia"
  tipo_alloggiato_codice: text('tipo_alloggiato_codice'),
  // Stato e scadenza
  stato: statoSchedina('stato').notNull().default('Da inviare'),
  scade_il: timestamp('scade_il', { withTimezone: true }), // check-in +6h (1 notte) / +24h (più lunghe)
  inviata_il: timestamp('inviata_il', { withTimezone: true }),
  esito_invio: text('esito_invio'),
  ricevuta_documento_id: uuid('ricevuta_documento_id'), // la ricevuta di trasmissione, conservata per sempre
});

export const documenti = pgTable('documenti', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  tipo: tipoDocumento('tipo').notNull(),
  nome: text('nome').notNull(),
  ospite_id: uuid('ospite_id').references(() => ospiti.id),
  prenotazione_id: uuid('prenotazione_id').references(() => prenotazioni.id),
  proprietario_id: uuid('proprietario_id').references(() => proprietari.id),
  drive_file_id: text('drive_file_id'),
  drive_url: text('drive_url'),
  mime: text('mime'),
  caricato_il: timestamp('caricato_il', { withTimezone: true }).defaultNow().notNull(),
});

export const pulizie = pgTable('pulizie', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  prenotazione_id: uuid('prenotazione_id').references(() => prenotazioni.id), // creata a ogni check-out
  alloggio_id: uuid('alloggio_id').notNull().references(() => alloggi.id),
  data: date('data').notNull(),
  addetto_id: uuid('addetto_id').references(() => utenti.id),
  confermata_il: timestamp('confermata_il', { withTimezone: true }), // "pulizia terminata, stanza pronta"
  note: text('note'),
});

// ─────────────────────────────────────────────────────────────────────────────
// Gestione
// ─────────────────────────────────────────────────────────────────────────────

export const categorieSpesa = pgTable('categorie_spesa', {
  ...base,
  nome: text('nome').notNull().unique(),
  attiva: boolean('attiva').notNull().default(true),
});

export const spese = pgTable('spese', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  immobile_id: uuid('immobile_id').references(() => immobili.id), // null = spesa generale
  categoria_id: uuid('categoria_id').notNull().references(() => categorieSpesa.id),
  data: date('data').notNull(),
  descrizione: text('descrizione').notNull(),
  importo: numeric('importo', { precision: 10, scale: 2 }).notNull(),
  metodo_pagamento: metodoPagamento('metodo_pagamento'),
  scontrino_documento_id: uuid('scontrino_documento_id').references(() => documenti.id),
  da_rimborsare_proprietario: boolean('da_rimborsare_proprietario').notNull().default(false),
  note: text('note'),
});

export const scadenze = pgTable('scadenze', {
  ...base,
  origine: origineRecord('origine').notNull().default('Database'),
  immobile_id: uuid('immobile_id').references(() => immobili.id), // null = generale
  titolo: text('titolo').notNull(),
  data_scadenza: date('data_scadenza').notNull(),
  ricorrenza: ricorrenza('ricorrenza').notNull().default('Una tantum'),
  note: text('note'),
  ultimo_completamento: date('ultimo_completamento'),
});

// Versamenti dell'imposta di soggiorno al comune (di solito trimestrali). Il dovuto si
// calcola dalle prenotazioni; qui si tiene traccia di quanto e quando è stato versato e
// della dichiarazione. Marcianise oggi non la richiede — la tabella c'è comunque pronta.
export const versamentiSoggiorno = pgTable('versamenti_soggiorno', {
  ...base,
  immobile_id: uuid('immobile_id').notNull().references(() => immobili.id),
  anno: integer('anno').notNull(),
  trimestre: integer('trimestre').notNull(), // 1-4
  importo_dovuto: numeric('importo_dovuto', { precision: 10, scale: 2 }).notNull().default('0'),
  importo_versato: numeric('importo_versato', { precision: 10, scale: 2 }),
  versato_il: date('versato_il'),
  dichiarazione_inviata_il: date('dichiarazione_inviata_il'),
  note: text('note'),
}, (t) => ({ unico: unique().on(t.immobile_id, t.anno, t.trimestre) }));

// Invii mensili al portale regionale (Sinfonia per la Campania): un file .txt per mese/
// immobile con le righe DDMMYYYY;codiceNazione;codiceProvincia;arrivi;partenze.
export const inviiRegione = pgTable('invii_regione', {
  ...base,
  immobile_id: uuid('immobile_id').notNull().references(() => immobili.id),
  anno: integer('anno').notNull(),
  mese: integer('mese').notNull(),
  generato_il: timestamp('generato_il', { withTimezone: true }),
  inviato_il: timestamp('inviato_il', { withTimezone: true }),
  contenuto_txt: text('contenuto_txt'), // il file generato, per riferimento
  note: text('note'),
}, (t) => ({ unico: unique().on(t.immobile_id, t.anno, t.mese) }));

// Calendari iCal esterni (Airbnb, Booking...) per ogni alloggio.
//  - IMPORT: si scaricano periodicamente e si confrontano con le prenotazioni nostre → si
//    segnalano i disallineamenti (una prenotazione OTA che non abbiamo, o viceversa).
//  - EXPORT: /api/ical/<alloggio>.ics pubblica le nostre prenotazioni attive; incollando
//    quell'URL in Airbnb/Booking le date vengono bloccate anche lì (evita il doppio
//    booking quando si registra una prenotazione diretta / No Tax).
export const calendariIcal = pgTable('calendari_ical', {
  ...base,
  alloggio_id: uuid('alloggio_id').notNull().references(() => alloggi.id),
  nome: text('nome').notNull(), // "Airbnb", "Booking", ...
  url: text('url').notNull(),
  attivo: boolean('attivo').notNull().default(true),
  ultimo_controllo: timestamp('ultimo_controllo', { withTimezone: true }),
  ultimo_esito: text('ultimo_esito'), // "ok" oppure il testo del disallineamento
}, (t) => ({ unico: unique().on(t.alloggio_id, t.nome) }));

export const rendiconti = pgTable('rendiconti', {
  ...base,
  proprietario_id: uuid('proprietario_id').notNull().references(() => proprietari.id),
  mese: integer('mese').notNull(), // 1-12
  anno: integer('anno').notNull(),
  documento_id: uuid('documento_id').references(() => documenti.id),
  totale_incassato: numeric('totale_incassato', { precision: 12, scale: 2 }).notNull().default('0'),
  totale_spese: numeric('totale_spese', { precision: 12, scale: 2 }).notNull().default('0'),
  netto_proprietario: numeric('netto_proprietario', { precision: 12, scale: 2 }).notNull().default('0'),
  stato: text('stato').notNull().default('In revisione'), // 'In revisione' | 'Pubblicato' | 'Pagato'
  inviato_il: timestamp('inviato_il', { withTimezone: true }),
}, (t) => ({
  unico: unique().on(t.proprietario_id, t.mese, t.anno),
}));

// Preventivi: la richiesta di disponibilità → offerta all'ospite. Quando è "Accettato"
// diventa una prenotazione vera (prenotazione_id). Il PDF si rigenera al volo dai campi.
export const preventivi = pgTable('preventivi', {
  ...base,
  codice: text('codice').notNull().unique(),          // "PR-0007", leggibile
  ospite_id: uuid('ospite_id').references(() => ospiti.id),
  alloggio_id: uuid('alloggio_id').notNull().references(() => alloggi.id),
  checkin: date('checkin').notNull(),
  checkout: date('checkout').notNull(),
  numero_ospiti: integer('numero_ospiti').notNull().default(1),
  prezzo_notte: numeric('prezzo_notte', { precision: 12, scale: 2 }),
  totale_pieno: numeric('totale_pieno', { precision: 12, scale: 2 }).notNull().default('0'),
  sconto: numeric('sconto', { precision: 12, scale: 2 }).notNull().default('0'),
  sconto_tipo: text('sconto_tipo').notNull().default('euro'), // 'euro' | 'percento'
  totale: numeric('totale', { precision: 12, scale: 2 }).notNull().default('0'),
  valido_ore: integer('valido_ore').notNull().default(24),
  note: text('note'),
  stato: statoPreventivo('stato').notNull().default('Bozza'),
  prenotazione_id: uuid('prenotazione_id').references(() => prenotazioni.id),
  inviato_il: timestamp('inviato_il', { withTimezone: true }),
  accettato_il: timestamp('accettato_il', { withTimezone: true }),
  creato_da: uuid('creato_da').references(() => utenti.id),
});

// Un invio al giorno del report notturno (dedup fra cron 5:30 e backup 5:20).
export const inviiReport = pgTable('invii_report', {
  giorno: date('giorno').primaryKey(),
  inviato_il: timestamp('inviato_il', { withTimezone: true }).defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Sistema (accessi, bot, notifiche)
// ─────────────────────────────────────────────────────────────────────────────

export const utenti = pgTable('utenti', {
  ...base,
  username: text('username').notNull().unique(),
  password_hash: text('password_hash').notNull(), // scrypt, come oggi
  nome: text('nome').notNull(),
  email: text('email'),
  ruolo: ruoloUtente('ruolo').notNull(),
  proprietario_id: uuid('proprietario_id').references(() => proprietari.id), // se ruolo = Proprietario
  attivo: boolean('attivo').notNull().default(true),
});

export const permessiImmobile = pgTable('permessi_immobile', {
  ...base,
  utente_id: uuid('utente_id').notNull().references(() => utenti.id),
  immobile_id: uuid('immobile_id').notNull().references(() => immobili.id),
  puo_vedere: boolean('puo_vedere').notNull().default(true),
  puo_vedere_finanziario: boolean('puo_vedere_finanziario').notNull().default(false),
  puo_modificare: boolean('puo_modificare').notNull().default(false),
}, (t) => ({
  unico: unique().on(t.utente_id, t.immobile_id),
}));

export const botState = pgTable('bot_state', {
  chat_id: text('chat_id').primaryKey(),
  stato: jsonb('stato').notNull(),
  aggiornato_il: timestamp('aggiornato_il', { withTimezone: true }).defaultNow().notNull(),
});

export const telegramLog = pgTable('telegram_log', {
  ...base,
  ts: timestamp('ts', { withTimezone: true }).notNull(),
  chat_id: text('chat_id').notNull(),
  ruolo: text('ruolo').notNull(), // 'user' | 'assistant'
  testo: text('testo').notNull(),
});

export const emailProcessate = pgTable('email_processate', {
  ...base,
  message_id: text('message_id').notNull().unique(),
  tipo: text('tipo').notNull(),
  data: timestamp('data', { withTimezone: true }).notNull(),
  esito: text('esito').notNull(),
});

export const notifiche = pgTable('notifiche', {
  ...base,
  tipo: tipoNotifica('tipo').notNull(),
  titolo: text('titolo').notNull(),
  prenotazione_id: uuid('prenotazione_id').references(() => prenotazioni.id),
  scadenza_id: uuid('scadenza_id').references(() => scadenze.id),
  schedina_id: uuid('schedina_id').references(() => schedine.id),
  scade_il: timestamp('scade_il', { withTimezone: true }),
  letta_il: timestamp('letta_il', { withTimezone: true }),
});
