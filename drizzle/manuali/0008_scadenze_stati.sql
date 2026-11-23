-- Punto 13 delle richieste (23/11/2026): scadenze con stati, storico dei completamenti e ricevute.
--  - scadenze.stato: Aperta | Fatta | Non più applicabile. Le voci non aperte non compaiono in Dashboard.
--  - scadenze.chiusa_il / motivo_chiusura: quando e perché una voce è stata archiviata.
--  - scadenze_storico: ogni volta che una scadenza è fatta (con data ed eventuale ricevuta su Drive).
-- Nessun dato esistente viene modificato (tutte le scadenze restano "Aperta"). Idempotente. Rollback: 0008_scadenze_stati_rollback.sql

ALTER TABLE scadenze ADD COLUMN IF NOT EXISTS stato text NOT NULL DEFAULT 'Aperta';
ALTER TABLE scadenze DROP CONSTRAINT IF EXISTS scadenze_stato_check;
ALTER TABLE scadenze ADD CONSTRAINT scadenze_stato_check CHECK (stato IN ('Aperta', 'Fatta', 'Non più applicabile'));
ALTER TABLE scadenze ADD COLUMN IF NOT EXISTS chiusa_il date;
ALTER TABLE scadenze ADD COLUMN IF NOT EXISTS motivo_chiusura text;

CREATE TABLE IF NOT EXISTS scadenze_storico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creato_il timestamptz NOT NULL DEFAULT now(),
  scadenza_id uuid NOT NULL REFERENCES scadenze(id) ON DELETE CASCADE,
  scadenza_prevista date NOT NULL,
  fatta_il date NOT NULL,
  ricevuta_documento_id uuid REFERENCES documenti(id),
  note text
);
CREATE INDEX IF NOT EXISTS scadenze_storico_scadenza_idx ON scadenze_storico (scadenza_id, fatta_il DESC);
