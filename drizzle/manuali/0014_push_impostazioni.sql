-- Notifiche push: dove si tengono le chiavi quando non sono nelle variabili d'ambiente (chiave pubblica e privata VAPID). Idempotente.
-- Rollback: 0014_push_impostazioni_rollback.sql
CREATE TABLE IF NOT EXISTS push_impostazioni (
  chiave text PRIMARY KEY,
  valore text NOT NULL,
  creato_il timestamptz NOT NULL DEFAULT now()
);
