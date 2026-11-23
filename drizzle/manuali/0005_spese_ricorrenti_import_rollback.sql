-- Annulla 0005_spese_ricorrenti_import.sql. Attenzione: perde le spese ricorrenti e i collegamenti (alloggio, ricorrenza, import) delle spese già registrate.
DROP INDEX IF EXISTS spese_ricorrente_data_idx;
DROP INDEX IF EXISTS spese_chiave_import_idx;
ALTER TABLE spese DROP COLUMN IF EXISTS chiave_import;
ALTER TABLE spese DROP COLUMN IF EXISTS ricorrente_id;
ALTER TABLE spese DROP COLUMN IF EXISTS alloggio_id;
DROP TABLE IF EXISTS spese_ricorrenti;
