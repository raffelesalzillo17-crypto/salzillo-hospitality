/**
 * Import di un estratto conto in CSV e spese ricorrenti (punto 12 delle richieste, 23/11/2026).
 * Funzioni PURE (niente database): si provano con dati finti e girano sia nel browser sia sul server.
 */

// ── CSV ─────────────────────────────────────────────────────────────────────────────────

/** Legge un CSV (separatore ; , o tabulazione, virgolette doppie, a-capo dentro le virgolette). Toglie un eventuale BOM. */
export function leggiCsv(testo: string): string[][] {
  const t = testo.replace(/^﻿/, '');
  const prime = t.split(/\r?\n/).slice(0, 5).join('\n');
  const conta = (c: string) => (prime.match(new RegExp(c === '\t' ? '\\t' : `\\${c}`, 'g')) ?? []).length;
  const sep = [';', ',', '\t'].map((c) => [c, conta(c)] as const).sort((a, b) => b[1] - a[1])[0][0];
  const righe: string[][] = [];
  let riga: string[] = []; let campo = ''; let dentro = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentro) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') dentro = false;
      else campo += c;
    } else if (c === '"') dentro = true;
    else if (c === sep) { riga.push(campo.trim()); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      riga.push(campo.trim()); campo = '';
      if (riga.some((x) => x !== '')) righe.push(riga);
      riga = [];
    } else campo += c;
  }
  riga.push(campo.trim());
  if (riga.some((x) => x !== '')) righe.push(riga);
  return righe;
}

/** "1.234,56" · "-12,30" · "12.30" · "€ 12,30" · "(12,30)" → numero. null se non è un importo. */
export function numeroIt(grezzo: string | null | undefined): number | null {
  let s = (grezzo ?? '').trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) { negativo = true; s = s.slice(1, -1); }
  s = s.replace(/[€\s]|EUR/gi, '');
  if (s.startsWith('-')) { negativo = !negativo; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  if (s.endsWith('-')) { negativo = !negativo; s = s.slice(0, -1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const ultimoPunto = s.lastIndexOf('.'), ultimaVirgola = s.lastIndexOf(',');
  if (ultimaVirgola > ultimoPunto) s = s.replace(/\./g, '').replace(',', '.');          // 1.234,56
  else if (ultimoPunto > ultimaVirgola && ultimaVirgola >= 0) s = s.replace(/,/g, '');   // 1,234.56
  else if (ultimaVirgola >= 0) s = s.replace(',', '.');                                    // 12,30
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');                  // 1.234.567
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round((negativo ? -n : n) * 100) / 100;
}

/** "03/11/2026" · "3-11-26" · "2026-11-03" → "2026-11-03". null se non è una data valida. */
export function dataIso(grezza: string | null | undefined): string | null {
  const s = (grezza ?? '').trim();
  let g: number, m: number, a: number;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (r) { a = +r[1]; m = +r[2]; g = +r[3]; }
  else {
    r = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4}|\d{2})/);
    if (!r) return null;
    g = +r[1]; m = +r[2]; a = +r[3]; if (a < 100) a += 2000;
  }
  const d = new Date(Date.UTC(a, m - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== g) return null;
  return d.toISOString().slice(0, 10);
}

export type Mappa = { data: number; descrizione: number; importo: number; dare?: number; avere?: number; usciteNegative: boolean; intestazione: boolean };

/** Indovina le colonne dall'intestazione; l'utente può correggerle. */
export function proponiMappa(righe: string[][]): Mappa {
  const prima = (righe[0] ?? []).map((x) => x.toLowerCase());
  const trova = (...nomi: RegExp[]) => prima.findIndex((c) => nomi.some((n) => n.test(c)));
  const intest = trova(/data|date|valuta/) >= 0 && trova(/import|amount|dare|avere|uscit|entrat|addebit|accredit/) >= 0;
  const dare = trova(/dare|uscit|addebit|debit/), avere = trova(/avere|entrat|accredit|credit/);
  const importo = trova(/importo|amount|ammontare|valore/);
  return {
    data: Math.max(0, trova(/data contab|data oper|data|date|valuta/)),
    descrizione: Math.max(0, trova(/descri|causale|operazione|dettagli|motivo|note|beneficiario/)),
    importo: importo >= 0 ? importo : Math.max(0, dare >= 0 ? dare : 2),
    dare: dare >= 0 && importo < 0 ? dare : undefined, avere: avere >= 0 && importo < 0 ? avere : undefined,
    usciteNegative: true, intestazione: intest,
  };
}

export type RigaEstratto = { riga: number; data: string; descrizione: string; importo: number }; // importo SEMPRE positivo: è un'uscita
export type EsitoEstratto = { uscite: RigaEstratto[]; ignorate: { riga: number; motivo: string }[]; entrate: number };

/** Applica la mappa. Si tengono SOLO le uscite (importi negativi, o colonna "dare"); le entrate si contano e si ignorano. */
export function interpretaEstratto(righe: string[][], mappa: Mappa): EsitoEstratto {
  const uscite: RigaEstratto[] = []; const ignorate: EsitoEstratto['ignorate'] = []; let entrate = 0;
  righe.forEach((r, i) => {
    if (i === 0 && mappa.intestazione) return;
    const n = i + 1;
    const data = dataIso(r[mappa.data]);
    let valore: number | null;
    if (mappa.dare !== undefined || mappa.avere !== undefined) {
      const d = mappa.dare !== undefined ? numeroIt(r[mappa.dare]) : null;
      const a = mappa.avere !== undefined ? numeroIt(r[mappa.avere]) : null;
      if (d && Math.abs(d) > 0) valore = -Math.abs(d); else if (a && Math.abs(a) > 0) valore = Math.abs(a); else valore = null;
    } else {
      valore = numeroIt(r[mappa.importo]);
      if (valore !== null && !mappa.usciteNegative) valore = -valore;
    }
    if (!data) { ignorate.push({ riga: n, motivo: 'data non riconosciuta' }); return; }
    if (valore === null || valore === 0) { ignorate.push({ riga: n, motivo: 'importo mancante o a zero' }); return; }
    if (valore > 0) { entrate++; return; }
    uscite.push({ riga: n, data, descrizione: (r[mappa.descrizione] ?? '').replace(/\s+/g, ' ').trim() || '(senza descrizione)', importo: Math.abs(valore) });
  });
  return { uscite, ignorate, entrate };
}

/** Impronta stabile di una riga: lo stesso movimento importato due volte dà la stessa chiave. */
export function chiaveImport(data: string, importo: number, descrizione: string): string {
  return `${data}|${importo.toFixed(2)}|${descrizione.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80)}`;
}

// ── Abbinamento alle categorie ───────────────────────────────────────────────────────────

const REGOLE: { categoria: RegExp; parole: RegExp }[] = [
  { categoria: /utenz/i, parole: /\b(enel|eni|edison|a2a|sorgenia|acea|iren|hera|gas|luce|energia|acqua|tim|vodafone|fastweb|wind|iliad|internet|fibra|bolletta|telefon)\b/i },
  { categoria: /manuten/i, parole: /\b(idraulic|elettricist|ferramenta|leroy|brico|manutenz|riparaz|caldaia|climatizz|imbianc)\b/i },
  { categoria: /prodotti pul|pulizi/i, parole: /\b(detersiv|pulizi|lavander|igienizz|sapone|carta igienica)\b/i },
  { categoria: /arred/i, parole: /\b(ikea|materass|arredo|arreda|mondo convenienza|maisons|divan|lenzuol|asciugaman)\b/i },
  { categoria: /marketing|pubblic/i, parole: /\b(google ads|facebook|meta ads|instagram|canva|dominio|aruba|hosting|vercel|sito web)\b/i },
  { categoria: /commercialist/i, parole: /\b(commercialista|studio|consulenza|parcella)\b/i },
  { categoria: /tass|impost/i, parole: /\b(f24|agenzia entrate|agenzia delle entrate|imu|tari|tributi|imposta|bollo|inps|inail)\b/i },
];
const token = (s: string) => s.toLowerCase().replace(/[^a-z0-9àèéìòù ]+/g, ' ').split(/\s+/).filter((t) => t.length >= 4);

export type Suggerimento = { categoriaId: string | null; motivo: string };

/** Prima guarda le spese già registrate con parole in comune, poi alcune parole chiave note. Mai obbligatorio: la sceglie l'utente. */
export function suggerisciCategoria(descrizione: string, storico: { descrizione: string; categoriaId: string }[], categorie: { id: string; nome: string }[]): Suggerimento {
  const mie = new Set(token(descrizione));
  let migliore: { categoriaId: string; punti: number } | null = null;
  for (const s of storico) {
    const punti = token(s.descrizione).filter((t) => mie.has(t)).length;
    if (punti > 0 && (!migliore || punti > migliore.punti)) migliore = { categoriaId: s.categoriaId, punti };
  }
  if (migliore) return { categoriaId: migliore.categoriaId, motivo: 'come una spesa già registrata' };
  for (const r of REGOLE) {
    if (r.parole.test(descrizione)) {
      const c = categorie.find((x) => r.categoria.test(x.nome));
      if (c) return { categoriaId: c.id, motivo: 'parola chiave' };
    }
  }
  return { categoriaId: null, motivo: '' };
}

// ── Spese ricorrenti ──────────────────────────────────────────────────────────────────────

export const FREQUENZE = { Mensile: 1, Trimestrale: 3, Semestrale: 6, Annuale: 12 } as const;
export type Frequenza = keyof typeof FREQUENZE;

/** Data successiva di una spesa ricorrente: stesso giorno del mese (o l'ultimo, se il mese è più corto) dopo N mesi. */
export function prossimaData(corrente: string, frequenza: Frequenza, giorno: number): string {
  const [a, m] = corrente.split('-').map(Number);
  const tot = a * 12 + (m - 1) + FREQUENZE[frequenza];
  const anno = Math.floor(tot / 12), mese = (tot % 12) + 1;
  const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  return `${anno}-${String(mese).padStart(2, '0')}-${String(Math.min(giorno, ultimo)).padStart(2, '0')}`;
}

/** Tutte le date da registrare fino a `oggi` (comprese), a partire da `prossima`, rispettando `fine`. Massimo 36 per volta. */
export function dateDaGenerare(prossima: string, frequenza: Frequenza, giorno: number, oggi: string, fine?: string | null): { date: string[]; prossimaDopo: string } {
  const date: string[] = []; let corrente = prossima;
  while (corrente <= oggi && (!fine || corrente <= fine) && date.length < 36) { date.push(corrente); corrente = prossimaData(corrente, frequenza, giorno); }
  return { date, prossimaDopo: corrente };
}
