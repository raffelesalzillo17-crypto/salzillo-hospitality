-- Punto 11 delle richieste (23/11/2026): promemoria agli ospiti con condizione.
--  - regole_automazione.condizione: NULL = sempre; 'documenti-mancanti' | 'caparra-da-incassare' | 'saldo-da-incassare' = la regola vale solo se la condizione è vera per quella prenotazione.
-- Nessun dato esistente viene modificato. Idempotente. Rollback: 0010_regole_condizione_rollback.sql

ALTER TABLE regole_automazione ADD COLUMN IF NOT EXISTS condizione text;
