'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import QrCodeTool from '@/components/QrCodeTool';
import RicevutaButton from '@/components/RicevutaButton';
import PulizieChecklist from '@/components/PulizieChecklist';
import ContrattoButton from '@/components/ContrattoButton';
import SchedineManager from '@/components/SchedineManager';
import ContabilitaDashboard from '@/components/ContabilitaDashboard';
import ScadenzeFiscali from '@/components/ScadenzeFiscali';
import UltimiContratti from '@/components/UltimiContratti';
import ContiBancari from '@/components/ContiBancari';
import AccessiManager from '@/components/AccessiManager';
import OspitiManager from '@/components/OspitiManager';
import { NOMI_STRUTTURE } from '@/lib/strutture';

// Sincronizzazione con la preferenza di sistema (chiaro/scuro) — via useSyncExternalStore,
// il modo corretto in React per leggere uno stato esterno al browser senza setState in un effect.
function subscribeSystemDark(callback: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', callback);
  return () => mq.removeEventListener('change', callback);
}
function getSystemDarkSnapshot() { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
function getSystemDarkServerSnapshot() { return false; }

// -------------------- tipi --------------------
type Booking = {
  row: number; checkin: string; checkout: string; ospite: string; stanza: string;
  canale: string; lordo: number; utile: number; stato: string; penale: string; eventId: string;
};
type CalEvent = { id?: string; summary: string; start: string; end: string; allDay: boolean; calendarName: string };
type NewsItem = { source: string; title: string; link: string; snippet: string; pubDate: string };
type Market = { label: string; price?: number; changePercent?: number; currency?: string; spark?: number[]; error?: boolean };

// Elenco strutture ora centralizzato in src/lib/strutture.ts (09/09/2026) — vedi quel file
// per il perché.
const STANZE = NOMI_STRUTTURE;
const VIEWS = [
  'agenda', 'hospitality', 'notizie', 'scuola', 'patrimonio', 'salute', 'personale',
  'hosp-prenotazioni', 'hosp-contratti', 'hosp-ricevute', 'hosp-contabilita', 'hosp-pulizie',
  'hosp-alloggiati', 'hosp-qrcode', 'hosp-scadenze', 'hosp-eventi',
];

// Quote possedute del PAC (aggiornate manualmente il 16 di ogni mese dopo il versamento — vedi wiki/concetti/pac-etf-core-msci-world.md)
const PAC_QUOTE = 43.709478;

// -------------------- io e Martina --------------------
const MARTINA = {
  primoBacio: new Date(2021, 6, 27),      // 27 luglio 2021, Marina di Minturno
  fidanzamento: new Date(2021, 8, 4),     // 4 settembre 2021, Sorrento
  nascita: new Date(2001, 4, 22),         // 22 maggio 2001
  onomastico: { mese: 0, giorno: 30 },    // 30 gennaio, Santa Martina
};

// -------------------- saluto + frase del giorno --------------------
function greeting(h: number) {
  if (h < 5) return 'Buonanotte';
  if (h < 12) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

// Frasi ricorrenti speciali: hanno sempre priorità sul pool generico quel giorno esatto.
function specialLine(d: Date): string | null {
  const md = (m: number, day: number) => d.getMonth() === m && d.getDate() === day;
  if (md(8, 4)) return 'Oggi è il vostro anniversario di fidanzamento. Il resto della lista può aspettare.';
  if (md(6, 27)) return 'Il 27 luglio è iniziato tutto, a Marina di Minturno. Buona giornata speciale.';
  if (md(4, 22)) return 'Oggi Martina compie gli anni — il resto della giornata gira intorno a questo.';
  if (md(0, 30)) return 'Buon onomastico a Martina, oggi. Non dimenticartelo per primo tu.';
  if (md(2, 6)) return 'Buon compleanno, Raffaele. Un anno in più di cose costruite da zero.';
  if (md(8, 7)) return 'Primo giorno di scuola 2026/27 — il primo da docente di ruolo. Goditelo.';
  return null;
}

// Pool di frasi radicate nei fatti reali di Raffaele (scuola/sostegno, Salzillo Hospitality,
// PAC/investimenti, il percorso con Martina, l'aver imparato a programmare da zero con Claude Code).
// Selezione deterministica per giorno dell'anno: cambia ogni mattina, si ripete solo dopo un giro completo.
const DAILY_LINES = [
  'Hai portato un B&B di famiglia da un foglio Excel a un sistema che gestisci dal telefono. Oggi aggiungi solo un altro mattone.',
  'Sei diventato di ruolo dopo un percorso che è partito da un incontro informale con l\'inclusione scolastica a 18 anni. Non è stato un caso, è stato lavoro.',
  'Il PAC va avanti anche nei mesi in cui non ci pensi. Le cose che contano davvero funzionano così.',
  'Hai imparato a costruire un sito intero senza aver mai scritto una riga di codice prima. Oggi puoi affrontare qualsiasi cosa sembri "troppo tecnica".',
  'Tre stanze nuove stanno per aprire a Marcianise. Quello che stai costruendo ora, tra qualche mese sarà normale amministrazione.',
  'Un allievo che segui oggi si ricorderà di te tra vent\'anni, anche se lui non lo sa ancora e nemmeno tu.',
  'Da Marcianise a Feltre per un posto di ruolo: la parte difficile del percorso l\'hai già fatta.',
  'Martina e tu vi conoscete da quando eravate ragazzi in un istituto alberghiero. Le cose buone, spesso, richiedono solo tempo.',
  'Oggi è un giorno feriale qualunque. Sono proprio i giorni così a costruire i risultati di cui poi ti stupisci.',
  'Hai gestito un B&B, superato un anno di prova e tenuto in piedi una relazione a distanza nello stesso periodo. Sai fare più cose insieme di quanto ti ricordi nei giorni no.',
  'Ogni prenotazione che arriva oggi passa da un sistema che hai progettato tu, da zero. Non è scontato.',
  'Sei un docente di sostegno: il tuo lavoro migliore spesso non produce risultati visibili subito. Va bene lo stesso.',
  'La disciplina che metti nel PAC è la stessa che serve per un anno scolastico intero: piccoli versamenti costanti, nessun panico sui cali.',
  'Hai già affrontato un trasloco, un nuovo incarico e una procedura di ruolo nello stesso anno. Oggi è, relativamente, un giorno leggero.',
  'Ogni cosa che automatizzi nel gestionale del B&B è un\'ora che non dovrai più passare a farla a mano il mese prossimo.',
  'Quello che stai costruendo con Salzillo Hospitality assomiglia sempre di più a un\'azienda vera, non più a un progetto secondario.',
  'Chi ti ha insegnato in sala al terzo anno di alberghiero non immaginava che avresti insegnato tu, un giorno, a qualcun altro.',
  'Le cose che rimandi da giorni di solito richiedono venti minuti reali, non l\'ora che gli hai assegnato nella testa.',
  'Sei passato da cameriere di sala a docente di ruolo. Le tappe intermedie che sembravano deviazioni erano il percorso.',
  'Un contratto in più, uno studente in più, una prenotazione in più: oggi conta ognuna di queste piccole cose, anche se non lo sembra.',
  'Hai scelto di tenere famiglia, scuola e impresa nello stesso spazio mentale invece di sacrificarne una. È più difficile, ed è anche perché funziona.',
  'La versione di te che ha superato il colloquio finale dell\'anno di prova sapeva che ce l\'avresti fatta. Fidati ancora di lui oggi.',
  'Ogni euro che entra da Airbnb o Booking passa da un calcolo che hai automatizzato tu. Il lavoro sporco l\'hai già fatto una volta sola.',
  'Non serve una giornata perfetta per far progredire la tua carriera, il B&B o la relazione con Martina. Serve solo che oggi non sia peggio di ieri.',
  'Sei l\'unico della tua famiglia ad aver imparato a programmare da autodidatta per risolvere un problema pratico. Ricordatelo la prossima volta che ti sembra "impossibile".',
];
function dailyLine(d: Date) {
  const special = specialLine(d);
  if (special) return special;
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return DAILY_LINES[(dayOfYear * 7) % DAILY_LINES.length];
}

function parseItDate(s: string): Date | null {
  const [d, m, y] = (s || '').split('/').map(Number);
  if (!d || !m || !y) return null;
  return new Date(y, m - 1, d);
}
function todayMid() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}
function fmtDayLabel(d: Date) {
  const t = todayMid();
  const diffDays = Math.round((d.getTime() - t.getTime()) / 86400000);
  if (diffDays === 0) return 'Oggi — ' + d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  if (diffDays === 1) return 'Domani — ' + d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}
function eur(n: number) { return '€' + Math.round(n).toLocaleString('it-IT'); }
function capitalize(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }
function daysBetween(a: Date, b: Date) { return Math.round((b.getTime() - a.getTime()) / 86400000); }
// Differenza "civile" anni/mesi/giorni tra due date (per "insieme da X anni, Y mesi, Z giorni").
function yearsMonthsDays(from: Date, to: Date) {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}
// Prossima occorrenza di una ricorrenza annuale (compleanno, onomastico, anniversario) da "from" in poi.
function nextOccurrence(month: number, day: number, from: Date) {
  const year = from.getFullYear();
  let d = new Date(year, month, day);
  if (d < from) d = new Date(year + 1, month, day);
  return d;
}
// Soglie di severità per variazioni di mercato: una flessione minima non è "urgente".
function changeChipClass(pct: number) { return pct >= 0 ? 'good' : pct > -1 ? 'warn' : 'urgent'; }
function changeLabel(pct: number, decimals = 1) {
  const rounded = Math.abs(pct) < 0.05 ? 0 : pct;
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(decimals)}%`;
}

// icone (Tabler-style, inline)
const Icon = {
  calendar: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-6 9 6v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><path d="M9 21V12h6v9" /></svg>,
  news: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13a2 2 0 0 1 2 2v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z" /><path d="M19 8h1a1 1 0 0 1 1 1v9.5a1.5 1.5 0 0 1-3 0V6" /><path d="M8 8h7M8 12h7M8 16h4" /></svg>,
  school: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 10L12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" /></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>,
  heart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>,
  chevron: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>,
  back: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>,
  sun: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /></svg>,
  cloud: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.4-1.5A4.5 4.5 0 0 0 6.5 19z" /></svg>,
  bell: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>,
  moon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>,
  sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 5.3L19 10l-5.1 1.7L12 17l-1.9-5.3L5 10l5.1-1.7z" /></svg>,
  send: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>,
  search: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>,
  mic: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a7 7 0 0 1-14 0M12 18v3" /></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>,
  doc: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></svg>,
  receipt: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 2h16v20l-3-2-3 2-3-2-3 2-3-2-1 2z" /><path d="M8 7h8M8 11h8M8 15h5" /></svg>,
  wallet: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v3" /><path d="M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-5a2 2 0 0 0 0 4h.5" /></svg>,
  broom: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M4 22l5-9M9 13l8-9 3 3-9 8z" /><path d="M12 16l-3.5 3.5a2 2 0 0 1-2.8 0l-.2-.2a2 2 0 0 1 0-2.8L9 13" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>,
  qrcode: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20h1" /></svg>,
  alarm: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l3 2M5 3L2 6M22 6l-3-3" /></svg>,
  flame: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2s6 5.5 6 10.5A6 6 0 0 1 6 12.5C6 10 7.5 8.5 8 7c.5 2 2 2.5 2 2.5C9 6 10.5 3.5 12 2z" /></svg>,
  key: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="15" r="4" /><path d="M10.5 12.5L20 3M17 6l3 3M13.5 9.5l2.5 2.5" /></svg>,
  users: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
};

export default function PlanciaPage() {
  const [hash, setHash] = useState('');
  const [clock, setClock] = useState<Date | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null);
  const [askInput, setAskInput] = useState('');
  const [askHistory, setAskHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [askPending, setAskPending] = useState<unknown>(null);
  const [askExchange, setAskExchange] = useState<{ q: string; a: string } | null>(null);
  const [askLoading, setAskLoading] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDarkSnapshot, getSystemDarkServerSnapshot);
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [bookingsErr, setBookingsErr] = useState<string | null>(null);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [eventsErr, setEventsErr] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [weather, setWeather] = useState<{ marcianise: number | null; feltre: number | null }>({ marcianise: null, feltre: null });
  // Sblocco leggero della pagina: senza login vero, ma tiene fuori chi trova il link per caso.
  // La chiave resta solo lato server (route /api/assistente) — qui si salva solo ciò che l'utente digita.
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [plancKey, setPlancKey] = useState('');
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keyChecking, setKeyChecking] = useState(false);
  const [keyVisible, setKeyVisible] = useState(false);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const verifyKey = async (k: string) => {
    try {
      const res = await fetch('/api/verifica-chiave', { method: 'POST', headers: { 'x-plancia-key': k } });
      const data = await res.json();
      return !!data.ok;
    } catch {
      return false; // problema di rete: meglio far ritentare che sbloccare a vuoto
    }
  };

  useEffect(() => {
    (async () => {
      let stored = '';
      try { stored = localStorage.getItem('plancia_key') || ''; } catch { /* localStorage non disponibile */ }
      if (!stored) { setUnlocked(false); return; }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- verifica post-mount necessaria, non fidarsi ciecamente del valore salvato
      const ok = await verifyKey(stored);
      if (ok) { setPlancKey(stored); setUnlocked(true); }
      else { try { localStorage.removeItem('plancia_key'); } catch { /* localStorage non disponibile */ } setUnlocked(false); }
    })();
  }, []);

  const unlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const k = keyInput.trim();
    if (!k || keyChecking) return;
    setKeyChecking(true);
    setKeyError('');
    const ok = await verifyKey(k);
    setKeyChecking(false);
    if (!ok) { setKeyError('Chiave sbagliata, controlla e riprova.'); return; }
    try { localStorage.setItem('plancia_key', k); } catch { /* localStorage non disponibile */ }
    setPlancKey(k);
    setUnlocked(true);
  };

  useEffect(() => {
    const sync = () => setHash(location.hash.replace('#', ''));
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Tema: segue il sistema finché l'utente non sceglie esplicitamente, poi resta fisso (salvato).
  // Lettura di localStorage volutamente in un effect (non nel render): sul server non esiste,
  // leggerlo in fase di render causerebbe un mismatch di idratazione tra server e client.
  useEffect(() => {
    try {
      const stored = localStorage.getItem('plancia-theme');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lettura post-mount necessaria per evitare mismatch SSR/client
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch { /* localStorage non disponibile, resta sul sistema */ }
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.setAttribute('data-theme', theme);
    else document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  const effectiveDark = theme ? theme === 'dark' : systemDark;
  const toggleTheme = () => {
    const next = effectiveDark ? 'light' : 'dark';
    setTheme(next);
    try { localStorage.setItem('plancia-theme', next); } catch { /* non salvabile, resta per la sessione */ }
  };

  // Caricata dopo lo sblocco di plancia (plancKey arriva async da localStorage). /api/prenotazioni
  // dal 10/09/2026 è di nuovo aperta (login rimosso su richiesta di Raffaele) — l'header
  // x-plancia-key non serve più ma è innocuo, lo si toglie quando arriva il nuovo sistema.
  useEffect(() => {
    if (!plancKey) return;
    fetch('/api/prenotazioni').then((r) => r.json()).then((d) => {
      if (d.ok) setBookings(d.prenotazioni); else setBookingsErr(d.error || 'errore');
    }).catch((e) => setBookingsErr(String(e)));
  }, [plancKey]);

  useEffect(() => {
    fetch('/api/calendario?days=14').then((r) => r.json()).then((d) => {
      if (d.ok) setEvents(d.events); else setEventsErr(d.error || 'errore');
    }).catch((e) => setEventsErr(String(e)));

    fetch('/api/notizie').then((r) => r.json()).then((d) => { if (d.ok) setNews(d.news); }).catch(() => {});
    fetch('/api/mercati').then((r) => r.json()).then((d) => { if (d.ok) setMarkets(d.markets); }).catch(() => {});

    const coords = { marcianise: [41.0333, 14.2833], feltre: [46.0167, 11.9] } as const;
    (Object.keys(coords) as (keyof typeof coords)[]).forEach((city) => {
      const [lat, lon] = coords[city];
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&timezone=auto`)
        .then((r) => r.json())
        .then((d) => setWeather((w) => ({ ...w, [city]: Math.round(d?.current?.temperature_2m ?? NaN) })))
        .catch(() => {});
    });
  }, []);

  const active = useMemo(() => (bookings || []).filter((b) => (b.stato || '').toLowerCase() === 'attiva')
    .map((b) => ({ ...b, ci: parseItDate(b.checkin), co: parseItDate(b.checkout) }))
    .filter((b) => b.ci && b.co), [bookings]);

  const today = todayMid();
  const horizon = new Date(today.getTime() + 14 * 86400000);

  const occupancy = useMemo(() => STANZE.map((room) => {
    const occ = active.some((b) => b.stanza === room && b.ci! <= today && b.co! > today);
    return { room, pct: occ ? 100 : 0 };
  }), [active]);
  const occupiedCount = occupancy.filter((o) => o.pct > 0).length;

  const upcoming = useMemo(() => active
    .filter((b) => b.ci! > today && b.ci! <= horizon)
    .sort((a, b) => a.ci!.getTime() - b.ci!.getTime()), [active]);

  const checkoutsToday = useMemo(() => active.filter((b) => b.co!.getTime() === today.getTime()), [active]);

  const monthlyProfit = useMemo(() => active
    .filter((b) => b.ci!.getMonth() === today.getMonth() && b.ci!.getFullYear() === today.getFullYear())
    .reduce((sum, b) => sum + (b.utile || 0), 0), [active]);

  const eventsByDay = useMemo(() => {
    if (!events) return [] as { label: string; items: CalEvent[] }[];
    const map = new Map<string, CalEvent[]>();
    events.forEach((e) => {
      const d = new Date(e.start);
      const key = d.toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries()).map(([key, items]) => ({ label: fmtDayLabel(new Date(key)), items }));
  }, [events]);

  const eventsToday = useMemo(() => (events || [])
    .filter((e) => new Date(e.start).toDateString() === today.toDateString()).length, [events]);
  const eventsWeek = useMemo(() => (events || [])
    .filter((e) => { const d = new Date(e.start); return d >= today && d.getTime() < today.getTime() + 7 * 86400000; }).length, [events]);

  const martina = useMemo(() => {
    const giorniInsieme = daysBetween(MARTINA.fidanzamento, today);
    const insieme = yearsMonthsDays(MARTINA.fidanzamento, today);
    const prossimoCompleanno = nextOccurrence(4, 22, today);
    const prossimoOnomastico = nextOccurrence(MARTINA.onomastico.mese, MARTINA.onomastico.giorno, today);
    const prossimoAnniversario = nextOccurrence(8, 4, today);
    const eventi = [
      { label: 'Anniversario fidanzamento', data: prossimoAnniversario, giorni: daysBetween(today, prossimoAnniversario) },
      { label: 'Compleanno di Martina', data: prossimoCompleanno, giorni: daysBetween(today, prossimoCompleanno) },
      { label: 'Onomastico di Martina', data: prossimoOnomastico, giorni: daysBetween(today, prossimoOnomastico) },
    ].sort((a, b) => a.giorni - b.giorni);
    return { giorniInsieme, insieme, eventi };
  }, []);

  const etf = markets?.find((m) => m.label.includes('PAC'));
  const otherMarkets = markets?.filter((m) => !m.label.includes('PAC'));

  // Anello patrimonio: avanzamento del mese verso il versamento automatico del 16.
  const pacRingPct = useMemo(() => {
    const day = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return day <= 16 ? (day / 16) * 100 : ((day - 16) / (daysInMonth - 16)) * 100;
  }, []);
  const nextPacDate = today.getDate() < 16
    ? new Date(today.getFullYear(), today.getMonth(), 16)
    : new Date(today.getFullYear(), today.getMonth() + 1, 16);

  // Anello Martina: si riempie via via che ci si avvicina alla prossima ricorrenza.
  const martinaRingPct = Math.max(6, 100 - (martina.eventi[0].giorni / 365) * 100);
  const hospitalityRingPct = (occupiedCount / STANZE.length) * 100;
  const pacValue = etf?.price != null ? PAC_QUOTE * etf.price : null;

  const runAsk = async (raw: string) => {
    const q = raw.trim();
    if (!q || askLoading) return;
    setAskInput('');
    setAskLoading(true);
    setAskOpen(true);
    setAskExchange({ q, a: '' });
    try {
      const res = await fetch('/api/assistente', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-plancia-key': plancKey },
        body: JSON.stringify({ message: q, history: askHistory, pendingAction: askPending }),
      });
      if (res.status === 401) {
        try { localStorage.removeItem('plancia_key'); } catch { /* localStorage non disponibile */ }
        setUnlocked(false);
        throw new Error('Chiave di accesso non valida, reinseriscila.');
      }
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Errore sconosciuto');
      setAskHistory(data.history || []);
      setAskPending(data.pendingAction || null);
      setAskExchange({ q, a: data.answer || '(nessuna risposta)' });
    } catch (err) {
      setAskExchange({ q, a: `⚠️ ${err instanceof Error ? err.message : 'Errore di connessione'}` });
    } finally {
      setAskLoading(false);
    }
  };

  const askSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await runAsk(askInput);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = ['audio/mp4', 'audio/webm', 'audio/ogg'];
      const mimeType = preferredTypes.find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        transcribeAndAsk(blob);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setAskOpen(true);
      setAskExchange({ q: '🎤', a: '⚠️ Non riesco ad accedere al microfono — controlla i permessi del browser.' });
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const transcribeAndAsk = async (blob: Blob) => {
    setAskLoading(true);
    setAskOpen(true);
    setAskExchange({ q: '🎤 …', a: '' });
    try {
      const form = new FormData();
      form.append('audio', blob, 'voice');
      const res = await fetch('/api/trascrivi', { method: 'POST', headers: { 'x-plancia-key': plancKey }, body: form });
      if (res.status === 401) {
        try { localStorage.removeItem('plancia_key'); } catch { /* localStorage non disponibile */ }
        setUnlocked(false);
        throw new Error('Chiave di accesso non valida, reinseriscila.');
      }
      const data = await res.json();
      if (!data.ok || !data.text) throw new Error(data.error || 'Non ho capito nulla dal vocale.');
      setAskLoading(false);
      await runAsk(data.text);
    } catch (err) {
      setAskLoading(false);
      setAskExchange({ q: '🎤', a: `⚠️ ${err instanceof Error ? err.message : 'Errore trascrizione'}` });
    }
  };

  const micClick = () => {
    if (askInput.trim()) { runAsk(askInput); return; }
    if (recording) stopRecording(); else startRecording();
  };

  // Rende *grassetto* senza markdown pesante, coerente col formato già usato dal bot Telegram.
  const renderAskText = (text: string) => text.split(/(\*[^*]+\*)/g).map((part, i) =>
    part.startsWith('*') && part.endsWith('*') && part.length > 2
      ? <b key={i}>{part.slice(1, -1)}</b>
      : <span key={i}>{part}</span>
  );

  const openView = (v: string) => { location.hash = v; };
  const closeView = () => { location.hash = ''; };
  const isHome = !VIEWS.includes(hash);

  if (unlocked === null) return null; // primo render: aspetta il controllo di localStorage, niente flash

  if (!unlocked) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b0d12', padding: 24 }}>
        <form onSubmit={unlockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
          <p style={{ color: '#fff', fontFamily: 'system-ui, sans-serif', fontSize: 15, marginBottom: 4, textAlign: 'center' }}>Motore Rafilu</p>
          <div style={{ position: 'relative' }}>
            <input
              type={keyVisible ? 'text' : 'password'}
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={keyInput}
              onChange={(e) => { setKeyInput(e.target.value); setKeyError(''); }}
              placeholder="Chiave di accesso"
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px 44px 12px 14px', borderRadius: 10, border: keyError ? '1px solid #ff6b5b' : '1px solid #333', background: '#15171e', color: '#fff', fontSize: 15 }}
            />
            <button
              type="button"
              onClick={() => setKeyVisible((v) => !v)}
              aria-label={keyVisible ? 'Nascondi chiave' : 'Mostra chiave'}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: 13, cursor: 'pointer', padding: 4 }}
            >
              {keyVisible ? 'nascondi' : 'mostra'}
            </button>
          </div>
          {keyError && <p style={{ color: '#ff6b5b', fontFamily: 'system-ui, sans-serif', fontSize: 13, margin: 0, textAlign: 'center' }}>{keyError}</p>}
          <button type="submit" disabled={keyChecking} style={{ padding: '12px 14px', borderRadius: 10, border: 'none', background: '#ff6b5b', color: '#fff', fontWeight: 600, fontSize: 15, opacity: keyChecking ? .6 : 1 }}>
            {keyChecking ? 'Controllo…' : 'Entra'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <style>{CSS}</style>

      <button className="theme-fab" onClick={toggleTheme} aria-label={effectiveDark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}>
        {effectiveDark ? Icon.sun : Icon.moon}
      </button>

      <div className="ask-dock">
        {askOpen && askExchange && (
          <div className="ask-card">
            <button className="ask-close" onClick={() => setAskOpen(false)} aria-label="Chiudi">{Icon.close}</button>
            <p className="ask-q">{askExchange.q}</p>
            {askLoading ? (
              <p className="ask-a ask-loading">Sto pensando…</p>
            ) : (
              <p className="ask-a">{renderAskText(askExchange.a)}</p>
            )}
          </div>
        )}
        <form className="ask-bar" onSubmit={askSubmit}>
          <span className="ask-glow" aria-hidden="true" />
          <span className="ask-icon">{Icon.search}</span>
          <input
            type="text"
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onFocus={() => { if (askExchange) setAskOpen(true); }}
            placeholder="Cerca"
            aria-label="Chiedi qualcosa a Motore Rafilu"
          />
          <button
            type="button"
            className={`ask-send${recording ? ' recording' : ''}`}
            onClick={micClick}
            disabled={askLoading}
            aria-label={askInput.trim() ? 'Invia' : recording ? 'Ferma registrazione' : 'Registra un messaggio vocale'}
          >
            {askInput.trim() ? Icon.send : Icon.mic}
          </button>
        </form>
      </div>

      {isHome && (
        <div id="home">
          <div className="topbar hero">
            <div className="hero-text">
              <div className="hero-badge"><div className="hero-badge-in">⚙️</div></div>
              <span className="hero-eyebrow">{clock ? capitalize(clock.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })) : ''}</span>
              <h1>{greeting(clock ? clock.getHours() : 9)}, Raffaele</h1>
              <p className="hero-quote">{dailyLine(clock || new Date())}</p>
            </div>
            <div className="hero-clock num">{clock ? clock.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '··:··:··'}</div>
          </div>

          <div className="pill-row">
            <span className="quick-pill"><span className="dot good" />Tutto ok</span>
            <span className="quick-pill hot"><span className="dot pink" />Tra {martina.eventi[0].giorni}gg — {martina.eventi[0].label}</span>
            <span className="quick-pill">{Icon.sun}Marcianise <span className="val">{weather.marcianise != null ? `${weather.marcianise}°` : '···'}</span></span>
            <span className="quick-pill">{Icon.cloud}Feltre <span className="val">{weather.feltre != null ? `${weather.feltre}°` : '···'}</span></span>
          </div>

          <div className="tiles tiles-home">
            <button type="button" className="tile tile-lg" onClick={() => openView('agenda')}>
              <div className="tile-top">
                <span className="tile-head"><span className="tile-icon">{Icon.calendar}</span>Agenda</span>
                {eventsErr && <span className="badge urgent">Errore</span>}
                {!eventsErr && <span className="badge amber">{events ? `${eventsByDay[0]?.items.length || 0} impegni oggi` : '···'}</span>}
              </div>
              <ul className="mini-list">
                {(events || []).slice(0, 2).map((e, i) => (
                  <li key={i}><span className="when">{e.allDay ? new Date(e.start).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : new Date(e.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span><span>{e.summary}</span></li>
                ))}
              </ul>
            </button>

            <button type="button" className="tile tile-lg" onClick={() => openView('hospitality')}>
              <div className="tile-top">
                <span className="tile-head"><span className="tile-icon">{Icon.home}</span>Salzillo Hospitality</span>
                {bookingsErr && <span className="badge urgent">Errore</span>}
                {!bookingsErr && <span className="badge amber">{bookings ? `${occupiedCount}/5 stanze` : '···'}</span>}
              </div>
              <div className="ring-row">
                <Ring value={bookings ? hospitalityRingPct : 0} from="#FF5A5F" to="#FFB238" />
                <div className="ring-stat"><b className="num">{bookings ? eur(monthlyProfit) : '···'}</b><span>utile — questo mese</span></div>
              </div>
            </button>

            <button type="button" className="tile tile-lg" onClick={() => openView('notizie')}>
              <div className="tile-top">
                <span className="tile-head"><span className="tile-icon">{Icon.news}</span>Notizie</span>
                <span className="badge neutral">{news ? `${news.length} nuove` : '···'}</span>
              </div>
              <ul className="mini-list">
                {(news || []).slice(0, 2).map((n, i) => (
                  <li key={i}><span className="when">{n.source}</span><span>{n.title}</span></li>
                ))}
              </ul>
            </button>

            <button type="button" className="tile" onClick={() => openView('scuola')}>
              <div className="tile-top"><span className="tile-icon">{Icon.school}</span><span className="badge neutral">IS Feltre</span></div>
              <span className="tile-label">Scuola</span>
            </button>

            <button type="button" className="tile tile-lg" onClick={() => openView('patrimonio')}>
              <div className="tile-top">
                <span className="tile-head"><span className="tile-icon good">{Icon.chart}</span>Patrimonio</span>
                <span className={'badge ' + (etf?.changePercent != null ? changeChipClass(etf.changePercent) : 'neutral')}>
                  {etf?.changePercent != null ? changeLabel(etf.changePercent) : '···'}
                </span>
              </div>
              <div className="ring-row">
                <Ring value={pacRingPct} from="#1FAA6E" to="#22D3C5" />
                <div className="ring-stat"><b className="num">{pacValue != null ? eur(pacValue) : '···'}</b><span>valore PAC MSCI World</span></div>
              </div>
            </button>

            <button type="button" className="tile" onClick={() => openView('salute')}>
              <div className="tile-top"><span className="tile-icon">{Icon.heart}</span><span className="badge neutral">Concept</span></div>
              <span className="tile-label">Salute</span>
            </button>

            <button type="button" className="tile tile-lg" onClick={() => openView('personale')}>
              <div className="tile-top">
                <span className="tile-head"><span className="tile-icon pink">{Icon.heart}</span>Io e Martina</span>
                <span className="badge pink">tra {martina.eventi[0].giorni}gg</span>
              </div>
              <div className="ring-row">
                <Ring value={martinaRingPct} from="#B14AE2" to="#FF5DA2" />
                <div className="ring-stat"><b className="num">{martina.giorniInsieme.toLocaleString('it-IT')}</b><span>giorni insieme</span></div>
              </div>
            </button>
          </div>

          <footer><span>Motore Rafilu</span><span>{bookings ? 'Dati live' : 'Caricamento...'}</span></footer>
        </div>
      )}

      {hash === 'agenda' && (
        <Detail title="Agenda" icon={Icon.calendar} onBack={closeView}>
          {eventsErr && <p style={{ color: 'var(--urgent)' }}>Errore nel recupero del calendario: {eventsErr}</p>}
          {!eventsErr && !events && <p style={{ color: 'var(--ink-muted)' }}>Caricamento eventi...</p>}
          {!eventsErr && events && (
            <div className="grid">
              <div className="card square static">
                <div className="card-title"><span className="t"><span className="icon-badge">{Icon.alarm}</span>Oggi</span></div>
                <div className="stat"><b className="num">{eventsToday}</b><span>impegni</span></div>
              </div>
              <div className="card square static">
                <div className="card-title"><span className="t"><span className="icon-badge amber">{Icon.calendar}</span>Settimana</span></div>
                <div className="stat"><b className="num">{eventsWeek}</b><span>impegni nei prossimi 7 giorni</span></div>
              </div>
              {eventsByDay.map((g, i) => (
                <div className="card row static" key={i}>
                  <div className="card-title"><span className="t">{g.label}</span><span className="badge neutral">{g.items.length}</span></div>
                  <ul className="mini-list">
                    {g.items.map((e, j) => (
                      <li key={j}><span className="when">{e.allDay ? 'Tutto il giorno' : new Date(e.start).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span><span>{e.summary} <span style={{ color: 'var(--ink-faint)' }}>· {e.calendarName}</span></span></li>
                    ))}
                  </ul>
                </div>
              ))}
              {eventsByDay.length === 0 && (
                <div className="card row static"><p style={{ color: 'var(--ink-muted)', margin: 0 }}>Nessun impegno nei prossimi 14 giorni.</p></div>
              )}
            </div>
          )}
        </Detail>
      )}

      {hash === 'hospitality' && (
        <Detail title="Salzillo Hospitality" icon={Icon.home} accent="good" onBack={closeView}>
          <p style={{ color: 'var(--ink-muted)', fontSize: '.85rem', margin: '-0.8rem 0 1.4rem', maxWidth: '62ch' }}>
            Il centro di controllo dei B&amp;B: gli strumenti che replicano un gestionale host completo (tipo Locazione Turistica / Vita da Host), costruiti su misura invece di un abbonamento. Nove su dieci sono già attivi; Alert prezzi eventi resta l&apos;unico da costruire — apri ognuno per i dettagli.
          </p>
          <div className="tiles">
            <button type="button" className="tile" onClick={() => openView('hosp-prenotazioni')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.calendar}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Prenotazioni &amp; Calendario</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-scadenze')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.alarm}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Scadenze fiscali</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-alloggiati')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.shield}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Check-in digitale &amp; Schedine</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-ricevute')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.receipt}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Ricevute</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-pulizie')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.broom}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Gestione Pulizie</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-contratti')}>
              <div className="tile-top"><span className="tile-icon amber">{Icon.doc}</span><span className="badge amber">Bozza</span></div>
              <span className="tile-label">Contratti di locazione</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-qrcode')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.qrcode}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">QR Code</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-eventi')}>
              <div className="tile-top"><span className="tile-icon">{Icon.flame}</span><span className="badge neutral">Da fare</span></div>
              <span className="tile-label">Alert prezzi eventi</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-contabilita')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.wallet}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Contabilità</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-accessi')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.key}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Accessi collaboratori</span>
            </button>
            <button type="button" className="tile" onClick={() => openView('hosp-ospiti')}>
              <div className="tile-top"><span className="tile-icon good">{Icon.users}</span><span className="badge good">Attivo</span></div>
              <span className="tile-label">Ospiti</span>
            </button>
          </div>
        </Detail>
      )}

      {hash === 'hosp-prenotazioni' && (
        <Detail title="Prenotazioni & Calendario" icon={Icon.calendar} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality">
          <div className="detail-grid">
            <div className="panel">
              <h3>Occupazione stanze — oggi</h3>
              {occupancy.map((o) => (
                <div className="room-bar" key={o.room}>
                  <span className="room-name">{o.room}</span>
                  <div className="track"><div className="fill" style={{ width: o.pct + '%' }} /></div>
                  <span className="pct">{o.pct}%</span>
                </div>
              ))}
            </div>
            <div className="panel">
              <h3>Oggi</h3>
              <ul className="mini-list">
                {checkoutsToday.length === 0 && <li><span className="when">—</span><span>Nessun check-out oggi</span></li>}
                {checkoutsToday.map((b) => (
                  <li key={b.row}><span className="when">Check-out</span><span>{b.ospite}, {b.stanza}</span></li>
                ))}
              </ul>
              <a href="/" className="open-hint" style={{ marginTop: '1.2rem' }}>Apri gestione prenotazioni {Icon.chevron}</a>
            </div>
            <div className="panel full">
              <h3>Prossimi arrivi (14 giorni)</h3>
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Ospite</th><th>Stanza</th><th>Check-in</th><th>Canale</th><th>Lordo</th><th>Azioni</th></tr></thead>
                  <tbody>
                    {upcoming.map((b) => (
                      <tr key={b.row}><td>{b.ospite}</td><td>{b.stanza}</td><td>{b.checkin}</td><td>{b.canale}</td><td className="num">€{b.lordo}</td><td style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap' }}><RicevutaButton prenotazione={b} /><ContrattoButton prenotazione={b} /></td></tr>
                    ))}
                    {upcoming.length === 0 && <tr><td colSpan={6} style={{ color: 'var(--ink-muted)' }}>Nessun arrivo nei prossimi 14 giorni</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Detail>
      )}

      {hash === 'hosp-scadenze' && (
        <Detail title="Calendario scadenze fiscali" icon={Icon.alarm} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality">
          <ScadenzeFiscali />
        </Detail>
      )}

      {hash === 'hosp-alloggiati' && (
        <Detail title="Check-in digitale & Schedine" icon={Icon.shield} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality" chip="Verificato — invio manuale">
          <p style={{ color: 'var(--ink-muted)', fontSize: '.85rem', margin: '-0.8rem 0 1.4rem', maxWidth: '62ch' }}>
            Connessione al portale Alloggiati Web della Polizia di Stato verificata l&apos;08/09/2026 con le vere credenziali (GenerateToken e Authentication_Test hanno risposto esito positivo). L&apos;invio automatico delle schedine non è ancora costruito — manca il formattatore del record — quindi per ora resta la copia manuale dei dati, come prima.
          </p>
          <SchedineManager />
        </Detail>
      )}

      {hash === 'hosp-ricevute' && (
        <Detail title="Ricevute" icon={Icon.receipt} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality">
          <div className="panel full">
            <p style={{ color: 'var(--ink-muted)' }}><strong>Ricevuta d&apos;affitto in PDF — attiva</strong>: apri &quot;Prenotazioni &amp; Calendario&quot; e premi &quot;Ricevuta&quot; su una prenotazione Booking/Airbnb/Diretto per generarla, con intestatario/importo modificabili prima del download. Le prenotazioni No Tax (Stanza Rosa, Via Campania, e il Tulipano quando è No Tax) non mostrano il pulsante — per scelta, restano fuori conto come deciso. Imposta di soggiorno: nessuna risulta in vigore a Marcianise (verificato), il campo resta comunque disponibile per un domani.</p>
          </div>
        </Detail>
      )}

      {hash === 'hosp-pulizie' && (
        <Detail title="Gestione Pulizie" icon={Icon.broom} accent="amber" onBack={() => openView('hospitality')} backLabel="Hospitality" chip="Attivo">
          <PulizieChecklist />
          <div className="panel full">
            <p style={{ color: 'var(--ink-muted)' }}>Checklist generata automaticamente dai check-out reali (oggi + prossimi 2 giorni), con spunta persistente salvata sul foglio Google (scheda &quot;PULIZIE&quot;) e operatore tracciato — di default Lella, come una vera assegnazione.</p>
          </div>
        </Detail>
      )}

      {hash === 'hosp-contratti' && (
        <Detail title="Contratti di locazione turistica" icon={Icon.doc} onBack={() => openView('hospitality')} backLabel="Hospitality" chip="Bozza — non revisionato">
          <div className="panel full">
            <p style={{ color: 'var(--warn)', fontWeight: 700, fontSize: '.85rem', margin: '0 0 1rem' }}>
              BOZZA — questo generatore produce un contratto NON revisionato da un legale. Non usarlo con ospiti reali prima di far controllare il testo a un commercialista/legale (avviso ripetuto anche su ogni pagina del PDF).
            </p>
            <p style={{ color: 'var(--ink-muted)' }}>Genera la bozza di contratto di locazione turistica dai dati prenotazione: apri &quot;Prenotazioni &amp; Calendario&quot; e premi &quot;Contratto&quot; su qualunque prenotazione (anche No Tax — qui è una tutela contrattuale, non una questione fiscale). Cauzione e giorni di preavviso cancellazione sono campi compilabili nel form, mai precompilati con valori inventati.</p>
          </div>
          <UltimiContratti />
        </Detail>
      )}

      {hash === 'hosp-qrcode' && (
        <Detail title="QR Code Generator" icon={Icon.qrcode} onBack={() => openView('hospitality')} backLabel="Hospitality">
          <div className="panel full">
            <QrCodeTool />
          </div>
        </Detail>
      )}

      {hash === 'hosp-eventi' && (
        <Detail title="Alert prezzi eventi" icon={Icon.flame} onBack={() => openView('hospitality')} backLabel="Hospitality" chip="Da costruire">
          <div className="panel full">
            <p style={{ color: 'var(--ink-muted)' }}>Il Calendario Google ora funziona (riautorizzato l&apos;08/09/2026) — e si è scoperto che gli eventi locali per il pricing (concerti alla Reggia, ecc.) sono già segnati a mano nel calendario del B&amp;B, spesso già con un prezzo suggerito nel titolo (es. &quot;LUCA CARBONI alla Reggia - €80/notte&quot;). Questo semplifica parecchio lo strumento rispetto all&apos;idea originale.</p>
            <h3 style={{ fontSize: '1rem', marginTop: '1.4rem' }}>Cosa farà (versione semplificata)</h3>
            <ul className="mini-list">
              <li><span className="when">1</span><span>Legge gli eventi già presenti nel calendario del B&amp;B nei prossimi 30 giorni (nessuna ricerca esterna necessaria)</span></li>
              <li><span className="when">2</span><span>Li mostra qui raggruppati per data vicina a un check-in, come promemoria per il prezzo</span></li>
            </ul>
            <p style={{ color: 'var(--ink-faint)', fontSize: '.8rem', marginTop: '1.2rem' }}>Non più bloccato da nulla — solo da costruire, priorità bassa.</p>
          </div>
        </Detail>
      )}

      {hash === 'hosp-contabilita' && (
        <Detail title="Contabilità" icon={Icon.wallet} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality">
          <ContabilitaDashboard />
        </Detail>
      )}

      {hash === 'hosp-accessi' && (
        <Detail title="Accessi collaboratori" icon={Icon.key} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality">
          <AccessiManager plancKey={plancKey} />
        </Detail>
      )}

      {hash === 'hosp-ospiti' && (
        <Detail title="Ospiti" icon={Icon.users} accent="good" onBack={() => openView('hospitality')} backLabel="Hospitality">
          <OspitiManager plancKey={plancKey} />
        </Detail>
      )}

      {hash === 'notizie' && (
        <Detail title="Notizie del giorno" icon={Icon.news} onBack={closeView}>
          {!news && <p style={{ color: 'var(--ink-muted)' }}>Caricamento notizie...</p>}
          {news && (
            <div className="grid">
              {news.map((n, i) => (
                <div className="card row static" key={i}>
                  <div className="card-title"><span className="t"><span className="icon-badge">{Icon.news}</span>{n.source}</span></div>
                  <h4 style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', margin: '0 0 .4rem' }}>{n.title}</h4>
                  <p style={{ margin: 0, color: 'var(--ink-muted)', fontSize: '.87rem' }}>{n.snippet} — <a href={n.link} target="_blank" rel="noreferrer" style={{ color: 'var(--coral)', fontWeight: 600, textDecoration: 'none' }}>leggi</a></p>
                </div>
              ))}
              {news.length === 0 && (
                <div className="card row static"><p style={{ color: 'var(--ink-muted)', margin: 0 }}>Nessuna notizia disponibile.</p></div>
              )}
            </div>
          )}
        </Detail>
      )}

      {hash === 'scuola' && (
        <Detail title="Scuola — IS Feltre" icon={Icon.school} onBack={closeView}>
          <div className="grid">
            <div className="card slim static">
              <div className="card-title"><span className="t"><span className="icon-badge">{Icon.school}</span>Contratto in corso</span></div>
              <ul className="mini-list"><li><span className="when">2026/27</span><span>Sostegno psicofisico, 18 ore/sett.</span></li><li><span className="when">Sede</span><span>IPIA &quot;Carlo Rizzarda&quot;</span></li></ul>
            </div>
            <div className="card slim static">
              <div className="card-title"><span className="t"><span className="icon-badge good">{Icon.shield}</span>Anno di formazione e prova 2025/26</span></div>
              <ul className="mini-list"><li><span className="when">Esito</span><span>Superato — colloquio finale concluso</span></li><li><span className="when">Tutor</span><span>Pietro Avanzi</span></li></ul>
            </div>
          </div>
        </Detail>
      )}

      {hash === 'patrimonio' && (
        <Detail title="Patrimonio" icon={Icon.chart} accent="good" onBack={closeView}>
          <div className="grid">
            <div className="card row static">
              <div className="card-title"><span className="t"><span className="icon-badge good">{Icon.chart}</span>iShares Core MSCI World UCITS ETF — ultimo mese</span></div>
              {etf?.spark && <Sparkline values={etf.spark} height={120} />}
              <div className="stat-row">
                <div className="stat"><b className="num">{pacValue != null ? eur(pacValue) : '···'}</b><span>valore totale — {PAC_QUOTE} quote</span></div>
                <div className="stat"><b className="num">{etf?.changePercent != null ? changeLabel(etf.changePercent, 2) : '···'}</b><span>oggi</span></div>
                <div className="stat"><b className="num">{etf?.price != null ? `${etf.price.toFixed(2)} ${etf.currency}` : '···'}</b><span>prezzo attuale</span></div>
              </div>
            </div>
            {(otherMarkets || []).map((m) => (
              <div className="card square static" key={m.label}>
                <div className="card-title"><span className="t">{m.label}</span>
                  {m.changePercent != null && <span className={'badge ' + changeChipClass(m.changePercent)}>{changeLabel(m.changePercent, 2)}</span>}
                </div>
                <div className="stat"><b className="num">{m.price != null ? `${m.price.toFixed(2)} ${m.currency}` : 'n/d'}</b></div>
              </div>
            ))}
            {(!otherMarkets || otherMarkets.length === 0) && (
              <div className="card row static"><p style={{ color: 'var(--ink-muted)', margin: 0 }}>Nessun altro mercato disponibile.</p></div>
            )}
            <ContiBancari />
          </div>
        </Detail>
      )}

      {hash === 'salute' && (
        <Detail title="Salute" icon={Icon.heart} onBack={closeView} chip="Concept">
          <div className="grid">
            <div className="card row static">
              <p style={{ color: 'var(--ink-muted)', margin: 0 }}>Questa sezione prende forma quando colleghi un dispositivo (es. Fitbit) via Google Health API — passi, sonno, calorie e un consigliere pasti giornaliero. Per ora resta un concept: nessun dato reale collegato.</p>
            </div>
          </div>
        </Detail>
      )}

      {hash === 'personale' && (
        <Detail title="Vita personale" icon={Icon.heart} onBack={closeView}>
          <div className="grid">
            <div className="card square static">
              <div className="card-title"><span className="t"><span className="icon-badge pink">{Icon.heart}</span>Insieme</span></div>
              <div className="stat"><b className="num">{martina.giorniInsieme.toLocaleString('it-IT')}</b><span>giorni insieme</span></div>
            </div>
            <div className="card square static">
              <div className="card-title"><span className="t"><span className="icon-badge pink">{Icon.heart}</span>Coppia ufficiale</span></div>
              <div className="stat"><b className="num">{martina.insieme.years}a {martina.insieme.months}m {martina.insieme.days}g</b><span>da quando siamo ufficialmente una coppia</span></div>
            </div>
            <div className="card row static">
              <div className="card-title"><span className="t">Date da ricordare</span></div>
              <ul className="mini-list">
                <li><span className="when">27 lug 2021</span><span>Primo bacio, Marina di Minturno</span></li>
                <li><span className="when">04 set 2021</span><span>Fidanzamento ufficiale, Sorrento</span></li>
                <li><span className="when">22 maggio</span><span>Compleanno di Martina (2001)</span></li>
                <li><span className="when">30 gennaio</span><span>Onomastico di Martina</span></li>
              </ul>
            </div>
            <div className="card row static">
              <div className="card-title"><span className="t">Prossime ricorrenze</span></div>
              <ul className="mini-list">
                {martina.eventi.map((e) => (
                  <li key={e.label}><span className="when">Tra {e.giorni}gg</span><span>{e.label} — {e.data.toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })}</span></li>
                ))}
              </ul>
            </div>
            <div className="card slim static">
              <div className="card-title"><span className="t">Famiglia</span></div>
              <ul className="mini-list">
                <li><span className="when">Mag &apos;27</span><span>25° anniversario di matrimonio di Luigi &amp; Raffaela</span></li>
              </ul>
            </div>
          </div>
        </Detail>
      )}
    </>
  );
}

// Quadrante circolare in stile Apple Fitness: anello sfumato su una traccia chiara.
function Ring({ value, from, to, size = 76, stroke = 8 }: { value: number; from: string; to: string; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const gid = `ring-${from.replace('#', '')}-${to.replace('#', '')}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="gauge">
      <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={from} /><stop offset="100%" stopColor={to} />
      </linearGradient></defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${gid})`} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

function Sparkline({ values, height = 46 }: { values: number[]; height?: number }) {
  const w = 640;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 10 - ((v - min) / range) * (height - 20)}`).join(' ');
  const last = pts.split(' ').pop()!.split(',');
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${height}`} width="100%" height={height} fill="none">
      <polyline points={pts} stroke="var(--good)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={4} fill="var(--good)" />
    </svg>
  );
}

function Detail({ title, icon, accent, chip, onBack, backLabel, children }: { title: string; icon: React.ReactNode; accent?: string; chip?: string; onBack: () => void; backLabel?: string; children: React.ReactNode }) {
  return (
    <section className="detail active">
      <div className="detail-head">
        <button className="back-btn" onClick={onBack}>{Icon.back}{backLabel || 'Motore'}</button>
        <div className={'icon-badge' + (accent ? ' ' + accent : '')}>{icon}</div>
        <h1>{title} {chip && <span className="chip neutral" style={{ marginLeft: '.5rem' }}>{chip}</span>}</h1>
      </div>
      {children}
    </section>
  );
}

const CSS = `
:root{
  --bg:#FAF7F3; --surface:#FFFFFF; --surface-soft:#F5F0EA; --track:#F1ECE4;
  --ink:#1C1C1E; --ink-muted:#6E6E73; --ink-faint:#AEABA4; --line:#EFEAE3;
  --coral:#FF5A5F; --coral-soft:#FFE7E4; --amber:#FFB238; --amber-soft:#FFF3E0; --amber-ink:#C97A16;
  --good:#1FAA6E; --good-soft:#E3F6EC; --warn:#D98700; --warn-soft:#FCEDD1;
  --urgent:#E5484D; --urgent-soft:#FBE0E1;
  --pink:#FF5DA2; --pink-soft:#FBE6F3; --pink-ink:#C93E86;
  --r-card:24px; --r-panel:20px; --r-badge:13px; --r-pill:100px;
  --shadow:0 1px 2px rgba(28,20,15,.04), 0 14px 32px rgba(28,20,15,.07);
  --shadow-sm:0 1px 3px rgba(28,20,15,.06);
  --shadow-lift:0 2px 6px rgba(28,20,15,.05), 0 22px 40px rgba(28,20,15,.1);
  --font-display:'Plus Jakarta Sans','SF Pro Display','Segoe UI',sans-serif;
  --font-body:'Inter','SF Pro Text','Segoe UI',sans-serif;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --bg:#161512; --surface:#211F1B; --surface-soft:#2A2822; --track:#33312A;
    --ink:#F5F1EA; --ink-muted:#ABA79E; --ink-faint:#6E6A61; --line:#332F28;
    --coral:#FF7A73; --coral-soft:#3A2420; --amber:#FFC15C; --amber-soft:#3A2C10; --amber-ink:#FFC15C;
    --good:#3FC98A; --good-soft:#173226; --warn:#FFB238; --warn-soft:#3A2C10;
    --urgent:#FF6B67; --urgent-soft:#3A1F1E;
    --pink:#FF7EB6; --pink-soft:#3A2030; --pink-ink:#FF9FCB;
    --shadow:0 1px 2px rgba(0,0,0,.4), 0 14px 32px rgba(0,0,0,.45);
    --shadow-sm:0 1px 3px rgba(0,0,0,.4);
    --shadow-lift:0 2px 6px rgba(0,0,0,.4), 0 22px 40px rgba(0,0,0,.5);
  }
}
:root[data-theme="dark"]{
  --bg:#161512; --surface:#211F1B; --surface-soft:#2A2822; --track:#33312A;
  --ink:#F5F1EA; --ink-muted:#ABA79E; --ink-faint:#6E6A61; --line:#332F28;
  --coral:#FF7A73; --coral-soft:#3A2420; --amber:#FFC15C; --amber-soft:#3A2C10; --amber-ink:#FFC15C;
  --good:#3FC98A; --good-soft:#173226; --warn:#FFB238; --warn-soft:#3A2C10;
  --urgent:#FF6B67; --urgent-soft:#3A1F1E;
  --pink:#FF7EB6; --pink-soft:#3A2030; --pink-ink:#FF9FCB;
  --shadow:0 1px 2px rgba(0,0,0,.4), 0 14px 32px rgba(0,0,0,.45);
  --shadow-sm:0 1px 3px rgba(0,0,0,.4);
  --shadow-lift:0 2px 6px rgba(0,0,0,.4), 0 22px 40px rgba(0,0,0,.5);
}
*{box-sizing:border-box;}
html{overflow-x:hidden;}
body{background:var(--bg) !important;overflow-x:hidden;}
.theme-fab{position:fixed;right:1.2rem;bottom:calc(5.6rem + env(safe-area-inset-bottom));z-index:10;width:46px;height:46px;border-radius:50%;
  background:var(--surface);box-shadow:var(--shadow-lift);border:none;color:var(--ink);cursor:pointer;
  display:flex;align-items:center;justify-content:center;}
.theme-fab svg{width:20px;height:20px;}
@media (prefers-reduced-motion: no-preference){ .theme-fab{transition:transform .15s ease;} .theme-fab:hover{transform:scale(1.06);} }
#home, .detail{ font-family:var(--font-body); color:var(--ink); font-size:16px; line-height:1.5;
  padding:0 clamp(1rem,4vw,3rem) calc(8.5rem + env(safe-area-inset-bottom)); max-width:1180px; width:100%; min-width:0; margin:0 auto; }
h1,h2,h3{font-family:var(--font-display);font-weight:700;margin:0;color:var(--ink);letter-spacing:-.01em;}
.num{font-variant-numeric:tabular-nums;}
@keyframes riseIn{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:translateY(0);}}
.topbar{ position:sticky; top:0; z-index:5; display:flex; justify-content:space-between; align-items:flex-end;
  gap:1.5rem; flex-wrap:wrap; padding:1.8rem 0 1.2rem; margin-bottom:.5rem;
  background:var(--bg); }
.hero-text{animation:riseIn .6s ease both;min-width:0;flex:1 1 260px;}
.hero-badge{width:46px;height:46px;border-radius:50%;padding:3px;flex:none;margin-bottom:.9rem;
  background:conic-gradient(from 200deg,#FFB238,#FF5A5F,#B14AE2,#FF5DA2,#FFB238);display:inline-flex;}
.hero-badge-in{width:100%;height:100%;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.1rem;}
.hero-eyebrow{display:block;font-size:.8rem;font-weight:700;color:var(--coral);text-transform:capitalize;letter-spacing:.02em;margin-bottom:.3rem;}
.hero-text h1{font-size:clamp(1.6rem,4.2vw,2.6rem);overflow-wrap:break-word;font-weight:800;}
.hero-quote{margin:.55rem 0 0;max-width:44ch;color:var(--ink-muted);font-size:.98rem;font-weight:500;line-height:1.5;}
.hero-clock{font-family:var(--font-display);font-size:clamp(1.4rem,2.8vw,2.1rem);font-weight:700;color:var(--ink);
  letter-spacing:-.01em;animation:riseIn .6s ease .1s both;flex:none;}
@media (max-width:560px){
  .topbar.hero{flex-direction:column;align-items:flex-start;}
  .hero-text{flex:none;width:100%;}
  .hero-clock{margin-top:.3rem;}
}
.pill-row{display:flex;gap:.55rem;overflow-x:auto;padding:.6rem 0 1.6rem;scrollbar-width:none;animation:riseIn .6s ease .15s both;}
.quick-pill{display:inline-flex;align-items:center;gap:.4rem;flex:none;background:var(--surface);
  box-shadow:var(--shadow-sm);border-radius:var(--r-pill);padding:.5rem .9rem;
  font-size:.8rem;font-weight:600;color:var(--ink-muted);font-family:var(--font-body);white-space:nowrap;}
.quick-pill svg{width:15px;height:15px;color:var(--ink-faint);}
.quick-pill .dot{width:7px;height:7px;border-radius:50%;background:var(--good);flex:none;}
.quick-pill .dot.pink{background:var(--pink);}
.quick-pill.hot{color:var(--pink-ink);}
.quick-pill span.val{color:var(--ink);font-weight:700;}
.grid{display:grid; grid-template-columns:repeat(6, 1fr); gap:1.1rem;}
.card{grid-column:span 3; background:var(--surface); border-radius:var(--r-card); padding:1.4rem 1.5rem;
  cursor:pointer; box-shadow:var(--shadow); transition:transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s ease;
  animation:riseIn .55s cubic-bezier(.2,.8,.2,1) both;}
.card:nth-child(1){animation-delay:.05s;} .card:nth-child(2){animation-delay:.1s;}
.card:nth-child(3){animation-delay:.15s;} .card:nth-child(4){animation-delay:.2s;}
.card:nth-child(5){animation-delay:.25s;} .card:nth-child(6){animation-delay:.3s;}
.card:hover{transform:translateY(-4px);box-shadow:var(--shadow-lift);}
.card.featured{grid-column:span 4;}
.card.slim{grid-column:span 2;}
.card.square{grid-column:span 2; aspect-ratio:1/1; display:flex; flex-direction:column; justify-content:center;}
.card.row{grid-column:span 6;}
.card.static{cursor:default;}
.card.static:hover{transform:none; box-shadow:var(--shadow);}
@media (max-width:880px){
  .card, .card.featured, .card.slim{grid-column:span 6;}
  .card.square{grid-column:span 3;}
}
/* ---------- Pulsanti quadrati (stile guide check-in Tulipano/Rosa) ----------
   Griglia responsive dedicata, indipendente dal sistema .grid a 6 colonne sopra:
   2 pulsanti per riga su telefono (come nelle guide), 3 su tablet, 4-5 su desktop —
   3 fasce esplicite invece del vecchio "tutto a colonna singola sotto 880px". */
.tiles{display:grid; grid-template-columns:repeat(2, 1fr); gap:.85rem;}
@media (min-width:640px){ .tiles{grid-template-columns:repeat(3, 1fr); gap:1rem;} }
@media (min-width:1024px){ .tiles{grid-template-columns:repeat(4, 1fr); gap:1.1rem;} }
@media (min-width:1400px){ .tiles{grid-template-columns:repeat(5, 1fr);} }
/* Home: mix di tile grandi (span 2) e piccole (span 1) — a 3 o 5 colonne lasciano
   sempre una colonna vuota asimmetrica (i conti non tornano: 5 tile grandi + 2 piccole
   non si dividono in gruppi da 3 o 5). Si salta dritti da 2 a 4 colonne, dove il conto
   torna esatto, con dense come rete di sicurezza. */
.tiles.tiles-home{grid-auto-flow:dense;}
@media (min-width:640px){ .tiles.tiles-home{grid-template-columns:repeat(2, 1fr); gap:1rem;} }
@media (min-width:1024px){ .tiles.tiles-home{grid-template-columns:repeat(4, 1fr); gap:1.1rem;} }
.tile{
  appearance:none; border:none; width:100%; font-family:inherit; text-align:left; color:var(--ink);
  background:var(--surface); border-radius:var(--r-panel); padding:1.35rem 1.1rem;
  cursor:pointer; display:flex; flex-direction:column; gap:.9rem; box-shadow:var(--shadow-sm);
  transition:transform .2s cubic-bezier(.2,.8,.2,1), box-shadow .2s ease;
}
.tile:hover{transform:translateY(-3px); box-shadow:var(--shadow-lift);}
.tile:active{transform:scale(.97);}
.tile.static{cursor:default;}
.tile.static:hover{transform:none; box-shadow:var(--shadow-sm);}
.tile-wide{grid-column:1/-1; flex-direction:row; align-items:center;}
.tile-wide .tile-icon{flex:none;}
.tile-icon{width:46px;height:46px;border-radius:13px;background:var(--coral-soft);color:var(--coral);
  display:flex;align-items:center;justify-content:center;flex:none;}
.tile-icon svg{width:23px;height:23px;}
.tile-icon.good{background:var(--good-soft);color:var(--good);}
.tile-icon.amber{background:var(--amber-soft);color:var(--amber-ink);}
.tile-icon.pink{background:var(--pink-soft);color:var(--pink-ink);}
.tile-top{display:flex;align-items:flex-start;justify-content:space-between;gap:.6rem;}
.tile-label{font-family:var(--font-display);font-size:.95rem;font-weight:700;letter-spacing:-.005em;color:var(--ink);}
.tile-sub{font-size:.74rem;color:var(--ink-muted);font-weight:500;margin-top:.15rem;}
.tile-stat{margin-top:-.2rem;}
.tile-stat b{display:block;font-family:var(--font-display);font-size:1.15rem;font-weight:800;color:var(--ink);letter-spacing:-.01em;}
.tile-stat span{font-size:.72rem;color:var(--ink-muted);font-weight:500;}
.tile-lg{grid-column:span 2;}
.tile-lg .tile-top{margin-bottom:.1rem;}
.tile-lg .tile-head{display:flex;align-items:center;gap:.7rem;font-family:var(--font-display);font-weight:700;font-size:.98rem;color:var(--ink);}

.card-title{display:flex;justify-content:space-between;align-items:center;gap:.75rem;margin-bottom:1.1rem;}
.card-title .t{display:flex;align-items:center;gap:.7rem;font-family:var(--font-display);font-weight:700;font-size:.98rem;color:var(--ink);}
.icon-badge{width:36px;height:36px;flex:none;border-radius:var(--r-badge);display:flex;align-items:center;justify-content:center;background:var(--coral-soft);color:var(--coral);}
.icon-badge.good{background:var(--good-soft);color:var(--good);}
.icon-badge.pink{background:var(--pink-soft);color:var(--pink-ink);}
.icon-badge.amber{background:var(--amber-soft);color:var(--amber-ink);}
.icon-badge svg{width:18px;height:18px;}
.badge, .chip{font-size:.72rem;font-weight:700;padding:.28rem .65rem;border-radius:var(--r-pill);white-space:nowrap;flex:none;}
.badge.good, .chip.good{background:var(--good-soft);color:var(--good);}
.badge.warn, .chip.warn{background:var(--warn-soft);color:var(--warn);}
.badge.urgent, .chip.urgent{background:var(--urgent-soft);color:var(--urgent);}
.badge.amber, .chip.amber{background:var(--amber-soft);color:var(--amber-ink);}
.badge.pink, .chip.pink{background:var(--pink-soft);color:var(--pink-ink);}
.badge.neutral, .chip.neutral{background:var(--surface-soft);color:var(--ink-muted);}
.ring-row{display:flex;align-items:center;gap:1.1rem;}
.gauge circle{transition:stroke-dashoffset .6s ease;}
.ring-stat{min-width:0;}
.stat-row{display:flex;gap:1.7rem;margin-top:1.1rem;flex-wrap:wrap;}
.stat b, .ring-stat b{display:block;font-family:var(--font-display);font-size:1.55rem;font-weight:800;letter-spacing:-.02em;color:var(--ink);}
.stat span, .ring-stat span{font-size:.78rem;color:var(--ink-muted);font-weight:500;}
/* max-width apposta: dentro un .card.row/.panel.full largo (es. desktop), "justify-content:space-between"
   su una riga a piena larghezza spinge la pillola e il testo agli estremi opposti, con un vuoto enorme
   in mezzo che rompe la lettura riga-per-riga. Nei contenitori più stretti (tile, card piccole) il limite
   non ha effetto, perché sono già più stretti di così. */
.mini-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.7rem;max-width:640px;}
.mini-list li{display:flex;justify-content:space-between;gap:.75rem;font-size:.88rem;font-weight:500;align-items:baseline;}
.mini-list .when{color:var(--coral);background:var(--coral-soft);font-size:.72rem;font-weight:700;flex:none;
  padding:.22rem .5rem;border-radius:7px;}
.sparkline{display:block;margin-top:1rem;}
.open-hint{font-size:.78rem;font-weight:700;color:var(--coral);margin-top:1.1rem;display:flex;align-items:center;gap:.25rem;text-decoration:none;cursor:pointer;}
.open-hint svg{width:13px;height:13px;}
footer{margin-top:2.5rem;padding-top:1.5rem;color:var(--ink-faint);font-size:.8rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem;font-weight:500;}
.detail-head{position:sticky; top:0; z-index:5; display:flex;align-items:center;gap:1rem;padding:1.4rem 0 1.2rem;margin-bottom:1.6rem;
  background:var(--bg);}
/* Niente "both"/"forwards" qui apposta: un'animazione con fill-mode persistente resta "attiva" su
   transform/opacity anche a fine corsa, e questo crea uno stacking context che intrappola i modali a
   position:fixed dentro .detail (schedina, ricevuta, contratto...) facendoli finire SOTTO il FAB del
   tema (z-index:10) invece che sopra. Senza fill-mode l'animazione si stacca da sola a fine corsa —
   lo stato finale coincide comunque con quello naturale (opacity:1, transform:none), quindi visivamente
   non cambia nulla. */
.detail.active{animation:riseIn .45s cubic-bezier(.2,.8,.2,1);}
.back-btn{display:flex;align-items:center;gap:.35rem;background:var(--surface);box-shadow:var(--shadow-sm);color:var(--ink);
  font-family:var(--font-body);font-size:.85rem;font-weight:600;padding:.55rem .9rem;border-radius:var(--r-pill);cursor:pointer;flex:none;border:none;}
.back-btn svg{width:14px;height:14px;}
.detail-head h1{font-size:clamp(1.5rem,2.8vw,2rem);}
.detail-head .icon-badge{width:42px;height:42px;border-radius:14px;}
.detail-head .icon-badge svg{width:21px;height:21px;}
.detail-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1.1rem;min-width:0;}
@media (max-width:720px){.detail-grid{grid-template-columns:1fr;}}
.panel{background:var(--surface);box-shadow:var(--shadow);border-radius:var(--r-panel);padding:1.5rem 1.6rem;min-width:0;}
.panel h3{font-size:1rem;margin-bottom:1rem;font-weight:700;}
.panel.full{grid-column:1 / -1;}
.day-group + .day-group{margin-top:1.3rem;padding-top:1.3rem;border-top:1px solid var(--line);}
.day-group .day-label{font-size:.72rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase;letter-spacing:.06em;margin-bottom:.6rem;}
table.data{width:100%;border-collapse:collapse;font-size:.87rem;}
table.data th{text-align:left;font-size:.7rem;font-weight:700;color:var(--ink-faint);text-transform:uppercase;padding:.5rem .6rem;border-bottom:1px solid var(--line);}
table.data td{padding:.65rem .6rem;border-bottom:1px solid var(--line);font-weight:500;}
table.data tr:last-child td{border-bottom:none;}
.table-wrap{overflow-x:auto;max-width:100%;}
.news-item + .news-item{margin-top:1.1rem;padding-top:1.1rem;border-top:1px solid var(--line);}
.news-item .src{font-size:.7rem;font-weight:700;color:var(--coral);text-transform:uppercase;}
.news-item h4{font-family:var(--font-display);font-weight:700;font-size:1rem;margin:.35rem 0 .35rem;}
.news-item p{margin:0;color:var(--ink-muted);font-size:.87rem;}
.news-item a{color:var(--coral);font-weight:600;text-decoration:none;}
.room-bar{display:flex;align-items:center;gap:.8rem;margin-top:.85rem;}
.room-bar .room-name{width:82px;flex:none;font-size:.82rem;font-weight:600;}
.room-bar .track{flex:1;height:8px;background:var(--track);border-radius:5px;overflow:hidden;}
.room-bar .fill{height:100%;background:linear-gradient(90deg, var(--coral), var(--amber));border-radius:5px;}
.room-bar .pct{width:38px;flex:none;text-align:right;font-size:.8rem;color:var(--ink-muted);font-weight:600;}

.ask-dock{position:fixed;left:0;right:0;bottom:0;z-index:20;
  padding:0 clamp(.9rem,3vw,2rem) calc(.9rem + env(safe-area-inset-bottom));
  display:flex;flex-direction:column;align-items:center;gap:.6rem;pointer-events:none;}
.ask-bar{pointer-events:auto;position:relative;width:100%;max-width:640px;display:flex;align-items:center;gap:.7rem;
  background:rgba(30,28,34,.55);border-radius:100px;padding:.7rem .65rem .7rem 1.25rem;
  border:1px solid rgba(255,255,255,.14);
  backdrop-filter:blur(24px) saturate(180%);-webkit-backdrop-filter:blur(24px) saturate(180%);
  box-shadow:0 8px 30px rgba(0,0,0,.35);isolation:isolate;overflow:hidden;}
.ask-glow{position:absolute;inset:-60%;z-index:-1;pointer-events:none;filter:blur(30px);opacity:.55;
  background:
    radial-gradient(circle at 15% 30%, var(--coral) 0%, transparent 55%),
    radial-gradient(circle at 85% 20%, var(--amber) 0%, transparent 55%),
    radial-gradient(circle at 30% 85%, #6ee7ff 0%, transparent 55%),
    radial-gradient(circle at 80% 80%, var(--pink, #ff6bd6) 0%, transparent 55%);}
.ask-bar input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:#fff;
  font-family:var(--font-body);font-size:1rem;padding:.4rem 0;}
.ask-bar input::placeholder{color:rgba(255,255,255,.55);}
.ask-icon{color:rgba(255,255,255,.75);display:flex;flex:none;}
.ask-icon svg{width:19px;height:19px;}
.ask-send{flex:none;width:38px;height:38px;border-radius:50%;border:none;background:transparent;color:rgba(255,255,255,.85);
  display:flex;align-items:center;justify-content:center;cursor:pointer;}
.ask-send:disabled{opacity:.4;cursor:default;}
.ask-send svg{width:19px;height:19px;}
.ask-send.recording{background:var(--coral);color:#fff;animation:micPulse 1.4s ease-in-out infinite;}
@keyframes micPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,90,95,.55);}50%{box-shadow:0 0 0 8px rgba(255,90,95,0);}}
.ask-card{pointer-events:auto;width:100%;max-width:640px;background:var(--surface);border-radius:20px;
  padding:1.1rem 1.3rem;box-shadow:var(--shadow-lift);position:relative;max-height:40vh;overflow-y:auto;
  animation:riseIn .3s cubic-bezier(.2,.8,.2,1) both;}
.ask-close{position:absolute;top:.7rem;right:.7rem;width:26px;height:26px;border-radius:50%;border:none;
  background:var(--surface-soft);color:var(--ink-muted);display:flex;align-items:center;justify-content:center;cursor:pointer;}
.ask-close svg{width:13px;height:13px;}
.ask-q{font-family:var(--font-display);font-weight:700;font-size:.92rem;color:var(--ink);margin:0 1.6rem .5rem 0;}
.ask-a{font-size:.92rem;color:var(--ink-muted);line-height:1.55;margin:0;white-space:pre-wrap;}
.ask-a b{color:var(--ink);font-weight:700;}
.ask-loading{font-style:italic;}
`;
