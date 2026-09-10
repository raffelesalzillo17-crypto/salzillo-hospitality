CREATE TYPE "public"."canale" AS ENUM('Airbnb', 'Booking', 'Diretto', 'No Tax');--> statement-breakpoint
CREATE TYPE "public"."metodo_pagamento" AS ENUM('Bonifico', 'Contanti', 'Carta', 'Piattaforma');--> statement-breakpoint
CREATE TYPE "public"."regime_fiscale" AS ENUM('Con cedolare', 'No tax');--> statement-breakpoint
CREATE TYPE "public"."ricorrenza" AS ENUM('Una tantum', 'Mensile', 'Semestrale', 'Annuale');--> statement-breakpoint
CREATE TYPE "public"."ruolo_utente" AS ENUM('Titolare', 'Collaboratore', 'Proprietario', 'Pulizie');--> statement-breakpoint
CREATE TYPE "public"."sesso" AS ENUM('M', 'F');--> statement-breakpoint
CREATE TYPE "public"."stato_prenotazione" AS ENUM('Attiva', 'In attesa di conferma', 'Cancellata', 'Cancellata con penale', 'No-show');--> statement-breakpoint
CREATE TYPE "public"."stato_schedina" AS ENUM('Da inviare', 'Inviata', 'Errore');--> statement-breakpoint
CREATE TYPE "public"."tipo_documento" AS ENUM('Documento identità', 'Contratto ospite', 'Ricevuta', 'Preventivo', 'Conferma prenotazione', 'Contratto gestione', 'Rendiconto', 'Ricevuta Alloggiati', 'Altro');--> statement-breakpoint
CREATE TYPE "public"."tipo_notifica" AS ENUM('Schedina da inviare', 'Pulizia da fare', 'Documento mancante', 'Scadenza vicina', 'Pagamento in sospeso');--> statement-breakpoint
CREATE TYPE "public"."tipo_pagamento" AS ENUM('Caparra', 'Saldo', 'Rimborso');--> statement-breakpoint
CREATE TYPE "public"."tipo_proprietario" AS ENUM('Persona fisica', 'Società');--> statement-breakpoint
CREATE TYPE "public"."valutazione_ospite" AS ENUM('Buono', 'Neutro', 'Problematico');--> statement-breakpoint
CREATE TABLE "alloggi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"immobile_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"attivo" boolean DEFAULT true NOT NULL,
	"regime_fiscale" "regime_fiscale" DEFAULT 'No tax' NOT NULL,
	"costo_pulizia" numeric(8, 2) DEFAULT '20' NOT NULL,
	"ha_self_checkin" boolean DEFAULT false NOT NULL,
	"checkin_guide_url" text,
	"emoji" text,
	"wifi_ssid" text,
	"wifi_password" text,
	"messaggio_guida" text,
	"promemoria_pulizia" text,
	"trasmette_alloggiati" boolean DEFAULT false NOT NULL,
	"imposta_soggiorno_comune" text,
	"calendar_id" text
);
--> statement-breakpoint
CREATE TABLE "bot_state" (
	"chat_id" text PRIMARY KEY NOT NULL,
	"stato" jsonb NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorie_spesa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"attiva" boolean DEFAULT true NOT NULL,
	CONSTRAINT "categorie_spesa_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
CREATE TABLE "contratti_gestione" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"proprietario_id" uuid NOT NULL,
	"dal" date NOT NULL,
	"al" date,
	"percentuale_fee" numeric(5, 2) DEFAULT '0' NOT NULL,
	"condizioni" text,
	"documento_id" uuid
);
--> statement-breakpoint
CREATE TABLE "documenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" "tipo_documento" NOT NULL,
	"nome" text NOT NULL,
	"ospite_id" uuid,
	"prenotazione_id" uuid,
	"proprietario_id" uuid,
	"drive_file_id" text,
	"drive_url" text,
	"mime" text,
	"caricato_il" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_processate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"message_id" text NOT NULL,
	"tipo" text NOT NULL,
	"data" timestamp with time zone NOT NULL,
	"esito" text NOT NULL,
	CONSTRAINT "email_processate_message_id_unique" UNIQUE("message_id")
);
--> statement-breakpoint
CREATE TABLE "immobili" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"proprietario_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"indirizzo" text NOT NULL,
	"comune" text NOT NULL,
	"provincia" text NOT NULL,
	"cin" text,
	"cir" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "notifiche" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"tipo" "tipo_notifica" NOT NULL,
	"titolo" text NOT NULL,
	"prenotazione_id" uuid,
	"scadenza_id" uuid,
	"schedina_id" uuid,
	"scade_il" timestamp with time zone,
	"letta_il" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ospiti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"cognome" text NOT NULL,
	"telefono" text,
	"email" text,
	"codice_fiscale" text,
	"valutazione" "valutazione_ospite" DEFAULT 'Neutro' NOT NULL,
	"note" text,
	"note_import" text
);
--> statement-breakpoint
CREATE TABLE "ospiti_prenotazione" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"prenotazione_id" uuid NOT NULL,
	"ospite_id" uuid NOT NULL,
	CONSTRAINT "ospiti_prenotazione_prenotazione_id_ospite_id_unique" UNIQUE("prenotazione_id","ospite_id")
);
--> statement-breakpoint
CREATE TABLE "pagamenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"prenotazione_id" uuid NOT NULL,
	"tipo" "tipo_pagamento" NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"data" date NOT NULL,
	"metodo" "metodo_pagamento",
	"note" text
);
--> statement-breakpoint
CREATE TABLE "permessi_immobile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"utente_id" uuid NOT NULL,
	"immobile_id" uuid NOT NULL,
	"puo_vedere" boolean DEFAULT true NOT NULL,
	"puo_vedere_finanziario" boolean DEFAULT false NOT NULL,
	"puo_modificare" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permessi_immobile_utente_id_immobile_id_unique" UNIQUE("utente_id","immobile_id")
);
--> statement-breakpoint
CREATE TABLE "prenotazioni" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"alloggio_id" uuid NOT NULL,
	"ospite_id" uuid NOT NULL,
	"checkin" date NOT NULL,
	"checkout" date NOT NULL,
	"numero_ospiti" integer DEFAULT 1 NOT NULL,
	"canale" "canale" NOT NULL,
	"codice_conferma_canale" text,
	"lordo" numeric(10, 2) NOT NULL,
	"commissione" numeric(10, 2) DEFAULT '0' NOT NULL,
	"cedolare" numeric(10, 2) DEFAULT '0' NOT NULL,
	"costo_pulizia" numeric(10, 2) DEFAULT '0' NOT NULL,
	"fee_gestione" numeric(10, 2) DEFAULT '0' NOT NULL,
	"utile" numeric(10, 2) DEFAULT '0' NOT NULL,
	"netto_proprietario" numeric(10, 2) DEFAULT '0' NOT NULL,
	"stato" "stato_prenotazione" DEFAULT 'Attiva' NOT NULL,
	"penale_importo" numeric(10, 2),
	"calendar_event_id" text,
	"note" text,
	"creata_da" uuid
);
--> statement-breakpoint
CREATE TABLE "proprietari" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"nome" text NOT NULL,
	"tipo" "tipo_proprietario" DEFAULT 'Persona fisica' NOT NULL,
	"codice_fiscale_piva" text,
	"email" text,
	"telefono" text,
	"iban" text,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "pulizie" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"prenotazione_id" uuid,
	"alloggio_id" uuid NOT NULL,
	"data" date NOT NULL,
	"addetto_id" uuid,
	"confermata_il" timestamp with time zone,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "rendiconti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"proprietario_id" uuid NOT NULL,
	"mese" integer NOT NULL,
	"anno" integer NOT NULL,
	"documento_id" uuid,
	"totale_incassato" numeric(12, 2) DEFAULT '0' NOT NULL,
	"totale_spese" numeric(12, 2) DEFAULT '0' NOT NULL,
	"netto_proprietario" numeric(12, 2) DEFAULT '0' NOT NULL,
	"inviato_il" timestamp with time zone,
	CONSTRAINT "rendiconti_proprietario_id_mese_anno_unique" UNIQUE("proprietario_id","mese","anno")
);
--> statement-breakpoint
CREATE TABLE "scadenze" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"immobile_id" uuid,
	"titolo" text NOT NULL,
	"data_scadenza" date NOT NULL,
	"ricorrenza" "ricorrenza" DEFAULT 'Una tantum' NOT NULL,
	"note" text,
	"ultimo_completamento" date
);
--> statement-breakpoint
CREATE TABLE "schedine" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"prenotazione_id" uuid NOT NULL,
	"ospite_id" uuid NOT NULL,
	"cognome" text NOT NULL,
	"nome" text NOT NULL,
	"sesso" "sesso",
	"data_nascita" date,
	"luogo_nascita" text,
	"comune_nascita_codice" text,
	"provincia_nascita" text,
	"stato_nascita" text,
	"stato_nascita_codice" text,
	"cittadinanza" text,
	"cittadinanza_codice" text,
	"tipo_documento" text,
	"tipo_documento_codice" text,
	"numero_documento" text,
	"luogo_rilascio_documento" text,
	"tipo_alloggiato" text,
	"tipo_alloggiato_codice" text,
	"stato" "stato_schedina" DEFAULT 'Da inviare' NOT NULL,
	"scade_il" timestamp with time zone,
	"inviata_il" timestamp with time zone,
	"esito_invio" text,
	"ricevuta_documento_id" uuid
);
--> statement-breakpoint
CREATE TABLE "spese" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"immobile_id" uuid,
	"categoria_id" uuid NOT NULL,
	"data" date NOT NULL,
	"descrizione" text NOT NULL,
	"importo" numeric(10, 2) NOT NULL,
	"metodo_pagamento" "metodo_pagamento",
	"scontrino_documento_id" uuid,
	"da_rimborsare_proprietario" boolean DEFAULT false NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "telegram_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"chat_id" text NOT NULL,
	"ruolo" text NOT NULL,
	"testo" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utenti" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"creato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"aggiornato_il" timestamp with time zone DEFAULT now() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"nome" text NOT NULL,
	"email" text,
	"ruolo" "ruolo_utente" NOT NULL,
	"proprietario_id" uuid,
	"attivo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "utenti_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "alloggi" ADD CONSTRAINT "alloggi_immobile_id_immobili_id_fk" FOREIGN KEY ("immobile_id") REFERENCES "public"."immobili"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratti_gestione" ADD CONSTRAINT "contratti_gestione_proprietario_id_proprietari_id_fk" FOREIGN KEY ("proprietario_id") REFERENCES "public"."proprietari"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documenti" ADD CONSTRAINT "documenti_ospite_id_ospiti_id_fk" FOREIGN KEY ("ospite_id") REFERENCES "public"."ospiti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documenti" ADD CONSTRAINT "documenti_prenotazione_id_prenotazioni_id_fk" FOREIGN KEY ("prenotazione_id") REFERENCES "public"."prenotazioni"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documenti" ADD CONSTRAINT "documenti_proprietario_id_proprietari_id_fk" FOREIGN KEY ("proprietario_id") REFERENCES "public"."proprietari"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "immobili" ADD CONSTRAINT "immobili_proprietario_id_proprietari_id_fk" FOREIGN KEY ("proprietario_id") REFERENCES "public"."proprietari"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifiche" ADD CONSTRAINT "notifiche_prenotazione_id_prenotazioni_id_fk" FOREIGN KEY ("prenotazione_id") REFERENCES "public"."prenotazioni"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifiche" ADD CONSTRAINT "notifiche_scadenza_id_scadenze_id_fk" FOREIGN KEY ("scadenza_id") REFERENCES "public"."scadenze"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifiche" ADD CONSTRAINT "notifiche_schedina_id_schedine_id_fk" FOREIGN KEY ("schedina_id") REFERENCES "public"."schedine"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ospiti_prenotazione" ADD CONSTRAINT "ospiti_prenotazione_prenotazione_id_prenotazioni_id_fk" FOREIGN KEY ("prenotazione_id") REFERENCES "public"."prenotazioni"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ospiti_prenotazione" ADD CONSTRAINT "ospiti_prenotazione_ospite_id_ospiti_id_fk" FOREIGN KEY ("ospite_id") REFERENCES "public"."ospiti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamenti" ADD CONSTRAINT "pagamenti_prenotazione_id_prenotazioni_id_fk" FOREIGN KEY ("prenotazione_id") REFERENCES "public"."prenotazioni"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permessi_immobile" ADD CONSTRAINT "permessi_immobile_utente_id_utenti_id_fk" FOREIGN KEY ("utente_id") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permessi_immobile" ADD CONSTRAINT "permessi_immobile_immobile_id_immobili_id_fk" FOREIGN KEY ("immobile_id") REFERENCES "public"."immobili"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenotazioni" ADD CONSTRAINT "prenotazioni_alloggio_id_alloggi_id_fk" FOREIGN KEY ("alloggio_id") REFERENCES "public"."alloggi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenotazioni" ADD CONSTRAINT "prenotazioni_ospite_id_ospiti_id_fk" FOREIGN KEY ("ospite_id") REFERENCES "public"."ospiti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prenotazioni" ADD CONSTRAINT "prenotazioni_creata_da_utenti_id_fk" FOREIGN KEY ("creata_da") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulizie" ADD CONSTRAINT "pulizie_prenotazione_id_prenotazioni_id_fk" FOREIGN KEY ("prenotazione_id") REFERENCES "public"."prenotazioni"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulizie" ADD CONSTRAINT "pulizie_alloggio_id_alloggi_id_fk" FOREIGN KEY ("alloggio_id") REFERENCES "public"."alloggi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pulizie" ADD CONSTRAINT "pulizie_addetto_id_utenti_id_fk" FOREIGN KEY ("addetto_id") REFERENCES "public"."utenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendiconti" ADD CONSTRAINT "rendiconti_proprietario_id_proprietari_id_fk" FOREIGN KEY ("proprietario_id") REFERENCES "public"."proprietari"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendiconti" ADD CONSTRAINT "rendiconti_documento_id_documenti_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scadenze" ADD CONSTRAINT "scadenze_immobile_id_immobili_id_fk" FOREIGN KEY ("immobile_id") REFERENCES "public"."immobili"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedine" ADD CONSTRAINT "schedine_prenotazione_id_prenotazioni_id_fk" FOREIGN KEY ("prenotazione_id") REFERENCES "public"."prenotazioni"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedine" ADD CONSTRAINT "schedine_ospite_id_ospiti_id_fk" FOREIGN KEY ("ospite_id") REFERENCES "public"."ospiti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spese" ADD CONSTRAINT "spese_immobile_id_immobili_id_fk" FOREIGN KEY ("immobile_id") REFERENCES "public"."immobili"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spese" ADD CONSTRAINT "spese_categoria_id_categorie_spesa_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorie_spesa"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spese" ADD CONSTRAINT "spese_scontrino_documento_id_documenti_id_fk" FOREIGN KEY ("scontrino_documento_id") REFERENCES "public"."documenti"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "utenti" ADD CONSTRAINT "utenti_proprietario_id_proprietari_id_fk" FOREIGN KEY ("proprietario_id") REFERENCES "public"."proprietari"("id") ON DELETE no action ON UPDATE no action;