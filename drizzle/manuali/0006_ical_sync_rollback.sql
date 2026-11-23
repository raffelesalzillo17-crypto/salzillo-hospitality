-- Annulla 0006_ical_sync.sql. Attenzione: perde il token dei link di export (i link tornano quelli vecchi, aperti), il registro delle
-- sincronizzazioni, i conflitti rilevati e i segni "da verificare".
DROP TABLE IF EXISTS conflitti_calendario;
DROP TABLE IF EXISTS sync_ical_log;
ALTER TABLE prenotazioni DROP COLUMN IF EXISTS da_verificare_motivo;
ALTER TABLE prenotazioni DROP COLUMN IF EXISTS da_verificare;
ALTER TABLE alloggi DROP COLUMN IF EXISTS ical_token;
