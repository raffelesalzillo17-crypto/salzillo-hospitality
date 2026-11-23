-- Punto 5 delle richieste (23/11/2026): registro delle azioni e cestino recuperabile 30 giorni.
-- Solo tabelle NUOVE: nessun dato esistente viene toccato. Idempotente. Rollback: 0003_registro_azioni_cestino_rollback.sql

CREATE TABLE IF NOT EXISTS registro_azioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quando timestamptz NOT NULL DEFAULT now(),
  utente_id uuid,
  utente_nome text,
  ruolo text,
  azione text NOT NULL,
  entita text,
  entita_id text,
  dettaglio text
);

CREATE INDEX IF NOT EXISTS registro_azioni_quando_idx ON registro_azioni (quando DESC);

CREATE TABLE IF NOT EXISTS cestino (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  entita_id uuid NOT NULL,
  etichetta text NOT NULL,
  dati jsonb NOT NULL,
  eliminato_il timestamptz NOT NULL DEFAULT now(),
  eliminato_da uuid,
  scade_il timestamptz NOT NULL,
  ripristinato_il timestamptz
);

CREATE INDEX IF NOT EXISTS cestino_scade_idx ON cestino (scade_il);
