---
titolo: Schema del database di Motore Rafilu separato da quello di Salzillo Hospitality
tipo: decisione
tag: [decisioni, tecniche, database, motore-rafilu, sicurezza]
fonti:
  - "conversazione diretta in Claude Code, sessione 19/09/2026"
creato: 2026-09-19
aggiornato: 2026-09-19
---

# Schema del database di Motore Rafilu separato da quello di Salzillo Hospitality

**Decisione**: `plancia-raffaele` (Motore Rafilu) ha una propria configurazione `drizzle-kit` (`drizzle.config.ts`, script `db:generate`/`db:push`/`db:studio`) per gestire le tabelle di sua competenza (Vita personale, Conti bancari) sulla stessa istanza Neon Postgres condivisa con `salzillo-hospitality`. Non usa più la configurazione di `salzillo-hospitality` per queste tabelle, anche se il database fisico resta lo stesso.

**Perché**: fino al 19/09/2026 le tabelle di Motore Rafilu (checkin/abitudini/obiettivi, poi conti bancari) venivano definite nello schema di `salzillo-hospitality`, perché solo quel progetto aveva gli strumenti di migrazione — nonostante quel repository sia concettualmente per la gestione del B&B, non per la vita personale/finanziaria di Raffaele. Raffaele ha fatto notare la stranezza mentre gli si chiedeva conferma per un `db:push`, ed è corretto: i dati personali non devono dipendere dal repository di un'altra attività.

**Rischio reale scoperto nel fare il cambio (19/09/2026) — leggere prima di ripetere l'operazione**: `drizzle-kit push` con `tablesFilter` impostato sulle sole tabelle di competenza **filtra le tabelle ma non i tipi enum** (`pgEnum`). Il primo tentativo di `db:push` da `plancia-raffaele` (schema che non dichiara nessuno degli enum di `salzillo-hospitality`) ha generato in automatico 17 istruzioni `DROP TYPE` per tutti gli enum del B&B (`canale`, `stato_prenotazione`, `tipo_documento`, ecc.), oltre alle `CREATE TABLE` volute. L'esecuzione si è fermata da sola con un errore reale di Postgres ("cannot drop type canale because other objects depend on it") prima di arrivare a un tipo davvero innocuo da eliminare — verificato subito dopo che `prenotazioni` e tutti gli enum del B&B erano intatti (65 righe, nessun dato perso). **Non è stata la rete di sicurezza a salvare la situazione, è stata fortuna** (il primo enum in ordine alfabetico aveva una dipendenza che Postgres ha rifiutato di rompere senza `CASCADE` esplicito) — con un ordine diverso, o con il flag `--force`, l'esito poteva essere diverso.

**Come si applica**:
- Non lanciare mai più `drizzle-kit push` da `plancia-raffaele` senza prima leggere l'output completo delle istruzioni proposte (usare `--verbose`, mai `--force`) e verificare che non compaiano `DROP TYPE`/`DROP SCHEMA` riferiti a nomi che non sono di Motore Rafilu.
- Se serve una nuova tabella in `plancia-raffaele`: aggiungerla a `src/lib/db/schema.ts` lì, generare/lanciare il push, leggere per intero l'elenco di istruzioni prima di procedere. Se compaiono `DROP TYPE` inattesi, fermarsi e non eseguire — il problema è che drizzle-kit vede un enum che non conosce, non che vada davvero eliminato.
- In alternativa più sicura, da valutare se il problema si ripresenta spesso: dichiarare in `plancia-raffaele/src/lib/db/schema.ts` anche gli enum (non le tabelle) di `salzillo-hospitality`, solo per farli "vedere" a drizzle-kit ed evitare che li proponga in cancellazione — non ancora fatto, perché aggiunge un accoppiamento che si voleva evitare.
- Vale la stessa cautela in senso opposto: anche `salzillo-hospitality` (che non ha `tablesFilter`) potrebbe in teoria proporre modifiche alle tabelle di Motore Rafilu se il suo schema.ts smette di essere identico a quello copiato in `plancia-raffaele` — tenerli sincronizzati manualmente quando cambia qualcosa in comune.
