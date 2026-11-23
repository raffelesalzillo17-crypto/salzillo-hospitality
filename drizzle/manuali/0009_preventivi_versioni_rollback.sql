-- Annulla 0009_preventivi_versioni.sql. Attenzione: perde il legame tra le versioni di uno stesso preventivo.
ALTER TABLE preventivi DROP COLUMN IF EXISTS versione_di;
ALTER TABLE preventivi DROP COLUMN IF EXISTS versione;
