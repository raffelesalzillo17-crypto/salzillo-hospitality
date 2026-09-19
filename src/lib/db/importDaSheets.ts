/**
 * Importa TUTTI i dati dai 3 file Google Sheet nel database Neon.
 *
 * Usato in due modi:
 *  - script una tantum:  npx tsx scripts/importa.ts
 *  - cron di sincronizzazione (/api/cron/sync-db): rilanciato periodicamente finché Google
 *    Sheets resta la fonte viva (fasi 2-4 del piano), così il database resta allineato al
 *    foglio senza che nessuno debba scrivere due volte.
 *
 * Ri-eseguibile: TRUNCATE + reimport da zero.
 * Vedi data/wiki/sintesi/piano-migrazione-database-modello-proprietario.md.
 */

import { eq, sql } from 'drizzle-orm';
import { randomBytes, scryptSync } from 'crypto';
import { getDb } from './index';
import {
  proprietari, immobili, alloggi, ospiti, prenotazioni, categorieSpesa, spese, scadenze,
  pulizie, schedine, documenti, botState, telegramLog, emailProcessate, utenti,
} from './schema';
import { getSheetsClient } from '../sheets';

const FILES = {
  prenotazioni: '1SFQhO_SPRvIe8L1lgILRNsE-kUHPEfVqUEo3-wwwRjs',
  gestione:     '1A-Fi97s4af9qJWTupjVEajWP8bZzxHLdpLiyA6jcXbE',
  sistema:      '1SR6x6fRHsx37fVyF9ErmvM8m9oUTYFysQz1pZPB89xQ',
};

type Cell = string | number | boolean | null | undefined;
type Riga = Cell[];

async function leggi(fileKey: keyof typeof FILES, tab: string, range = 'A1:AZ100000'): Promise<Riga[]> {
  const sheets = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets.readonly']);
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: FILES[fileKey], range: `${tab}!${range}` });
  return (res.data.values ?? []) as Riga[];
}

const itToIso = (s: Cell): string | null => {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
};
const num = (v: Cell): number => {
  if (v == null || v === '') return 0;
  const s = String(v).trim();
  return parseFloat(s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s) || 0;
};
// Confronta i telefoni per le ultime 10 cifre: assorbe prefisso +39 presente/assente, spazi,
// e i caratteri Unicode invisibili (LRM/RLM) che WhatsApp a volte aggiunge quando un numero
// viene copiato da lì — senza questo, lo stesso numero con/senza quei caratteri non combacia
// e l'ospite viene ricreato da capo ad ogni sync (bug reale, 19/09/2026: Marcello Vaghi e una
// dozzina di altri ospiti duplicati da un sync dopo che la loro prenotazione era già stata
// confermata a mano nel nuovo sistema).
const normTel = (t: Cell): string | null => {
  const cifre = String(t || '').replace(/\D/g, '');
  return cifre.length >= 8 ? cifre.slice(-10) : null;
};
const splitNome = (intero: Cell): { nome: string; cognome: string } => {
  const parti = String(intero || '').trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return { nome: '(sconosciuto)', cognome: '(sconosciuto)' };
  if (parti.length === 1) return { nome: parti[0], cognome: '' };
  return { nome: parti.slice(0, -1).join(' '), cognome: parti[parti.length - 1] };
};

const COMM_RATE: Record<string, number> = { Airbnb: 0.1891, Booking: 0.2015, Diretto: 0, 'No Tax': 0 };
function componenti(lordo: number, canale: string) {
  const commissione = Math.round(lordo * (COMM_RATE[canale] ?? 0) * 100) / 100;
  const cedolare = canale === 'No Tax' ? 0 : Math.round(lordo * 0.21 * 100) / 100;
  const costo_pulizia = 20, fee_gestione = 0;
  const utile = Math.round((lordo - commissione - cedolare - costo_pulizia) * 100) / 100;
  return { commissione, cedolare, costo_pulizia, fee_gestione, utile, netto_proprietario: utile - fee_gestione };
}
const CANALE_MAP: Record<string, string> = { Airbnb: 'Airbnb', Booking: 'Booking', Diretto: 'Diretto', 'No Tax': 'No Tax', 'No tax': 'No Tax', Notax: 'No Tax' };
const STATO_MAP: Record<string, string> = {
  Attiva: 'Attiva', Cancellata: 'Cancellata', 'Cancellata con penale': 'Cancellata con penale',
  'No-show': 'No-show', 'No show': 'No-show', 'In attesa': 'In attesa di conferma',
};

const ALLOGGI_SEED = [
  { nome: 'Il Tulipano', immobile: 'Via Clanio 60', foglio: 'Tulipano', regime: 'Con cedolare' as const, self: true, emoji: '🌷', wifi: ['Lella', 'Lella1978@'], trasm: true, sogg: 'Marcianise' },
  { nome: 'Stanza Rosa', immobile: 'Via Clanio 60', foglio: 'Rosa', regime: 'No tax' as const, self: false, emoji: '🌸', wifi: ['Lella', 'Lella1978@'], trasm: false, sogg: null },
  { nome: 'Piano Terra', immobile: 'Via Campania 36', foglio: 'Piano Terra', regime: 'No tax' as const, self: false, emoji: '🏠', wifi: null, trasm: false, sogg: null },
  { nome: 'Primo Piano', immobile: 'Via Campania 36', foglio: 'Primo Piano', regime: 'No tax' as const, self: false, emoji: '🏠', wifi: null, trasm: false, sogg: null },
  { nome: 'Secondo Piano', immobile: 'Via Campania 36', foglio: 'Secondo Piano', regime: 'No tax' as const, self: false, emoji: '🏠', wifi: null, trasm: false, sogg: null },
];
const CATEGORIE = ['Utenze', 'Manutenzione', 'Prodotti pulizia', 'Commercialista', 'Tasse', 'Arredamento', 'Marketing', 'Altro'];

export type RisultatoImport = {
  proprietari: number; immobili: number; alloggi: number; ospiti: number;
  prenotazioni: number; sommaLordo: number; sommaUtile: number;
  spese: number; scadenze: number; pulizie: number; schedine: number; contratti: number;
  botState: number; telegramLog: number; emailProcessate: number;
};

export async function importaDaSheets(): Promise<RisultatoImport> {
  const db = getDb();

  // ── SYNC NON DISTRUTTIVO ──
  // L'anagrafica (proprietari/immobili/alloggi/categorie/utenti) si crea SOLO la prima volta;
  // i sync successivi non la toccano — così le modifiche fatte in /nuovo restano.
  // Le prenotazioni/ospiti/spese/... si riscrivono ma SOLO le righe con origine='Foglio':
  // quelle create direttamente nel nuovo sistema (origine='Database') sopravvivono.
  // prima i record che dipendono dalle prenotazioni del foglio (FK NO ACTION):
  // così il DELETE sotto non fallisce se qualcuno vi ha agganciato pagamenti/schedine/ecc.
  await db.execute(sql`DELETE FROM pagamenti WHERE prenotazione_id IN (SELECT id FROM prenotazioni WHERE origine = 'Foglio')`);
  await db.execute(sql`DELETE FROM ospiti_prenotazione WHERE prenotazione_id IN (SELECT id FROM prenotazioni WHERE origine = 'Foglio')`);
  await db.execute(sql`DELETE FROM pulizie WHERE prenotazione_id IN (SELECT id FROM prenotazioni WHERE origine = 'Foglio')`);
  await db.execute(sql`DELETE FROM schedine WHERE prenotazione_id IN (SELECT id FROM prenotazioni WHERE origine = 'Foglio')`);
  await db.execute(sql`DELETE FROM notifiche WHERE prenotazione_id IN (SELECT id FROM prenotazioni WHERE origine = 'Foglio')`);
  await db.execute(sql`UPDATE preventivi SET prenotazione_id = NULL WHERE prenotazione_id IN (SELECT id FROM prenotazioni WHERE origine = 'Foglio')`);
  await db.execute(sql`DELETE FROM prenotazioni WHERE origine = 'Foglio'`);
  // NON basta proteggere gli ospiti agganciati a una prenotazione: un ospite può esistere
  // SOLO per un preventivo (non ha ancora prenotato) o per un documento caricato a mano — se
  // origine='Foglio' e la sync lo cancella comunque, il preventivo/documento resta con un
  // ospite_id orfano e il prossimo salvataggio fallisce con un errore di foreign key (bug
  // reale, 14/09/2026: preventivo PR-0002 di Raffaele, ospite creato dal foglio poi cancellato
  // da un "aggiorna dal foglio" prima che il preventivo venisse salvato).
  await db.execute(sql`DELETE FROM ospiti WHERE origine = 'Foglio' AND id NOT IN (
    SELECT ospite_id FROM prenotazioni
    UNION SELECT ospite_id FROM ospiti_prenotazione
    UNION SELECT ospite_id FROM preventivi WHERE ospite_id IS NOT NULL
    UNION SELECT ospite_id FROM documenti WHERE ospite_id IS NOT NULL
  )`);
  await db.execute(sql`DELETE FROM spese WHERE origine = 'Foglio'`);
  await db.execute(sql`DELETE FROM scadenze WHERE origine = 'Foglio'`);
  await db.execute(sql`DELETE FROM pulizie WHERE origine = 'Foglio'`);
  await db.execute(sql`DELETE FROM schedine WHERE origine = 'Foglio'`);
  await db.execute(sql`DELETE FROM documenti WHERE origine = 'Foglio'`);
  await db.execute(sql`TRUNCATE TABLE bot_state, telegram_log, email_processate`);

  const esistenti = await db.select({ id: proprietari.id }).from(proprietari).limit(1);
  const primaVolta = esistenti.length === 0;

  const immId: Record<string, string> = {};
  const alloggioPerFoglio: Record<string, string> = {};

  if (primaVolta) {
    const [pL] = await db.insert(proprietari).values({ nome: 'Salzillo Luigi', tipo: 'Persona fisica', note: 'Padre di Raffaele. Intestatario SCIA e notifica sanitaria Via Clanio 60.' }).returning({ id: proprietari.id });
    const [pR] = await db.insert(proprietari).values({ nome: 'Raffaela Iodice', tipo: 'Persona fisica', note: 'Madre di Raffaele ("Lella"). Intestataria attuale Via Campania 36. Fa anche le pulizie.' }).returning({ id: proprietari.id });
    const [iC] = await db.insert(immobili).values({ proprietario_id: pL.id, nome: 'Via Clanio 60', indirizzo: 'Via Clanio 60', comune: 'Marcianise', provincia: 'CE' }).returning({ id: immobili.id });
    const [iV] = await db.insert(immobili).values({ proprietario_id: pR.id, nome: 'Via Campania 36', indirizzo: 'Via Campania 36', comune: 'Marcianise', provincia: 'CE' }).returning({ id: immobili.id });
    immId['Via Clanio 60'] = iC.id; immId['Via Campania 36'] = iV.id;
    for (const a of ALLOGGI_SEED) {
      const [row] = await db.insert(alloggi).values({
        immobile_id: immId[a.immobile], nome: a.nome, regime_fiscale: a.regime, costo_pulizia: '20',
        ha_self_checkin: a.self, emoji: a.emoji, wifi_ssid: a.wifi?.[0] ?? null, wifi_password: a.wifi?.[1] ?? null,
        trasmette_alloggiati: a.trasm, imposta_soggiorno_comune: a.sogg,
        checkin_guide_url: `https://salzillo-hospitality.vercel.app/checkin/${a.foglio.toLowerCase().replace(/\s+/g, '-')}.html`,
      }).returning({ id: alloggi.id });
      alloggioPerFoglio[a.foglio] = row.id;
    }
    // Niente password reali scritte qui: se questo seed dovesse mai rigirare da zero (nuovo
    // ambiente, disaster recovery), ne genera una temporanea casuale e la stampa SOLO nel log
    // di esecuzione (mai nel codice/commit) — da cambiare subito dopo il primo accesso.
    const passwordSeed = process.env.SEED_TITOLARE_PASSWORD || randomBytes(9).toString('base64url');
    const salt0 = randomBytes(16).toString('hex');
    await db.insert(utenti).values({ username: 'raffaele', password_hash: `${salt0}:${scryptSync(passwordSeed, salt0, 64).toString('hex')}`, nome: 'Raffaele Salzillo', ruolo: 'Titolare' });
    if (!process.env.SEED_TITOLARE_PASSWORD) {
      console.warn(`[importDaSheets] Password temporanea generata per "raffaele": ${passwordSeed} — cambiala subito dopo il primo accesso.`);
    }
  } else {
    for (const im of await db.select().from(immobili)) immId[im.nome] = im.id;
    for (const al of await db.select().from(alloggi)) {
      const seed = ALLOGGI_SEED.find((s) => s.nome === al.nome);
      if (seed) alloggioPerFoglio[seed.foglio] = al.id;
    }
  }

  // Ospiti
  // Prima di creare un ospite dal foglio, controlla se esiste già nel database (per telefono,
  // la chiave più affidabile — i nomi si spezzano diversamente tra i vari tab del foglio) o,
  // in mancanza di telefono, per nome completo. Altrimenti ogni sync ricrea da zero chiunque
  // sia già stato registrato a mano nel nuovo sistema (es. da un preventivo accettato) e che
  // compare anche nel foglio: l'ospite si duplica invece di restare lo stesso.
  const ospitiEsistenti = await db.select({ id: ospiti.id, nome: ospiti.nome, cognome: ospiti.cognome, telefono: ospiti.telefono }).from(ospiti);
  const esistentePerTelefono = new Map<string, string>();
  const esistentePerNome = new Map<string, string>();
  for (const o of ospitiEsistenti) {
    const t = normTel(o.telefono);
    if (t && !esistentePerTelefono.has(t)) esistentePerTelefono.set(t, o.id);
    const n = `${o.nome} ${o.cognome}`.toLowerCase().trim();
    if (n && !esistentePerNome.has(n)) esistentePerNome.set(n, o.id);
  }

  const ospitiRows = await leggi('prenotazioni', 'OSPITI');
  const ospitePerChiave: Record<string, string> = {};
  let nOspiti = 0;
  for (let i = 1; i < ospitiRows.length; i++) {
    const [ospiteIdFoglio, nomeIntero, telefono, cf, note] = ospitiRows[i];
    if (!nomeIntero) continue;
    const chiave = String(nomeIntero).toLowerCase().trim();
    const tel = normTel(telefono);
    const giaEsiste = (tel && esistentePerTelefono.get(tel)) || esistentePerNome.get(chiave);
    if (giaEsiste) { ospitePerChiave[chiave] = giaEsiste; continue; }
    const { nome, cognome } = splitNome(nomeIntero);
    const [row] = await db.insert(ospiti).values({
      origine: 'Foglio',
      nome, cognome, telefono: telefono ? String(telefono) : null, codice_fiscale: cf ? String(cf) : null,
      note: note ? String(note) : null,
      note_import: `Nome originale dal foglio: "${nomeIntero}"${ospiteIdFoglio ? ` (OspiteId ${ospiteIdFoglio})` : ''}`,
    }).returning({ id: ospiti.id });
    ospitePerChiave[chiave] = row.id;
    if (tel) esistentePerTelefono.set(tel, row.id);
    esistentePerNome.set(chiave, row.id);
    nOspiti++;
  }
  async function trovaOCreaOspite(nomeIntero: Cell, telefono: Cell): Promise<string> {
    const chiave = String(nomeIntero).toLowerCase().trim();
    if (ospitePerChiave[chiave]) return ospitePerChiave[chiave];
    const tel = normTel(telefono);
    const giaEsiste = (tel && esistentePerTelefono.get(tel)) || esistentePerNome.get(chiave);
    if (giaEsiste) { ospitePerChiave[chiave] = giaEsiste; return giaEsiste; }
    const { nome, cognome } = splitNome(nomeIntero);
    const [row] = await db.insert(ospiti).values({
      origine: 'Foglio',
      nome, cognome, telefono: telefono ? String(telefono) : null,
      note_import: `Creato dall'import da una prenotazione. Nome originale: "${nomeIntero}"`,
    }).returning({ id: ospiti.id });
    ospitePerChiave[chiave] = row.id;
    if (tel) esistentePerTelefono.set(tel, row.id);
    esistentePerNome.set(chiave, row.id);
    return row.id;
  }

  // Prenotazioni
  // Le prenotazioni create direttamente nel nuovo sistema (origine='Database') si scrivono da
  // sole anche sul foglio (vedi scriviNuovaPrenotazioneSuFoglio), riportando il proprio eventId
  // in colonna J — altrimenti questo stesso import le re-inserirebbe come righe 'Foglio'
  // duplicate a ogni sincronizzazione (scoperto il 13/09/2026 con la prenotazione doppia di
  // Emanuel Sulis). Le righe con un eventId già in uso da una prenotazione Database vanno
  // saltate: sono lo specchio di quella prenotazione, non una nuova.
  const eventIdDatabase = new Set(
    (await db.select({ id: prenotazioni.calendar_event_id }).from(prenotazioni).where(eq(prenotazioni.origine, 'Database')))
      .map((r) => r.id).filter((id): id is string => !!id),
  );
  const dbRows = await leggi('prenotazioni', 'DATABASE', 'B1:K100000');
  let nPren = 0, sommaLordo = 0, sommaUtile = 0;
  for (let i = 1; i < dbRows.length; i++) {
    const [checkin, checkout, ospite, stanza, canaleRaw, lordoRaw, statoRaw, penaleRaw, eventId, telefono] = dbRows[i];
    if (!checkin || !ospite || !stanza || !canaleRaw) continue;
    if (eventId && eventIdDatabase.has(String(eventId))) continue;
    const ci = itToIso(checkin); if (!ci) continue;
    const canale = CANALE_MAP[String(canaleRaw).trim()] ?? 'Diretto';
    const stato = STATO_MAP[String(statoRaw || 'Attiva').trim()] ?? 'Attiva';
    const lordo = num(lordoRaw);
    const alloggio_id = alloggioPerFoglio[String(stanza).trim()];
    if (!alloggio_id) continue;
    const ospite_id = await trovaOCreaOspite(ospite, telefono);
    const c = componenti(lordo, canale);
    await db.insert(prenotazioni).values({
      origine: 'Foglio',
      alloggio_id, ospite_id, checkin: ci, checkout: itToIso(checkout) ?? ci, numero_ospiti: 1,
      canale: canale as 'Airbnb', lordo: String(lordo), commissione: String(c.commissione),
      cedolare: String(c.cedolare), costo_pulizia: String(c.costo_pulizia), fee_gestione: String(c.fee_gestione),
      utile: String(c.utile), netto_proprietario: String(c.netto_proprietario),
      stato: stato as 'Attiva',
      penale_importo: /penale/i.test(String(statoRaw)) ? String(num(penaleRaw) || 0) : null,
      calendar_event_id: eventId ? String(eventId) : null,
    });
    nPren++; sommaLordo += lordo; sommaUtile += c.utile;
  }

  // Categorie + spese
  const catId: Record<string, string> = {};
  const catEsistenti = await db.select().from(categorieSpesa);
  for (const c of CATEGORIE) {
    const trovata = catEsistenti.find((x) => x.nome === c);
    if (trovata) { catId[c] = trovata.id; continue; }
    const [row] = await db.insert(categorieSpesa).values({ nome: c }).returning({ id: categorieSpesa.id });
    catId[c] = row.id;
  }
  const speseRows = await leggi('gestione', 'SPESE');
  let nSpese = 0;
  for (let i = 1; i < speseRows.length; i++) {
    const [data, categoria, descrizione, importo, struttura] = speseRows[i];
    if (!data && !descrizione) continue;
    const catNome = CATEGORIE.includes(String(categoria)) ? String(categoria) : 'Altro';
    let immobile_id: string | null = null;
    if (struttura) {
      const s = String(struttura);
      if (s.includes('Clanio')) immobile_id = immId['Via Clanio 60'];
      else if (s.includes('Campania')) immobile_id = immId['Via Campania 36'];
      else if (alloggioPerFoglio[s.trim()]) {
        const a = ALLOGGI_SEED.find((x) => x.foglio === s.trim());
        immobile_id = a ? immId[a.immobile] : null;
      }
    }
    await db.insert(spese).values({
      origine: 'Foglio',
      immobile_id, categoria_id: catId[catNome], data: itToIso(data) ?? new Date().toISOString().slice(0, 10),
      descrizione: descrizione ? String(descrizione) : '(senza descrizione)', importo: String(num(importo)),
      note: struttura && !immobile_id ? `Struttura dal foglio: ${struttura}` : null,
    });
    nSpese++;
  }

  // Scadenze
  const scadRows = await leggi('gestione', 'SCADENZE');
  const RICO = ['Una tantum', 'Mensile', 'Semestrale', 'Annuale'];
  let nScad = 0;
  for (let i = 1; i < scadRows.length; i++) {
    const [, titolo, dataScad, ricorrenza, note, ultimoCompl] = scadRows[i];
    if (!titolo) continue;
    await db.insert(scadenze).values({
      origine: 'Foglio',
      titolo: String(titolo), data_scadenza: itToIso(dataScad) ?? new Date().toISOString().slice(0, 10),
      ricorrenza: (RICO.includes(String(ricorrenza)) ? String(ricorrenza) : 'Una tantum') as 'Una tantum',
      note: note ? String(note) : null, ultimo_completamento: itToIso(ultimoCompl),
    });
    nScad++;
  }

  // Pulizie
  const pulRows = await leggi('gestione', 'PULIZIE');
  let nPul = 0;
  for (let i = 1; i < pulRows.length; i++) {
    const r = pulRows[i];
    const data = r[0], stanza = r[1], operatore = r[10], completatoIl = r[11], note = r[12];
    if (!data && !stanza) continue;
    const alloggio_id = alloggioPerFoglio[String(stanza || '').trim()];
    if (!alloggio_id) continue;
    await db.insert(pulizie).values({
      origine: 'Foglio',
      alloggio_id, data: itToIso(data) ?? new Date().toISOString().slice(0, 10),
      confermata_il: completatoIl && itToIso(completatoIl) ? new Date(itToIso(completatoIl)!) : null,
      note: [operatore ? `Operatore: ${operatore}` : null, note].filter(Boolean).join(' — ') || null,
    });
    nPul++;
  }

  // Schedine
  const schedRows = await leggi('prenotazioni', 'SCHEDINE', 'A1:U100000');
  let nSched = 0;
  for (let i = 1; i < schedRows.length; i++) {
    const r = schedRows[i];
    const cognome = r[3], nome = r[4];
    if (!cognome && !nome) continue;
    const dataArrivo = itToIso(r[0]);
    const alloggio_id = alloggioPerFoglio[String(r[2] || '').trim()];
    if (!alloggio_id || !dataArrivo) continue;
    const p = await db.execute(sql`SELECT id, ospite_id FROM prenotazioni WHERE alloggio_id = ${alloggio_id} AND checkin = ${dataArrivo} LIMIT 1`);
    const pr = (p.rows ?? p)[0] as { id: string; ospite_id: string } | undefined;
    if (!pr) continue;
    await db.insert(schedine).values({
      origine: 'Foglio',
      prenotazione_id: pr.id, ospite_id: pr.ospite_id, cognome: String(cognome || ''), nome: String(nome || ''),
      sesso: ['M', 'F'].includes(String(r[13])) ? (String(r[13]) as 'M') : null,
      data_nascita: itToIso(r[5]), luogo_nascita: r[6] ? String(r[6]) : null,
      cittadinanza: r[7] ? String(r[7]) : null, tipo_documento: r[8] ? String(r[8]) : null,
      numero_documento: r[9] ? String(r[9]) : null, luogo_rilascio_documento: r[20] ? String(r[20]) : null,
      stato: r[11] === 'Inviata' ? 'Inviata' : 'Da inviare',
      stato_nascita_codice: r[17] ? String(r[17]) : null, cittadinanza_codice: r[18] ? String(r[18]) : null,
      tipo_documento_codice: r[19] ? String(r[19]) : null, tipo_alloggiato_codice: r[14] ? String(r[14]) : null,
    });
    nSched++;
  }

  // Contratti → documenti
  const contrRows = await leggi('prenotazioni', 'CONTRATTI');
  let nContr = 0;
  for (let i = 1; i < contrRows.length; i++) {
    const [dataGen, ospite, stanza, checkinC] = contrRows[i];
    if (!ospite && !dataGen) continue;
    const alloggio_id = alloggioPerFoglio[String(stanza || '').trim()];
    let prenotazione_id: string | null = null;
    if (alloggio_id && itToIso(checkinC)) {
      const p = await db.execute(sql`SELECT id FROM prenotazioni WHERE alloggio_id = ${alloggio_id} AND checkin = ${itToIso(checkinC)} LIMIT 1`);
      prenotazione_id = ((p.rows ?? p)[0] as { id: string } | undefined)?.id ?? null;
    }
    await db.insert(documenti).values({
      origine: 'Foglio',
      tipo: 'Contratto ospite', nome: `Contratto ${ospite || '?'} — ${stanza || '?'}`,
      prenotazione_id, caricato_il: dataGen ? new Date(String(dataGen)) : new Date(),
    });
    nContr++;
  }

  // Sistema
  const botRows = await leggi('sistema', 'BOT_STATE');
  let nBot = 0;
  for (let i = 1; i < botRows.length; i++) {
    const [chatId, updatedAt, stateJson] = botRows[i];
    if (!chatId) continue;
    let stato: unknown; try { stato = JSON.parse(String(stateJson || '{}')); } catch { stato = {}; }
    await db.insert(botState).values({ chat_id: String(chatId), stato, aggiornato_il: updatedAt ? new Date(String(updatedAt)) : new Date() }).onConflictDoUpdate({ target: botState.chat_id, set: { stato } });
    nBot++;
  }
  const tgRows = await leggi('sistema', 'TELEGRAM_LOG');
  let nTg = 0;
  for (let i = 1; i < tgRows.length; i++) {
    const [ts, chatId, role, text] = tgRows[i];
    if (!ts || !text) continue;
    await db.insert(telegramLog).values({ ts: new Date(String(ts)), chat_id: String(chatId || '?'), ruolo: String(role || 'user'), testo: String(text) });
    nTg++;
  }
  const emRows = await leggi('sistema', 'EmailProcessate');
  let nEm = 0;
  for (let i = 1; i < emRows.length; i++) {
    const [msgId, tipo, data, esito] = emRows[i];
    if (!msgId) continue;
    await db.insert(emailProcessate).values({ message_id: String(msgId), tipo: String(tipo || '?'), data: data ? new Date(String(data)) : new Date(), esito: String(esito || '?') }).onConflictDoNothing();
    nEm++;
  }

  return {
    proprietari: 2, immobili: 2, alloggi: ALLOGGI_SEED.length, ospiti: nOspiti,
    prenotazioni: nPren, sommaLordo: Math.round(sommaLordo * 100) / 100, sommaUtile: Math.round(sommaUtile * 100) / 100,
    spese: nSpese, scadenze: nScad, pulizie: nPul, schedine: nSched, contratti: nContr,
    botState: nBot, telegramLog: nTg, emailProcessate: nEm,
  };
}
