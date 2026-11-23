-- Annulla 0008_scadenze_stati.sql. Attenzione: perde lo storico dei completamenti e gli stati (tutte le scadenze tornano visibili come aperte).
DROP TABLE IF EXISTS scadenze_storico;
ALTER TABLE scadenze DROP COLUMN IF EXISTS motivo_chiusura;
ALTER TABLE scadenze DROP COLUMN IF EXISTS chiusa_il;
ALTER TABLE scadenze DROP CONSTRAINT IF EXISTS scadenze_stato_check;
ALTER TABLE scadenze DROP COLUMN IF EXISTS stato;
