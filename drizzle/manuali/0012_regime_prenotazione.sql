-- Punto 3 delle richieste (23/11/2026): regime fiscale della prenotazione, separato dal canale.
--  - prenotazioni.regime_prenotazione: 'Ordinario' | 'Esente da tassa di soggiorno' | 'No Tax'
--  - prenotazioni.regime_motivo: motivo (per le esenzioni)
-- Le prenotazioni oggi con canale "No Tax" ricevono regime 'No Tax' (a parità di comportamento: restano escluse da Alloggiati, ricevute e cedolare).
-- Il canale NON viene toccato qui: lo si cambia solo dopo l'anteprima e la conferma del titolare. Idempotente.
-- Rollback: 0012_regime_prenotazione_rollback.sql

ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS regime_prenotazione text NOT NULL DEFAULT 'Ordinario';
ALTER TABLE prenotazioni ADD COLUMN IF NOT EXISTS regime_motivo text;
UPDATE prenotazioni SET regime_prenotazione = 'No Tax' WHERE canale::text = 'No Tax' AND regime_prenotazione = 'Ordinario';
