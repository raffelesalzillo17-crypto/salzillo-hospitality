-- Rollback del punto 11: toglie la colonna condizione (le regole tornano senza condizione).
ALTER TABLE regole_automazione DROP COLUMN IF EXISTS condizione;
