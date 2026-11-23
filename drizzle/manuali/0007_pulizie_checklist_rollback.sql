-- Annulla 0007_pulizie_checklist.sql. Attenzione: perde gli orari, le checklist spuntate e le checklist personalizzate degli alloggi.
ALTER TABLE alloggi DROP COLUMN IF EXISTS checklist_pulizie;
ALTER TABLE pulizie DROP COLUMN IF EXISTS checklist_fatta;
ALTER TABLE pulizie DROP COLUMN IF EXISTS ora_prevista;
