-- Punto 10 delle richieste (23/11/2026): preventivi con versioni.
--  - preventivi.versione: 1 per l'originale, 2, 3… per le nuove versioni (un preventivo accettato è bloccato: si cambia creando una nuova versione).
--  - preventivi.versione_di: il preventivo originale da cui discende la versione.
-- Nessun dato esistente viene modificato. Idempotente. Rollback: 0009_preventivi_versioni_rollback.sql

ALTER TABLE preventivi ADD COLUMN IF NOT EXISTS versione integer NOT NULL DEFAULT 1;
ALTER TABLE preventivi ADD COLUMN IF NOT EXISTS versione_di uuid REFERENCES preventivi(id);
