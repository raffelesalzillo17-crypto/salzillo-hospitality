/**
 * Resoconto annuale (punto 14, 23/11/2026) — nucleo PURO, senza database (si prova con i test).
 *
 * Stesse definizioni della Dashboard e dei Rendiconti, così i totali coincidono:
 *  - contano le prenotazioni ATTIVE, assegnate al mese del check-in (incasso lordo, tassa di soggiorno, canale);
 *  - la tassa di soggiorno di una prenotazione = notti (almeno 1, con il massimo dell'alloggio) × ospiti × importo a persona a notte;
 *  - le notti occupate di un mese sono le notti della prenotazione che cadono in quel mese (anche se il check-in è nel mese prima);
 *  - occupazione = notti occupate / (alloggi attivi × giorni del periodo).
 */

export type RigaResoconto = {
  checkin: string; checkout: string; canale: string; alloggio: string; ospiti: number; lordo: number;
  impostaImporto: number; impostaMaxNotti: number | null;
  /** Regime della prenotazione (punto 3): 'No Tax' = esente da ogni imposta, tassa di soggiorno compresa. */
  regime?: string;
};

export type MeseResoconto = { mese: number; prenotazioni: number; lordo: number; tassa: number; nottiOccupate: number; occupazione: number };
export type Resoconto = {
  anno: number; alloggiAttivi: number;
  mesi: MeseResoconto[];
  totali: { prenotazioni: number; lordo: number; tassa: number; nottiOccupate: number; occupazione: number };
  perCanale: { canale: string; prenotazioni: number; lordo: number }[];
  /** Per regime fiscale (Ordinario, Esente da tassa di soggiorno, No Tax): separato dal canale. */
  perRegime: { regime: string; prenotazioni: number; lordo: number; tassa: number }[];
  /** Tassa di soggiorno per alloggio, dodici valori (gennaio → dicembre). */
  tassaPerAlloggio: { alloggio: string; mesi: number[]; totale: number }[];
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const giorniDelMese = (anno: number, mese: number) => new Date(Date.UTC(anno, mese, 0)).getUTCDate();
const giorni = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const iso = (anno: number, mese: number, g: number) => `${anno}-${String(mese).padStart(2, '0')}-${String(g).padStart(2, '0')}`;

export function tassaPrenotazione(r: Pick<RigaResoconto, 'checkin' | 'checkout' | 'ospiti' | 'impostaImporto' | 'impostaMaxNotti'> & { regime?: string }): number {
  if (!r.impostaImporto || r.regime === 'No Tax') return 0;
  let notti = Math.max(1, giorni(r.checkin, r.checkout));
  if (r.impostaMaxNotti) notti = Math.min(notti, r.impostaMaxNotti);
  return r2(notti * r.ospiti * r.impostaImporto);
}

/** Notti di una prenotazione che cadono nel mese (checkout escluso). */
export function nottiNelMese(r: Pick<RigaResoconto, 'checkin' | 'checkout'>, anno: number, mese: number): number {
  const da = iso(anno, mese, 1);
  const finePiuUno = mese === 12 ? iso(anno + 1, 1, 1) : iso(anno, mese + 1, 1);
  const a = r.checkin > da ? r.checkin : da, b = r.checkout < finePiuUno ? r.checkout : finePiuUno;
  return Math.max(0, giorni(a, b));
}

/** `righe` = prenotazioni attive che toccano l'anno (check-in nell'anno o soggiorno a cavallo). */
export function costruisciResoconto(anno: number, righe: RigaResoconto[], alloggiAttivi: number): Resoconto {
  const mesi: MeseResoconto[] = [];
  const perCanale = new Map<string, { prenotazioni: number; lordo: number }>();
  const tassaAll = new Map<string, number[]>();
  const perRegime = new Map<string, { prenotazioni: number; lordo: number; tassa: number }>();
  for (let m = 1; m <= 12; m++) {
    const delMese = righe.filter((r) => r.checkin.startsWith(`${anno}-${String(m).padStart(2, '0')}`));
    const notti = righe.reduce((s, r) => s + nottiNelMese(r, anno, m), 0);
    const tassa = r2(delMese.reduce((s, r) => s + tassaPrenotazione(r), 0));
    const lordo = r2(delMese.reduce((s, r) => s + r.lordo, 0));
    mesi.push({
      mese: m, prenotazioni: delMese.length, lordo, tassa, nottiOccupate: notti,
      occupazione: alloggiAttivi ? Math.round((notti / (alloggiAttivi * giorniDelMese(anno, m))) * 1000) / 10 : 0,
    });
    for (const r of delMese) {
      const c = perCanale.get(r.canale) ?? { prenotazioni: 0, lordo: 0 };
      c.prenotazioni++; c.lordo = r2(c.lordo + r.lordo); perCanale.set(r.canale, c);
      const reg = perRegime.get(r.regime ?? 'Ordinario') ?? { prenotazioni: 0, lordo: 0, tassa: 0 };
      reg.prenotazioni++; reg.lordo = r2(reg.lordo + r.lordo); reg.tassa = r2(reg.tassa + tassaPrenotazione(r)); perRegime.set(r.regime ?? 'Ordinario', reg);
      const t = tassaPrenotazione(r);
      if (t) {
        const v = tassaAll.get(r.alloggio) ?? Array(12).fill(0);
        v[m - 1] = r2(v[m - 1] + t); tassaAll.set(r.alloggio, v);
      }
    }
  }
  const nottiTot = mesi.reduce((s, x) => s + x.nottiOccupate, 0);
  const giorniAnno = mesi.reduce((s, x, i) => s + giorniDelMese(anno, i + 1), 0);
  return {
    anno, alloggiAttivi, mesi,
    totali: {
      prenotazioni: mesi.reduce((s, x) => s + x.prenotazioni, 0), lordo: r2(mesi.reduce((s, x) => s + x.lordo, 0)), tassa: r2(mesi.reduce((s, x) => s + x.tassa, 0)),
      nottiOccupate: nottiTot, occupazione: alloggiAttivi ? Math.round((nottiTot / (alloggiAttivi * giorniAnno)) * 1000) / 10 : 0,
    },
    perRegime: [...perRegime.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([regime, x]) => ({ regime, ...x })),
    perCanale: [...perCanale.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([canale, x]) => ({ canale, ...x })),
    tassaPerAlloggio: [...tassaAll.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([alloggio, mesi12]) => ({ alloggio, mesi: mesi12, totale: r2(mesi12.reduce((s, x) => s + x, 0)) })),
  };
}

export const NOMI_MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

/** Differenza con l'anno precedente, per la tabella di confronto. */
export function confrontoAnni(corrente: Resoconto, precedente: Resoconto) {
  const delta = (a: number, b: number) => ({ corrente: a, precedente: b, differenza: r2(a - b), percentuale: b ? Math.round(((a - b) / b) * 1000) / 10 : null as number | null });
  return {
    prenotazioni: delta(corrente.totali.prenotazioni, precedente.totali.prenotazioni),
    lordo: delta(corrente.totali.lordo, precedente.totali.lordo),
    tassa: delta(corrente.totali.tassa, precedente.totali.tassa),
    nottiOccupate: delta(corrente.totali.nottiOccupate, precedente.totali.nottiOccupate),
    occupazione: delta(corrente.totali.occupazione, precedente.totali.occupazione),
  };
}

type FoglioDati = { nome: string; intestazioni: string[]; righe: (string | number | null)[][]; note?: string[] };

/** I fogli del resoconto (Excel o CSV): mesi, canali, tassa per alloggio e confronto con l'anno prima. */
export function fogliResoconto(c: Resoconto, p: Resoconto): FoglioDati[] {
  const conf = confrontoAnni(c, p);
  const nota = [`Criteri: prenotazioni attive, assegnate al mese del check-in. Occupazione = notti occupate / (alloggi attivi × giorni). Alloggi attivi oggi: ${c.alloggiAttivi} (lo stesso numero è usato per ${p.anno}).`];
  return [
    {
      nome: 'Mesi', intestazioni: ['Mese', 'Prenotazioni', 'Incasso lordo', 'Tassa di soggiorno', 'Notti occupate', 'Occupazione %', `Incasso lordo ${p.anno}`, `Occupazione % ${p.anno}`],
      righe: [
        ...c.mesi.map((m, i) => [NOMI_MESI[i], m.prenotazioni, m.lordo, m.tassa, m.nottiOccupate, m.occupazione, p.mesi[i].lordo, p.mesi[i].occupazione] as (string | number | null)[]),
        ['Totale ' + c.anno, c.totali.prenotazioni, c.totali.lordo, c.totali.tassa, c.totali.nottiOccupate, c.totali.occupazione, p.totali.lordo, p.totali.occupazione],
      ],
      note: nota,
    },
    { nome: 'Per canale', intestazioni: ['Canale', 'Prenotazioni', 'Incasso lordo', `Prenotazioni ${p.anno}`, `Incasso lordo ${p.anno}`],
      righe: [...new Set([...c.perCanale.map((x) => x.canale), ...p.perCanale.map((x) => x.canale)])].sort().map((can) => {
        const a = c.perCanale.find((x) => x.canale === can), b = p.perCanale.find((x) => x.canale === can);
        return [can, a?.prenotazioni ?? 0, a?.lordo ?? 0, b?.prenotazioni ?? 0, b?.lordo ?? 0] as (string | number | null)[];
      }) },
    { nome: 'Per regime fiscale', intestazioni: ['Regime', 'Prenotazioni', 'Incasso lordo', 'Tassa di soggiorno', `Prenotazioni ${p.anno}`, `Incasso lordo ${p.anno}`],
      righe: [...new Set([...c.perRegime.map((x) => x.regime), ...p.perRegime.map((x) => x.regime)])].sort().map((reg) => {
        const a = c.perRegime.find((x) => x.regime === reg), b = p.perRegime.find((x) => x.regime === reg);
        return [reg, a?.prenotazioni ?? 0, a?.lordo ?? 0, a?.tassa ?? 0, b?.prenotazioni ?? 0, b?.lordo ?? 0] as (string | number | null)[];
      }) },
    { nome: 'Tassa per alloggio', intestazioni: ['Alloggio', ...NOMI_MESI, 'Totale'],
      righe: c.tassaPerAlloggio.map((x) => [x.alloggio, ...x.mesi, x.totale] as (string | number | null)[]),
      note: c.tassaPerAlloggio.length === 0 ? ['Nessuna tassa di soggiorno riscossa: gli alloggi non hanno un importo impostato.'] : undefined },
    { nome: 'Confronto', intestazioni: ['Voce', String(c.anno), String(p.anno), 'Differenza', 'Variazione %'],
      righe: [
        ['Prenotazioni', conf.prenotazioni], ['Incasso lordo', conf.lordo], ['Tassa di soggiorno', conf.tassa], ['Notti occupate', conf.nottiOccupate], ['Occupazione %', conf.occupazione],
      ].map(([voce, d]) => { const x = d as ReturnType<typeof confrontoAnni>['lordo']; return [voce as string, x.corrente, x.precedente, x.differenza, x.percentuale]; }) },
  ];
}
