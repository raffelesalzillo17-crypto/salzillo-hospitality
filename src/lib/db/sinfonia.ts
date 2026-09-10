/**
 * Generatore del file di movimento turistico mensile per il portale regionale della
 * Campania (Sinfonia Turismo Smart) / ISTAT.
 *
 * Formato riga:  DDMMYYYY;codiceNazione;codiceProvincia;numeroArrivi;numeroPartenze
 * separatore ';', nessuno spazio, una riga per ogni combinazione giorno+provenienza,
 * niente duplicati. Le camere occupate si inseriscono a parte nel portale dopo l'import.
 *
 * NOTA (10/09/2026): Marcianise non richiede ancora questi flussi (vedi
 * data/wiki/decisioni/solo-tulipano-va-inviato-ad-alloggiati-e-sinfonia.md). La struttura
 * c'è già pronta per quando Via Campania avrà i suoi obblighi. Il dato di provenienza degli
 * ospiti (nazione + provincia di residenza) oggi NON è raccolto in modo completo — il file
 * usa un default (Italia + provincia dell'immobile) e va verificato col portale reale.
 */

import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb } from './index';
import { prenotazioni, alloggi, immobili, schedine } from './schema';

const CODICE_ITALIA = '100000100';

function ddmmyyyy(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}${m}${y}`;
}

export type RigaSinfonia = { data: string; nazione: string; provincia: string; arrivi: number; partenze: number };

export async function generaFileSinfonia(immobileId: string, anno: number, mese: number): Promise<{
  contenuto: string; righe: RigaSinfonia[]; totaleArrivi: number; totalePartenze: number;
  avvisi: string[];
}> {
  const db = getDb();
  const primo = `${anno}-${String(mese).padStart(2, '0')}-01`;
  const ultGiorno = new Date(anno, mese, 0).getDate();
  const ultimo = `${anno}-${String(mese).padStart(2, '0')}-${String(ultGiorno).padStart(2, '0')}`;

  const [imm] = await db.select().from(immobili).where(eq(immobili.id, immobileId));
  if (!imm) throw new Error('Immobile non trovato');
  const provinciaDefault = imm.provincia;

  // alloggi dell'immobile che trasmettono alla regione
  const alloggiOk = (await db.select({ id: alloggi.id }).from(alloggi)
    .where(and(eq(alloggi.immobile_id, immobileId), eq(alloggi.trasmette_regione, true)))).map((a) => a.id);
  const avvisi: string[] = [];
  if (alloggiOk.length === 0) avvisi.push('Nessun alloggio di questo immobile ha "trasmette al portale regionale" attivo.');

  // prenotazioni attive che si sovrappongono al mese
  const pren = await db.select({
    id: prenotazioni.id, checkin: prenotazioni.checkin, checkout: prenotazioni.checkout,
    alloggioId: prenotazioni.alloggio_id, numeroOspiti: prenotazioni.numero_ospiti,
  }).from(prenotazioni).where(and(
    eq(prenotazioni.stato, 'Attiva'),
    lte(prenotazioni.checkin, ultimo),
    gte(prenotazioni.checkout, primo),
  ));
  const pertinenti = pren.filter((p) => alloggiOk.includes(p.alloggioId));

  // aggrega arrivi/partenze per giorno + provenienza
  const agg = new Map<string, RigaSinfonia>();
  const bump = (data: string, naz: string, prov: string, campo: 'arrivi' | 'partenze', n: number) => {
    const k = `${data}|${naz}|${prov}`;
    if (!agg.has(k)) agg.set(k, { data, nazione: naz, provincia: prov, arrivi: 0, partenze: 0 });
    agg.get(k)![campo] += n;
  };

  let stimati = 0;
  for (const p of pertinenti) {
    // provenienza dell'ospite: dalla schedina se c'è, altrimenti stima "Italia + provincia dell'immobile"
    const sch = await db.select({ statoNascitaCodice: schedine.stato_nascita_codice, cittadinanzaCodice: schedine.cittadinanza_codice })
      .from(schedine).where(eq(schedine.prenotazione_id, p.id)).limit(1);
    const codice = sch[0]?.cittadinanzaCodice || sch[0]?.statoNascitaCodice;
    const nazione = codice || CODICE_ITALIA;
    const provincia = nazione === CODICE_ITALIA ? provinciaDefault : '';
    if (!codice) stimati++;

    if (p.checkin >= primo && p.checkin <= ultimo) bump(p.checkin, nazione, provincia, 'arrivi', p.numeroOspiti);
    if (p.checkout >= primo && p.checkout <= ultimo) bump(p.checkout, nazione, provincia, 'partenze', p.numeroOspiti);
  }
  if (stimati > 0) avvisi.push(`${stimati} prenotazioni senza dati di provenienza dalla schedina: usato "Italia / ${provinciaDefault}" come stima. Da verificare col portale Sinfonia reale.`);

  const righe = [...agg.values()].sort((a, b) => a.data.localeCompare(b.data) || a.nazione.localeCompare(b.nazione));
  const contenuto = righe.map((r) => `${ddmmyyyy(r.data)};${r.nazione};${r.provincia};${r.arrivi};${r.partenze}`).join('\n') + (righe.length ? '\n' : '');
  return {
    contenuto, righe,
    totaleArrivi: righe.reduce((s, r) => s + r.arrivi, 0),
    totalePartenze: righe.reduce((s, r) => s + r.partenze, 0),
    avvisi,
  };
}
