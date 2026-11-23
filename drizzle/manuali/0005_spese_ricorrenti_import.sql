-- Punto 12 delle richieste (23/11/2026): spese e conti per il commercialista.
--  - spese_ricorrenti: spese che si ripetono (utenze, abbonamenti, commissioni) e che il gestionale registra da solo alle scadenze.
--  - spese.alloggio_id: la spesa può riguardare un singolo alloggio (oltre che un immobile o essere generale).
--  - spese.ricorrente_id: da quale spesa ricorrente nasce; unico per (ricorrente, data) così non si duplica mai.
--  - spese.chiave_import: impronta di una riga importata da estratto conto; unica, così un secondo import dello stesso file non duplica.
-- Nessun dato esistente viene modificato (oggi le spese sono 0). Idempotente. Rollback: 0005_spese_ricorrenti_import_rollback.sql

CREATE TABLE IF NOT EXISTS spese_ricorrenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creato_il timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now(),
  descrizione text NOT NULL,
  categoria_id uuid NOT NULL REFERENCES categorie_spesa(id),
  immobile_id uuid REFERENCES immobili(id),
  alloggio_id uuid REFERENCES alloggi(id),
  importo numeric(10,2) NOT NULL,
  metodo_pagamento metodo_pagamento,
  frequenza text NOT NULL CHECK (frequenza IN ('Mensile', 'Trimestrale', 'Semestrale', 'Annuale')),
  giorno integer NOT NULL DEFAULT 1 CHECK (giorno BETWEEN 1 AND 31),
  prossima_data date NOT NULL,
  fine date,
  attiva boolean NOT NULL DEFAULT true,
  note text
);

ALTER TABLE spese ADD COLUMN IF NOT EXISTS alloggio_id uuid REFERENCES alloggi(id);
ALTER TABLE spese ADD COLUMN IF NOT EXISTS ricorrente_id uuid REFERENCES spese_ricorrenti(id);
ALTER TABLE spese ADD COLUMN IF NOT EXISTS chiave_import text;

CREATE UNIQUE INDEX IF NOT EXISTS spese_chiave_import_idx ON spese (chiave_import) WHERE chiave_import IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS spese_ricorrente_data_idx ON spese (ricorrente_id, data) WHERE ricorrente_id IS NOT NULL;
