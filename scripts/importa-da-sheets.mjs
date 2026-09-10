/**
 * Importa TUTTI i dati dai 3 file Google Sheet nel database Neon.
 *
 * Ri-eseguibile: fa TRUNCATE di tutte le tabelle e reimporta da zero. Finché Google Sheets
 * resta la fonte di verità (fasi 1-4 del piano), si può rilanciare quante volte serve.
 *
 * Uso:  node scripts/importa-da-sheets.mjs
 * Richiede: google-credentials.json nel root (service account, lettura Sheets) e DATABASE_URL
 *           in .env.local (creato da `vercel integration add neon`).
 *
 * Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md (Fase 3).
 */

import { google } from 'googleapis';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// ── Config ───────────────────────────────────────────────────────────────────
const FILES = {
  prenotazioni: '1SFQhO_SPRvIe8L1lgILRNsE-kUHPEfVqUEo3-wwwRjs', // SH · Prenotazioni & Ospiti
  gestione:     '1A-Fi97s4af9qJWTupjVEajWP8bZzxHLdpLiyA6jcXbE', // SH · Struttura & Spese
  sistema:      '1SR6x6fRHsx37fVyF9ErmvM8m9oUTYFysQz1pZPB89xQ', // SH · Sistema
};

const envText = fs.readFileSync(path.join(process.cwd(), '.env.local'), 'utf8');
const DATABASE_URL = envText.match(/^DATABASE_URL="?([^"\n]+)"?/m)[1];
const sql = neon(DATABASE_URL);

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(process.cwd(), 'google-credentials.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});
const sheets = google.sheets({ version: 'v4', auth });

async function leggi(fileKey, tab, range = 'A1:AZ100000', unformatted = false) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: FILES[fileKey],
    range: `${tab}!${range}`,
    ...(unformatted ? { valueRenderOption: 'UNFORMATTED_VALUE' } : {}),
  });
  return res.data.values ?? [];
}

// ── Utility ──────────────────────────────────────────────────────────────────
const itToIso = (s) => {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
// Stessa identica interpretazione dei numeri dell'API del foglio
// (src/app/api/prenotazioni: `parseFloat(String(lordo ?? 0)) || 0`), così i totali coincidono.
const num = (v) => {
  if (v == null || v === '') return 0;
  const s = String(v).trim();
  // se c'è una virgola e nessun punto → è il separatore decimale italiano
  const normalizzato = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s;
  return parseFloat(normalizzato) || 0;
};
const splitNome = (intero) => {
  const parti = String(intero || '').trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return { nome: '(sconosciuto)', cognome: '(sconosciuto)' };
  if (parti.length === 1) return { nome: parti[0], cognome: '' };
  return { nome: parti.slice(0, -1).join(' '), cognome: parti[parti.length - 1] };
};

// Stesso identico calcolo del foglio (src/lib/prenotazioni.ts calcUtile) — così i totali
// storici coincidono al centesimo in fase di verifica.
const COMM_RATE = { Airbnb: 0.1891, Booking: 0.2015, Diretto: 0, 'No Tax': 0 };
function componentiPrenotazione(lordo, canale) {
  const commissione = Math.round(lordo * (COMM_RATE[canale] ?? 0) * 100) / 100;
  const cedolare = canale === 'No Tax' ? 0 : Math.round(lordo * 0.21 * 100) / 100;
  const costo_pulizia = 20;
  const fee_gestione = 0; // 0% per la famiglia
  const utile = Math.round((lordo - commissione - cedolare - costo_pulizia) * 100) / 100;
  const netto_proprietario = Math.round((utile - fee_gestione) * 100) / 100;
  return { commissione, cedolare, costo_pulizia, fee_gestione, utile, netto_proprietario };
}

const CANALE_MAP = { 'Airbnb': 'Airbnb', 'Booking': 'Booking', 'Diretto': 'Diretto', 'No Tax': 'No Tax', 'No tax': 'No Tax', 'Notax': 'No Tax' };
const STATO_MAP = {
  'Attiva': 'Attiva', 'Cancellata': 'Cancellata',
  'Cancellata con penale': 'Cancellata con penale',
  'No-show': 'No-show', 'No show': 'No-show', 'In attesa': 'In attesa di conferma',
};

// ── Anagrafica di partenza (dati confermati da Raffaele 10/09/2026) ──────────
const ALLOGGI_SEED = [
  { nome: 'Il Tulipano',  immobile: 'Via Clanio 60',   nomiFoglio: ['Tulipano'],      regime: 'Con cedolare', selfCheckin: true,  emoji: '🌷', wifi: ['Lella', 'Lella1978@'], trasmette: true,  soggiorno: 'Marcianise' },
  { nome: 'Stanza Rosa',  immobile: 'Via Clanio 60',   nomiFoglio: ['Rosa'],          regime: 'No tax',       selfCheckin: false, emoji: '🌸', wifi: ['Lella', 'Lella1978@'], trasmette: false, soggiorno: null },
  { nome: 'Piano Terra',  immobile: 'Via Campania 36', nomiFoglio: ['Piano Terra'],   regime: 'No tax',       selfCheckin: false, emoji: '🏠', wifi: null, trasmette: false, soggiorno: null },
  { nome: 'Primo Piano',  immobile: 'Via Campania 36', nomiFoglio: ['Primo Piano'],   regime: 'No tax',       selfCheckin: false, emoji: '🏠', wifi: null, trasmette: false, soggiorno: null },
  { nome: 'Secondo Piano', immobile: 'Via Campania 36', nomiFoglio: ['Secondo Piano'], regime: 'No tax',       selfCheckin: false, emoji: '🏠', wifi: null, trasmette: false, soggiorno: null },
];

// ── Import ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('== Import da Google Sheets → Neon ==\n');

  // 1. TRUNCATE tutto (ordine irrilevante con CASCADE)
  console.log('Svuoto le tabelle...');
  await sql`TRUNCATE TABLE
    notifiche, rendiconti, permessi_immobile, ospiti_prenotazione, pagamenti,
    schedine, pulizie, documenti, contratti_gestione, prenotazioni, ospiti,
    spese, scadenze, categorie_spesa, alloggi, immobili, proprietari, utenti,
    bot_state, telegram_log, email_processate
    CASCADE`;

  // 2. Proprietari
  const [propLuigi] = await sql`
    INSERT INTO proprietari (nome, tipo, note) VALUES
    ('Salzillo Luigi', 'Persona fisica', 'Padre di Raffaele. Intestatario SCIA e notifica sanitaria Via Clanio 60. Dati completi nel wiki (bb-il-tulipano).')
    RETURNING id`;
  const [propRaffaela] = await sql`
    INSERT INTO proprietari (nome, tipo, note) VALUES
    ('Raffaela Iodice', 'Persona fisica', 'Madre di Raffaele ("Lella"). Intestataria attuale Via Campania 36. Fa anche le pulizie. Dati nel wiki (raffaela-iodice).')
    RETURNING id`;
  console.log('Proprietari: 2');

  // 3. Immobili
  const [immClanio] = await sql`
    INSERT INTO immobili (proprietario_id, nome, indirizzo, comune, provincia)
    VALUES (${propLuigi.id}, 'Via Clanio 60', 'Via Clanio 60', 'Marcianise', 'CE') RETURNING id`;
  const [immCampania] = await sql`
    INSERT INTO immobili (proprietario_id, nome, indirizzo, comune, provincia)
    VALUES (${propRaffaela.id}, 'Via Campania 36', 'Via Campania 36', 'Marcianise', 'CE') RETURNING id`;
  const immobiliId = { 'Via Clanio 60': immClanio.id, 'Via Campania 36': immCampania.id };
  console.log('Immobili: 2');

  // 4. Alloggi + mappa "nome nel foglio" -> alloggio_id
  const alloggioIdPerNomeFoglio = {};
  for (const a of ALLOGGI_SEED) {
    const [row] = await sql`
      INSERT INTO alloggi (immobile_id, nome, regime_fiscale, costo_pulizia, ha_self_checkin,
        emoji, wifi_ssid, wifi_password, trasmette_alloggiati, imposta_soggiorno_comune,
        checkin_guide_url)
      VALUES (${immobiliId[a.immobile]}, ${a.nome}, ${a.regime}, 20, ${a.selfCheckin},
        ${a.emoji}, ${a.wifi?.[0] ?? null}, ${a.wifi?.[1] ?? null}, ${a.trasmette}, ${a.soggiorno},
        ${'https://salzillo-hospitality.vercel.app/checkin/' + a.nomiFoglio[0].toLowerCase().replace(/\s+/g, '-') + '.html'})
      RETURNING id`;
    for (const nf of a.nomiFoglio) alloggioIdPerNomeFoglio[nf] = row.id;
  }
  console.log('Alloggi:', ALLOGGI_SEED.length);

  // 5. Ospiti (dal foglio OSPITI) + mappa per nome normalizzato
  const ospitiRows = await leggi('prenotazioni', 'OSPITI');
  const ospiteIdPerChiave = {}; // chiave = nome intero minuscolo trim
  let nOspiti = 0;
  for (let i = 1; i < ospitiRows.length; i++) {
    const [ospiteIdFoglio, nomeIntero, telefono, cf, note] = ospitiRows[i];
    if (!nomeIntero) continue;
    const { nome, cognome } = splitNome(nomeIntero);
    const [row] = await sql`
      INSERT INTO ospiti (nome, cognome, telefono, codice_fiscale, note, note_import)
      VALUES (${nome}, ${cognome}, ${telefono || null}, ${cf || null}, ${note || null},
        ${'Nome originale dal foglio: "' + nomeIntero + '"' + (ospiteIdFoglio ? ' (OspiteId ' + ospiteIdFoglio + ')' : '')})
      RETURNING id`;
    ospiteIdPerChiave[String(nomeIntero).toLowerCase().trim()] = row.id;
    nOspiti++;
  }
  console.log('Ospiti (da OSPITI):', nOspiti);

  async function trovaOCreaOspite(nomeIntero, telefono) {
    const chiave = String(nomeIntero).toLowerCase().trim();
    if (ospiteIdPerChiave[chiave]) return ospiteIdPerChiave[chiave];
    const { nome, cognome } = splitNome(nomeIntero);
    const [row] = await sql`
      INSERT INTO ospiti (nome, cognome, telefono, note_import)
      VALUES (${nome}, ${cognome}, ${telefono || null},
        ${'Creato dall\'import da una prenotazione (non era in OSPITI). Nome originale: "' + nomeIntero + '"'})
      RETURNING id`;
    ospiteIdPerChiave[chiave] = row.id;
    return row.id;
  }

  // 6. Prenotazioni (dal foglio DATABASE, colonne B..K)
  const dbRows = await leggi('prenotazioni', 'DATABASE', 'B1:K100000');
  let nPren = 0, sommaLordo = 0, sommaUtile = 0, scartate = 0;
  for (let i = 1; i < dbRows.length; i++) {
    const [checkin, checkout, ospite, stanza, canaleRaw, lordoRaw, statoRaw, penaleRaw, eventId, telefono] = dbRows[i];
    if (!checkin || !ospite || !stanza || !canaleRaw) { scartate++; continue; }
    const ci = itToIso(checkin);
    if (!ci) { scartate++; continue; }
    const co = itToIso(checkout);
    const canale = CANALE_MAP[String(canaleRaw).trim()] ?? 'Diretto';
    const stato = STATO_MAP[String(statoRaw || 'Attiva').trim()] ?? 'Attiva';
    const lordo = num(lordoRaw);
    const alloggio_id = alloggioIdPerNomeFoglio[String(stanza).trim()];
    if (!alloggio_id) { console.warn('  ⚠️ stanza non riconosciuta:', stanza, '— riga saltata'); scartate++; continue; }
    const ospite_id = await trovaOCreaOspite(ospite, telefono);
    const comp = componentiPrenotazione(lordo, canale);
    const penale_importo = /penale/i.test(String(statoRaw)) ? (num(penaleRaw) || null) : null;

    await sql`
      INSERT INTO prenotazioni (alloggio_id, ospite_id, checkin, checkout, numero_ospiti,
        canale, lordo, commissione, cedolare, costo_pulizia, fee_gestione, utile,
        netto_proprietario, stato, penale_importo, calendar_event_id)
      VALUES (${alloggio_id}, ${ospite_id}, ${ci}, ${co}, 1, ${canale}, ${lordo},
        ${comp.commissione}, ${comp.cedolare}, ${comp.costo_pulizia}, ${comp.fee_gestione},
        ${comp.utile}, ${comp.netto_proprietario}, ${stato}, ${penale_importo},
        ${eventId || null})`;
    nPren++; sommaLordo += lordo; sommaUtile += comp.utile;
  }
  console.log(`Prenotazioni: ${nPren} (scartate ${scartate}) | somma lordo ${sommaLordo.toFixed(2)} | somma utile ${sommaUtile.toFixed(2)}`);

  // 7. Categorie spesa (lista fissa iniziale) + Spese
  const CATEGORIE = ['Utenze', 'Manutenzione', 'Prodotti pulizia', 'Commercialista', 'Tasse', 'Arredamento', 'Marketing', 'Altro'];
  const catId = {};
  for (const c of CATEGORIE) {
    const [row] = await sql`INSERT INTO categorie_spesa (nome) VALUES (${c}) RETURNING id`;
    catId[c] = row.id;
  }
  const speseRows = await leggi('gestione', 'SPESE');
  let nSpese = 0;
  for (let i = 1; i < speseRows.length; i++) {
    const [data, categoria, descrizione, importo, struttura] = speseRows[i];
    if (!data && !descrizione) continue;
    const d = itToIso(data);
    const catNome = CATEGORIE.includes(categoria) ? categoria : 'Altro';
    let immobile_id = null;
    for (const [nome, id] of Object.entries(immobiliId)) {
      if (struttura && (nome.includes(struttura) || struttura.includes('Clanio') && nome.includes('Clanio') || struttura.includes('Campania') && nome.includes('Campania'))) immobile_id = id;
    }
    if (alloggioIdPerNomeFoglio[String(struttura || '').trim()]) {
      // se la "struttura" è un nome di alloggio, risali all'immobile
      const arow = await sql`SELECT immobile_id FROM alloggi WHERE id = ${alloggioIdPerNomeFoglio[String(struttura).trim()]}`;
      immobile_id = arow[0]?.immobile_id ?? immobile_id;
    }
    await sql`
      INSERT INTO spese (immobile_id, categoria_id, data, descrizione, importo, note)
      VALUES (${immobile_id}, ${catId[catNome]}, ${d ?? new Date().toISOString().slice(0,10)},
        ${descrizione || '(senza descrizione)'}, ${num(importo)},
        ${struttura && !immobile_id ? 'Struttura dal foglio: ' + struttura : null})`;
    nSpese++;
  }
  console.log('Categorie spesa:', CATEGORIE.length, '| Spese:', nSpese);

  // 8. Scadenze
  const scadRows = await leggi('gestione', 'SCADENZE');
  const RICO = ['Una tantum', 'Mensile', 'Semestrale', 'Annuale'];
  let nScad = 0;
  for (let i = 1; i < scadRows.length; i++) {
    const [id, titolo, dataScad, ricorrenza, note, ultimoCompl] = scadRows[i];
    if (!titolo) continue;
    await sql`
      INSERT INTO scadenze (titolo, data_scadenza, ricorrenza, note, ultimo_completamento)
      VALUES (${titolo}, ${itToIso(dataScad) ?? new Date().toISOString().slice(0,10)},
        ${RICO.includes(ricorrenza) ? ricorrenza : 'Una tantum'}, ${note || null},
        ${itToIso(ultimoCompl)})`;
    nScad++;
  }
  console.log('Scadenze:', nScad);

  // 9. Pulizie (dal foglio PULIZIE: data, stanza, ospite, 7 checklist, operatore, completatoIl, note)
  const pulRows = await leggi('gestione', 'PULIZIE');
  let nPul = 0;
  for (let i = 1; i < pulRows.length; i++) {
    const r = pulRows[i];
    const data = r[0], stanza = r[1], operatore = r[10], completatoIl = r[11], note = r[12];
    if (!data && !stanza) continue;
    const alloggio_id = alloggioIdPerNomeFoglio[String(stanza || '').trim()];
    if (!alloggio_id) continue;
    await sql`
      INSERT INTO pulizie (alloggio_id, data, confermata_il, note)
      VALUES (${alloggio_id}, ${itToIso(data) ?? new Date().toISOString().slice(0,10)},
        ${completatoIl ? (itToIso(completatoIl) || null) : null},
        ${[operatore ? 'Operatore: ' + operatore : null, note].filter(Boolean).join(' — ') || null})`;
    nPul++;
  }
  console.log('Pulizie:', nPul);

  // 10. Schedine
  const schedRows = await leggi('prenotazioni', 'SCHEDINE', 'A1:U100000');
  let nSched = 0;
  for (let i = 1; i < schedRows.length; i++) {
    const r = schedRows[i];
    const cognome = r[3], nome = r[4];
    if (!cognome && !nome) continue;
    // collega alla prenotazione per stanza + data arrivo
    const dataArrivo = itToIso(r[0]);
    const stanza = String(r[2] || '').trim();
    const alloggio_id = alloggioIdPerNomeFoglio[stanza];
    let prenotazione_id = null, ospite_id = null;
    if (alloggio_id && dataArrivo) {
      const p = await sql`SELECT id, ospite_id FROM prenotazioni WHERE alloggio_id = ${alloggio_id} AND checkin = ${dataArrivo} LIMIT 1`;
      if (p[0]) { prenotazione_id = p[0].id; ospite_id = p[0].ospite_id; }
    }
    if (!prenotazione_id) { console.warn('  ⚠️ schedina senza prenotazione collegabile:', cognome, nome); continue; }
    await sql`
      INSERT INTO schedine (prenotazione_id, ospite_id, cognome, nome, sesso, data_nascita,
        luogo_nascita, cittadinanza, tipo_documento, numero_documento, luogo_rilascio_documento,
        stato, stato_nascita_codice, cittadinanza_codice, tipo_documento_codice, tipo_alloggiato_codice)
      VALUES (${prenotazione_id}, ${ospite_id}, ${cognome || ''}, ${nome || ''},
        ${['M','F'].includes(r[13]) ? r[13] : null}, ${itToIso(r[5])}, ${r[6] || null},
        ${r[7] || null}, ${r[8] || null}, ${r[9] || null}, ${r[20] || null},
        ${r[11] === 'Inviata' ? 'Inviata' : 'Da inviare'}, ${r[17] || null}, ${r[18] || null},
        ${r[19] || null}, ${r[14] || null})`;
    nSched++;
  }
  console.log('Schedine:', nSched);

  // 11. Contratti (foglio CONTRATTI: solo audit trail — creiamo un documento "segnaposto")
  const contrRows = await leggi('prenotazioni', 'CONTRATTI');
  let nContr = 0;
  for (let i = 1; i < contrRows.length; i++) {
    const [dataGen, ospite, stanza, checkinC, , , importo] = contrRows[i];
    if (!ospite && !dataGen) continue;
    const alloggio_id = alloggioIdPerNomeFoglio[String(stanza || '').trim()];
    let prenotazione_id = null;
    if (alloggio_id && itToIso(checkinC)) {
      const p = await sql`SELECT id FROM prenotazioni WHERE alloggio_id = ${alloggio_id} AND checkin = ${itToIso(checkinC)} LIMIT 1`;
      prenotazione_id = p[0]?.id ?? null;
    }
    await sql`
      INSERT INTO documenti (tipo, nome, prenotazione_id, caricato_il)
      VALUES ('Contratto ospite', ${'Contratto ' + (ospite || '?') + ' — ' + (stanza || '?')},
        ${prenotazione_id}, ${dataGen ? new Date(dataGen).toISOString() : new Date().toISOString()})`;
    nContr++;
  }
  console.log('Contratti (come documenti):', nContr);

  // 12. Sistema: bot_state, telegram_log, email_processate
  const botRows = await leggi('sistema', 'BOT_STATE');
  let nBot = 0;
  for (let i = 1; i < botRows.length; i++) {
    const [chatId, updatedAt, stateJson] = botRows[i];
    if (!chatId) continue;
    let stato; try { stato = JSON.parse(stateJson || '{}'); } catch { stato = {}; }
    await sql`INSERT INTO bot_state (chat_id, stato, aggiornato_il)
      VALUES (${chatId}, ${JSON.stringify(stato)}::jsonb, ${updatedAt ? new Date(updatedAt).toISOString() : new Date().toISOString()})
      ON CONFLICT (chat_id) DO UPDATE SET stato = EXCLUDED.stato`;
    nBot++;
  }
  const tgRows = await leggi('sistema', 'TELEGRAM_LOG');
  let nTg = 0;
  for (let i = 1; i < tgRows.length; i++) {
    const [ts, chatId, role, text] = tgRows[i];
    if (!ts || !text) continue;
    await sql`INSERT INTO telegram_log (ts, chat_id, ruolo, testo)
      VALUES (${new Date(ts).toISOString()}, ${chatId || '?'}, ${role || 'user'}, ${text})`;
    nTg++;
  }
  const emRows = await leggi('sistema', 'EmailProcessate');
  let nEm = 0;
  for (let i = 1; i < emRows.length; i++) {
    const [msgId, tipo, data, esito] = emRows[i];
    if (!msgId) continue;
    await sql`INSERT INTO email_processate (message_id, tipo, data, esito)
      VALUES (${msgId}, ${tipo || '?'}, ${data ? new Date(data).toISOString() : new Date().toISOString()}, ${esito || '?'})
      ON CONFLICT (message_id) DO NOTHING`;
    nEm++;
  }
  console.log(`Sistema: bot_state ${nBot} | telegram_log ${nTg} | email_processate ${nEm}`);

  // 13. Utente titolare (Raffaele) — password uguale a quella attuale, hash rigenerato
  //     Nota: qui non ha più senso "raffaele/strada-lupo-89" perché il login è rimosso;
  //     creiamo comunque la riga titolare per quando il login tornerà (fase 5).
  const { scryptSync, randomBytes } = await import('crypto');
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync('strada-lupo-89', salt, 64).toString('hex');
  await sql`INSERT INTO utenti (username, password_hash, nome, ruolo)
    VALUES ('raffaele', ${salt + ':' + hash}, 'Raffaele Salzillo', 'Titolare')`;
  console.log('Utenti: 1 (titolare)');

  console.log('\n✅ Import completato.');
}

main().catch((e) => { console.error('\n❌ ERRORE:', e); process.exit(1); });
