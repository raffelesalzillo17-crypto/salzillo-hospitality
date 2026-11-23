-- Punto 4 delle richieste (23/11/2026): qualità dell'elenco ospiti.
--  - ospiti.di_prova: segna i record di prova, che si nascondono da elenchi e ricerche (mai eliminati da soli).
--  - ospiti_alias: quando si unisce o si inverte un ospite, il vecchio "nome cognome" resta come alias, così
--    la sincronizzazione notturna dal foglio (importDaSheets) non ricrea il doppione.
-- Nessun dato esistente viene modificato. Idempotente. Rollback: 0004_ospiti_qualita_rollback.sql

ALTER TABLE ospiti ADD COLUMN IF NOT EXISTS di_prova boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS ospiti_alias (
  chiave text PRIMARY KEY,
  ospite_id uuid NOT NULL REFERENCES ospiti(id) ON DELETE CASCADE,
  creato_il timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ospiti_alias_ospite_idx ON ospiti_alias (ospite_id);
