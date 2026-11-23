-- Punto 3 delle richieste (23/11/2026), parte sicura: nuovi canali diretti WhatsApp, Telefono, Altro.
-- Si aggiungono soltanto valori all'elenco dei canali: nessuna prenotazione esistente viene toccata.
-- "No Tax" resta com'è, per scelta esplicita del titolare (non viene spostato in nessun altro campo).
-- Idempotente. Rollback: 0011_canali_diretti_rollback.sql (si rifiuta di procedere se qualche prenotazione usa i nuovi canali).

ALTER TYPE canale ADD VALUE IF NOT EXISTS 'WhatsApp';
ALTER TYPE canale ADD VALUE IF NOT EXISTS 'Telefono';
ALTER TYPE canale ADD VALUE IF NOT EXISTS 'Altro';
