/**
 * Export per il commercialista (punto 12 delle richieste, 23/11/2026): per anno e per proprietario, incassi, commissioni,
 * spese, tassa di soggiorno riscossa e versata. Un file Excel con quattro fogli, oppure un foglio per volta in CSV.
 *
 * Criteri (scritti anche nel foglio "Riepilogo", perché il commercialista li legga):
 *  - le prenotazioni dell'anno sono quelle con CHECK-IN nell'anno (come nei Rendiconti); si includono TUTTE le attive, qualunque
 *    sia il canale, e le cancellate con penale (conta l'importo della penale);
 *  - niente nomi né contatti degli ospiti: solo il numero di ospiti;
 *  - la tassa di soggiorno "riscossa" è calcolata dalle prenotazioni (€ a persona a notte, con il massimo di notti dell'alloggio);
 *    la "versata" è quella registrata in versamenti_soggiorno.
 */
import { and, eq, gte, lte, inArray } from 'drizzle-orm';
import { getDb } from './db';
import { alloggi, categorieSpesa, immobili, prenotazioni, proprietari, spese, versamentiSoggiorno } from './db/schema';

export type Foglio = { nome: string; intestazioni: string[]; righe: (string | number | null)[][]; note?: string[] };
export type DatiCommercialista = { anno: number; proprietario: string; fogli: Foglio[]; totali: { lordo: number; commissioni: number; cedolare: number; pulizia: number; fee: number; netto: number; spese: number; risultato: number; tassaRiscossa: number; tassaVersata: number; prenotazioni: number } };

const r2 = (n: number) => Math.round(n * 100) / 100;
const notti = (ci: string, co: string) => Math.max(1, Math.round((Date.parse(co) - Date.parse(ci)) / 864e5));
const trimestre = (iso: string) => Math.floor((Number(iso.slice(5, 7)) - 1) / 3) + 1;

export async function datiCommercialista(anno: number, proprietarioId: string | null): Promise<DatiCommercialista> {
  const db = getDb();
  const da = `${anno}-01-01`, a = `${anno}-12-31`;
  let nomeProprietario = 'Tutti i proprietari';
  if (proprietarioId) {
    const [p] = await db.select({ nome: proprietari.nome }).from(proprietari).where(eq(proprietari.id, proprietarioId));
    if (!p) throw new Error('Proprietario non trovato');
    nomeProprietario = p.nome;
  }

  // ── Prenotazioni
  const condPren = [gte(prenotazioni.checkin, da), lte(prenotazioni.checkin, a), inArray(prenotazioni.stato, ['Attiva', 'Cancellata con penale'])];
  if (proprietarioId) condPren.push(eq(immobili.proprietario_id, proprietarioId));
  const pren = await db.select({
    checkin: prenotazioni.checkin, checkout: prenotazioni.checkout, alloggio: alloggi.nome, immobile: immobili.nome, proprietario: proprietari.nome,
    canale: prenotazioni.canale, ospiti: prenotazioni.numero_ospiti, stato: prenotazioni.stato,
    lordo: prenotazioni.lordo, commissione: prenotazioni.commissione, cedolare: prenotazioni.cedolare, pulizia: prenotazioni.costo_pulizia,
    fee: prenotazioni.fee_gestione, utile: prenotazioni.utile, netto: prenotazioni.netto_proprietario, penale: prenotazioni.penale_importo,
    imposta: alloggi.imposta_soggiorno_importo, impostaMax: alloggi.imposta_soggiorno_max_notti, immobileId: immobili.id,
  }).from(prenotazioni)
    .innerJoin(alloggi, eq(alloggi.id, prenotazioni.alloggio_id))
    .innerJoin(immobili, eq(immobili.id, alloggi.immobile_id))
    .innerJoin(proprietari, eq(proprietari.id, immobili.proprietario_id))
    .where(and(...condPren)).orderBy(prenotazioni.checkin);

  const tassaDi = (p: (typeof pren)[number]) => {
    const imp = Number(p.imposta); if (!imp || p.stato !== 'Attiva') return 0;
    let n = notti(p.checkin, p.checkout); if (p.impostaMax) n = Math.min(n, p.impostaMax);
    return r2(n * p.ospiti * imp);
  };
  const lordoDi = (p: (typeof pren)[number]) => (p.stato === 'Attiva' ? Number(p.lordo) : Number(p.penale ?? 0));

  const foglioPren: Foglio = {
    nome: 'Prenotazioni',
    intestazioni: ['Check-in', 'Check-out', 'Notti', 'Immobile', 'Alloggio', 'Proprietario', 'Canale', 'Ospiti', 'Stato', 'Incasso lordo', 'Commissioni OTA', 'Cedolare secca', 'Costo pulizia', 'Fee di gestione', 'Utile', 'Netto proprietario', 'Tassa di soggiorno riscossa'],
    righe: pren.map((p) => [p.checkin, p.checkout, notti(p.checkin, p.checkout), p.immobile, p.alloggio, p.proprietario, p.canale, p.ospiti, p.stato === 'Attiva' ? 'Attiva' : 'Cancellata con penale',
      lordoDi(p), p.stato === 'Attiva' ? Number(p.commissione) : 0, p.stato === 'Attiva' ? Number(p.cedolare) : 0, p.stato === 'Attiva' ? Number(p.pulizia) : 0,
      p.stato === 'Attiva' ? Number(p.fee) : 0, p.stato === 'Attiva' ? Number(p.utile) : 0, p.stato === 'Attiva' ? Number(p.netto) : 0, tassaDi(p)]),
  };

  // ── Spese
  const condSpese = [gte(spese.data, da), lte(spese.data, a)];
  if (proprietarioId) condSpese.push(eq(immobili.proprietario_id, proprietarioId));
  const righeSpese = await db.select({
    data: spese.data, categoria: categorieSpesa.nome, descrizione: spese.descrizione, immobile: immobili.nome, alloggio: alloggi.nome,
    importo: spese.importo, metodo: spese.metodo_pagamento, ricevuta: spese.scontrino_documento_id, ricorrente: spese.ricorrente_id,
  }).from(spese)
    .innerJoin(categorieSpesa, eq(categorieSpesa.id, spese.categoria_id))
    .leftJoin(immobili, eq(immobili.id, spese.immobile_id))
    .leftJoin(alloggi, eq(alloggi.id, spese.alloggio_id))
    .where(and(...condSpese)).orderBy(spese.data);
  const foglioSpese: Foglio = {
    nome: 'Spese',
    intestazioni: ['Data', 'Categoria', 'Descrizione', 'Immobile', 'Alloggio', 'Importo', 'Metodo di pagamento', 'Ricevuta allegata', 'Ricorrente'],
    righe: righeSpese.map((s) => [s.data, s.categoria, s.descrizione, s.immobile ?? 'Generale', s.alloggio ?? '', Number(s.importo), s.metodo ?? '', s.ricevuta ? 'Sì' : 'No', s.ricorrente ? 'Sì' : 'No']),
  };

  // ── Tassa di soggiorno: riscossa (calcolata) e versata (registrata), per immobile e trimestre
  const versamenti = await db.select({ immobileId: versamentiSoggiorno.immobile_id, immobile: immobili.nome, trimestre: versamentiSoggiorno.trimestre, dovuto: versamentiSoggiorno.importo_dovuto, versato: versamentiSoggiorno.importo_versato, versatoIl: versamentiSoggiorno.versato_il, dichiarazione: versamentiSoggiorno.dichiarazione_inviata_il })
    .from(versamentiSoggiorno).innerJoin(immobili, eq(immobili.id, versamentiSoggiorno.immobile_id))
    .where(and(eq(versamentiSoggiorno.anno, anno), ...(proprietarioId ? [eq(immobili.proprietario_id, proprietarioId)] : [])));
  const riscossa = new Map<string, { immobile: string; trim: number; importo: number }>();
  for (const p of pren) {
    const t = tassaDi(p); if (!t) continue;
    const k = `${p.immobileId}|${trimestre(p.checkin)}`;
    const x = riscossa.get(k) ?? { immobile: p.immobile, trim: trimestre(p.checkin), importo: 0 };
    x.importo = r2(x.importo + t); riscossa.set(k, x);
  }
  const chiaviT = new Set([...riscossa.keys(), ...versamenti.map((v) => `${v.immobileId}|${v.trimestre}`)]);
  const righeTassa = [...chiaviT].sort().map((k) => {
    const rs = riscossa.get(k); const v = versamenti.find((x) => `${x.immobileId}|${x.trimestre}` === k);
    return [rs?.immobile ?? v!.immobile, `${anno} T${rs?.trim ?? v!.trimestre}`, rs?.importo ?? 0, v?.versato != null ? Number(v.versato) : 0, v?.versatoIl ?? '', v?.dichiarazione ?? ''] as (string | number | null)[];
  });
  const foglioTassa: Foglio = {
    nome: 'Tassa di soggiorno', intestazioni: ['Immobile', 'Trimestre', 'Riscossa (calcolata)', 'Versata', 'Versata il', 'Dichiarazione inviata il'], righe: righeTassa,
    note: righeTassa.length === 0 ? ['Nessuna tassa di soggiorno riscossa né versata nell\'anno (gli alloggi non hanno un importo di tassa impostato).'] : undefined,
  };

  // ── Riepilogo
  const att = pren.filter((p) => p.stato === 'Attiva');
  const tot = {
    lordo: r2(pren.reduce((s, p) => s + lordoDi(p), 0)), commissioni: r2(att.reduce((s, p) => s + Number(p.commissione), 0)), cedolare: r2(att.reduce((s, p) => s + Number(p.cedolare), 0)),
    pulizia: r2(att.reduce((s, p) => s + Number(p.pulizia), 0)), fee: r2(att.reduce((s, p) => s + Number(p.fee), 0)), netto: r2(att.reduce((s, p) => s + Number(p.netto), 0)),
    spese: r2(righeSpese.reduce((s, x) => s + Number(x.importo), 0)),
    tassaRiscossa: r2([...riscossa.values()].reduce((s, x) => s + x.importo, 0)), tassaVersata: r2(versamenti.reduce((s, v) => s + Number(v.versato ?? 0), 0)),
    prenotazioni: pren.length,
  };
  const risultato = r2(tot.netto - tot.spese);
  const perCanale = new Map<string, { n: number; lordo: number }>();
  for (const p of pren) { const x = perCanale.get(p.canale) ?? { n: 0, lordo: 0 }; x.n++; x.lordo = r2(x.lordo + lordoDi(p)); perCanale.set(p.canale, x); }
  const foglioRiepilogo: Foglio = {
    nome: 'Riepilogo', intestazioni: ['Voce', 'Importo'],
    righe: [
      ['Anno', anno], ['Proprietario', nomeProprietario], ['Prenotazioni (con check-in nell\'anno)', tot.prenotazioni],
      ['Incasso lordo', tot.lordo], ['Commissioni OTA', tot.commissioni], ['Cedolare secca', tot.cedolare], ['Costi di pulizia', tot.pulizia], ['Fee di gestione', tot.fee],
      ['Netto proprietario', tot.netto], ['Spese', tot.spese], ['Risultato (netto proprietario - spese)', risultato],
      ['Tassa di soggiorno riscossa', tot.tassaRiscossa], ['Tassa di soggiorno versata', tot.tassaVersata],
      ['', ''], ['Incasso lordo per canale', ''], ...[...perCanale.entries()].sort().map(([c, x]) => [`  ${c} (${x.n} prenotazioni)`, x.lordo] as (string | number | null)[]),
    ],
    note: [
      'Criteri: le prenotazioni sono quelle con check-in nell\'anno, tutte le attive qualunque sia il canale, più le cancellate con penale (conta la penale).',
      'Nessun dato personale degli ospiti: solo il numero di ospiti. Le spese generali (senza immobile) compaiono solo nell\'export di tutti i proprietari.',
      'Tassa di soggiorno riscossa = calcolata dalle prenotazioni (€ a persona a notte, con il massimo di notti dell\'alloggio); versata = registrata nei versamenti.',
    ],
  };

  return { anno, proprietario: nomeProprietario, fogli: [foglioRiepilogo, foglioPren, foglioSpese, foglioTassa], totali: { ...tot, risultato } };
}

/** Excel con i quattro fogli. */
export async function costruisciXlsx(d: DatiCommercialista): Promise<Buffer> {
  return costruisciXlsxFogli(d.fogli);
}

/** Excel con i fogli dati (usato anche dall'export delle prenotazioni e dal resoconto annuale). */
export async function costruisciXlsxFogli(fogli: Foglio[]): Promise<Buffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Salzillo Hospitality'; wb.created = new Date();
  for (const f of fogli) {
    const ws = wb.addWorksheet(f.nome.slice(0, 31));
    ws.addRow(f.intestazioni).font = { bold: true };
    for (const r of f.righe) ws.addRow(r);
    f.intestazioni.forEach((h, i) => {
      const col = ws.getColumn(i + 1);
      col.width = Math.min(48, Math.max(h.length + 2, ...f.righe.map((r) => String(r[i] ?? '').length + 2), 10));
      if (f.righe.some((r) => typeof r[i] === 'number') && !/^(Notti|Ospiti|Prenotazioni)/.test(h)) col.numFmt = '#,##0.00';
    });
    if (f.note) { ws.addRow([]); for (const n of f.note) ws.addRow([n]).font = { italic: true, color: { argb: 'FF666666' } }; }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** CSV di un foglio: separatore ";", decimali con la virgola, BOM per Excel. */
export function costruisciCsv(f: Foglio): string {
  const cella = (v: string | number | null) => {
    if (v === null || v === undefined) return '';
    const t = typeof v === 'number' ? String(v).replace('.', ',') : v;
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const righe = [f.intestazioni, ...f.righe, ...(f.note ? [[], ...f.note.map((n) => [n])] : [])];
  return '﻿' + righe.map((r) => r.map(cella).join(';')).join('\r\n') + '\r\n';
}
