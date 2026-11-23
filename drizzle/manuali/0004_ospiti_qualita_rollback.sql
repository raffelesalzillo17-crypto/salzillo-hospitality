-- Annulla 0004_ospiti_qualita.sql. Attenzione: perde gli alias (le unioni già fatte non si disfano, ma la
-- sincronizzazione dal foglio potrebbe ricreare i doppioni) e i segni "di prova".
DROP TABLE IF EXISTS ospiti_alias;
ALTER TABLE ospiti DROP COLUMN IF EXISTS di_prova;
