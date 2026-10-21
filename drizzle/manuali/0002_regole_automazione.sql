-- Motore di regole per promemoria e messaggi (21/10/2026). Vedi src/lib/regole.ts.
-- Applicare con:  node scripts/applica-sql-manuale.mjs drizzle/manuali/0002_regole_automazione.sql
-- Idempotente (CREATE ... IF NOT EXISTS, regole di partenza solo se la tabella è vuota).
-- Stato e azione come testo, non enum: modificare un enum con drizzle-kit comporta rischi di DROP TYPE.

CREATE TABLE IF NOT EXISTS regole_automazione (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  creato_il timestamp with time zone DEFAULT now() NOT NULL,
  aggiornato_il timestamp with time zone DEFAULT now() NOT NULL,
  nome text NOT NULL,
  attiva boolean DEFAULT true NOT NULL,
  evento text NOT NULL,
  offset_giorni integer DEFAULT 0 NOT NULL,
  ora text DEFAULT '10:00' NOT NULL,
  azione text NOT NULL,
  modello text NOT NULL,
  alloggio_id uuid,
  canale text,
  min_notti integer
);

CREATE TABLE IF NOT EXISTS attivita_pianificate (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  creato_il timestamp with time zone DEFAULT now() NOT NULL,
  aggiornato_il timestamp with time zone DEFAULT now() NOT NULL,
  regola_id uuid NOT NULL,
  alloggio_id uuid NOT NULL,
  checkin date NOT NULL,
  checkout date NOT NULL,
  prenotazione_id uuid,
  ospite_nome text DEFAULT '' NOT NULL,
  telefono text,
  azione text NOT NULL,
  scadenza timestamp with time zone NOT NULL,
  stato text DEFAULT 'Da fare' NOT NULL,
  testo text NOT NULL,
  fatta_il timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE regole_automazione ADD CONSTRAINT regole_automazione_alloggio_id_alloggi_id_fk
    FOREIGN KEY (alloggio_id) REFERENCES alloggi(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE attivita_pianificate ADD CONSTRAINT attivita_pianificate_regola_id_regole_automazione_id_fk
    FOREIGN KEY (regola_id) REFERENCES regole_automazione(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE attivita_pianificate ADD CONSTRAINT attivita_pianificate_alloggio_id_alloggi_id_fk
    FOREIGN KEY (alloggio_id) REFERENCES alloggi(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE attivita_pianificate ADD CONSTRAINT attivita_pianificate_regola_id_alloggio_id_checkin_unique
    UNIQUE (regola_id, alloggio_id, checkin);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS attivita_pianificate_stato_scadenza_idx ON attivita_pianificate (stato, scadenza);

-- Regole di partenza (solo se non ce n'è nessuna). Il testo del messaggio di benvenuto è quello
-- già in uso e confermato (strutture.ts: guideMessageText + link alla pagina info della stanza);
-- le altre due sono proposte DISATTIVATE: il testo per gli ospiti lo conferma Raffaele prima.
INSERT INTO regole_automazione (nome, attiva, evento, offset_giorni, ora, azione, modello)
SELECT * FROM (VALUES
  ('Link ospite il giorno prima dell''arrivo', true, 'Check-in', -1, '10:00', 'Messaggio ospite',
   E'{messaggio_guida}\n{emoji} {link_info}'),
  ('Richiesta recensione dopo la partenza', false, 'Check-out', 1, '10:00', 'Messaggio ospite',
   E'Ciao {nome}, grazie per aver scelto {alloggio}! Se il soggiorno ti è piaciuto, ci farebbe molto piacere una tua recensione. A presto!'),
  ('Controlla i documenti prima dell''arrivo', false, 'Check-in', -2, '10:00', 'Promemoria per me',
   E'Controlla che {nome} {cognome} ({alloggio}, arrivo {checkin}) abbia mandato i documenti d''identità.')
) AS v(nome, attiva, evento, offset_giorni, ora, azione, modello)
WHERE NOT EXISTS (SELECT 1 FROM regole_automazione);
