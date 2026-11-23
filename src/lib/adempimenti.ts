/**
 * Adempimenti (punto 6 delle richieste, 23/11/2026): arrivi con lo stato di ciascuno per Alloggiati Web,
 * file da caricare sul portale, avvisi su schedine mancanti o in ritardo, stato mensile di Sinfonia.
 *
 * REGOLA: niente invio automatico. Questo modulo PREPARA e MOSTRA; il Titolare scarica il file, lo carica
 * sul portale e segna a mano "inviata". Non contatta mai Alloggiati Web e non tocca la logica di invio
 * reale (alloggiatiInvio.ts): ricostruisce i dati con le stesse regole di formato.
 *
 * Stati per prenotazione (per strutture che trasmettono ad Alloggiati Web):
 *   Da preparare  → mancano schedine o dati obbligatori, o le schedine non coincidono con gli ospiti
 *   Pronta        → schedine complete e valide: si può scaricare il file
 *   Inviata       → tutte le schedine risultano inviate (dal gestionale o segnate a mano)
 *   Con errore    → una schedina ha un errore d'invio
 *   Da verificare → stato incerto (invio rimasto a metà): va controllato sul portale
 *   Non soggetta  → canale "No Tax": come da regola attuale NON viene inviata (si mostra, non si nasconde)
 *
 * Termine: 24 ore dall'arrivo. L'ora di arrivo non è registrata, quindi si conta in modo prudente dall'inizio
 * del giorno di check-in (cioè entro la fine del giorno di arrivo).
 */
import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { getDb } from './db';
import { alloggi, immobili, inviiRegione, ospiti, prenotazioni, schedine } from './db/schema';
import { formatSchedinaRecord, ordinaGruppoAlloggiati, validateSchedina, type DatiSchedina, type TipoAlloggiatoCodice } from './alloggiatiRecordFormat';
import { codiceLuogoRilascio } from './alloggiatiLookup';
import { controlloOspitiSchedine } from './controlloOspiti';

export type StatoAlloggiati = 'Da preparare' | 'Pronta' | 'Inviata' | 'Con errore' | 'Da verificare' | 'Non soggetta';

export type ArrivoAdempimento = {
  prenotazioneId: string; alloggio: string; checkin: string; checkout: string; canale: string;
  ospite: string; ospitiAttesi: number; schedine: number;
  stato: StatoAlloggiati; motivi: string[];
  scadeIl: string; oreAllaScadenza: number; inRitardo: boolean; inviataIl: string | null;
};

const MARCA_MANO = 'Segnata come inviata a mano dal Titolare';

export function inizioGiornoRoma(iso: string): number {
  const utc = Date.parse(`${iso}T00:00:00Z`);
  const parti = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', timeZoneName: 'shortOffset' }).formatToParts(new Date(utc + 12 * 3600e3));
  const m = (parti.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1').match(/GMT([+-]\d+)/);
  return utc - (m ? Number(m[1]) : 1) * 3600e3;
}
const isoToIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const notti = (ci: string, co: string) => Math.max(1, Math.round((Date.parse(co) - Date.parse(ci)) / 864e5));

type RigaSch = {
  id: string; cognome: string; nome: string; sesso: string | null; dataNascita: string | null; comuneNascitaCodice: string | null;
  provinciaNascita: string | null; statoNascitaCodice: string | null; cittadinanzaCodice: string | null; tipoDocumentoCodice: string | null;
  numeroDocumento: string | null; luogoRilascioDocumento: string | null; tipo: string | null; stato: string; esito: string | null; inviataIl: Date | null;
};

/** Stesse regole dell'invio reale: DatiSchedina + errori in italiano (vuoto = valida). */
function costruisciDati(s: RigaSch, checkin: string, checkout: string): { dati?: DatiSchedina; errori: string[] } {
  const chi = `${s.nome} ${s.cognome}`.trim();
  const errori: string[] = [];
  if (!s.tipo) errori.push(`${chi}: manca il tipo di ospite (singolo, capofamiglia…)`);
  if (s.sesso !== 'M' && s.sesso !== 'F') errori.push(`${chi}: sesso mancante`);
  if (!s.dataNascita) errori.push(`${chi}: data di nascita mancante`);
  if (!s.statoNascitaCodice) errori.push(`${chi}: stato di nascita mancante`);
  if (!s.cittadinanzaCodice) errori.push(`${chi}: cittadinanza mancante`);
  const serveDoc = s.tipo === '16' || s.tipo === '17' || s.tipo === '18';
  if (serveDoc && !s.tipoDocumentoCodice) errori.push(`${chi}: tipo di documento mancante`);
  if (serveDoc && !(s.numeroDocumento ?? '').trim()) errori.push(`${chi}: numero del documento mancante`);
  let luogo: string | null = null;
  if (serveDoc) {
    luogo = codiceLuogoRilascio(s.luogoRilascioDocumento);
    if (!luogo) errori.push(`${chi}: luogo di rilascio del documento ${s.luogoRilascioDocumento?.trim() ? `"${s.luogoRilascioDocumento}" non riconosciuto nelle tabelle ufficiali` : 'mancante'}`);
  }
  if (errori.length) return { errori };
  const dati: DatiSchedina = {
    tipoAlloggiato: s.tipo as TipoAlloggiatoCodice, dataArrivo: isoToIt(checkin), numeroGiorniPermanenza: notti(checkin, checkout),
    cognome: s.cognome, nome: s.nome, sesso: s.sesso === 'F' ? '2' : '1', dataNascita: isoToIt(s.dataNascita!),
    comuneNascita: s.comuneNascitaCodice ?? undefined, provinciaNascita: s.provinciaNascita ?? undefined,
    statoNascita: s.statoNascitaCodice!, cittadinanza: s.cittadinanzaCodice!,
    tipoDocumento: s.tipoDocumentoCodice ?? undefined, numeroDocumento: s.numeroDocumento ?? undefined, luogoRilascioDocumento: luogo ?? undefined,
  };
  const altri = validateSchedina(dati).map((e) => `${chi}: ${e}`);
  return altri.length ? { errori: altri } : { dati, errori: [] };
}

type DatiPren = { id: string; alloggio: string; checkin: string; checkout: string; canale: string; stato: string; ospitiAttesi: number; ospite: string };

function valutaPrenotazione(p: DatiPren, sch: RigaSch[], ora: number): { arrivo: ArrivoAdempimento; righe: string[] } {
  const motivi: string[] = [];
  let stato: StatoAlloggiati;
  let righe: string[] = [];
  if (p.canale === 'No Tax') {
    stato = 'Non soggetta'; motivi.push('Canale "No Tax": come da regola attuale non viene inviata ad Alloggiati Web.');
  } else if (sch.length === 0) {
    stato = 'Da preparare'; motivi.push(`Nessuna schedina: mancano i dati ${p.ospitiAttesi === 1 ? "dell'ospite" : `dei ${p.ospitiAttesi} ospiti`}.`);
  } else if (sch.some((s) => s.stato === 'Errore')) {
    stato = 'Con errore'; for (const s of sch.filter((x) => x.stato === 'Errore')) motivi.push(`${s.nome} ${s.cognome}: ${s.esito ?? 'errore durante l\'invio'}`);
  } else if (sch.some((s) => s.stato === 'In invio') || (sch.some((s) => s.stato === 'Inviata') && sch.some((s) => s.stato !== 'Inviata'))) {
    stato = 'Da verificare'; motivi.push('Invio rimasto a metà o solo in parte: controlla sul portale quali schedine risultano arrivate.');
  } else if (sch.every((s) => s.stato === 'Inviata')) {
    stato = 'Inviata';
    const d = controlloOspitiSchedine(p.ospitiAttesi, sch.length);
    if (d) motivi.push(`Attenzione, inviata ma: ${d}`);
  } else {
    // tutte "Da inviare"
    const d = controlloOspitiSchedine(p.ospitiAttesi, sch.length);
    if (d) motivi.push(d);
    const dati: DatiSchedina[] = [];
    const ordine = ordinaGruppoAlloggiati(sch.map((s) => ({ ...s, tipo: s.tipo })));
    if (!ordine.ok) motivi.push(ordine.errore);
    for (const s of sch) { const r = costruisciDati(s, p.checkin, p.checkout); motivi.push(...r.errori); if (r.dati) dati.push(r.dati); }
    if (motivi.length === 0 && ordine.ok) {
      const perId = new Map(sch.map((s, i) => [s.id, dati[i]]));
      righe = ordine.ordinati.map((s) => formatSchedinaRecord(perId.get(s.id)!));
      stato = 'Pronta';
    } else stato = 'Da preparare';
  }
  const scade = inizioGiornoRoma(p.checkin) + 24 * 3600e3;
  const inviate = sch.filter((s) => s.inviataIl).map((s) => s.inviataIl!.getTime());
  return {
    righe,
    arrivo: {
      prenotazioneId: p.id, alloggio: p.alloggio, checkin: p.checkin, checkout: p.checkout, canale: p.canale, ospite: p.ospite,
      ospitiAttesi: p.ospitiAttesi, schedine: sch.length, stato, motivi,
      scadeIl: new Date(scade).toISOString(), oreAllaScadenza: Math.round(((scade - ora) / 3600e3) * 10) / 10,
      inRitardo: stato !== 'Inviata' && stato !== 'Non soggetta' && ora > scade,
      inviataIl: inviate.length ? new Date(Math.max(...inviate)).toISOString() : null,
    },
  };
}

async function carica(filtro: ReturnType<typeof and> | undefined) {
  const db = getDb();
  const pren = await db.select({
    id: prenotazioni.id, alloggio: alloggi.nome, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, canale: prenotazioni.canale,
    stato: prenotazioni.stato, ospitiAttesi: prenotazioni.numero_ospiti, cog: ospiti.cognome, nom: ospiti.nome,
  }).from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(ospiti, eq(ospiti.id, prenotazioni.ospite_id))
    .where(and(eq(prenotazioni.stato, 'Attiva'), eq(alloggi.trasmette_alloggiati, true), filtro))
    .orderBy(prenotazioni.checkin);
  if (pren.length === 0) return { pren: [] as DatiPren[], perPren: new Map<string, RigaSch[]>() };
  const righe = await db.select({
    id: schedine.id, prenotazioneId: schedine.prenotazione_id, cognome: schedine.cognome, nome: schedine.nome, sesso: schedine.sesso,
    dataNascita: schedine.data_nascita, comuneNascitaCodice: schedine.comune_nascita_codice, provinciaNascita: schedine.provincia_nascita,
    statoNascitaCodice: schedine.stato_nascita_codice, cittadinanzaCodice: schedine.cittadinanza_codice, tipoDocumentoCodice: schedine.tipo_documento_codice,
    numeroDocumento: schedine.numero_documento, luogoRilascioDocumento: schedine.luogo_rilascio_documento, tipo: schedine.tipo_alloggiato_codice,
    stato: schedine.stato, esito: schedine.esito_invio, inviataIl: schedine.inviata_il,
  }).from(schedine).where(inArray(schedine.prenotazione_id, pren.map((p) => p.id)));
  const perPren = new Map<string, RigaSch[]>();
  for (const r of righe) { const l = perPren.get(r.prenotazioneId) ?? []; l.push(r); perPren.set(r.prenotazioneId, l); }
  return {
    perPren,
    pren: pren.map((p): DatiPren => ({ id: p.id, alloggio: p.alloggio, checkin: p.checkin, checkout: p.checkout, canale: p.canale, stato: p.stato, ospitiAttesi: p.ospitiAttesi || 1, ospite: `${p.cog} ${p.nom}`.trim() })),
  };
}

/** Arrivi del periodo [da, a] (date ISO) con lo stato di ciascuno. Sola lettura. */
export async function arriviAdempimenti(da: string, a: string, ora = Date.now()): Promise<ArrivoAdempimento[]> {
  const { pren, perPren } = await carica(and(gte(prenotazioni.checkin, da), lte(prenotazioni.checkin, a)));
  return pren.map((p) => valutaPrenotazione(p, perPren.get(p.id) ?? [], ora).arrivo);
}

/** Avvisi per la Dashboard: arrivi degli ultimi 14 giorni e di domani con schedine ancora da fare, in ritardo o a meno di 24 ore dal termine. */
export async function avvisiAdempimenti(oggiISO: string, ora = Date.now()): Promise<ArrivoAdempimento[]> {
  const da = new Date(Date.parse(oggiISO) - 14 * 864e5).toISOString().slice(0, 10);
  const a = new Date(Date.parse(oggiISO) + 1 * 864e5).toISOString().slice(0, 10);
  return (await arriviAdempimenti(da, a, ora))
    .filter((x) => ['Da preparare', 'Con errore', 'Da verificare', 'Pronta'].includes(x.stato) && (x.inRitardo || x.oreAllaScadenza <= 24));
}

export type FileAlloggiati = { nomeFile: string; contenuto: string; prenotazioniInFile: number; schedineInFile: number; saltate: { prenotazioneId: string; stato: string; motivo: string }[] };

/**
 * File di testo nel tracciato ufficiale Alloggiati Web (record da 168 caratteri, uno per ospite, persona di riferimento per prima,
 * righe separate da CRLF) con le sole prenotazioni PRONTE tra quelle richieste. Le altre sono elencate in `saltate` col motivo.
 * Si scarica e si carica a mano sul portale: da qui non parte niente.
 */
export async function generaFileAlloggiati(prenotazioneIds: string[], oggiISO: string, ora = Date.now()): Promise<FileAlloggiati> {
  const { pren, perPren } = await carica(inArray(prenotazioni.id, prenotazioneIds.length ? prenotazioneIds : ['00000000-0000-0000-0000-000000000000']));
  const righe: string[] = [];
  const saltate: FileAlloggiati['saltate'] = [];
  let inFile = 0;
  for (const p of pren) {
    const v = valutaPrenotazione(p, perPren.get(p.id) ?? [], ora);
    if (v.arrivo.stato === 'Pronta') { righe.push(...v.righe); inFile++; }
    else saltate.push({ prenotazioneId: p.id, stato: v.arrivo.stato, motivo: v.arrivo.motivi[0] ?? v.arrivo.stato });
  }
  for (const id of prenotazioneIds) if (!pren.some((p) => p.id === id)) saltate.push({ prenotazioneId: id, stato: 'Non trovata', motivo: 'Prenotazione non trovata o non soggetta ad Alloggiati Web' });
  return { nomeFile: `alloggiati-${oggiISO}.txt`, contenuto: righe.length ? righe.join('\r\n') + '\r\n' : '', prenotazioniInFile: inFile, schedineInFile: righe.length, saltate };
}

/** Il Titolare ha caricato il file sul portale: segna le schedine della prenotazione come inviate. Reversibile con annullaInvioAMano. */
export async function segnaInviataAMano(prenotazioneId: string): Promise<{ aggiornate: number }> {
  const db = getDb();
  const sch = await db.select({ id: schedine.id, stato: schedine.stato }).from(schedine).where(eq(schedine.prenotazione_id, prenotazioneId));
  if (sch.length === 0) throw new Error('Questa prenotazione non ha schedine.');
  if (sch.every((s) => s.stato === 'Inviata')) throw new Error('Risulta già tutta inviata.');
  const r = await db.update(schedine).set({ stato: 'Inviata', inviata_il: new Date(), esito_invio: `${MARCA_MANO} (${new Date().toLocaleDateString('it-IT')}), dopo aver caricato il file sul portale.`, aggiornato_il: new Date() })
    .where(and(eq(schedine.prenotazione_id, prenotazioneId), inArray(schedine.stato, ['Da inviare', 'Errore', 'In invio']))).returning({ id: schedine.id });
  return { aggiornate: r.length };
}

/** Annulla un "inviata a mano" (solo se è stata segnata così): le schedine tornano "da inviare". */
export async function annullaInvioAMano(prenotazioneId: string): Promise<{ aggiornate: number }> {
  const r = await getDb().update(schedine).set({ stato: 'Da inviare', inviata_il: null, esito_invio: null, aggiornato_il: new Date() })
    .where(and(eq(schedine.prenotazione_id, prenotazioneId), eq(schedine.stato, 'Inviata'), sql`${schedine.esito_invio} like ${MARCA_MANO + '%'}`)).returning({ id: schedine.id });
  if (r.length === 0) throw new Error('Si può annullare solo un invio segnato a mano da qui.');
  return { aggiornate: r.length };
}

// ── Sinfonia: stato mensile ───────────────────────────────────────────────────────────────
export type StatoMeseSinfonia = { mese: number; stato: 'Da generare' | 'Generato' | 'Inviato'; generatoIl: string | null; inviatoIl: string | null };
export type StatoSinfonia = { immobileId: string; immobile: string; mesi: StatoMeseSinfonia[] };

/** Per ogni immobile che trasmette al portale regionale: i mesi dell'anno (fino al corrente) con lo stato. */
export async function statoSinfonia(anno: number, meseCorrente: number): Promise<StatoSinfonia[]> {
  const db = getDb();
  const imm = await db.selectDistinct({ id: immobili.id, nome: immobili.nome }).from(immobili)
    .innerJoin(alloggi, eq(alloggi.immobile_id, immobili.id)).where(eq(alloggi.trasmette_regione, true));
  const invii = await db.select().from(inviiRegione).where(eq(inviiRegione.anno, anno));
  return imm.map((i) => ({
    immobileId: i.id, immobile: i.nome,
    mesi: Array.from({ length: Math.max(1, Math.min(12, meseCorrente)) }, (_, k) => {
      const r = invii.find((x) => x.immobile_id === i.id && x.mese === k + 1);
      return { mese: k + 1, stato: r?.inviato_il ? 'Inviato' as const : r?.generato_il ? 'Generato' as const : 'Da generare' as const, generatoIl: r?.generato_il?.toISOString() ?? null, inviatoIl: r?.inviato_il?.toISOString() ?? null };
    }),
  }));
}

/** Segna (o toglie) "inviato" per un mese di Sinfonia: lo fa il Titolare dopo aver caricato il file sul portale regionale. */
export async function segnaSinfoniaInviato(immobileId: string, anno: number, mese: number, inviato: boolean) {
  const quando = inviato ? new Date() : null;
  await getDb().insert(inviiRegione).values({ immobile_id: immobileId, anno, mese, inviato_il: quando })
    .onConflictDoUpdate({ target: [inviiRegione.immobile_id, inviiRegione.anno, inviiRegione.mese], set: { inviato_il: quando, aggiornato_il: new Date() } });
  return { immobileId, anno, mese, inviato };
}
