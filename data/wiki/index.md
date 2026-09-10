---
titolo: Index
tipo: overview
tag: [index]
fonti: []
creato: 2026-08-31
aggiornato: 2026-09-08
---

# Index

Catalogo di tutte le pagine del wiki, organizzato per categoria. Ogni ingest aggiorna questo file.

## Overview

- [[overview]] — la sintesi di alto livello.
- [[chi-sono]] — identità/stile/regole vincolanti di Raffaele in un colpo d'occhio, da leggere a inizio sessione insieme a CLAUDE.md

## Entità

- [[salzillo-hospitality]] — attività di famiglia di gestione affitti brevi a Marcianise, di cui Il Tulipano è la prima proprietà; nuove stanze di Via Campania completate (lavori finiti, in attesa dei codici CIN)
- [[bb-il-tulipano]] — B&B Il Tulipano, struttura ricettiva a Marcianise (CE)
- [[salzillo-luigi]] — titolare legale/sanitario del B&B Il Tulipano, padre di Raffaele
- [[raffaele-salzillo]] — anagrafica dell'utente proprietario del secondo cervello
- [[raffaela-iodice]] — madre di Raffaele, residente allo stesso indirizzo; comproprietaria (con la sorella Giovanna) del fabbricato Via Campania 36/38 dove sorge il nuovo B&B
- [[martina]] — compagna di Raffaele dal 2021, nata 22/05/2001
- [[iodice-paolo-giovanni]] — zio materno di Raffaele, firmatario della pratica di allacciamento del fabbricato Via Campania 36/38
- [[iodice-giovanna]] — zia materna di Raffaele, proprietaria di tre appartamenti nel fabbricato Via Campania 36/38
- [[iodice-rosanna]] — zia materna di Raffaele, firmataria della pratica di allacciamento del fabbricato Via Campania 36/38

## Concetti

- [[uso-claude-raffaele]] — come Raffaele comunica e usa l'ecosistema Claude (Claude Code, claude.ai)
- [[assistente-digitale-raffaele]] — progetto bot Telegram, assistente digitale personale a fasi (consultazione wiki → news/mercati → esecuzione compiti)
- [[pac-etf-core-msci-world]] — PAC su ETF Core MSCI World (Acc): posizione attuale e regola di reinvestimento mensile

## Sintesi

- [[presentazione-raffaele]] — sintesi biografica di Raffaele (percorso professionale, imprenditoriale, familiare)
- [[carriera-scolastica-raffaele]] — cronologia contratti scuola, graduatorie GPS/ATA, concorso ordinario 2023 e anno di formazione e prova 2025/26 di Raffaele
- [[titoli-certificazioni-raffaele]] — diploma, TFA sostegno, 24 CFU, CLIL, C1 inglese, sicurezza sul lavoro, MOOC Scuola Futura di Raffaele
- [[naspi-collocamento-raffaele]] — storico collocamento completo 2019-2024 e domande NASPI 2023/2024 di Raffaele
- [[scienze-motorie-raffaele]] — laurea in Scienze delle Attività Motorie e Sportive (eCampus) e tirocinio 3° anno di Raffaele
- [[tfa-sostegno-raffaele]] — TFA Sostegno VIII Ciclo (Link Campus): immatricolazione, tirocinio, proposta tesi, pagamenti di Raffaele
- [[trasferimento-feltre-raffaele]] — trasferimento di residenza di Raffaele da Marcianise a Feltre (BL), 2026
- [[documentazione-apertura-tulipano]] — timeline della procedura di apertura del B&B Il Tulipano
- [[fatture-booking-tulipano]] — fatture mensili Booking.com e Certificazioni Uniche (cedolare secca locazioni brevi)
- [[hostflow-tulipano]] — gestionale prenotazioni HostFlow 2026, parametri di calcolo redditività, log prenotazioni (con sincronizzazione automatica giornaliera dal Google Sheet live)
- [[messaggi-checkin-ospiti]] — messaggi standard di check-in per gli ospiti, una scheda per stanza (WhatsApp Business)
- [[analisi-critica-sistema-salzillo-hospitality]] — revisione critica dell'architettura del sistema (10/09/2026): il tetto di Google Sheets come database, assenza di modello proprietario/immobile, autenticazione frammentata, priorità proposte
- [[piano-migrazione-database-modello-proprietario]] — piano dettagliato in 6 fasi per sostituire Google Sheets con Postgres/Neon e introdurre le entità Proprietario/Immobile (10/09/2026)
- [[discovery-nuovo-sistema-salzillo-hospitality]] — intervista strutturata a Raffaele (15 sezioni) per definire cosa deve fare il nuovo sistema a database (10/09/2026)
- [[pms-professionali-idee-da-rubare]] — ricerca sui gestionali professionali (Krossbooking, Octorate, Smoobu, Hospitable): 15 idee da adottare per il nostro sistema (10/09/2026)

## Decisioni

- [[decisioni]] — indice: il perché delle scelte ricorrenti di Raffaele
- [[non-toccare-sito-prenotazioni]] — il sito prenotazioni condiviso coi collaboratori: solo restyling visivo, mai logica
- [[chiedere-prima-di-eliminare]] — nessuna eliminazione di file senza conferma esplicita
- [[due-livelli-credenziali]] — credenziali cloud vive vs. statiche personali: standard diversi, entrambe omesse dalle copie online
- [[un-solo-canale-bot-telegram]] — bot.js locale e webhook Vercel non girano mai insieme
- [[massima-autonomia-agenti]] — preferenza per agenti che eseguono, non solo consigliano
- [[infrastruttura-free-first]] — hosting gratuito il più a lungo possibile, server fisico solo quando serve davvero
- [[piattaforma-property-management-personale]] — l'ecosistema Salzillo Hospitality come piattaforma multi-utente futura; Motore Rafilu resta però privato per sempre, la condivisione vive su superfici separate
- [[architettura-dati-pronta-per-server-domestico]] — scrivere l'accesso ai dati dietro un confine sostituibile, in vista di un futuro server domestico
- [[solo-tulipano-va-inviato-ad-alloggiati-e-sinfonia]] — solo le prenotazioni Tulipano su Airbnb/Booking/Diretto vanno davvero trasmesse ai portali ufficiali
- [[obiettivo-autonomia-orizzonte-un-anno]] — patto 10/09/2026: un anno per portare a maturità l’ecosistema, poi hardware locale; Raffaele vuole più tempo libero, poche azioni concrete e sicure
