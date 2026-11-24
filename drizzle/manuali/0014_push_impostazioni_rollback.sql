-- Rollback: toglie la tabella delle impostazioni push (con le chiavi VAPID: poi vanno rigenerate e le persone devono riattivare le notifiche).
DROP TABLE IF EXISTS push_impostazioni;
