-- Notifiche push (24/11/2026): le sottoscrizioni dei dispositivi e un registro degli avvisi già mandati (per non ripeterli).
--  - push_sottoscrizioni: un dispositivo (endpoint) di un utente. Si crea quando la persona attiva le notifiche, si toglie quando le disattiva
--    o quando il servizio risponde che il dispositivo non esiste più.
--  - push_avvisi: chiave unica per ogni avviso già mandato (es. una sovrapposizione di calendario), così la stessa cosa non arriva ogni 5 minuti.
-- Nessun dato esistente viene toccato. Idempotente. Rollback: 0013_notifiche_push_rollback.sql

CREATE TABLE IF NOT EXISTS push_sottoscrizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  utente_id uuid NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  dispositivo text,
  creato_il timestamptz NOT NULL DEFAULT now(),
  ultimo_invio timestamptz
);
CREATE INDEX IF NOT EXISTS push_sottoscrizioni_utente_idx ON push_sottoscrizioni (utente_id);

CREATE TABLE IF NOT EXISTS push_avvisi (
  chiave text PRIMARY KEY,
  creato_il timestamptz NOT NULL DEFAULT now()
);
