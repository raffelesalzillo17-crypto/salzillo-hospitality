-- Vincolo anti-doppia-prenotazione (21/10/2026).
-- Due prenotazioni che occupano l'alloggio (stato diverso da Cancellata / Cancellata con penale /
-- No-show) non possono avere notti in comune. Un soggiorno occupa le notti [checkin, checkout):
-- il giorno di check-out è libero per un nuovo check-in.
--
-- NON è gestito da drizzle-kit (non sa esprimere i vincoli di esclusione): va applicato con
--   node scripts/applica-vincolo-sovrapposizioni.mjs
-- e un `drizzle-kit push` lo lascia al suo posto.
--
-- Per toglierlo:  ALTER TABLE prenotazioni DROP CONSTRAINT prenotazioni_no_sovrapposizione;

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE prenotazioni
  ADD CONSTRAINT prenotazioni_no_sovrapposizione
  EXCLUDE USING gist (
    alloggio_id WITH =,
    daterange(checkin, checkout, '[)') WITH &&
  )
  WHERE (stato NOT IN ('Cancellata', 'Cancellata con penale', 'No-show'));
