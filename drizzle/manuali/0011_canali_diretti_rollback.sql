-- Rollback del punto 3 (canali diretti): ricrea l'elenco dei canali senza WhatsApp, Telefono, Altro.
-- Prima verifica che nessuna prenotazione li usi: se ce n'è, si ferma con un errore e non cambia nulla (bisogna prima riportarle a "Diretto").
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM prenotazioni WHERE canale::text IN ('WhatsApp', 'Telefono', 'Altro')) THEN
    RAISE EXCEPTION 'Ci sono prenotazioni con canale WhatsApp/Telefono/Altro: portale prima a Diretto, poi riesegui il rollback';
  END IF;
END
$$;
ALTER TYPE canale RENAME TO canale_vecchio;
CREATE TYPE canale AS ENUM ('Airbnb', 'Booking', 'Diretto', 'No Tax');
ALTER TABLE prenotazioni ALTER COLUMN canale TYPE canale USING canale::text::canale;
DROP TYPE canale_vecchio;
