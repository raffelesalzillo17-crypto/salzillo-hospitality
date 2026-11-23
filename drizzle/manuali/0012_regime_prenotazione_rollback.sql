-- Rollback del punto 3 (regime fiscale della prenotazione).
-- Prima rimette "No Tax" come canale per le prenotazioni che ne avevano il regime (se la migrazione del canale era stata applicata),
-- poi toglie le colonne. Cosi' niente va perso.
UPDATE prenotazioni SET canale = 'No Tax' WHERE regime_prenotazione = 'No Tax' AND canale::text <> 'No Tax';
ALTER TABLE prenotazioni DROP COLUMN IF EXISTS regime_motivo;
ALTER TABLE prenotazioni DROP COLUMN IF EXISTS regime_prenotazione;
