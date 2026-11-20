# Regole per Claude Code su questo repository (sistema prenotazioni Salzillo Hospitality)

Vale per chiunque usi Claude Code qui, in particolare per il Claude nel terminale di Grok Bot, che può lavorare direttamente sul codice (decisione di Raffaele, 20/11/2026). Ogni tua modifica viene **rivista dopo** da Claude sul computer di Raffaele a ogni accensione del PC, e ripristinata se non va bene.

## Come lavorare
- Rispondi e scrivi in italiano.
- Parti dal problema segnalato, trova la causa, correggi solo quello. Niente refactoring o modifiche non richieste: se vedi altro, segnalalo nel messaggio di commit o a Grok Bot.
- Prima di dire "fatto" esegui `npx tsc --noEmit` e, se tocchi pagine o route, `npm run build`. Dichiara cosa non hai potuto verificare.
- Commit piccoli, uno per problema, messaggio in italiano che inizia con `[grok]` e spiega perché, non solo cosa.
- `git push` su `main` fa partire il deploy in produzione: spingi solo ciò che hai verificato.

## Cosa non fare mai
- Non cercare, creare, copiare o chiedere chiavi, token, file `.env`, password o credenziali. Il codice funziona senza: le chiavi sono su Vercel.
- Non collegarti al database di produzione, a Google Drive/Sheets/Calendar, ad Alloggiati Web, a Telegram o a Gemini con dati veri. Non scrivere script che inviino dati a enti o a ospiti.
- Non leggere, stampare né copiare in chat documenti, nomi o dati di ospiti, anche se li trovi nel codice o nei log.
- Non cambiare prezzi, regole di prenotazione, ruoli e permessi di accesso, né la logica di invio alla Polizia (Alloggiati Web), senza che Raffaele lo abbia chiesto per iscritto: in quel caso scrivi la proposta e fermati.
- Non fare deploy diretti, non toccare le impostazioni di Vercel o di GitHub, non riscrivere la storia di git (`push --force`, `reset` su `main`).
- Non cancellare file o dati: ripristina con `git revert` se serve tornare indietro.

## Mappa rapida
- `src/app/nuovo/` interfaccia del gestionale; `src/app/api/` route; `src/lib/` logica (OCR documenti in `src/lib/ocrDocumento.ts`, Alloggiati in `src/lib/alloggiati*.ts`, database in `src/lib/db/`).
- Le tabelle ufficiali di comuni e stati sono in `public/checkin/tabelle.json`: la ricerca accetta solo corrispondenze esatte, non indovinare un dato che finisce alla Polizia.
