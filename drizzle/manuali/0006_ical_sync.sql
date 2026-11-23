-- Punto 2 delle richieste (23/11/2026): sincronizzazione dei calendari Airbnb e Booking (iCal).
--  - alloggi.ical_token: segreto del link di export. NULL = link vecchio (solo id dell'alloggio), che resta valido finché
--    il Titolare non genera il link protetto: così i collegamenti già incollati su Airbnb e Booking non si rompono da soli.
--  - sync_ical_log: registro per alloggio di ogni sincronizzazione (quando, esito, eventi letti, importate, conflitti, errori).
--  - conflitti_calendario: sovrapposizioni rilevate tra un evento OTA e una nostra prenotazione di un altro canale (o con date
--    diverse); si chiudono da sole quando non si rilevano più.
--  - prenotazioni.da_verificare: una prenotazione sparita dal feed dell'OTA si segna "da verificare", mai cancellata da sola.
-- Nessun dato esistente viene modificato. Idempotente. Rollback: 0006_ical_sync_rollback.sql

ALTER TABLE alloggi ADD COLUMN IF NOT EXISTS ical_token text;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS da_verificare boolean NOT NULL DEFAULT false;
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS da_verificare_motivo text;

CREATE TABLE IF NOT EXISTS sync_ical_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quando timestamptz NOT NULL DEFAULT now(),
  alloggio_id uuid NOT NULL REFERENCES alloggi(id),
  calendario text NOT NULL,
  origine text NOT NULL DEFAULT 'manuale',
  esito text NOT NULL,
  eventi_letti integer NOT NULL DEFAULT 0,
  importate integer NOT NULL DEFAULT 0,
  conflitti integer NOT NULL DEFAULT 0,
  da_verificare integer NOT NULL DEFAULT 0,
  errore text,
  durata_ms integer
);
CREATE INDEX IF NOT EXISTS sync_ical_log_alloggio_idx ON sync_ical_log (alloggio_id, quando DESC);

CREATE TABLE IF NOT EXISTS conflitti_calendario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rilevato_il timestamptz NOT NULL DEFAULT now(),
  risolto_il timestamptz,
  alloggio_id uuid NOT NULL REFERENCES alloggi(id),
  calendario text NOT NULL,
  ota_dal date NOT NULL,
  ota_al date NOT NULL,
  prenotazione_id uuid NOT NULL REFERENCES prenotazioni(id),
  tipo text NOT NULL,
  motivo text NOT NULL,
  UNIQUE (alloggio_id, calendario, ota_dal, ota_al, prenotazione_id)
);
