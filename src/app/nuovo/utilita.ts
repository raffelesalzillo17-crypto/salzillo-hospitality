import type { DatiSch, Prenotazione, Tema } from './tipi';

/** Importo in euro con il punto delle migliaia (1.471,00 €): il formato it-IT del browser lo omette per i numeri a quattro cifre. */
export const eur = (n: number) => {
  const [i, d] = Math.abs(n).toFixed(2).split('.');
  return `${n < -0.004 ? '-' : ''}${i.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${d}\u00a0€`;
};

export const neg = (n: number) => (n > 0.005 ? '−' : '') + eur(n);

export const dataIt = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

export const CANALE_COLOR: Record<string, string> = {
  'Airbnb': '#FF5A5F', 'Booking': '#1D6DF0', 'Diretto': '#1FAA6E', 'No Tax': '#8C7BD8',
};

// La scheda 'documenti' mostra soprattutto i preventivi (più le richieste dal sito e i file
// veri su Drive) — il nome in tab riflette quello che ci si trova davvero.
export const TAB_LABEL: Partial<Record<string, string>> = { documenti: 'Preventivi', documentiospiti: 'Documenti ospiti', alloggiati: 'Alloggiati Web', link: 'Link utili', promemoria: 'Promemoria' };

export function applicaTema(t: Tema) {
  const el = document.documentElement;
  if (t === 'auto') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', t);
}

export async function api(azione: string, payload: Record<string, unknown> = {}) {
  const r = await fetch('/api/nuovo/scrivi', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ azione, ...payload }),
  });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Errore');
  return d.risultato;
}

/** Scarica come Excel o CSV una tabella già visibile (es. prenotazioni coi filtri attivi): la formatta il server, che non legge altro dal database. */
/** Sezioni che hanno un indirizzo proprio: /nuovo/<sezione>. */
export const TAB_URL = ['dashboard', 'calendario', 'prenotazioni', 'documenti', 'ospiti', 'documentiospiti', 'promemoria', 'pulizie', 'alloggiati', 'adempimenti', 'rendiconti', 'spese', 'scadenze', 'immobili', 'link', 'registro', 'guida'] as const;

export async function scaricaTabella(nome: string, formato: 'xlsx' | 'csv', intestazioni: string[], righe: (string | number | null)[][]) {
  const r = await fetch('/api/nuovo/esporta-tabella', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, formato, intestazioni, righe }),
  });
  if (!r.ok) { const d = await r.json().catch(() => ({})); throw new Error(d.error || 'Esportazione non riuscita'); }
  const blob = await r.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.${formato}`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export async function creaBlocco(alloggioId: string, checkin: string, checkout: string, nota?: string) {
  const r = await fetch('/api/nuovo/blocchi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alloggioId, checkin, checkout, nota }) });
  const d = await r.json();
  if (!d.ok) throw new Error(d.error || 'Errore');
}

export async function rimuoviBloccoApi(id: string) {
  await fetch('/api/nuovo/blocchi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rimuovi: id }) });
}

/** Prenotazione attiva, non ancora conclusa, senza nessun documento caricato né schedina (indicatore sul calendario). */
export const mancanoDocumenti = (p: Prenotazione) => {
  const oggiLocale = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  return p.stato === 'Attiva' && p.checkout >= oggiLocale && p.documentiIdentita === 0 && p.schedine.length === 0;
};

/** Documenti d'identità della prenotazione: li carica Raffaele (foto o PDF), non l'ospite.
 *  Le foto vengono ridimensionate qui prima dell'invio (limite ~4 MB di Vercel). */
export async function ridimensiona(file: File, lato = 1800): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic' || file.type === 'image/heif') return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, lato / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}

const MAX_FILE_MB = 4; // limite del corpo di una funzione Vercel (~4,5 MB)

/** Prepara un file da caricare: ridimensiona le foto e rifiuta con un messaggio chiaro quello che resta troppo grande. */
export async function preparaFile(file: File): Promise<File> {
  const f = await ridimensiona(file);
  if (f.size > MAX_FILE_MB * 1024 * 1024) {
    throw new Error(`"${f.name}" pesa ${(f.size / 1048576).toFixed(1).replace('.', ',')} MB: il massimo è ${MAX_FILE_MB} MB. Se è una foto, scattala con meno qualità; se è un PDF, comprimilo prima.`);
  }
  return f;
}

/** Legge la risposta di un caricamento: un file troppo grande per il server arriva come testo, non come JSON. */
export async function rispostaCaricamento(r: Response): Promise<{ ok: boolean; error?: string; [k: string]: unknown }> {
  if (r.status === 413) throw new Error(`Il file è troppo grande (massimo ${MAX_FILE_MB} MB).`);
  try { return await r.json(); } catch { throw new Error('Il server ha risposto in modo inatteso: riprova tra un attimo.'); }
}

export const SCH_VUOTA: DatiSch = {
  cognome: '', nome: '', sesso: '', dataNascita: '', luogoNascita: '', statoNascita: '', cittadinanza: '', tipoDocumento: '',
  numeroDocumento: '', luogoRilascioDocumento: '', tipoAlloggiatoCodice: '16', comuneNascitaCodice: '',
};

export const normAll = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
