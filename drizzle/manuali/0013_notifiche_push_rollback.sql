-- Rollback delle notifiche push: toglie le due tabelle (le notifiche smettono, nient'altro cambia).
DROP TABLE IF EXISTS push_avvisi;
DROP TABLE IF EXISTS push_sottoscrizioni;
