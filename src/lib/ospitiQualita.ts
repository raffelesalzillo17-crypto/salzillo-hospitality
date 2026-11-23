/**
 * Qualità dell'elenco ospiti (punto 4 delle richieste, 23/11/2026): validazioni e ricerca dei duplicati.
 * Funzioni PURE (nessun accesso al database): si provano con dati finti.
 */

// ── Validazioni ─────────────────────────────────────────────────────────────────────────

type Esito = { ok: true; valore: string | null } | { ok: false; errore: string };

const MSG_TELEFONO = 'Numero di telefono non valido. Scrivilo in formato internazionale, per esempio +39 333 1234567 (solo cifre, senza lettere).';

/** Telefono → formato internazionale senza spazi (+393331234567). Vuoto = nessun telefono (valido). Senza prefisso si assume +39. */
export function validaTelefono(grezzo: string | null | undefined): Esito {
  const t = (grezzo ?? '').trim();
  if (!t) return { ok: true, valore: null };
  let s = t.replace(/[\s.\-()/]/g, '');
  if (/[^\d+]/.test(s) || (s.includes('+') && !s.startsWith('+')) || (s.match(/\+/g) ?? []).length > 1) return { ok: false, errore: MSG_TELEFONO };
  if (s.startsWith('00')) s = '+' + s.slice(2);
  const italiano = (n: string) => /^3\d{8,9}$/.test(n) || /^0\d{5,10}$/.test(n); // cellulare o fisso, senza prefisso
  if (s.startsWith('+')) {
    const cifre = s.slice(1);
    if (!/^\d{8,15}$/.test(cifre)) return { ok: false, errore: MSG_TELEFONO };
    if (cifre.startsWith('39') && !italiano(cifre.slice(2))) return { ok: false, errore: MSG_TELEFONO };
    return { ok: true, valore: s };
  }
  if (s.startsWith('39') && s.length >= 11 && italiano(s.slice(2))) return { ok: true, valore: '+' + s };
  if (italiano(s)) return { ok: true, valore: '+39' + s };
  return { ok: false, errore: MSG_TELEFONO };
}

export function validaEmail(grezza: string | null | undefined): Esito {
  const e = (grezza ?? '').trim();
  if (!e) return { ok: true, valore: null };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return { ok: false, errore: 'Indirizzo email non valido (es. nome@dominio.it).' };
  return { ok: true, valore: e.toLowerCase() };
}

const DISPARI: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
};

/** Carattere di controllo (16° carattere) di un codice fiscale a 15 caratteri. */
export function carattereControlloCF(primi15: string): string {
  let somma = 0;
  for (let i = 0; i < 15; i++) {
    const c = primi15[i];
    somma += i % 2 === 0 ? DISPARI[c] : (/\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65);
  }
  return String.fromCharCode(65 + (somma % 26));
}

/** Codice fiscale: 16 caratteri e carattere finale corretto (accetta le lettere al posto delle cifre dell'omocodia). Vuoto = valido. */
export function validaCodiceFiscale(grezzo: string | null | undefined): Esito {
  const cf = (grezzo ?? '').trim().toUpperCase().replace(/\s/g, '');
  if (!cf) return { ok: true, valore: null };
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) {
    return { ok: false, errore: 'Codice fiscale non valido: deve avere 16 caratteri (cognome e nome, data di nascita, comune, carattere finale). Se l\'ospite è straniero lascia il campo vuoto.' };
  }
  if (carattereControlloCF(cf.slice(0, 15)) !== cf[15]) {
    return { ok: false, errore: 'Codice fiscale non valido: l\'ultimo carattere non corrisponde agli altri. Controlla lettere e numeri.' };
  }
  return { ok: true, valore: cf };
}

// ── Nomi ────────────────────────────────────────────────────────────────────────────────

export const senzaAccenti = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const parole = (s: string) => senzaAccenti((s ?? '').toLowerCase()).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(Boolean);

/** Chiave "nome cognome" come la costruisce la sincronizzazione dal foglio (minuscolo, spazi singoli). */
export const chiaveNomeFoglio = (nome: string, cognome: string) => `${nome} ${cognome}`.toLowerCase().trim();

const PRIMI_NOMI = new Set(`francesco giuseppe antonio giovanni mario luigi salvatore vincenzo pasquale raffaele carmine michele angelo gennaro ciro luca marco andrea alessandro paolo roberto stefano gerardo nicola domenico vittorio carlo giorgio pietro fabio daniele davide simone matteo diego emanuele gabriele maurizio massimo enrico sergio claudio bruno marcello alfonso biagio aniello mattia riccardo giacomo lorenzo federico tommaso alberto bernardo cristian christian fabrizio gianluca gaetano giulio ivan manuel marcello nunzio oreste rocco sabato tony umberto valerio vito maria anna giulia francesca rosa angela giovanna teresa lucia carmela concetta antonietta assunta rosaria annamaria elena sara martina chiara valentina federica silvia paola laura giuseppina immacolata filomena luisa patrizia monica roberta alessandra elisa veronica ilaria marina daniela cristina barbara denise irene carmen mariana tea ignazio stella giovanna serena claudia michela noemi emanuela lina nunzia rita marta gina viviana alessia simona lucia carla caterina`.split(/\s+/));

/** true se il "cognome" sembra un nome di battesimo e il "nome" no: probabile inversione. */
export function sembraInvertito(nome: string, cognome: string): boolean {
  const n = parole(nome), c = parole(cognome);
  if (n.length === 0 || c.length === 0) return false;
  return PRIMI_NOMI.has(c[0]) && !PRIMI_NOMI.has(n[0]);
}

// ── Duplicati ───────────────────────────────────────────────────────────────────────────

export type OspiteBase = { id: string; nome: string; cognome: string; telefono: string | null };
export type GruppoDuplicati = { ids: string[]; motivi: string[] };

const ultime9 = (t: string | null) => { const c = (t ?? '').replace(/\D/g, ''); return c.length >= 8 ? c.slice(-9) : ''; };

function distanza(a: string, b: string): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}

/**
 * Gruppi di ospiti che potrebbero essere la stessa persona. Quattro motivi:
 *  - stesso telefono;
 *  - stesso nome e cognome, anche scambiati;
 *  - nome quasi uguale (1 lettera di differenza) — solo se i telefoni non sono diversi;
 *  - un record ha solo il nome e quel nome compare nell'altro — solo se i telefoni non sono diversi.
 * Due persone con telefoni DIVERSI non vengono mai accoppiate per somiglianza del nome. Non decide nulla:
 * l'unione la sceglie e la conferma il Titolare.
 */
export function trovaGruppiDuplicati(lista: OspiteBase[]): GruppoDuplicati[] {
  const padre = new Map<string, string>(lista.map((o) => [o.id, o.id]));
  const trova = (x: string): string => { while (padre.get(x) !== x) { padre.set(x, padre.get(padre.get(x)!)!); x = padre.get(x)!; } return x; };
  const motiviPer = new Map<string, Set<string>>();
  const unisci = (a: string, b: string, motivo: string) => {
    padre.set(trova(a), trova(b));
    for (const id of [a, b]) { if (!motiviPer.has(id)) motiviPer.set(id, new Set()); motiviPer.get(id)!.add(motivo); }
  };

  const info = lista.map((o) => ({ o, tel: ultime9(o.telefono), tok: parole(`${o.nome} ${o.cognome}`).sort(), solo: parole(o.cognome).length === 0 }));
  for (let i = 0; i < info.length; i++) for (let j = i + 1; j < info.length; j++) {
    const a = info[i], b = info[j];
    if (a.tel && a.tel === b.tel) { unisci(a.o.id, b.o.id, 'stesso telefono'); continue; }
    const telDiversi = !!a.tel && !!b.tel && a.tel !== b.tel;
    const ka = a.tok.join(' '), kb = b.tok.join(' ');
    if (ka && ka === kb) { unisci(a.o.id, b.o.id, 'stesso nome e cognome (anche scambiati)'); continue; }
    if (telDiversi) continue;
    if (ka.length >= 6 && kb.length >= 6 && distanza(ka, kb) <= 1) { unisci(a.o.id, b.o.id, 'nome quasi uguale'); continue; }
    const soloNome = (x: typeof a, y: typeof a) => x.solo && x.tok.length === 1 && y.tok.includes(x.tok[0]) && y.tok.length > 1;
    if (soloNome(a, b) || soloNome(b, a)) unisci(a.o.id, b.o.id, 'solo il nome, uguale a quello di un altro ospite');
  }
  const gruppi = new Map<string, string[]>();
  for (const o of lista) if (motiviPer.has(o.id)) { const r = trova(o.id); gruppi.set(r, [...(gruppi.get(r) ?? []), o.id]); }
  return [...gruppi.values()].filter((ids) => ids.length > 1).map((ids) => ({ ids, motivi: [...new Set(ids.flatMap((id) => [...(motiviPer.get(id) ?? [])]))] }));
}

/** Record che sembrano di prova (test, prova, xxx…): solo un suggerimento, mai una cancellazione. */
export function sembraDiProva(nome: string, cognome: string): boolean {
  return /(^|[^a-z])(test|prova|prov|xxx|asd|demo|fake|finto)([^a-z]|$)/i.test(`${nome} ${cognome}`.replace(/_/g, ' '));
}
