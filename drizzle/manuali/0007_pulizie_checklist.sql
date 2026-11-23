-- Punto 9 delle richieste (23/11/2026): pulizie.
--  - pulizie.ora_prevista: orario della pulizia (HH:MM), facoltativo.
--  - pulizie.checklist_fatta: le voci della checklist spuntate (JSON), per ogni pulizia.
--  - alloggi.checklist_pulizie: la checklist di ogni alloggio (una voce per riga); vuota = voci predefinite (biancheria, cortesia, rifornimenti).
-- Nessun dato esistente viene modificato. Idempotente. Rollback: 0007_pulizie_checklist_rollback.sql

ALTER TABLE pulizie ADD COLUMN IF NOT EXISTS ora_prevista text;
ALTER TABLE pulizie ADD COLUMN IF NOT EXISTS checklist_fatta text;
ALTER TABLE alloggi ADD COLUMN IF NOT EXISTS checklist_pulizie text;
